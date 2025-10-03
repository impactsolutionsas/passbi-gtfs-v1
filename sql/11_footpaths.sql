-- sql/11_footpaths.sql
-- Paramètres
-- \set walk_radius 400
-- \set walk_speed 1.25

create table if not exists footpaths (
  from_stop_id text not null references stops(stop_id) on delete cascade,
  to_stop_id   text not null references stops(stop_id) on delete cascade,
  distance_m   int not null,
  walk_time_s  int not null,
  primary key (from_stop_id, to_stop_id)
);

-- refresh complet (selon taille; sinon stratégie incrémentale)
truncate table footpaths;

insert into footpaths(from_stop_id, to_stop_id, distance_m, walk_time_s)
select
  s1.stop_id,
  s2.stop_id,
  round(ST_DistanceSphere(s1.geom, s2.geom))::int as d,
  ceil(ST_DistanceSphere(s1.geom, s2.geom) / coalesce(:walk_speed::numeric,1.25))::int
from stops s1
join stops s2 on s1.stop_id <> s2.stop_id
where ST_DWithin(s1.geom, s2.geom, coalesce(:walk_radius::int, 400));

-- transferts intra-stop (même stop entre routes) → self-link utile pour RAPTOR
insert into footpaths(from_stop_id, to_stop_id, distance_m, walk_time_s)
select s.stop_id, s.stop_id, 0, 0
from stops s
on conflict do nothing;

create index if not exists footpaths_from_idx on footpaths(from_stop_id);
analyze footpaths;
