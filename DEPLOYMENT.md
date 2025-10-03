# 🚀 Guide de déploiement Vercel

Ce guide détaille le déploiement de l'API PassBI GTFS sur Vercel.

## 📋 Prérequis

### Comptes et services
- [x] Compte Vercel (gratuit)
- [x] Base de données PostgreSQL/PostGIS (Supabase, Neon, PlanetScale, etc.)
- [x] Repository Git (GitHub, GitLab, Bitbucket)

### Base de données recommandée
- **Supabase** : PostgreSQL + PostGIS + interface web
- **Neon** : PostgreSQL serverless
- **PlanetScale** : MySQL (nécessite adaptation)
- **Railway** : PostgreSQL + PostGIS

## 🔧 Configuration initiale

### 1. Préparation du projet

```bash
# Cloner le repository
git clone https://github.com/votre-username/passbi-gtfs-v1.git
cd passbi-gtfs-v1

# Installer les dépendances
npm install

# Tester le build local
npm run build:vercel
```

### 2. Configuration de la base de données

#### Avec Supabase
```bash
# Créer un projet Supabase
# Activer l'extension PostGIS dans l'éditeur SQL
CREATE EXTENSION IF NOT EXISTS postgis;

# Récupérer l'URL de connexion
# Format: postgresql://postgres:[password]@[host]:5432/postgres
```

#### Avec Neon
```bash
# Créer un projet Neon
# L'extension PostGIS est disponible par défaut
# Récupérer l'URL de connexion
```

### 3. Variables d'environnement

Créez un fichier `.env.local` pour les tests :

```env
DATABASE_URL="postgresql://username:password@host:5432/database"
NODE_ENV="development"
PORT="3000"
GTFS_DATA_PATH="./data/gtfs"
```

## 🚀 Déploiement Vercel

### Option 1 : Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter à Vercel
vercel login

# Premier déploiement (développement)
vercel

# Déploiement en production
vercel --prod
```

### Option 2 : Via GitHub (recommandé)

1. **Connecter le repository** à Vercel
2. **Configurer les variables d'environnement** dans le dashboard
3. **Déployer automatiquement** à chaque push

### Variables d'environnement Vercel

Dans le dashboard Vercel → Settings → Environment Variables :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `DATABASE_URL` | `postgresql://...` | URL de la base de données |
| `NODE_ENV` | `production` | Environnement de production |
| `PORT` | `3000` | Port de l'application |
| `GTFS_DATA_PATH` | `./data/gtfs` | Chemin des données GTFS |

## 🗄️ Configuration de la base de données

### 1. Appliquer le schéma Prisma

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Ou créer la première migration
npx prisma migrate dev --name init
```

### 2. Vérifier la connexion

```bash
# Tester la connexion
npx prisma db push

# Ouvrir Prisma Studio
npx prisma studio
```

## 📊 Import des données GTFS

### 1. Préparer les données

Les données GTFS doivent être hébergées sur un service externe (AWS S3, Google Cloud Storage, etc.) car Vercel a des limitations de taille.

### 2. Import via API

```bash
# URL de votre API déployée
API_URL="https://votre-app.vercel.app"

# Importer un feed GTFS
curl -X POST $API_URL/gtfs/import \
  -H 'Content-Type: application/json' \
  -d '{
    "dirPath": "https://votre-storage.com/gtfs-data/",
    "agencyId": "DDD"
  }'

# Construire le graphe
curl -X POST $API_URL/gtfs/build-graph

# Vérifier les agences
curl -X GET $API_URL/agencies
```

### 3. Test de l'API

```bash
# Tester la recherche d'itinéraires
curl -X POST $API_URL/route \
  -H 'Content-Type: application/json' \
  -d '{
    "fromLat": 14.6937,
    "fromLon": -17.4441,
    "toLat": 14.7210,
    "toLon": -17.4540
  }'
```

## ⚠️ Limitations et considérations

### Limitations Vercel
- **Taille maximale** : 50MB par fonction
- **Timeout** : 30 secondes maximum par requête
- **Mémoire** : Limite de mémoire pour les gros imports
- **Fichiers statiques** : Pas de stockage persistant

### Optimisations recommandées
- **Données GTFS** : Héberger sur un service de stockage externe
- **Cache** : Utiliser Redis ou un cache externe
- **CDN** : Utiliser Vercel Edge Functions pour les requêtes fréquentes
- **Base de données** : Utiliser un pool de connexions

### Alternatives pour la production
- **Railway** : Meilleur pour les applications avec base de données
- **Render** : Support complet PostgreSQL/PostGIS
- **DigitalOcean App Platform** : Plus de contrôle sur l'infrastructure
- **AWS Lambda** : Pour les déploiements serverless avancés

## 🔍 Monitoring et debugging

### Logs Vercel
```bash
# Voir les logs en temps réel
vercel logs

# Logs d'une fonction spécifique
vercel logs --function=api
```

### Métriques importantes
- **Temps de réponse** : < 5 secondes pour les requêtes de routage
- **Mémoire utilisée** : < 1GB par fonction
- **Erreurs** : Monitoring des erreurs 500
- **Base de données** : Connexions et requêtes

### Debugging
```bash
# Tester localement avec Vercel
vercel dev

# Tester la production localement
vercel --prod
```

## 🚨 Dépannage

### Erreurs courantes

#### 1. Timeout des fonctions
```bash
# Solution : Optimiser les requêtes SQL
# Utiliser des index de performance
# Limiter la taille des résultats
```

#### 2. Erreurs de connexion à la base de données
```bash
# Vérifier DATABASE_URL
# Tester la connexion
npx prisma db push
```

#### 3. Erreurs de build
```bash
# Vérifier les dépendances
npm install

# Nettoyer le cache
rm -rf node_modules package-lock.json
npm install
```

### Support
- **Documentation Vercel** : https://vercel.com/docs
- **Documentation Prisma** : https://www.prisma.io/docs
- **Issues GitHub** : Créer une issue pour les problèmes

## 📈 Optimisations avancées

### 1. Edge Functions
```javascript
// api/route.js - Edge Function pour les requêtes rapides
export default function handler(req, res) {
  // Logique optimisée pour les requêtes simples
}
```

### 2. Cache Redis
```javascript
// Utiliser Upstash Redis pour le cache
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})
```

### 3. CDN pour les données statiques
```bash
# Héberger les données GTFS sur un CDN
# Utiliser Vercel Edge Network
# Optimiser les requêtes géographiques
```

---

**Note** : Ce guide est optimisé pour Vercel, mais l'application peut être déployée sur d'autres plateformes avec des adaptations mineures.
