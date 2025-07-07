# Script de despliegue para Google Cloud Run (Windows PowerShell)
# Autor: Alexander - TeAlquilamos Bot

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando despliegue de TeAlquilamos Bot a Google Cloud Run..." -ForegroundColor Green

# Configuración
$PROJECT_ID = "gen-lang-client-0318357688"
$SERVICE_NAME = "bot-wsp-whapi-ia-1-0"
$REGION = "northamerica-south1"
$IMAGE_NAME = "bot-wsp-whapi-ia"
$VERSION = "1.0"

# Construir nombre completo de la imagen
$IMAGE_URL = "${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${IMAGE_NAME}-${VERSION}/${SERVICE_NAME}:latest"

Write-Host "📦 Configuración del despliegue:" -ForegroundColor Cyan
Write-Host "   Proyecto: $PROJECT_ID" -ForegroundColor White
Write-Host "   Servicio: $SERVICE_NAME" -ForegroundColor White
Write-Host "   Región: $REGION" -ForegroundColor White
Write-Host "   Imagen: $IMAGE_URL" -ForegroundColor White
Write-Host ""

# Verificar que gcloud esté instalado
try {
    $null = Get-Command gcloud -ErrorAction Stop
    Write-Host "✅ gcloud CLI encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: gcloud CLI no está instalado" -ForegroundColor Red
    Write-Host "   Instala gcloud desde: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Verificar que docker esté instalado
try {
    $null = Get-Command docker -ErrorAction Stop
    Write-Host "✅ Docker encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Docker no está instalado" -ForegroundColor Red
    Write-Host "   Instala Docker desde: https://docs.docker.com/get-docker/" -ForegroundColor Yellow
    exit 1
}

# Verificar autenticación
Write-Host "🔐 Verificando autenticación..." -ForegroundColor Cyan
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if (-not $authCheck) {
    Write-Host "❌ Error: No estás autenticado con gcloud" -ForegroundColor Red
    Write-Host "   Ejecuta: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Autenticación verificada" -ForegroundColor Green

# Configurar proyecto
Write-Host "⚙️  Configurando proyecto..." -ForegroundColor Cyan
gcloud config set project $PROJECT_ID

# Habilitar APIs necesarias
Write-Host "🔧 Habilitando APIs necesarias..." -ForegroundColor Cyan
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Configurar Docker para usar gcloud como helper
Write-Host "🐳 Configurando Docker..." -ForegroundColor Cyan
gcloud auth configure-docker "${REGION}-docker.pkg.dev"

# Crear repositorio de Artifact Registry si no existe
Write-Host "📦 Verificando repositorio de Artifact Registry..." -ForegroundColor Cyan
$repoCheck = gcloud artifacts repositories describe cloud-run-source-deploy --location=$REGION 2>$null
if (-not $repoCheck) {
    Write-Host "   Creando repositorio..." -ForegroundColor Yellow
    gcloud artifacts repositories create cloud-run-source-deploy `
        --repository-format=docker `
        --location=$REGION `
        --description="Repositorio para TeAlquilamos Bot"
}

# Construir imagen Docker
Write-Host "🏗️  Construyendo imagen Docker..." -ForegroundColor Cyan
docker build -t $IMAGE_URL .

# Subir imagen al registro
Write-Host "⬆️  Subiendo imagen al registro..." -ForegroundColor Cyan
docker push $IMAGE_URL

# Desplegar a Cloud Run
Write-Host "🚀 Desplegando a Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --image=$IMAGE_URL `
    --platform=managed `
    --region=$REGION `
    --allow-unauthenticated `
    --port=8080 `
    --memory=1Gi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=10 `
    --timeout=300 `
    --set-env-vars="NODE_ENV=production,PORT=8080" `
    --execution-environment=gen2

# Obtener URL del servicio
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"

Write-Host ""
Write-Host "✅ ¡Despliegue completado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 URL del servicio: $SERVICE_URL" -ForegroundColor Cyan
Write-Host "📊 Monitoreo: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME" -ForegroundColor Cyan
Write-Host "📋 Logs: https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22$SERVICE_NAME%22" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Para configurar el webhook, usa esta URL:" -ForegroundColor Yellow
Write-Host "   $SERVICE_URL/hook" -ForegroundColor White
Write-Host ""
Write-Host "💡 Comandos útiles:" -ForegroundColor Yellow
Write-Host "   Ver logs: gcloud run services logs read $SERVICE_NAME --region=$REGION" -ForegroundColor White
Write-Host "   Ver tráfico: gcloud run services describe $SERVICE_NAME --region=$REGION" -ForegroundColor White
Write-Host "" 