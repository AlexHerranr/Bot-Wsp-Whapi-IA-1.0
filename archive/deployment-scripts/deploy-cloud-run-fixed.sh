#!/bin/bash

# 🚀 Script de Despliegue Optimizado para Cloud Run
# Versión: 2.0 - Corregido para errores de compilación

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
PROJECT_ID="gen-lang-client-0318357688"
REGION="northamerica-northeast1"
SERVICE_NAME="bot-wsp-whapi-ia"
REPO_NAME="cloud-run-source-deploy"
IMAGE_NAME="bot-wsp-whapi-ia"

echo -e "${BLUE}🚀 Iniciando despliegue optimizado para Cloud Run${NC}"
echo -e "${BLUE}Proyecto: ${PROJECT_ID}${NC}"
echo -e "${BLUE}Servicio: ${SERVICE_NAME}${NC}"
echo -e "${BLUE}Región: ${REGION}${NC}"

# Función para mostrar progreso
show_progress() {
    echo -e "${YELLOW}⏳ $1...${NC}"
}

# Función para mostrar éxito
show_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Función para mostrar error
show_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Verificar que estamos en el directorio correcto
show_progress "Verificando directorio del proyecto"
if [ ! -f "package.json" ]; then
    show_error "No se encontró package.json. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi
show_success "Directorio del proyecto verificado"

# 2. Verificar que gcloud está configurado
show_progress "Verificando configuración de gcloud"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    show_error "No hay cuenta activa en gcloud. Ejecuta 'gcloud auth login'"
    exit 1
fi
show_success "Configuración de gcloud verificada"

# 3. Configurar proyecto
show_progress "Configurando proyecto"
gcloud config set project $PROJECT_ID
show_success "Proyecto configurado: $PROJECT_ID"

# 4. Instalar dependencias localmente para verificar
show_progress "Instalando dependencias localmente"
if command -v pnpm &> /dev/null; then
    pnpm install
else
    npm install
fi
show_success "Dependencias instaladas"

# 5. Compilar localmente para verificar
show_progress "Compilando aplicación localmente"
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi
show_success "Compilación local exitosa"

# 6. Construir imagen en Cloud Build
show_progress "Construyendo imagen con Cloud Build"
COMMIT_SHA=$(git rev-parse HEAD)
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:$COMMIT_SHA"

gcloud builds submit \
    --tag $IMAGE_URL \
    --timeout=600s \
    --machine-type=e2-highcpu-8 \
    --disk-size=100GB

show_success "Imagen construida: $IMAGE_URL"

# 7. Desplegar a Cloud Run
show_progress "Desplegando a Cloud Run"
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 600 \
    --concurrency 100 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production \
    --set-env-vars LOG_LEVEL=production \
    --execution-environment gen2 \
    --cpu-boost

show_success "Despliegue completado"

# 8. Obtener URL del servicio
show_progress "Obteniendo URL del servicio"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
show_success "Servicio disponible en: $SERVICE_URL"

# 9. Probar health check
show_progress "Probando health check"
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    show_success "Health check exitoso"
else
    show_error "Health check falló"
    echo -e "${YELLOW}Verificando logs...${NC}"
    gcloud run services logs read $SERVICE_NAME --region $REGION --limit=20
fi

# 10. Mostrar información final
echo -e "\n${GREEN}🎉 Despliegue completado exitosamente!${NC}"
echo -e "${BLUE}📋 Información del servicio:${NC}"
echo -e "  URL: $SERVICE_URL"
echo -e "  Health Check: $SERVICE_URL/health"
echo -e "  Imagen: $IMAGE_URL"
echo -e "  Commit: $COMMIT_SHA"

echo -e "\n${YELLOW}📊 Comandos útiles:${NC}"
echo -e "  Ver logs: gcloud run services logs tail $SERVICE_NAME --region $REGION"
echo -e "  Ver métricas: gcloud run services describe $SERVICE_NAME --region $REGION"
echo -e "  Actualizar: ./deploy-cloud-run-fixed.sh"

echo -e "\n${GREEN}✅ Despliegue finalizado${NC}" 