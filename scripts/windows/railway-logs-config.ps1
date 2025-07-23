# Script para configurar logs detallados en Railway
# Autor: Alexander - TeAlquilamos
# Fecha: Julio 2025

Write-Host "Configurando Railway para logs detallados..." -ForegroundColor Cyan

# Variables de entorno para logs detallados
$envVars = @{
    "ENABLE_DETAILED_LOGS" = "true"
    "ENABLE_VERBOSE_LOGS" = "true"
    "ENABLE_BUFFER_LOGS" = "true"
    "ENABLE_TIMING_LOGS" = "true"
    "LOG_LEVEL" = "DEBUG"
}

Write-Host "Variables a configurar:" -ForegroundColor Yellow
foreach ($key in $envVars.Keys) {
    Write-Host "   $key = $($envVars[$key])" -ForegroundColor White
}

Write-Host ""
Write-Host "Para aplicar estos cambios en Railway:" -ForegroundColor Green
Write-Host "1. Ve a tu proyecto en Railway" -ForegroundColor White
Write-Host "2. Ve a la pestaña Variables" -ForegroundColor White
Write-Host "3. Agrega las siguientes variables:" -ForegroundColor White
Write-Host ""

foreach ($key in $envVars.Keys) {
    Write-Host "   $key = $($envVars[$key])" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Despues de agregar las variables:" -ForegroundColor Green
Write-Host "   - Railway hara un redeploy automatico" -ForegroundColor White
Write-Host "   - Los logs se veran como en local" -ForegroundColor White
Write-Host "   - Podras ver todos los detalles del procesamiento" -ForegroundColor White

Write-Host ""
Write-Host "Para verificar que funciona:" -ForegroundColor Yellow
Write-Host "   - Envia un mensaje al bot" -ForegroundColor White
Write-Host "   - Revisa los logs en Railway" -ForegroundColor White
Write-Host "   - Deberias ver logs detallados como en local" -ForegroundColor White

Write-Host ""
Write-Host "Nota: Los logs detallados pueden generar mas volumen de datos" -ForegroundColor Yellow
Write-Host "   Para volver a logs simples, cambia ENABLE_DETAILED_LOGS a false" -ForegroundColor White 