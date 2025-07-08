# 🚀 Script de Despliegue Optimizado para Cloud Run v2
# Incluye todas las correcciones para evitar timeout
# Versión: 2.0 - Con correcciones completas

# Variables de configuración
$SERVICE_NAME = "bot-wsp-whapi-ia"
$REGION = "northamerica-northeast1"
$PROJECT_ID = "gen-lang-client-0318357688"
$MEMORY = "1Gi"
$CPU = "2"
$MIN_INSTANCES = "0"
$MAX_INSTANCES = "10"
$TIMEOUT = "300"

# Funciones auxiliares
function Write-Step { param($Message) Write-Host "🔹 $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }

Write-Host "🚀 Iniciando despliegue optimizado a Cloud Run v2..." -ForegroundColor Cyan
Write-Host "Configuración:" -ForegroundColor Blue
Write-Host "  - Servicio: $SERVICE_NAME" -ForegroundColor White
Write-Host "  - Región: $REGION" -ForegroundColor White
Write-Host "  - Memoria: $MEMORY" -ForegroundColor White
Write-Host "  - CPU: $CPU" -ForegroundColor White
Write-Host "  - Timeout: ${TIMEOUT}s" -ForegroundColor White
Write-Host ""

try {
    # Paso 1: Verificaciones previas
    Write-Step "Verificando directorio del proyecto..."
    if (!(Test-Path "package.json")) {
        Write-Error "No se encontró package.json"
        Write-Host "Asegúrate de ejecutar este script desde la raíz del proyecto"
        exit 1
    }
    Write-Success "Directorio del proyecto verificado"

    # Paso 2: Verificar gcloud
    Write-Step "Verificando gcloud CLI..."
    try {
        $currentProject = gcloud config get-value project 2>$null
        if ($currentProject -ne $PROJECT_ID) {
            Write-Warning "Cambiando al proyecto: $PROJECT_ID"
            gcloud config set project $PROJECT_ID
        }
        Write-Success "gcloud configurado correctamente"
    } catch {
        Write-Error "gcloud CLI no está instalado o configurado"
        Write-Host "Instala Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
        exit 1
    }

    # Paso 3: Aplicar correcciones automáticas
    Write-Step "Aplicando correcciones de TypeScript..."
    if (Test-Path "fix-typescript-errors.js") {
        Write-Host "Ejecutando correcciones automáticas..." -ForegroundColor Yellow
        node fix-typescript-errors.js
        Write-Success "Correcciones automáticas aplicadas"
    } else {
        Write-Warning "Script de correcciones no encontrado, continuando..."
    }

    # Paso 4: Compilar aplicación
    Write-Step "Compilando aplicación..."
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error en compilación"
        Write-Host $buildOutput -ForegroundColor Red
        Write-Host "`nRevisa los errores de TypeScript antes de continuar" -ForegroundColor Yellow
        exit 1
    }
    
    # Contar warnings
    $warnings = ([regex]::Matches($buildOutput, '\[plugin typescript\]')).Count
    if ($warnings -eq 0) {
        Write-Success "Compilación perfecta - Sin errores ni warnings"
    } elseif ($warnings -lt 10) {
        Write-Success "Compilación exitosa - $warnings warnings (aceptable)"
    } else {
        Write-Warning "Compilación con $warnings warnings - Revisar si es necesario"
    }

    # Paso 5: Crear .gcloudignore si no existe
    Write-Step "Preparando archivos para deploy..."
    if (!(Test-Path ".gcloudignore")) {
        $gcloudignoreContent = @"
# Archivos a ignorar en Cloud Build
node_modules/
.git/
.gitignore
*.log
*.backup
.env.local
.env.development
scripts/development/
docs/
README.md
*.test.js
*.spec.js
coverage/
.nyc_output/
.vscode/
.idea/
"@
        $gcloudignoreContent | Out-File -FilePath ".gcloudignore" -Encoding UTF8
        Write-Success "Archivo .gcloudignore creado"
    }

    # Paso 6: Deploy a Cloud Run
    Write-Step "Desplegando a Cloud Run..."
    Write-Host "Esto puede tardar 2-3 minutos..." -ForegroundColor Yellow
    
    $deployArgs = @(
        "run", "deploy", $SERVICE_NAME,
        "--source", ".",
        "--region", $REGION,
        "--platform", "managed",
        "--allow-unauthenticated",
        "--memory", $MEMORY,
        "--cpu", $CPU,
        "--timeout", $TIMEOUT,
        "--min-instances", $MIN_INSTANCES,
        "--max-instances", $MAX_INSTANCES,
        "--set-env-vars", "NODE_ENV=production,PORT=8080,LOG_LEVEL=production",
        "--service-account", "${PROJECT_ID}@appspot.gserviceaccount.com",
        "--concurrency", "1000",
        "--max-request-concurrent-per-instance", "100"
    )
    
    $deployOutput = gcloud @deployArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error en despliegue"
        Write-Host $deployOutput -ForegroundColor Red
        Write-Host "`nComandos de diagnóstico:" -ForegroundColor Yellow
        Write-Host "gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50" -ForegroundColor Cyan
        exit 1
    }
    
    Write-Success "Despliegue completado exitosamente"

    # Paso 7: Obtener URL del servicio
    Write-Step "Obteniendo información del servicio..."
    $serviceUrl = gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
    Write-Host "📍 URL del servicio: $serviceUrl" -ForegroundColor Cyan

    # Paso 8: Esperar y verificar health
    Write-Step "Verificando salud del servicio..."
    Write-Host "Esperando 15 segundos para que el servicio inicie..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15

    $healthUrl = "$serviceUrl/health"
    $readyUrl = "$serviceUrl/ready"
    $maxAttempts = 6
    $healthy = $false

    for ($i = 1; $i -le $maxAttempts; $i++) {
        Write-Host "Intento $i de $maxAttempts..." -ForegroundColor Yellow
        
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Success "Servicio saludable (HTTP $($response.StatusCode))"
                $healthData = $response.Content | ConvertFrom-Json
                Write-Host "Estado: $($healthData.status)" -ForegroundColor Green
                Write-Host "Inicializado: $($healthData.initialized)" -ForegroundColor Green
                $healthy = $true
                break
            }
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 503) {
                Write-Warning "Servicio inicializando (HTTP $statusCode)"
            } else {
                Write-Warning "Error: HTTP $statusCode"
            }
        }
        
        if ($i -lt $maxAttempts) {
            Write-Host "Esperando 10 segundos más..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
        }
    }

    # Verificar endpoint /ready
    Write-Step "Verificando endpoint /ready..."
    try {
        $readyResponse = Invoke-WebRequest -Uri $readyUrl -Method Get -TimeoutSec 10
        if ($readyResponse.StatusCode -eq 200) {
            Write-Success "Servicio listo para recibir tráfico"
        } else {
            Write-Warning "Servicio aún no está completamente listo"
        }
    } catch {
        Write-Warning "Endpoint /ready no disponible aún"
    }

    # Paso 9: Mostrar logs recientes
    Write-Step "Últimos logs del servicio:"
    gcloud run services logs read $SERVICE_NAME --region $REGION --limit 20

    # Paso 10: Configuración del webhook
    Write-Host "`n" -NoNewline
    Write-Host "🔗 Configuración del Webhook:" -ForegroundColor Cyan
    Write-Host "URL para Whapi: $serviceUrl/hook" -ForegroundColor White
    Write-Warning "Recuerda actualizar el webhook en Whapi con esta URL"

    # Resumen final
    Write-Host "`n🎉 ¡DESPLIEGUE COMPLETADO!" -ForegroundColor Green
    Write-Host "`nRecursos desplegados:" -ForegroundColor Blue
    Write-Host "  - Servicio: $SERVICE_NAME" -ForegroundColor White
    Write-Host "  - URL: $serviceUrl" -ForegroundColor White
    Write-Host "  - Health: $healthUrl" -ForegroundColor White
    Write-Host "  - Webhook: $serviceUrl/hook" -ForegroundColor White

    Write-Host "`nComandos útiles:" -ForegroundColor Cyan
    Write-Host "  - Ver logs: gcloud run services logs tail $SERVICE_NAME --region $REGION" -ForegroundColor White
    Write-Host "  - Describir: gcloud run services describe $SERVICE_NAME --region $REGION" -ForegroundColor White
    Write-Host "  - Revisiones: gcloud run revisions list --service $SERVICE_NAME --region $REGION" -ForegroundColor White

    if ($healthy) {
        Write-Host "`n✨ ¡Bot desplegado y funcionando correctamente!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Bot desplegado pero verificar logs para confirmar funcionamiento" -ForegroundColor Yellow
    }

} catch {
    Write-Error "Error durante el despliegue: $($_.Exception.Message)"
    Write-Host "Stack trace:" -ForegroundColor Red
    Write-Host $_.Exception.StackTrace -ForegroundColor Red
    exit 1
} 