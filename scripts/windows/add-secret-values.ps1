# Script para agregar valores a los secretos en Google Secret Manager
# Autor: Alexander - TeAlquilamos
# Fecha: 2025-01-11

param(
    [string]$ProjectId = "gen-lang-client-0318357688"
)

Write-Host "Agregando valores a los secretos de TeAlquilamos Bot..." -ForegroundColor Green
Write-Host "Proyecto: $ProjectId" -ForegroundColor Cyan
Write-Host ""

# Lista de secretos que necesitan valores
$secrets = @(
    "OPENAI_API_KEY",
    "ASSISTANT_ID", 
    "WHAPI_TOKEN",
    "WHAPI_API_URL",
    "BEDS24_TOKEN",
    "BEDS24_API_URL"
)

Write-Host "Secretos que necesitan valores:" -ForegroundColor Yellow
foreach ($secret in $secrets) {
    Write-Host "   - $secret" -ForegroundColor White
}

Write-Host ""
Write-Host "Para agregar valores, usa estos comandos:" -ForegroundColor Cyan
Write-Host ""

foreach ($secret in $secrets) {
    Write-Host "# Para $secret" -ForegroundColor Yellow
    Write-Host "echo 'TU_VALOR_AQUI' | gcloud secrets versions add $secret --project=$ProjectId --data-file=-" -ForegroundColor White
    Write-Host ""
}

Write-Host "IMPORTANTE:" -ForegroundColor Red
Write-Host "   - Reemplaza 'TU_VALOR_AQUI' con el valor real de cada secreto"
Write-Host "   - NO incluyas comillas adicionales en los valores"
Write-Host "   - Los valores se guardaran de forma segura en Secret Manager"
Write-Host ""
Write-Host "EJEMPLO REAL:" -ForegroundColor Green
Write-Host "   echo 'sk-proj-abcd1234...' | gcloud secrets versions add OPENAI_API_KEY --project=$ProjectId --data-file=-"
Write-Host ""
Write-Host "Una vez agregados todos los valores, el bot funcionara en Cloud Run!" -ForegroundColor Green 