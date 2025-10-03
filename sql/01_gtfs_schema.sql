-- ============================================================
-- 01_gtfs_schema.sql
-- Schéma GTFS complet + dérivés routing (Postgres/Supabase)
-- ============================================================

-- Extensions
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ============================================================
-- GTFS CORE
-- ============================================================

-- AGENCY
create table if not exists agency (
  agency_id text primary key,
  agency_name text not null,
  agency_url text,
  agency_timezone text not null,
  agency_lang text,
  agency_phone text,
  agency_email text
);

-- STOPS
create table if not exists stops (
  stop_id text primary key,
  agency_id text not null references agency(agency_id) on delete cascade,
  stop_code text,
  stop_name text not null,
  stop_desc text,
  stop_lat double precision not null,
  stop_lon double precision not null,
  location_type int default 0,
  parent_station text,
  zone_id text,
  geom geometry(Point,4326)
);

-- Génération auto du geom
create or replace function set_stop_geom() returns trigger as $$
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.stop_lon, new.stop_lat), 4326);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stop_geom on stops;
create trigger trg_stop_geom
before insert or update on stops
for each row execute procedure set_stop_geom();

create index if not exists stops_geom_gix on stops using gist(geom);
create index if not exists stops_agency_idx on stops(agency_id);
-- Recherche plein-texte nom arrêt (utile pour "fromPlace/toPlace")
create index if not exists stops_name_fts_idx on stops using gin (to_tsvector('simple', stop_name));

-- ROUTES
create table if not exists routes (
  route_id text primary key,
  agency_id text not null references agency(agency_id) on delete cascade,
  route_short_name text,
  route_long_name text,
  route_type int not null,  -- 0=tram/BRT, 2=rail(TER), 3=bus, etc.
  route_color text,
  route_text_color text
);
create index if not exists routes_agency_idx on routes(agency_id);

-- TRIPS
create table if not exists trips (
  trip_id text primary key,
  route_id text not null references routes(route_id) on delete cascade,
  service_id text not null,
  trip_headsign text,
  direction_id int,
  shape_id text
);
create index if not exists trips_route_idx on trips(route_id);
create index if not exists trips_service_idx on trips(service_id);

-- STOP_TIMES (horaires au format interval)
create table if not exists stop_times (
  trip_id text not null references trips(trip_id) on delete cascade,
  arrival_time interval,
  departure_time interval,
  stop_id text not null references stops(stop_id),
  stop_sequence int not null,
  pickup_type int default 0,
  drop_off_type int default 0,
  timepoint int,
  primary key (trip_id, stop_sequence)
);
create index if not exists stop_times_trip_seq_idx on stop_times(trip_id, stop_sequence);
create index if not exists stop_times_stop_idx on stop_times(stop_id);
create index if not exists stop_times_dep_idx on stop_times(departure_time);

-- CALENDAR
create table if not exists calendar (
  service_id text primary key,
  monday int not null,
  tuesday int not null,
  wednesday int not null,
  thursday int not null,
  friday int not null,
  saturday int not null,
  sunday int not null,
  start_date date not null,
  end_date date not null
);

-- CALENDAR_DATES
create table if not exists calendar_dates (
  service_id text not null,
  date date not null,
  exception_type int not null, -- 1=added, 2=removed
  primary key (service_id, date)
);

-- SHAPES (optionnel)
create table if not exists shapes (
  shape_id text not null,
  shape_pt_lat double precision not null,
  shape_pt_lon double precision not null,
  shape_pt_sequence int not null,
  shape_dist_traveled double precision,
  primary key (shape_id, shape_pt_sequence)
);
create index if not exists shapes_id_idx on shapes(shape_id);

-- FARES v1 (optionnel)
create table if not exists fare_attributes (
  fare_id text primary key,
  price numeric,
  currency_type text,
  payment_method int,
  transfers int,
  agency_id text references agency(agency_id) on delete cascade
);

create table if not exists fare_rules (
  fare_id text references fare_attributes(fare_id) on delete cascade,
  route_id text references routes(route_id) on delete cascade,
  origin_id text,
  destination_id text,
  contains_id text
);

-- ============================================================
-- DÉRIVÉS POUR LE ROUTING
-- ============================================================

-- Enum transport
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transport_mode') then
    create type transport_mode as enum ('walk','bus','rail','brt','vtc');
  end if;
end$$;

-- Nœuds route-stop (stop × route)
create table if not exists node_route_stop (
  id bigserial primary key,
  stop_id text not null references stops(stop_id),
  route_id text references routes(route_id),
  geom geometry(Point,4326) not null
);
create index if not exists nrs_stop_idx on node_route_stop(stop_id);
create index if not exists nrs_route_idx on node_route_stop(route_id);
create index if not exists nrs_geom_gix on node_route_stop using gist(geom);
create index if not exists nrs_stop_route_idx on node_route_stop(stop_id, route_id);

-- Arêtes multimodales
create table if not exists edges (
  id bigserial primary key,
  from_node bigint not null references node_route_stop(id) on delete cascade,
  to_node bigint not null references node_route_stop(id) on delete cascade,
  mode transport_mode not null,
  distance_m integer,
  travel_time_s integer,
  wait_time_s integer default 0,
  transfer_penalty_s integer default 0,
  monetary_cost_cfa integer default 0,
  line_trip_id text,
  route_id text,
  service_id text,
  dep_time_s int,
  arr_time_s int
);
create index if not exists edges_from_idx on edges(from_node);
create index if not exists edges_to_idx on edges(to_node);
create index if not exists edges_time_idx on edges(dep_time_s, arr_time_s);

-- Config VTC (optionnel)
create table if not exists vtc_config (
  id serial primary key,
  base_cost_cfa int default 1000,
  cost_per_km_cfa int default 500,
  avg_speed_ms numeric default 7.0
);

-- ============================================================
-- FONCTIONS UTILES
-- ============================================================

-- HH:MM:SS -> seconds since midnight
create or replace function hhmmss_to_seconds(hhmmss text) returns int as $$
declare
  p text[];
begin
  if hhmmss is null then return null; end if;
  p := string_to_array(hhmmss, ':');
  if array_length(p,1) <> 3 then return null; end if;
  return (p[1]::int * 3600 + p[2]::int * 60 + p[3]::int);
exception when others then
  return null;
end;
$$ language plpgsql immutable;

-- ============================================================
-- FIN
-- ============================================================
