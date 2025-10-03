# 🚌 PassBI GTFS v1

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## Description

Backend NestJS pour calculateur d'itinéraire multimodal utilisant données GTFS statiques multi-agences avec support VTC et regroupement intelligent des étapes.

**Stack:** NestJS 10 + Prisma + PostgreSQL/PostGIS + A* time-dependent + VTC Integration

### 🎯 Fonctionnalités

- **Import GTFS multi-agences** (agency, stops, routes, trips, stop_times, calendar, shapes, fares)
- **API REST pour recherche d'itinéraires** avec algorithmes BFS/A* optimisés
- **Support PostGIS** pour géolocalisation et calculs de distance
- **Trajets multimodaux** avec correspondances intelligentes
- **Trajets directs** avec un seul mode de transport
- **Intégration VTC** avec calcul de tarifs et alternatives
- **Regroupement des étapes** par route_id pour une vue simplifiée
- **Comptage des étapes** pour une expérience utilisateur optimale
- **Multi-tenant** via agency_id

## 🚀 Setup rapide

### 1. Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env
```

### 2. Configuration base de données

Éditez `.env` avec vos paramètres PostgreSQL/PostGIS :

```env
DATABASE_URL="postgresql://username:password@localhost:5432/passbi_gtfs"
```

### 3. Génération Prisma

```bash
# Générer le client Prisma
npm run prisma:gen

# Créer les migrations (quand le schéma sera prêt)
npm run prisma:migrate
```

### 4. Démarrage

```bash
# Mode développement
npm run start:dev

# L'API sera disponible sur http://localhost:3000
```

### 5. Workflow complet

```bash
# 1. Importer un feed GTFS
curl -X POST http://localhost:3000/gtfs/import \
  -H 'Content-Type: application/json' \
  -d '{"dirPath":"./fixtures/gtfs_ddd","agencyId":"DDD"}'

# 2. Construire le graphe multimodal
curl -X POST http://localhost:3000/gtfs/build-graph

# 3. Rechercher un itinéraire multimodal
curl -X POST http://localhost:3000/route \
  -H 'Content-Type: application/json' \
  -d '{"fromLat":14.6937,"fromLon":-17.4441,"toLat":14.7210,"toLon":-17.4540}'

# 4. Rechercher un trajet direct
curl -X POST http://localhost:3000/route/direct \
  -H 'Content-Type: application/json' \
  -d '{"fromLat":14.6937,"fromLon":-17.4441,"toLat":14.6940,"toLon":-17.4445}'

# 5. Lister les agences disponibles
curl -X GET http://localhost:3000/agencies

# 6. Gérer les configurations VTC
curl -X GET http://localhost:3000/vtc/configs
curl -X POST http://localhost:3000/vtc/configs \
  -H 'Content-Type: application/json' \
  -d '{"base_cost_cfa":1500,"cost_per_km_cfa":600,"avg_speed_ms":8.5,"name":"Yango","logo_url":"https://example.com/logo.png"}'
```

## 📋 Scripts disponibles

```bash
# Développement
npm run start:dev          # Démarrage avec watch
npm run start:debug        # Démarrage en mode debug

# Base de données
npm run prisma:gen         # Générer le client Prisma
npm run prisma:studio      # Interface graphique Prisma
npm run prisma:migrate     # Créer une migration
npm run prisma:deploy      # Appliquer les migrations

# Tests
npm run test              # Tests unitaires
npm run test:e2e          # Tests end-to-end
npm run test:cov          # Couverture de tests
```

## 🗂️ Structure du projet

```
src/
├── modules/
│   ├── gtfs/           # Import et gestion GTFS multi-agences
│   ├── gtfs-graph/     # Construction du graphe multimodal
│   ├── routing/        # Algorithmes BFS/A* et recherche d'itinéraires
│   ├── admin/          # Administration (reset DB)
│   ├── agencies/       # Gestion des agences et routes
│   └── vtc/            # Intégration VTC et calcul de tarifs
├── common/
│   └── prisma.service.ts  # Service Prisma partagé
└── main.ts             # Point d'entrée
```

## 🔌 API Endpoints

### GTFS Management
- `POST /gtfs/import` - Importer un feed GTFS
- `GET /gtfs/agencies` - Lister les agences
- `POST /gtfs/build-graph` - Construire le graphe multimodal

### Routing
- `POST /route` - Recherche d'itinéraire multimodal (avec alternatives VTC)
- `POST /route/direct` - Recherche de trajet direct (un seul mode)

### Administration
- `POST /admin/reset` - Réinitialiser la base de données
- `GET /agencies` - Liste hiérarchique des agences, routes et arrêts

### VTC Management
- `GET /vtc/configs` - Lister les configurations VTC
- `POST /vtc/configs` - Créer une configuration VTC
- `PUT /vtc/configs/:id` - Modifier une configuration VTC
- `DELETE /vtc/configs/:id` - Supprimer une configuration VTC

## 📊 Exemples de réponses

### Itinéraire multimodal
```json
{
  "from": {"lat": 14.6937, "lon": -17.4441},
  "to": {"lat": 14.721, "lon": -17.454},
  "itinerary": {
    "legs": [
      {
        "mode": "walk",
        "from_stop": {"stop_id": "D_771", "stop_name": "Face Eglise Temple Évangélique"},
        "to_stop": {"stop_id": "D_684", "stop_name": "Place De L'ObéLisque"}
      },
      {
        "mode": "bus",
        "agency_id": "DDD",
        "route_id": "L1",
        "route_short_name": "L1",
        "from_stop": {"stop_id": "D_684", "stop_name": "Place De L'ObéLisque"},
        "to_stop": {"stop_id": "D_123", "stop_name": "Arrêt Destination"}
      }
    ],
    "stepCount": 2
  },
  "direct": {
    "itinerary": {"legs": [...], "stepCount": 1},
    "alternatives": [...]
  },
  "alternatives": [
    {
      "mode": "vtc",
      "name": "Yango",
      "cost_cfa": 1465,
      "est_duration_s": 643
    }
  ]
}
```

### Liste des agences
```json
{
  "agencies": [
    {
      "agency_id": "DDD",
      "agency_name": "Dakar Dem Dikk",
      "routes": [
        {
          "route_id": "L1",
          "route_short_name": "L1",
          "route_long_name": "Ligne 1",
          "route_type": 3,
          "stops": [
            {
              "stop_id": "D_771",
              "stop_name": "Face Eglise Temple Évangélique",
              "stop_lat": 14.692267,
              "stop_lon": -17.447672
            }
          ]
        }
      ]
    }
  ]
}
```

## 🔧 Configuration

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL/PostGIS | - |
| `PORT` | Port de l'API | 3000 |
| `NODE_ENV` | Environnement | development |
| `GTFS_DATA_PATH` | Chemin des données GTFS | ./data/gtfs |

### Base de données

Le projet utilise PostgreSQL avec l'extension PostGIS pour la géolocalisation.

```sql
-- Activer PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
```

## 📚 Ressources

- [Documentation NestJS](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [GTFS Specification](https://gtfs.org/schedule/reference/)
- [PostGIS Documentation](https://postgis.net/documentation/)

## 📄 License

MIT
