-- ============================================================
-- 02_fulltext_search.sql
-- Recherche full-text performante pour autocomplétion GTFS
-- Compatible Supabase PostgreSQL
-- Langue : français (tolérance aux fautes, insensible à la casse)
-- ============================================================

-- ============================================================
-- 1. CRÉATION DE LA TABLE POI (Points d'Intérêt)
-- ============================================================

create table if not exists poi (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  lat double precision not null,
  lon double precision not null,
  geom geometry(Point,4326),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index spatial pour POI
create index if not exists poi_geom_gix on poi using gist(geom);

-- Trigger pour générer automatiquement le geom POI
create or replace function set_poi_geom() returns trigger as $$
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.lon, new.lat), 4326);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_poi_geom on poi;
create trigger trg_poi_geom
before insert or update on poi
for each row execute procedure set_poi_geom();

-- ============================================================
-- 2. AJOUT DES COLONNES search_vector (tsvector)
-- ============================================================

-- Ajouter search_vector à stops
alter table stops 
add column if not exists search_vector tsvector;

-- Ajouter search_vector à routes
alter table routes 
add column if not exists search_vector tsvector;

-- Ajouter search_vector à agency
alter table agency 
add column if not exists search_vector tsvector;

-- Ajouter search_vector à poi
alter table poi 
add column if not exists search_vector tsvector;

-- ============================================================
-- 3. INDEX GIN POUR PERFORMANCE (configuration 'french')
-- ============================================================

-- Supprimer l'ancien index stops_name_fts_idx (simple) s'il existe
drop index if exists stops_name_fts_idx;

-- Index GIN pour stops
create index if not exists stops_search_vector_idx 
on stops using gin(search_vector);

-- Index GIN pour routes
create index if not exists routes_search_vector_idx 
on routes using gin(search_vector);

-- Index GIN pour agency
create index if not exists agency_search_vector_idx 
on agency using gin(search_vector);

-- Index GIN pour poi
create index if not exists poi_search_vector_idx 
on poi using gin(search_vector);

-- ============================================================
-- 4. FONCTION GÉNÉRIQUE POUR METTRE À JOUR search_vector
-- ============================================================

create or replace function update_search_vector() returns trigger as $$
declare
  search_text text;
begin
  -- Déterminer le texte à indexer selon la table
  if TG_TABLE_NAME = 'stops' then
    search_text := coalesce(new.stop_name, '');
  elsif TG_TABLE_NAME = 'routes' then
    -- Concaténer route_short_name et route_long_name
    search_text := coalesce(new.route_short_name || ' ', '') || 
                   coalesce(new.route_long_name, '');
  elsif TG_TABLE_NAME = 'agency' then
    search_text := coalesce(new.agency_name, '');
  elsif TG_TABLE_NAME = 'poi' then
    search_text := coalesce(new.name, '');
  else
    return new;
  end if;
  
  -- Générer le tsvector avec configuration 'french'
  new.search_vector := to_tsvector('french', search_text);
  
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 5. TRIGGERS AUTOMATIQUES POUR MAINTENIR search_vector
-- ============================================================

-- Trigger pour stops
drop trigger if exists trg_stops_search_vector on stops;
create trigger trg_stops_search_vector
before insert or update on stops
for each row execute procedure update_search_vector();

-- Trigger pour routes
drop trigger if exists trg_routes_search_vector on routes;
create trigger trg_routes_search_vector
before insert or update on routes
for each row execute procedure update_search_vector();

-- Trigger pour agency
drop trigger if exists trg_agency_search_vector on agency;
create trigger trg_agency_search_vector
before insert or update on agency
for each row execute procedure update_search_vector();

-- Trigger pour poi
drop trigger if exists trg_poi_search_vector on poi;
create trigger trg_poi_search_vector
before insert or update on poi
for each row execute procedure update_search_vector();

-- ============================================================
-- 6. VUE UNIFIÉE search_places
-- ============================================================

create or replace view search_places as
select 
  stop_id as id,
  stop_name as label,
  'stop' as type,
  stop_lat as lat,
  stop_lon as lon,
  1 as priority,
  search_vector
from stops
where search_vector is not null

union all

select 
  route_id as id,
  coalesce(route_short_name || ' - ', '') || coalesce(route_long_name, '') as label,
  'route' as type,
  null::double precision as lat,
  null::double precision as lon,
  2 as priority,
  search_vector
from routes
where search_vector is not null

union all

select 
  agency_id as id,
  agency_name as label,
  'agency' as type,
  null::double precision as lat,
  null::double precision as lon,
  3 as priority,
  search_vector
from agency
where search_vector is not null

union all

select 
  id::text as id,
  name as label,
  'poi' as type,
  lat,
  lon,
  4 as priority,
  search_vector
from poi
where search_vector is not null;

-- ============================================================
-- 7. FONCTION RPC search_places(query, limit)
-- ============================================================

create or replace function search_places(
  query_text text,
  result_limit int default 10
) returns table (
  id text,
  label text,
  type text,
  lat double precision,
  lon double precision,
  rank real
) 
language plpgsql
stable
as $$
declare
  ts_query tsquery;
begin
  -- Filtrer les requêtes trop courtes (< 2 caractères)
  if length(trim(query_text)) < 2 then
    return;
  end if;
  
  -- Convertir la requête en tsquery avec configuration 'french'
  -- plainto_tsquery permet la tolérance aux fautes et est insensible à la casse
  ts_query := plainto_tsquery('french', query_text);
  
  -- Si la requête ne génère pas de tsquery valide, retourner vide
  if ts_query is null then
    return;
  end if;
  
  -- Recherche avec tri par pertinence (ts_rank) puis par priority
  return query
  select 
    sp.id,
    sp.label,
    sp.type,
    sp.lat,
    sp.lon,
    ts_rank(sp.search_vector, ts_query) as rank
  from search_places sp
  where sp.search_vector @@ ts_query
  order by 
    ts_rank(sp.search_vector, ts_query) desc,
    sp.priority asc
  limit result_limit;
end;
$$;

-- ============================================================
-- 8. INITIALISATION DES DONNÉES EXISTANTES
-- ============================================================

-- Mettre à jour search_vector pour tous les stops existants
update stops 
set search_vector = to_tsvector('french', coalesce(stop_name, ''))
where search_vector is null;

-- Mettre à jour search_vector pour toutes les routes existantes
update routes 
set search_vector = to_tsvector('french', 
    coalesce(route_short_name || ' ', '') || 
    coalesce(route_long_name, ''))
where search_vector is null;

-- Mettre à jour search_vector pour toutes les agencies existantes
update agency 
set search_vector = to_tsvector('french', coalesce(agency_name, ''))
where search_vector is null;

-- Mettre à jour search_vector pour tous les poi existants (si la table existe déjà)
update poi 
set search_vector = to_tsvector('french', coalesce(name, ''))
where search_vector is null;

-- ============================================================
-- 9. COMMENTAIRES ET DOCUMENTATION
-- ============================================================

comment on view search_places is 
'Vue unifiée pour la recherche full-text sur stops, routes, agencies et poi. 
Priorités: stop (1) > route (2) > agency (3) > poi (4)';

comment on function search_places(text, int) is 
'Fonction RPC pour recherche full-text avec autocomplétion.
Paramètres:
- query_text: texte de recherche (minimum 2 caractères)
- result_limit: nombre maximum de résultats (défaut: 10)
Retourne les résultats triés par pertinence (ts_rank) puis par priorité.
Utilise plainto_tsquery avec configuration french pour tolérance aux fautes.';

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================

