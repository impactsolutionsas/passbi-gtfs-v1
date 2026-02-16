# Routing Cache - Installation et Configuration

## Tables SQL

Exécuter le fichier `04_routing_cache.sql` pour créer les tables nécessaires :

- `route_cache` : Cache des réponses avec TTL
- `route_usage_stats` : Statistiques d'usage pour l'apprentissage
- `route_locks` : Mutex pour requêtes concurrentes

## Dépendances npm

Le service de nettoyage automatique nécessite `@nestjs/schedule` :

```bash
npm install @nestjs/schedule
```

## Configuration

Le module `ScheduleModule` doit être importé dans `RoutingModule` (déjà fait).

Le service de nettoyage s'exécute automatiquement toutes les heures pour :
- Supprimer les entrées de cache expirées
- Supprimer les locks expirés
- Nettoyer les statistiques d'usage anciennes (>90 jours)

