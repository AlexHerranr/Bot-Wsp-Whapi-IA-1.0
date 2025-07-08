#!/bin/bash

# Script de despliegue para Google Cloud Run
# Autor: Alexander - TeAlquilamos Bot

set -e  # Salir si hay errores

# Configuración
PROJECT_ID="gen-lang-client-0318357688"
REGION="northamerica-northeast1"
SERVICE_NAME="bot-wsp-whapi-ia"
IMAGE_NAME="bot-wsp-whapi-ia"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para mostrar errores y salir
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    exit 1
}

# Función para mostrar información
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Función para mostrar éxito
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Función para mostrar advertencias
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo -e "${GREEN}🚀 Iniciando despliegue optimizado a Cloud Run${NC}"

# 1. Verificar que estamos autenticados
info "Verificando autenticación..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    error_exit "No hay cuentas autenticadas. Ejecuta: gcloud auth login"
fi
success "Autenticación verificada"

# 2. Configurar proyecto
info "Configurando proyecto ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID} || error_exit "Error configurando proyecto"

# 3. Habilitar APIs necesarias
info "Habilitando APIs necesarias..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com || error_exit "Error habilitando APIs"

# 4. Crear secretos si no existen
info "Configurando secretos..."

# Función para crear secreto si no existe
create_secret_if_not_exists() {
    SECRET_NAME=$1
    SECRET_VALUE=$2
    
    if ! gcloud secrets describe ${SECRET_NAME} >/dev/null 2>&1; then
        info "Creando secreto ${SECRET_NAME}..."
        echo -n "${SECRET_VALUE}" | gcloud secrets create ${SECRET_NAME} \
            --data-file=- \
            --replication-policy="automatic" || error_exit "Error creando secreto ${SECRET_NAME}"
        success "Secreto ${SECRET_NAME} creado"
    else
        info "Secreto ${SECRET_NAME} ya existe"
    fi
}

# Solicitar valores si no están en el ambiente
if [ -z "$OPENAI_API_KEY" ]; then
    read -sp "Ingresa tu OPENAI_API_KEY: " OPENAI_API_KEY
    echo
fi

if [ -z "$WHAPI_TOKEN" ]; then
    read -sp "Ingresa tu WHAPI_TOKEN: " WHAPI_TOKEN
    echo
fi

if [ -z "$ASSISTANT_ID" ]; then
    read -p "Ingresa tu ASSISTANT_ID: " ASSISTANT_ID
fi

if [ -z "$WHAPI_API_URL" ]; then
    WHAPI_API_URL="https://gate.whapi.cloud/"
    info "Usando WHAPI_API_URL por defecto: ${WHAPI_API_URL}"
fi

# Validar que tenemos todos los valores necesarios
[ -z "$OPENAI_API_KEY" ] && error_exit "OPENAI_API_KEY es requerido"
[ -z "$WHAPI_TOKEN" ] && error_exit "WHAPI_TOKEN es requerido"
[ -z "$ASSISTANT_ID" ] && error_exit "ASSISTANT_ID es requerido"

# Crear los secretos
create_secret_if_not_exists "openai-api-key" "${OPENAI_API_KEY}"
create_secret_if_not_exists "whapi-token" "${WHAPI_TOKEN}"
create_secret_if_not_exists "assistant-id" "${ASSISTANT_ID}"

# 5. Configurar Docker para Artifact Registry
info "Configurando Docker para Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev || error_exit "Error configurando Docker"

# 6. Construir imagen
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S)"
info "Construyendo imagen Docker: ${IMAGE_URL}"
docker build -t ${IMAGE_URL} . || error_exit "Error construyendo imagen Docker"
success "Imagen construida exitosamente"

# 7. Subir imagen
info "Subiendo imagen a Artifact Registry..."
docker push ${IMAGE_URL} || error_exit "Error subiendo imagen"
success "Imagen subida exitosamente"

# 8. Desplegar a Cloud Run
info "Desplegando a Cloud Run..."
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
    --concurrency=80 \
    --cpu-throttling \
    --execution-environment=gen2 \
    --set-env-vars="NODE_ENV=production,PORT=8080,LOG_LEVEL=production,WHAPI_API_URL=${WHAPI_API_URL}" \
    --update-secrets="OPENAI_API_KEY=openai-api-key:latest,WHAPI_TOKEN=whapi-token:latest,ASSISTANT_ID=assistant-id:latest" \
    --service-account="${PROJECT_ID}@appspot.gserviceaccount.com" || error_exit "Error desplegando a Cloud Run"

success "Despliegue completado exitosamente!"

# 9. Obtener URL del servicio
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

echo
echo -e "${GREEN}🎉 ¡Despliegue completado!${NC}"
echo -e "${GREEN}🌐 URL del servicio: ${SERVICE_URL}${NC}"
echo -e "${GREEN}🔗 Webhook URL: ${SERVICE_URL}/hook${NC}"
echo -e "${GREEN}💚 Health Check: ${SERVICE_URL}/health${NC}"

# 10. Test del health check
info "Probando health check..."
sleep 5  # Esperar a que el servicio esté listo

if command -v curl >/dev/null 2>&1; then
    if command -v jq >/dev/null 2>&1; then
        curl -s "${SERVICE_URL}/health" | jq .
    else
        curl -s "${SERVICE_URL}/health"
    fi
else
    warning "curl no está disponible, verifica manualmente: ${SERVICE_URL}/health"
fi

echo
echo -e "${GREEN}📋 Información del despliegue:${NC}"
echo -e "  • Proyecto: ${PROJECT_ID}"
echo -e "  • Región: ${REGION}"
echo -e "  • Servicio: ${SERVICE_NAME}"
echo -e "  • Imagen: ${IMAGE_URL}"
echo -e "  • Memoria: 1Gi"
echo -e "  • CPU: 1 vCPU"
echo -e "  • Timeout: 300s"
echo -e "  • Concurrencia: 80"

echo
echo -e "${YELLOW}📝 Próximos pasos:${NC}"
echo -e "  1. Configura el webhook en Whapi: ${SERVICE_URL}/hook"
echo -e "  2. Verifica los logs: gcloud run services logs read ${SERVICE_NAME} --region=${REGION}"
echo -e "  3. Monitorea el servicio en: https://console.cloud.google.com/run"

echo
echo -e "${GREEN}✨ ¡Todo listo para recibir mensajes de WhatsApp!${NC}" 