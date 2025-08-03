# Script para iniciar el bot con ngrok de manera limpia
Write-Host "Limpiando procesos existentes..." -ForegroundColor Yellow

# Terminar procesos de Node.js existentes
try {
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "Terminando procesos de Node.js..." -ForegroundColor Red
        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
} catch {
    Write-Host "No se pudieron terminar algunos procesos de Node.js" -ForegroundColor Yellow
}

# Terminar procesos de ngrok existentes
try {
    $ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
    if ($ngrokProcesses) {
        Write-Host "Terminando procesos de ngrok..." -ForegroundColor Red
        Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
} catch {
    Write-Host "No se pudieron terminar algunos procesos de ngrok" -ForegroundColor Yellow
}

# Verificar que los puertos estén libres
Write-Host "Verificando puertos..." -ForegroundColor Cyan
$port3010 = netstat -ano | findstr ":3010" | findstr "LISTENING"
if ($port3010) {
    Write-Host "Puerto 3010 aún ocupado, esperando..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}

Write-Host "Procesos limpiados. Iniciando bot..." -ForegroundColor Green
Write-Host "Ejecutando: npm run dev:local" -ForegroundColor Cyan

# Ejecutar el comando
npm run dev:local 