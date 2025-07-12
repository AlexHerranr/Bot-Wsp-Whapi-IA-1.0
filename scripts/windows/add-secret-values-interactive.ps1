# Script interactivo para agregar valores a los secretos
# Autor: Alexander - TeAlquilamos
# Fecha: 2025-01-12

param(
    [string]$ProjectId = "gen-lang-client-0318357688"
)

Write-Host "=== CONFIGURACION DE SECRETOS PARA TEALQUILAMOS BOT ===" -ForegroundColor Green
Write-Host "Proyecto: $ProjectId" -ForegroundColor Cyan
Write-Host ""

# Función para agregar valor a un secreto
function Add-SecretValue {
    param(
        [string]$SecretName,
        [string]$Description,
        [bool]$IsSecret = $true
    )
    
    Write-Host "Configurando: $SecretName" -ForegroundColor Yellow
    Write-Host "Descripcion: $Description" -ForegroundColor Gray
    
    if ($IsSecret) {
        $value = Read-Host "Ingresa el valor (se ocultara)" -AsSecureString
        $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
    } else {
        $plainValue = Read-Host "Ingresa el valor"
    }
    
    if ([string]::IsNullOrWhiteSpace($plainValue)) {
        Write-Host "   Saltando $SecretName (valor vacio)" -ForegroundColor Yellow
        return
    }
    
    try {
        $plainValue | gcloud secrets versions add $SecretName --data-file=- --project=$ProjectId
        Write-Host "   Exito: $SecretName configurado" -ForegroundColor Green
    } catch {
        Write-Host "   Error: No se pudo configurar $SecretName" -ForegroundColor Red
        Write-Host "   Detalles: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Configurar cada secreto
Write-Host "PASO 1: Configurar OpenAI" -ForegroundColor Magenta
Add-SecretValue "OPENAI_API_KEY" "Tu clave de API de OpenAI (sk-...)" $true

Write-Host "PASO 2: Configurar Assistant ID" -ForegroundColor Magenta  
Add-SecretValue "ASSISTANT_ID" "ID del asistente de OpenAI (asst_...)" $false

Write-Host "PASO 3: Configurar WHAPI" -ForegroundColor Magenta
Add-SecretValue "WHAPI_TOKEN" "Token de autenticacion de WHAPI" $true
Add-SecretValue "WHAPI_API_URL" "URL de la API de WHAPI (ej: https://gate.whapi.cloud)" $false

Write-Host "PASO 4: Configurar Beds24" -ForegroundColor Magenta
Add-SecretValue "BEDS24_TOKEN" "Token de API de Beds24" $true
Add-SecretValue "BEDS24_API_URL" "URL de la API de Beds24 (ej: https://api.beds24.com)" $false

Write-Host "=== CONFIGURACION COMPLETADA ===" -ForegroundColor Green
Write-Host ""
Write-Host "SIGUIENTE PASO: Reiniciar el bot para aplicar los cambios:" -ForegroundColor Cyan
Write-Host "gcloud run services update bot-wsp-whapi-ia --region=northamerica-northeast1 --project=$ProjectId" -ForegroundColor White
Write-Host ""
Write-Host "VERIFICAR LOGS:" -ForegroundColor Cyan
Write-Host "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=bot-wsp-whapi-ia\" --limit=20 --project=$ProjectId" -ForegroundColor White 