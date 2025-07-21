# Script de PowerShell para actualizar el asistente de OpenAI
# con la nueva función de inyección de historial

Write-Host "Actualizando asistente de OpenAI con nueva funcion de inyeccion de historial..." -ForegroundColor Green

# Verificar que esté en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "Error: Debes ejecutar este script desde el directorio raíz del proyecto" -ForegroundColor Red
    exit 1
}

# Verificar que las variables de entorno estén configuradas
if (-not $env:OPENAI_API_KEY) {
    Write-Host "Error: OPENAI_API_KEY no está configurado" -ForegroundColor Red
    Write-Host "Configura la variable de entorno OPENAI_API_KEY" -ForegroundColor Yellow
    exit 1
}

if (-not $env:OPENAI_ASSISTANT_ID) {
    Write-Host "Error: OPENAI_ASSISTANT_ID no está configurado" -ForegroundColor Red
    Write-Host "Configura la variable de entorno OPENAI_ASSISTANT_ID" -ForegroundColor Yellow
    exit 1
}

Write-Host "Variables de entorno verificadas correctamente" -ForegroundColor Green
Write-Host "ID del asistente: $env:OPENAI_ASSISTANT_ID" -ForegroundColor Cyan

# Ejecutar el script de actualización
try {
    Write-Host "Ejecutando script de actualizacion..." -ForegroundColor Yellow
    node scripts/update-assistant-with-history-function.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Asistente actualizado exitosamente!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Resumen de cambios:" -ForegroundColor Cyan
        Write-Host "- Nueva funcion: inject_history" -ForegroundColor White
        Write-Host "- Categoria: context" -ForegroundColor White
        Write-Host "- Descripcion: Inyeccion inteligente de historial de conversacion" -ForegroundColor White
        Write-Host ""
        Write-Host "La funcion esta ahora disponible para el asistente y puede ser llamada" -ForegroundColor Green
        Write-Host "cuando sea necesario inyectar historial de manera optimizada." -ForegroundColor Green
    } else {
        Write-Host "Error ejecutando el script de actualizacion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} 