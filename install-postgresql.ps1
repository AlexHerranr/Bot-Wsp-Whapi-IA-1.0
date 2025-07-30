# Script para instalar PostgreSQL en Windows
Write-Host "🗄️ INSTALACIÓN DE POSTGRESQL" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Verificar si ya está instalado
$postgresPath = "C:\Program Files\PostgreSQL"
if (Test-Path $postgresPath) {
    Write-Host "✅ PostgreSQL ya está instalado en: $postgresPath" -ForegroundColor Yellow
    
    # Buscar psql
    $psqlPath = Get-ChildItem -Path $postgresPath -Recurse -Name "psql.exe" | Select-Object -First 1
    if ($psqlPath) {
        $fullPsqlPath = Join-Path $postgresPath $psqlPath
        Write-Host "📍 psql encontrado en: $fullPsqlPath" -ForegroundColor Green
        
        # Añadir al PATH si no está
        $env:PATH += ";$(Split-Path $fullPsqlPath)"
        Write-Host "✅ Añadido al PATH temporal" -ForegroundColor Green
        
        # Verificar versión
        & $fullPsqlPath --version
        exit 0
    }
}

Write-Host "❌ PostgreSQL no encontrado. Necesitas instalarlo manualmente." -ForegroundColor Red
Write-Host ""
Write-Host "📋 INSTRUCCIONES DE INSTALACIÓN MANUAL:" -ForegroundColor Yellow
Write-Host "1. Ve a: https://www.postgresql.org/download/windows/" -ForegroundColor White
Write-Host "2. Descarga PostgreSQL 15 o 16 (recomendado)" -ForegroundColor White
Write-Host "3. Ejecuta el instalador como Administrador" -ForegroundColor White
Write-Host "4. Durante la instalación:" -ForegroundColor White
Write-Host "   - Puerto: 5432 (por defecto)" -ForegroundColor White
Write-Host "   - Usuario: postgres" -ForegroundColor White
Write-Host "   - Contraseña: elige una que recuerdes (ej: admin123)" -ForegroundColor White
Write-Host "   - Instalar pgAdmin (recomendado)" -ForegroundColor White
Write-Host "5. Después de instalar, ejecuta este script nuevamente" -ForegroundColor White
Write-Host ""
Write-Host "⚡ INSTALACIÓN RÁPIDA CON WINGET (Alternativa):" -ForegroundColor Cyan
Write-Host "winget install PostgreSQL.PostgreSQL" -ForegroundColor White