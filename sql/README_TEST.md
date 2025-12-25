# Guide de test de la recherche full-text GTFS

## 📋 Prérequis

1. **Exécuter le script SQL principal** :
   ```bash
   # Dans Supabase SQL Editor ou via psql
   psql $DATABASE_URL -f sql/02_fulltext_search.sql
   ```

2. **Vérifier que les données GTFS sont importées** :
   - Au moins quelques `stops`, `routes`, `agency` dans la base
   - Optionnel : quelques `poi` (points d'intérêt)

## 🧪 Méthodes de test

### Option 1 : Test SQL direct (Recommandé pour débuter)

Exécuter le script de test complet :
```bash
psql $DATABASE_URL -f sql/03_test_fulltext_search.sql
```

Ou tester manuellement dans Supabase SQL Editor :

```sql
-- Test simple
SELECT * FROM search_places('pikine', 10);

-- Test avec faute d'orthographe
SELECT * FROM search_places('pikin', 5);

-- Test insensible à la casse
SELECT * FROM search_places('PIKINE', 5);
```

### Option 2 : Test via API REST (NestJS)

1. **Démarrer le serveur NestJS** :
   ```bash
   npm run start:dev
   ```

2. **Tester l'endpoint de recherche** :
   ```bash
   # Recherche simple
   curl "http://localhost:3000/search/places?q=pikine&limit=10"
   
   # Recherche avec limite par défaut
   curl "http://localhost:3000/search/places?q=dakar"
   
   # Recherche avec faute
   curl "http://localhost:3000/search/places?q=pikin&limit=5"
   ```

3. **Exemple de réponse JSON** :
   ```json
   [
     {
       "id": "STOP_001",
       "label": "Pikine Gare Routière",
       "type": "stop",
       "lat": 14.7167,
       "lon": -17.4672,
       "rank": 0.123456
     },
     {
       "id": "ROUTE_123",
       "label": "Ligne 1 - Pikine Centre",
       "type": "route",
       "lat": null,
       "lon": null,
       "rank": 0.098765
     }
   ]
   ```

## ✅ Vérifications à effectuer

### 1. Vérifier les colonnes search_vector
```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('stops', 'routes', 'agency', 'poi')
  AND column_name = 'search_vector';
```

### 2. Vérifier les index GIN
```sql
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE indexname LIKE '%search_vector%';
```

### 3. Vérifier que les données existantes ont été indexées
```sql
SELECT 
  'stops' as table_name,
  COUNT(*) as total,
  COUNT(search_vector) as indexed
FROM stops
UNION ALL
SELECT 'routes', COUNT(*), COUNT(search_vector) FROM routes
UNION ALL
SELECT 'agency', COUNT(*), COUNT(search_vector) FROM agency
UNION ALL
SELECT 'poi', COUNT(*), COUNT(search_vector) FROM poi;
```

### 4. Tester les triggers
```sql
-- Insérer un nouveau stop
INSERT INTO stops (stop_id, agency_id, stop_name, stop_lat, stop_lon)
VALUES ('TEST_001', (SELECT agency_id FROM agency LIMIT 1), 'Test Arrêt', 14.7167, -17.4672);

-- Vérifier que search_vector a été généré automatiquement
SELECT stop_id, stop_name, search_vector 
FROM stops 
WHERE stop_id = 'TEST_001';

-- Rechercher le nouveau stop
SELECT * FROM search_places('test', 5);
```

## 🐛 Dépannage

### Problème : Aucun résultat retourné

1. **Vérifier que les search_vector sont remplis** :
   ```sql
   SELECT COUNT(*) FROM stops WHERE search_vector IS NULL;
   ```
   Si > 0, exécuter la section 8 du script `02_fulltext_search.sql` pour initialiser.

2. **Vérifier que la requête est valide** :
   - Minimum 2 caractères requis
   - La fonction retourne vide si `plainto_tsquery` ne génère pas de requête valide

### Problème : Erreur "function search_places does not exist"

1. Vérifier que le script `02_fulltext_search.sql` a été exécuté complètement
2. Vérifier dans Supabase que la fonction existe :
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'search_places';
   ```

### Problème : Performance lente

1. Vérifier que les index GIN existent :
   ```sql
   EXPLAIN ANALYZE SELECT * FROM search_places('pikine', 10);
   ```
   Le plan d'exécution doit utiliser les index GIN.

2. Si les index n'existent pas, recréer :
   ```sql
   CREATE INDEX IF NOT EXISTS stops_search_vector_idx 
   ON stops USING gin(search_vector);
   ```

## 📊 Tests de performance

```sql
-- Analyser le plan d'exécution
EXPLAIN ANALYZE
SELECT * FROM search_places('dakar', 10);

-- Vérifier l'utilisation des index
EXPLAIN (VERBOSE, BUFFERS)
SELECT * FROM search_places('pikine', 20);
```

Le plan doit montrer :
- Utilisation de `Index Scan` avec les index GIN
- Temps d'exécution < 100ms pour la plupart des requêtes

## 🎯 Cas de test recommandés

1. **Recherche exacte** : `search_places('pikine', 10)`
2. **Recherche partielle** : `search_places('dakar', 10)`
3. **Avec faute d'orthographe** : `search_places('pikin', 5)`
4. **Insensible à la casse** : `search_places('PIKINE', 5)`
5. **Recherche trop courte** : `search_places('a', 10)` → doit retourner vide
6. **Recherche sur routes** : `search_places('ligne', 10)`
7. **Recherche sur agences** : `search_places('transport', 5)`
8. **Recherche sur POI** : `search_places('stade', 5)`

