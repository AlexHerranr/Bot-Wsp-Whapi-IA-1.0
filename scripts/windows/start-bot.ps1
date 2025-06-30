# Script para iniciar Bot WhatsApp + ngrok
Write-Host "🤖 Iniciando Bot TeAlquilamos con IA..." -ForegroundColor Green
Write-Host ""

# Verificar si el puerto 3008 está libre
$portCheck = Get-NetTCPConnection -LocalPort 3008 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "⚠️  El puerto 3008 ya está en uso. Deteniendo proceso..." -ForegroundColor Yellow
    Stop-Process -Id $portCheck.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Iniciar el bot en una nueva ventana
Write-Host "🚀 Iniciando bot en nueva ventana..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev" -WindowStyle Normal

# Esperar a que el bot se inicie
Write-Host "⏳ Esperando que el bot se inicie..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verificar que el bot esté corriendo
$botRunning = Get-NetTCPConnection -LocalPort 3008 -ErrorAction SilentlyContinue
if ($botRunning) {
    Write-Host "✅ Bot iniciado correctamente en puerto 3008" -ForegroundColor Green
} else {
    Write-Host "❌ Error: El bot no se inició correctamente" -ForegroundColor Red
    exit 1
}

# Iniciar ngrok en una nueva ventana
Write-Host "🌐 Iniciando ngrok con dominio fijo..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 3008 --domain=actual-bobcat-handy.ngrok-free.app" -WindowStyle Normal

Write-Host ""
Write-Host "🎉 ¡Bot iniciado correctamente!" -ForegroundColor Green
Write-Host "📱 URL del bot: https://actual-bobcat-handy.ngrok-free.app" -ForegroundColor White
Write-Host "🔍 Monitoreo: http://localhost:4040" -ForegroundColor White
Write-Host ""
Write-Host "Presiona Ctrl+C para detener todos los procesos..." -ForegroundColor Yellow

# Mantener el script corriendo
try {
    while ($true) {
        Start-Sleep -Seconds 10
        $botStatus = Get-NetTCPConnection -LocalPort 3008 -ErrorAction SilentlyContinue
        if (-not $botStatus) {
            Write-Host "❌ El bot se detuvo inesperadamente" -ForegroundColor Red
            break
        }
    }
} catch {
    Write-Host "🛑 Deteniendo todos los procesos..." -ForegroundColor Yellow
    Get-Process | Where-Object {$_.ProcessName -eq "node" -or $_.ProcessName -eq "ngrok"} | Stop-Process -Force
} 