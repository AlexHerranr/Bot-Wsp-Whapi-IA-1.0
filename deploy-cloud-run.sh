#!/bin/bash

# Script de despliegue para Google Cloud Run
# Autor: Alexander - TeAlquilamos Bot

set -e  # Salir si hay errores

echo "🚀 Iniciando despliegue de TeAlquilamos Bot a Google Cloud Run..."

# Configuración
PROJECT_ID="gen-lang-client-0318357688"
SERVICE_NAME="bot-wsp-whapi-ia-1-0"
REGION="northamerica-south1"
IMAGE_NAME="bot-wsp-whapi-ia"
VERSION="1.0"

# Construir nombre completo de la imagen
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${IMAGE_NAME}-${VERSION}/${SERVICE_NAME}:latest"

echo "📦 Configuración del despliegue:"
echo "   Proyecto: ${PROJECT_ID}"
echo "   Servicio: ${SERVICE_NAME}"
echo "   Región: ${REGION}"
echo "   Imagen: ${IMAGE_URL}"
echo ""

# Verificar que gcloud esté instalado
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI no está instalado"
    echo "   Instala gcloud desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar que docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado"
    echo "   Instala Docker desde: https://docs.docker.com/get-docker/"
    exit 1
fi

# Verificar autenticación
echo "🔐 Verificando autenticación..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo "❌ Error: No estás autenticado con gcloud"
    echo "   Ejecuta: gcloud auth login"
    exit 1
fi

# Configurar proyecto
echo "⚙️  Configurando proyecto..."
gcloud config set project ${PROJECT_ID}

# Habilitar APIs necesarias
echo "🔧 Habilitando APIs necesarias..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Configurar Docker para usar gcloud como helper
echo "🐳 Configurando Docker..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Crear repositorio de Artifact Registry si no existe
echo "📦 Verificando repositorio de Artifact Registry..."
if ! gcloud artifacts repositories describe cloud-run-source-deploy --location=${REGION} &> /dev/null; then
    echo "   Creando repositorio..."
    gcloud artifacts repositories create cloud-run-source-deploy \
        --repository-format=docker \
        --location=${REGION} \
        --description="Repositorio para TeAlquilamos Bot"
fi

# Construir imagen Docker
echo "🏗️  Construyendo imagen Docker..."
docker build -t ${IMAGE_URL} .

# Subir imagen al registro
echo "⬆️  Subiendo imagen al registro..."
docker push ${IMAGE_URL}

# Desplegar a Cloud Run
echo "🚀 Desplegando a Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE_URL} \
    --platform=managed \
    --region=${REGION} \
    --allow-unauthenticated \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --timeout=300 \
    --set-env-vars="NODE_ENV=production,PORT=8080" \
    --execution-environment=gen2

# Obtener URL del servicio
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

echo ""
echo "✅ ¡Despliegue completado exitosamente!"
echo ""
echo "🌐 URL del servicio: ${SERVICE_URL}"
echo "📊 Monitoreo: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}"
echo "📋 Logs: https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22${SERVICE_NAME}%22"
echo ""
echo "🔧 Para configurar el webhook, usa esta URL:"
echo "   ${SERVICE_URL}/hook"
echo ""
echo "💡 Comandos útiles:"
echo "   Ver logs: gcloud run services logs read ${SERVICE_NAME} --region=${REGION}"
echo "   Ver tráfico: gcloud run services describe ${SERVICE_NAME} --region=${REGION}"
echo "" 