-- ============================================================
-- 02_edges_build.sql
-- Construction du graphe (node_route_stop + edges)
-- - Transit time-dependent
-- - Walk (accès/egress + transferts même stop)
-- - Paramétrable
-- ============================================================

-- Paramètres intégrés (remplace les variables psql)
-- Defaults: walk_radius=500 (m), walk_speed=1.25 (m/s), transfer_penalty=120 (s)

-- Nettoyage
truncate table node_route_stop cascade;
truncate table edges cascade;

-- 1) Nœuds route-stop (arrêts réellement desservis)
insert into node_route_stop (stop_id, route_id, geom)
select distinct st.stop_id, t.route_id, s.geom
from stop_times st
join trips t on t.trip_id = st.trip_id
join stops s on s.stop_id = st.stop_id;

analyze node_route_stop;

-- 2) Arêtes TRANSIT (temps-dépendantes) depuis stop_times consécutifs
with ordered as (
  select
    st.trip_id,
    st.stop_id,
    st.stop_sequence,
    extract(epoch from st.departure_time)::int as dep_s,
    extract(epoch from st.arrival_time)::int   as arr_s,
    t.route_id,
    t.service_id,
    r.route_type
  from stop_times st
  join trips t on t.trip_id = st.trip_id
  join routes r on r.route_id = t.route_id
),
pairs as (
  select
    a.trip_id, a.route_id, a.service_id,
    a.stop_id as from_stop, b.stop_id as to_stop,
    a.dep_s as dep_time_s, b.arr_s as arr_time_s,
    a.route_type
  from ordered a
  join ordered b on a.trip_id=b.trip_id and b.stop_sequence=a.stop_sequence+1
  where b.arr_s > a.dep_s
)
insert into edges (from_node, to_node, mode, distance_m, travel_time_s, wait_time_s,
                   transfer_penalty_s, monetary_cost_cfa, line_trip_id, route_id,
                   service_id, dep_time_s, arr_time_s)
select
  n1.id, n2.id,
  case when p.route_type=2 then 'rail'::transport_mode
       when p.route_type=0 then 'brt'::transport_mode
       else 'bus'::transport_mode end,
  greatest(1, round(ST_DistanceSphere(s1.geom, s2.geom)))::int,
  greatest(1, p.arr_time_s - p.dep_time_s),
  0, 0, 0,
  p.trip_id, p.route_id, p.service_id,
  p.dep_time_s, p.arr_time_s
from pairs p
join stops s1 on s1.stop_id=p.from_stop
join stops s2 on s2.stop_id=p.to_stop
join node_route_stop n1 on n1.stop_id=s1.stop_id and n1.route_id=p.route_id
join node_route_stop n2 on n2.stop_id=s2.stop_id and n2.route_id=p.route_id;

-- Index clés pour la recherche (A*)
create index if not exists edges_from_dep_idx on edges(from_node, dep_time_s);
create index if not exists edges_to_idx on edges(to_node);
analyze edges;

-- 3) Arêtes WALK (transferts même stop)
-- a) correspondances intra-stop (intermodal)
insert into edges (from_node, to_node, mode, distance_m, travel_time_s, transfer_penalty_s)
select
  n1.id, n2.id, 'walk'::transport_mode,
  1,
  120,
  120
from node_route_stop n1
join node_route_stop n2 on n2.stop_id = n1.stop_id and n2.id <> n1.id
where n1.id < n2.id;

-- b) walk court rayon entre arrêts voisins (accès/egress)
-- Defaults: radius 500m, speed 1.25 m/s; use geography for meters
insert into edges (from_node, to_node, mode, distance_m, travel_time_s, transfer_penalty_s)
select
  n1.id, n2.id, 'walk'::transport_mode,
  round(ST_DistanceSphere(n1.geom, n2.geom))::int as d,
  ceil(ST_DistanceSphere(n1.geom, n2.geom) / 1.25)::int,
  0
from node_route_stop n1
join node_route_stop n2 on n1.id < n2.id
where ST_DWithin(n1.geom::geography, n2.geom::geography, 500);

-- 4) (Option) VTC - edges virtuels calculés côté service => table config seulement
insert into vtc_config default values
on conflict do nothing;

-- 5) (Option) Vue matérialisée pour accélérer les "prochains départs"
-- (Utilisée par un A* temps-dépendant si tu passes à v2+)
drop materialized view if exists mv_next_departures;
create materialized view mv_next_departures as
select from_node, dep_time_s, to_node, route_id, line_trip_id, arr_time_s,
       travel_time_s, wait_time_s, transfer_penalty_s, monetary_cost_cfa, mode, service_id
from edges
where dep_time_s is not null;

create index if not exists mv_next_departures_idx on mv_next_departures(from_node, dep_time_s);

-- refresh (non concurrent sur Supabase free)
refresh materialized view mv_next_departures;

-- ============================================================
-- FIN
-- ============================================================
