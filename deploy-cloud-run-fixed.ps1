# 🚀 Script de Despliegue Optimizado para Cloud Run (PowerShell)
# Versión: 2.0 - Corregido para errores de compilación

# Configuración
$PROJECT_ID = "gen-lang-client-0318357688"
$REGION = "northamerica-northeast1"
$SERVICE_NAME = "bot-wsp-whapi-ia"
$REPO_NAME = "cloud-run-source-deploy"
$IMAGE_NAME = "bot-wsp-whapi-ia"

# Función para mostrar mensajes con colores
function Write-Progress { param($Message) Write-Host "⏳ $Message..." -ForegroundColor Yellow }
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "📋 $Message" -ForegroundColor Blue }

Write-Info "🚀 Iniciando despliegue optimizado para Cloud Run"
Write-Info "Proyecto: $PROJECT_ID"
Write-Info "Servicio: $SERVICE_NAME"
Write-Info "Región: $REGION"

try {
    # 1. Verificar que estamos en el directorio correcto
    Write-Progress "Verificando directorio del proyecto"
    if (!(Test-Path "package.json")) {
        Write-Error "No se encontró package.json. Asegúrate de estar en el directorio raíz del proyecto."
        exit 1
    }
    Write-Success "Directorio del proyecto verificado"

    # 2. Verificar que gcloud está configurado
    Write-Progress "Verificando configuración de gcloud"
    $authList = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
    if (!$authList -or $authList -eq "") {
        Write-Error "No hay cuenta activa en gcloud. Ejecuta 'gcloud auth login'"
        exit 1
    }
    Write-Success "Configuración de gcloud verificada"

    # 3. Configurar proyecto
    Write-Progress "Configurando proyecto"
    gcloud config set project $PROJECT_ID
    Write-Success "Proyecto configurado: $PROJECT_ID"

    # 4. Instalar dependencias localmente
    Write-Progress "Instalando dependencias localmente"
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm install
    } else {
        npm install
    }
    Write-Success "Dependencias instaladas"

    # 5. Compilar localmente para verificar
    Write-Progress "Compilando aplicación localmente"
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm run build
    } else {
        npm run build
    }
    Write-Success "Compilación local exitosa"

    # 6. Construir imagen en Cloud Build
    Write-Progress "Construyendo imagen con Cloud Build"
    $COMMIT_SHA = git rev-parse HEAD
    $IMAGE_URL = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME`:$COMMIT_SHA"

    gcloud builds submit --tag $IMAGE_URL --timeout=600s --machine-type=e2-highcpu-8 --disk-size=100GB
    Write-Success "Imagen construida: $IMAGE_URL"

    # 7. Desplegar a Cloud Run
    Write-Progress "Desplegando a Cloud Run"
    gcloud run deploy $SERVICE_NAME `
        --image $IMAGE_URL `
        --platform managed `
        --region $REGION `
        --allow-unauthenticated `
        --port 8080 `
        --memory 1Gi `
        --cpu 1 `
        --timeout 600 `
        --concurrency 100 `
        --min-instances 0 `
        --max-instances 10 `
        --set-env-vars NODE_ENV=production `
        --set-env-vars LOG_LEVEL=production `
        --execution-environment gen2 `
        --cpu-boost

    Write-Success "Despliegue completado"

    # 8. Obtener URL del servicio
    Write-Progress "Obteniendo URL del servicio"
    $SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
    Write-Success "Servicio disponible en: $SERVICE_URL"

    # 9. Probar health check
    Write-Progress "Probando health check"
    try {
        $response = Invoke-WebRequest -Uri "$SERVICE_URL/health" -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Health check exitoso"
        } else {
            Write-Error "Health check falló con código: $($response.StatusCode)"
        }
    } catch {
        Write-Error "Health check falló: $($_.Exception.Message)"
        Write-Host "Verificando logs..." -ForegroundColor Yellow
        gcloud run services logs read $SERVICE_NAME --region $REGION --limit=20
    }

    # 10. Mostrar información final
    Write-Host "`n🎉 Despliegue completado exitosamente!" -ForegroundColor Green
    Write-Info "📋 Información del servicio:"
    Write-Host "  URL: $SERVICE_URL"
    Write-Host "  Health Check: $SERVICE_URL/health"
    Write-Host "  Imagen: $IMAGE_URL"
    Write-Host "  Commit: $COMMIT_SHA"

    Write-Host "`n📊 Comandos útiles:" -ForegroundColor Yellow
    Write-Host "  Ver logs: gcloud run services logs tail $SERVICE_NAME --region $REGION"
    Write-Host "  Ver métricas: gcloud run services describe $SERVICE_NAME --region $REGION"
    Write-Host "  Actualizar: .\deploy-cloud-run-fixed.ps1"

    Write-Success "✅ Despliegue finalizado"

} catch {
    Write-Error "Error durante el despliegue: $($_.Exception.Message)"
    Write-Host "Stack trace:" -ForegroundColor Red
    Write-Host $_.Exception.StackTrace -ForegroundColor Red
    exit 1
} 