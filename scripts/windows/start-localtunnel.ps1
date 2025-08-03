# Script para iniciar el bot con localtunnel
Write-Host "Iniciando bot con localtunnel..." -ForegroundColor Green

# Verificar si localtunnel está instalado
$ltPath = Get-Command lt -ErrorAction SilentlyContinue
if (-not $ltPath) {
    Write-Host "Instalando localtunnel..." -ForegroundColor Yellow
    npm install -g localtunnel
}

Write-Host "Iniciando bot y tunnel..." -ForegroundColor Green
Write-Host "El bot estará disponible en: https://tealquilamos-bot.loca.lt" -ForegroundColor Cyan

# Iniciar con concurrently
concurrently -k -n BOT,TUNNEL -c green,cyan "npm run dev" "lt --port 3008 --subdomain tealquilamos-bot" 