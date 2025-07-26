#!/bin/bash

# Script para configurar secretos en Google Secret Manager
# Autor: Alexander - TeAlquilamos
# Fecha: 2025-01-11

set -e

PROJECT_ID="gen-lang-client-0318357688"
REGION="northamerica-northeast1"

echo "🔐 Configurando secretos para TeAlquilamos Bot..."
echo "📍 Proyecto: $PROJECT_ID"
echo "🌍 Región: $REGION"
echo ""

# Función para crear un secreto
create_secret() {
    local secret_name=$1
    local secret_description=$2
    
    echo "🔑 Creando secreto: $secret_name"
    
    # Verificar si el secreto ya existe
    if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
        echo "   ⚠️  El secreto $secret_name ya existe. Saltando..."
        return 0
    fi
    
    # Crear el secreto
    gcloud secrets create "$secret_name" \
        --project="$PROJECT_ID" \
        --labels="app=tealquilamos-bot,env=production" \
        --replication-policy="automatic" || {
        echo "   ❌ Error creando secreto $secret_name"
        return 1
    }
    
    echo "   ✅ Secreto $secret_name creado exitosamente"
}

# Función para agregar valor a un secreto
add_secret_value() {
    local secret_name=$1
    local secret_value=$2
    
    echo "📝 Agregando valor al secreto: $secret_name"
    
    if [ -z "$secret_value" ]; then
        echo "   ⚠️  Valor vacío para $secret_name. Saltando..."
        return 0
    fi
    
    echo -n "$secret_value" | gcloud secrets versions add "$secret_name" \
        --project="$PROJECT_ID" \
        --data-file=- || {
        echo "   ❌ Error agregando valor al secreto $secret_name"
        return 1
    }
    
    echo "   ✅ Valor agregado al secreto $secret_name"
}

# Crear todos los secretos necesarios
echo "📦 Creando secretos..."
create_secret "OPENAI_API_KEY" "Clave API de OpenAI para el asistente"
create_secret "ASSISTANT_ID" "ID del asistente de OpenAI"
create_secret "WHAPI_TOKEN" "Token de autenticación para WHAPI"
create_secret "WHAPI_API_URL" "URL base de la API de WHAPI"
create_secret "BEDS24_TOKEN" "Token de autenticación para Beds24"
create_secret "BEDS24_API_URL" "URL base de la API de Beds24"

echo ""
echo "✅ Todos los secretos han sido creados exitosamente!"
echo ""
echo "🔧 SIGUIENTE PASO:"
echo "   Ahora debes agregar los valores a cada secreto usando:"
echo "   gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""
echo "📚 EJEMPLO:"
echo "   echo 'tu_valor_secreto' | gcloud secrets versions add OPENAI_API_KEY --data-file=-"
echo ""
echo "🚀 Una vez configurados todos los valores, el bot debería funcionar en Cloud Run." 