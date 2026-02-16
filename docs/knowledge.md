📚 PASSBI — KNOWLEDGE BASE MVP
Calculateur d’itinéraires multimodaux (Info Voyageurs)
🎯 OBJECTIF DU MVP

Construire un calculateur d’itinéraires multimodaux :

rapide (< 500 ms)

fiable

compréhensible par tous

sans inscription

sans paiement

capable de proposer 2 à 3 itinéraires pertinents

👉 Le MVP est centré usage, pas monétisation.

🧠 PRINCIPES FONDAMENTAUX (NON NÉGOCIABLES)

❌ Pas d’algorithmes lourds (Dijkstra temps-dépendant, GNN)

❌ Pas d’IA complexe ou externe

❌ Pas de sur-modélisation GTFS

✅ Heuristiques simples

✅ Cache agressif

✅ Apprentissage par l’usage (IA légère)

✅ Évolutif vers V2/V3

🧱 STACK TECHNIQUE (EXISTANTE)

Backend : NestJS

DB : PostgreSQL + PostGIS

Données : GTFS multi-agencies

Graphe :

node_route_stop

edges

Algo actuel :

BFS multi-sources / multi-cibles

Frontend (MVP) :

Ionic / Angular

Offline-first

1️⃣ APPROCHE GLOBALE DU CALCULATEUR
❌ À éviter

Chercher “le meilleur chemin absolu”

Explorer tout le graphe

Calculer les horaires exacts

Optimisation prématurée

✅ Approche retenue (MVP robuste)

Trouver rapidement des chemins “suffisamment bons”, puis les classer intelligemment.

2️⃣ ÉTAPES DU CALCUL D’ITINÉRAIRE
🧭 Étape 1 — Sélection des nœuds candidats

Trouver les k nœuds GTFS les plus proches :

départ : k = 5–10

arrivée : k = 5–10

Distance PostGIS (<->)

👉 Réduit drastiquement l’espace de recherche.

🧭 Étape 2 — BFS contraint

BFS limité

Profondeur max : 6 à 8

Nœuds visités max : 50k–100k

Anti-cycles

Stop dès qu’un chemin valide est trouvé

👉 On cherche des chemins, pas l’optimal théorique.

🧭 Étape 3 — Génération de variantes

À partir des chemins trouvés, construire jusqu’à 3 itinéraires distincts :

1️⃣ Itinéraire DIRECT

Même route_id si possible

0 correspondance

Priorité aux lignes continues

2️⃣ Itinéraire SIMPLE

≤ 1 correspondance

Moins de marche

Même agency si possible

3️⃣ Itinéraire RAPIDE

Accepte plusieurs correspondances

Favorise BRT / TER

Marche acceptée si gain de temps

3️⃣ HEURISTIQUES DE SCORING (CORE LOGIC)

Chaque chemin reçoit un score.

🧮 Score de base
score =
  (nb_correspondances × 10)
+ (distance_marche_m × 0.01)
+ (nb_changement_agency × 5)

🎯 Contraintes

max 2–3 agences

max 40 % du trajet à pied

rejet des chemins trop longs

4️⃣ IA LÉGÈRE — APPRENTISSAGE PAR L’USAGE (OBLIGATOIRE)
🧠 Philosophie

👉 Pas de ML, pas de modèles externes
👉 Statistiques + règles adaptatives

📊 Données collectées (anonymes)
route_usage_stats (
  id serial,
  from_cell text,
  to_cell text,
  route_hash text,
  route_type text, -- direct | simple | fast
  hits integer default 0,
  last_used_at timestamptz
);


from_cell, to_cell = coordonnées arrondies ou géohash

route_hash = hash du chemin

🧠 Impact IA sur le score
score_final = score_base - (log(hits + 1) × 5)


👉 Les itinéraires les plus utilisés :

remontent naturellement

deviennent prioritaires

sont mis en cache plus longtemps

5️⃣ CACHE DES REQUÊTES (CRITIQUE POUR LA PERF)
🎯 Pourquoi

Les mêmes trajets sont demandés des centaines de fois

Le cache réduit :

CPU

DB load

latence

🔑 Clé de cache
route:{from_lat_round}:{from_lon_round}:{to_lat_round}:{to_lon_round}


Arrondi à 4 décimales (~11 m)

🗃️ Stockage cache (MVP)
route_cache (
  cache_key text primary key,
  response jsonb,
  created_at timestamptz,
  expires_at timestamptz
);

⏱️ TTL recommandé

5 à 15 minutes

Invalidation si rebuild graphe

6️⃣ GESTION DES REQUÊTES CONCURRENTES (QUEUE LÉGÈRE)
🎯 Problème

Plusieurs utilisateurs demandent le même trajet en même temps.

✅ Solution MVP

Mutex logique par cache_key

Si un calcul est en cours :

les autres attendent

ou récupèrent la réponse cache dès dispo

👉 Implémentable :

en mémoire (mono-instance)

ou via table route_locks

7️⃣ PRÉCHAUFFAGE INTELLIGENT DU CACHE (IA UTILE)
🧠 Méthode

En tâche planifiée :

identifier les trajets les plus demandés

recalculer et stocker à l’avance

Exemples :

Maison → Travail

Université → Centre

Terminus → Quartier

👉 Réponses quasi instantanées aux heures de pointe.

8️⃣ STRUCTURE DE RÉPONSE API (STANDARD)
{
  "from": { "lat": 14.7, "lon": -17.4 },
  "to": { "lat": 14.6, "lon": -17.3 },
  "routes": [
    {
      "type": "direct",
      "score": 12,
      "duration_est_min": 50,
      "steps": [...]
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
  "cached": true
}

9️⃣ KPI TECH À SURVEILLER

Temps moyen /route

% cache hit

nœuds BFS visités

taux “no path found”

requêtes simultanées

🔮 CE QUI EST VOLONTAIREMENT EXCLU DU MVP

❌ Horaires temps réel
❌ Dijkstra complet
❌ GNN / ML avancé
❌ Personnalisation utilisateur
❌ Tarification

👉 Tout cela arrive en V2 / V3.

🏁 CONCLUSION STRATÉGIQUE

👉 Cette knowledge base permet :

d’améliorer fortement l’existant

d’avoir un moteur rapide et intelligent

de préparer la monétisation

de garder une dette technique faible