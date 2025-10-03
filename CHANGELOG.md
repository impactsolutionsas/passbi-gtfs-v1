# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-10

### 🎉 Ajouté

#### Core Features
- **Backend NestJS 10** avec architecture modulaire
- **Intégration Prisma** pour l'accès à la base de données PostgreSQL/PostGIS
- **Support GTFS multi-agences** avec import batch optimisé
- **Algorithmes de routage** BFS/A* optimisés pour la recherche d'itinéraires
- **Support PostGIS** pour les calculs géographiques et de distance

#### GTFS Management
- **Import GTFS complet** : agency, stops, routes, trips, stop_times, calendar, shapes, fares
- **Import batch optimisé** avec `UNNEST` pour de meilleures performances
- **Gestion multi-agences** avec propagation automatique de `agency_id`
- **Validation des données** avec filtrage des lignes invalides
- **Conversion automatique** des formats de temps (HH:MM:SS → secondes)
- **Géométrie PostGIS** automatique pour les arrêts

#### Graph Construction
- **Construction du graphe multimodal** avec `node_route_stop` et `edges`
- **Création d'arêtes de transit** basées sur les `stop_times`
- **Création d'arêtes de marche** pour les correspondances et arrêts proches
- **Index de performance** pour optimiser les requêtes de routage
- **Vue matérialisée** pour les prochains départs

#### Routing Engine
- **Recherche d'itinéraires multimodaux** avec correspondances intelligentes
- **Recherche de trajets directs** avec un seul mode de transport
- **Algorithme BFS multi-source/multi-target** optimisé
- **Enrichissement des itinéraires** avec détails des arrêts, routes et agences
- **Regroupement intelligent des étapes** par `route_id`
- **Comptage automatique des étapes** pour une expérience utilisateur optimale

#### VTC Integration
- **Module VTC complet** avec CRUD des configurations
- **Calcul automatique des tarifs** basé sur la distance PostGIS
- **Alternatives VTC** intégrées dans les réponses de routage
- **Tri automatique** des options VTC du moins cher au plus cher
- **Support multi-VTC** avec différentes configurations

#### Administration
- **Reset de base de données** avec `TRUNCATE` optimisé
- **Gestion des agences** avec liste hiérarchique
- **API de gestion** pour les configurations VTC

#### API Endpoints
- `POST /gtfs/import` - Import de feeds GTFS
- `GET /gtfs/agencies` - Liste des agences
- `POST /gtfs/build-graph` - Construction du graphe
- `POST /route` - Recherche d'itinéraire multimodal
- `POST /route/direct` - Recherche de trajet direct
- `POST /admin/reset` - Reset de la base de données
- `GET /agencies` - Liste hiérarchique des agences
- `GET /vtc/configs` - Liste des configurations VTC
- `POST /vtc/configs` - Création de configuration VTC
- `PUT /vtc/configs/:id` - Modification de configuration VTC
- `DELETE /vtc/configs/:id` - Suppression de configuration VTC

### 🔧 Technique

#### Architecture
- **Modules NestJS** : gtfs, gtfs-graph, routing, admin, agencies, vtc
- **Service Prisma partagé** pour la gestion du cycle de vie
- **DTOs avec validation** utilisant `class-validator`
- **Gestion d'erreurs robuste** avec logging détaillé

#### Performance
- **Import batch** avec `UNNEST` pour de meilleures performances
- **Requêtes SQL optimisées** avec index de performance
- **BFS level-by-level** pour réduire les requêtes à la base
- **Enrichissement en une seule requête** avec CTE et ordre préservé

#### Base de données
- **Schéma Prisma complet** avec support PostGIS
- **Types géométriques** avec `Unsupported("geometry")`
- **Index de performance** pour les requêtes de routage
- **Support des intervalles** avec `Unsupported("interval")`

### 🐛 Corrections

- **Gestion des dates** : Conversion correcte des formats de date GTFS
- **Validation des données** : Filtrage des lignes `calendar_dates` invalides
- **Gestion des erreurs** : Amélioration de la robustesse des imports
- **Types TypeScript** : Correction des types pour les retours de méthodes
- **Gestion des ports** : Résolution des conflits de ports

### 📚 Documentation

- **README complet** avec exemples d'utilisation
- **Configuration Cursor** avec règles de génération de code
- **Documentation GTFS** avec règles spécifiques
- **Exemples d'API** avec requêtes curl
- **Structure du projet** détaillée

### 🚀 Performance

- **Import GTFS** : ~10x plus rapide avec les imports batch
- **Construction du graphe** : Optimisé avec index de performance
- **Recherche d'itinéraires** : BFS optimisé avec requêtes batch
- **Enrichissement** : Une seule requête SQL pour tous les détails
- **Calculs VTC** : Utilisation de PostGIS pour la précision

### 🔒 Sécurité

- **Validation des entrées** avec DTOs et `class-validator`
- **Gestion des erreurs** sans exposition d'informations sensibles
- **Logging sécurisé** sans données confidentielles
- **Validation des chemins** pour éviter les injections de fichiers

---

## [0.1.0] - 2025-01-09

### 🎉 Ajouté

- **Initialisation du projet** NestJS 10
- **Configuration Prisma** avec PostgreSQL/PostGIS
- **Structure de base** avec modules et services
- **Configuration Cursor** pour la génération de code
- **Documentation initiale** et README

---

*Ce changelog suit le format [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et [Semantic Versioning](https://semver.org/).*
