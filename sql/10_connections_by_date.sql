-- sql/10_connections_by_date.sql
-- Matérialise les "connections" (segments consécutifs de trip) ACTIVÉS pour une date donnée
-- Paramètre : :qdate (date)

-- 1) services actifs le jour qdate
with params as (
  select to_date(:qdate, 'YYYY-MM-DD')::date as qd,
         extract(dow from to_date(:qdate,'YYYY-MM-DD'))::int as dow -- 0=dimanche
),
svc_base as (
  select c.service_id
  from calendar c, params p
  where p.qd between c.start_date and c.end_date
    and (
      (p.dow=0 and c.sunday=1) or (p.dow=1 and c.monday=1) or (p.dow=2 and c.tuesday=1) or
      (p.dow=3 and c.wednesday=1) or (p.dow=4 and c.thursday=1) or (p.dow=5 and c.friday=1) or
      (p.dow=6 and c.saturday=1)
    )
),
svc_delta as (
  select cd.service_id,
         case when cd.exception_type=1 then true when cd.exception_type=2 then false end as active
  from calendar_dates cd, params p
  where cd.date = p.qd
),
services as (
  -- base ON + delta overrides
  select service_id from svc_base
  where service_id not in (select service_id from svc_delta where active=false)
  union
  select service_id from svc_delta where active=true
),
ordered as (
  select
    st.trip_id,
    st.stop_id,
    st.stop_sequence,
    t.route_id,
    r.agency_id,
    r.route_short_name,
    r.route_long_name,
    r.route_type
  from stop_times st
  join trips t on t.trip_id = st.trip_id
  join routes r on r.route_id = t.route_id
  where t.service_id in (select service_id from services)
),
pairs as (
  select
    a.trip_id, a.route_id, a.agency_id, a.route_short_name, a.route_long_name, a.route_type,
    a.stop_id as from_stop_id,
    b.stop_id as to_stop_id,
    a.stop_sequence as from_seq,
    b.stop_sequence as to_seq
  from ordered a
  join ordered b on a.trip_id=b.trip_id and b.stop_sequence=a.stop_sequence+1
)
-- table de destination (partionnable par date au besoin)
create table if not exists connections (
  qdate date not null,
  trip_id text not null,
  route_id text not null,
  agency_id text not null,
  route_short_name text,
  route_long_name text,
  route_type int not null,
  from_stop_id text not null,
  to_stop_id text not null,
  from_seq int not null,
  to_seq int not null
);
create index if not exists connections_qdate_from_idx on connections(qdate, from_stop_id);
create index if not exists connections_qdate_route_idx on connections(qdate, route_id);

-- nettoyer la date
delete from connections where qdate = to_date(:qdate,'YYYY-MM-DD');

-- insérer
insert into connections(qdate, trip_id, route_id, agency_id, route_short_name, route_long_name, route_type, from_stop_id, to_stop_id, from_seq, to_seq)
select to_date(:qdate,'YYYY-MM-DD') as qdate, *
from pairs;

analyze connections;
