# Script para configurar secretos en Google Secret Manager
# Autor: Alexander - TeAlquilamos  
# Fecha: 2025-01-11

param(
    [string]$ProjectId = "gen-lang-client-0318357688",
    [string]$Region = "northamerica-northeast1"
)

Write-Host "🔐 Configurando secretos para TeAlquilamos Bot..." -ForegroundColor Green
Write-Host "📍 Proyecto: $ProjectId" -ForegroundColor Cyan
Write-Host "🌍 Región: $Region" -ForegroundColor Cyan
Write-Host ""

# Función para crear un secreto
function Create-Secret {
    param(
        [string]$SecretName,
        [string]$Description
    )
    
    Write-Host "🔑 Creando secreto: $SecretName" -ForegroundColor Yellow
    
    # Verificar si el secreto ya existe
    $existing = gcloud secrets describe $SecretName --project=$ProjectId 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ⚠️  El secreto $SecretName ya existe. Saltando..." -ForegroundColor Yellow
        return $true
    }
    
    # Crear el secreto
    gcloud secrets create $SecretName `
        --project=$ProjectId `
        --labels="app=tealquilamos-bot,env=production" `
        --replication-policy="automatic"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Secreto $SecretName creado exitosamente" -ForegroundColor Green
        return $true
    } else {
        Write-Host "   ❌ Error creando secreto $SecretName" -ForegroundColor Red
        return $false
    }
}

# Lista de secretos a crear
$secrets = @(
    @{ Name = "OPENAI_API_KEY"; Description = "Clave API de OpenAI para el asistente" },
    @{ Name = "ASSISTANT_ID"; Description = "ID del asistente de OpenAI" },
    @{ Name = "WHAPI_TOKEN"; Description = "Token de autenticación para WHAPI" },
    @{ Name = "WHAPI_API_URL"; Description = "URL base de la API de WHAPI" },
    @{ Name = "BEDS24_TOKEN"; Description = "Token de autenticación para Beds24" },
    @{ Name = "BEDS24_API_URL"; Description = "URL base de la API de Beds24" }
)

# Crear todos los secretos
Write-Host "📦 Creando secretos..." -ForegroundColor Cyan
$allSuccess = $true

foreach ($secret in $secrets) {
    $success = Create-Secret -SecretName $secret.Name -Description $secret.Description
    if (-not $success) {
        $allSuccess = $false
    }
}

Write-Host ""
if ($allSuccess) {
    Write-Host "✅ Todos los secretos han sido creados exitosamente!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Algunos secretos no se pudieron crear. Revisa los errores arriba." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔧 SIGUIENTE PASO:" -ForegroundColor Cyan
Write-Host "   Ahora debes agregar los valores a cada secreto."
Write-Host "   Puedes usar este script con valores o hacerlo manualmente:"
Write-Host ""
Write-Host "📚 EJEMPLO MANUAL:" -ForegroundColor Yellow
Write-Host "   echo 'tu_valor_secreto' | gcloud secrets versions add OPENAI_API_KEY --data-file=-"
Write-Host ""
Write-Host "🚀 Una vez configurados todos los valores, el bot debería funcionar en Cloud Run." -ForegroundColor Green 