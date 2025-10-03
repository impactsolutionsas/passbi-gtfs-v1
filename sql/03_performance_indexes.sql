-- Index pour améliorer les performances du routing
-- À exécuter après la construction du graphe

-- Index sur edges pour les requêtes BFS
CREATE INDEX IF NOT EXISTS edges_from_idx ON edges(from_node);
CREATE INDEX IF NOT EXISTS edges_to_idx ON edges(to_node);

-- Index sur node_route_stop pour les jointures
CREATE INDEX IF NOT EXISTS nrs_stop_idx ON node_route_stop(stop_id);

-- Index sur stops pour les recherches de noms (optionnel)
CREATE INDEX IF NOT EXISTS stops_name_idx ON stops USING gin (to_tsvector('simple', stop_name));

-- Index composite pour les requêtes de routing
CREATE INDEX IF NOT EXISTS edges_from_to_idx ON edges(from_node, to_node);

-- Index sur routes pour les jointures
CREATE INDEX IF NOT EXISTS routes_agency_idx ON routes(agency_id);

-- Index sur agency pour les jointures
CREATE INDEX IF NOT EXISTS agency_id_idx ON agency(agency_id);
