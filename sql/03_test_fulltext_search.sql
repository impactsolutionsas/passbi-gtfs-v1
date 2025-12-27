-- ============================================================
-- 03_test_fulltext_search.sql
-- Script de test pour la recherche full-text GTFS
-- ============================================================

-- ============================================================
-- 1. VÉRIFICATIONS PRÉLIMINAIRES
-- ============================================================

-- Vérifier que les colonnes search_vector existent
select 
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_name in ('stops', 'routes', 'agency', 'poi')
  and column_name = 'search_vector'
order by table_name;

-- Vérifier que les index GIN existent
select 
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where indexname like '%search_vector%'
order by tablename, indexname;

-- Vérifier que la vue search_places existe
select 
  table_name,
  view_definition
from information_schema.views
where table_name = 'search_places';

-- Vérifier que la fonction search_places existe
select 
  routine_name,
  routine_type,
  data_type
from information_schema.routines
where routine_name = 'search_places';

-- ============================================================
-- 2. VÉRIFICATION DES DONNÉES EXISTANTES
-- ============================================================

-- Compter les enregistrements par table
select 'stops' as table_name, count(*) as total, 
       count(search_vector) as with_search_vector
from stops
union all
select 'routes', count(*), count(search_vector)
from routes
union all
select 'agency', count(*), count(search_vector)
from agency
union all
select 'poi', count(*), count(search_vector)
from poi;

-- Afficher quelques exemples de stops avec search_vector
select 
  stop_id,
  stop_name,
  search_vector,
  length(stop_name) as name_length
from stops
where search_vector is not null
limit 5;

-- Afficher quelques exemples de routes avec search_vector
select 
  route_id,
  route_short_name,
  route_long_name,
  search_vector
from routes
where search_vector is not null
limit 5;

-- ============================================================
-- 3. TESTS DE RECHERCHE FULL-TEXT
-- ============================================================

-- Test 1: Recherche simple sur un nom d'arrêt
select * from search_places('pikine', 5);

-- Test 2: Recherche avec faute d'orthographe (tolérance)
select * from search_places('pikin', 5);

-- Test 3: Recherche insensible à la casse
select * from search_places('PIKINE', 5);

-- Test 4: Recherche partielle
select * from search_places('dakar', 10);

-- Test 5: Recherche sur une route
select * from search_places('ligne', 5);

-- Test 6: Recherche sur une agence
select * from search_places('transport', 5);

-- Test 7: Recherche avec limite par défaut
select * from search_places('station');

-- Test 8: Recherche trop courte (doit retourner vide)
select * from search_places('a', 10);

-- ============================================================
-- 4. TESTS DE PERFORMANCE
-- ============================================================

-- Test avec EXPLAIN pour voir l'utilisation des index
explain analyze
select * from search_places('pikine', 10);

-- Vérifier le plan d'exécution
explain (verbose, buffers)
select * from search_places('dakar', 10);

-- ============================================================
-- 5. TESTS AVEC DONNÉES DE TEST (si nécessaire)
-- ============================================================

-- Insérer un POI de test
insert into poi (name, category, lat, lon)
values 
  ('Stade Léopold Sédar Senghor', 'stadium', 14.7167, -17.4672),
  ('Marché Sandaga', 'market', 14.6914, -17.4472),
  ('Hôpital Principal', 'hospital', 14.7067, -17.4567)
on conflict do nothing;

-- Rechercher les POI
select * from search_places('stade', 5);
select * from search_places('marché', 5);
select * from search_places('hopital', 5); -- avec faute

-- ============================================================
-- 6. ANALYSE DE LA PERTINENCE
-- ============================================================

-- Comparer les résultats avec différents termes
select 
  'pikine' as query,
  count(*) as results,
  avg(rank) as avg_rank,
  min(rank) as min_rank,
  max(rank) as max_rank
from search_places('pikine', 100)
union all
select 
  'dakar',
  count(*),
  avg(rank),
  min(rank),
  max(rank)
from search_places('dakar', 100);

-- Afficher la distribution par type
select 
  type,
  count(*) as count,
  avg(rank) as avg_rank
from search_places('dakar', 50)
group by type
order by avg_rank desc;

-- ============================================================
-- 7. VÉRIFICATION DES TRIGGERS
-- ============================================================

-- Tester l'insertion d'un nouveau stop
insert into stops (
  stop_id, 
  agency_id, 
  stop_name, 
  stop_lat, 
  stop_lon
)
values (
  'TEST_STOP_001',
  (select agency_id from agency limit 1),
  'Test Arrêt Full-Text',
  14.7167,
  -17.4672
)
on conflict (stop_id) do update
set stop_name = excluded.stop_name;

-- Vérifier que search_vector a été généré automatiquement
select 
  stop_id,
  stop_name,
  search_vector
from stops
where stop_id = 'TEST_STOP_001';

-- Rechercher le nouveau stop
select * from search_places('test', 5);

-- Nettoyer (optionnel)
-- delete from stops where stop_id = 'TEST_STOP_001';

-- ============================================================
-- FIN DES TESTS
-- ============================================================

