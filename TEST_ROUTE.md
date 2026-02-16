# Test de l'endpoint /route

## Prérequis

1. ✅ Tables SQL créées (`sql/04_routing_cache.sql` exécuté)
2. ✅ `@nestjs/schedule` installé
3. ✅ Serveur démarré : `npm run start:dev`

## Format de la requête

```bash
POST http://localhost:3000/route
Content-Type: application/json

{
  "fromLat": 14.7167,
  "fromLon": -17.4677,
  "toLat": 14.6928,
  "toLon": -17.4467
}
```

## Format de la réponse attendu

```json
{
  "from": {
    "lat": 14.7167,
    "lon": -17.4677
  },
  "to": {
    "lat": 14.6928,
    "lon": -17.4467
  },
  "routes": [
    {
      "type": "direct",
      "score": 12,
      "duration_est_min": 50,
      "steps": [
        {
          "mode": "bus",
          "agency_id": "DDD",
          "route_id": "route_123",
          "route_short_name": "L1",
          "route_long_name": "Ligne 1",
          "from_stop": {
            "stop_id": "stop_1",
            "stop_name": "Arrêt A",
            "stop_lat": 14.7167,
            "stop_lon": -17.4677
          },
          "to_stop": {
            "stop_id": "stop_2",
            "stop_name": "Arrêt B",
            "stop_lat": 14.6928,
            "stop_lon": -17.4467
          }
        }
      ]
    },
    {
      "type": "simple",
      "score": 18,
      "duration_est_min": 45,
      "steps": [...]
    },
    {
      "type": "fast",
      "score": 25,
      "duration_est_min": 38,
      "steps": [...]
    }
  ],
  "cached": false
}
```

## Test avec curl

```bash
curl -X POST http://localhost:3000/route \
  -H "Content-Type: application/json" \
  -d '{
    "fromLat": 14.7167,
    "fromLon": -17.4677,
    "toLat": 14.6928,
    "toLon": -17.4467
  }' | jq '.'
```

## Test avec le script

```bash
./test-route.sh
```

## Vérifications

- ✅ La réponse contient `from` et `to`
- ✅ La réponse contient un tableau `routes` avec 1 à 3 itinéraires
- ✅ Chaque route a `type`, `score`, `duration_est_min`, et `steps`
- ✅ Le champ `cached` indique si la réponse vient du cache
- ✅ Les routes sont triées par score (meilleur score = plus bas)

## Cas d'erreur

Si aucun chemin n'est trouvé, la réponse sera :

```json
{
  "error": "No path found"
}
```

ou

```json
{
  "error": "No valid route found"
}
```

