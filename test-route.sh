#!/bin/bash

# Script de test pour l'endpoint /route
# Usage: ./test-route.sh

echo "🧪 Test de l'endpoint /route"
echo "================================"
echo ""

# Coordonnées de test (Dakar, Sénégal)

FROM_LAT=14.708831 
FROM_LON=-17.481380
TO_LAT=14.657795
TO_LON=-17.435378

echo "📍 Départ: ($FROM_LAT, $FROM_LON)"
echo "📍 Arrivée: ($TO_LAT, $TO_LON)"
echo ""

# Test de l'endpoint
echo "📡 Envoi de la requête..."
RESPONSE=$(curl -s -X POST http://localhost:3000/route \
  -H "Content-Type: application/json" \
  -d "{
    \"fromLat\": $FROM_LAT,
    \"fromLon\": $FROM_LON,
    \"toLat\": $TO_LAT,
    \"toLon\": $TO_LON
  }")

if [ $? -eq 0 ]; then
  echo "✅ Réponse reçue:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  
  echo ""
  echo "📊 Analyse de la réponse:"
  echo "$RESPONSE" | jq -r '.cached // "N/A" | "Cache: \(.)"' 2>/dev/null
  echo "$RESPONSE" | jq -r '.routes | length | "Nombre de routes: \(.)"' 2>/dev/null
  
  echo ""
  echo "🛣️  Routes trouvées:"
  echo "$RESPONSE" | jq -r '.routes[]? | "  - Type: \(.type), Score: \(.score), Durée: \(.duration_est_min) min"' 2>/dev/null
else
  echo "❌ Erreur lors de la requête"
  echo "Assurez-vous que le serveur est démarré: npm run start:dev"
fi

