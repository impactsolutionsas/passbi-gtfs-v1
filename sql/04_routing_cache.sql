-- ============================================================
-- 04_routing_cache.sql
-- Tables de support pour le cache et l'apprentissage par l'usage
-- ============================================================

-- Suppression des tables si elles existent (pour réexécution propre)
DROP TABLE IF EXISTS route_locks CASCADE;
DROP TABLE IF EXISTS route_usage_stats CASCADE;
DROP TABLE IF EXISTS route_cache CASCADE;

-- route_cache : cache des réponses avec TTL
CREATE TABLE route_cache (
  cache_key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX route_cache_expires_idx ON route_cache(expires_at);

-- route_usage_stats : statistiques d'usage pour l'IA légère
CREATE TABLE route_usage_stats (
  id SERIAL PRIMARY KEY,
  from_cell TEXT NOT NULL,
  to_cell TEXT NOT NULL,
  route_hash TEXT NOT NULL,
  route_type TEXT NOT NULL, -- 'direct' | 'simple' | 'fast'
  hits INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_cell, to_cell, route_hash, route_type)
);
CREATE INDEX route_usage_stats_cells_idx ON route_usage_stats(from_cell, to_cell);
CREATE INDEX route_usage_stats_last_used_idx ON route_usage_stats(last_used_at);

-- route_locks : mutex pour requêtes concurrentes
CREATE TABLE route_locks (
  cache_key TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- FIN
-- ============================================================

