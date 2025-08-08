# Script simple para capturar el máximo de logs posibles de Railway
param(
    [string]$OutputDir = "logs\railway-downloads"
)

Write-Host "Railway MAX Logs Downloader" -ForegroundColor Cyan
Write-Host "Capturando TODO lo posible..." -ForegroundColor Yellow

# Crear directorio
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Archivo único
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-MAX-$timestamp.txt"

Write-Host "Archivo: $logFile" -ForegroundColor Gray
Write-Host "Descargando por 15 minutos para capturar máximo historial..." -ForegroundColor Yellow

# Ejecutar railway logs por 15 minutos straight
$cmd = "railway logs > `"$logFile`" 2>&1"
$process = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru

# 15 minutos debería ser suficiente para agotar el buffer de Railway
Start-Sleep -Seconds 900

# Terminar
if (-not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit()
}

# Mostrar resultado
if (Test-Path $logFile) {
    $lines = (Get-Content $logFile -ErrorAction SilentlyContinue).Count
    $sizeKB = [math]::Round((Get-Item $logFile).Length / 1024, 2)
    
    Write-Host ""
    Write-Host "CAPTURADO:" -ForegroundColor Green
    Write-Host "Líneas: $lines" -ForegroundColor Green
    Write-Host "Tamaño: $sizeKB KB" -ForegroundColor Green
    
    # Rango temporal
    $first = Get-Content $logFile | Select-Object -First 1
    $last = Get-Content $logFile | Select-Object -Last 1
    
    if ($first -match '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)') {
        Write-Host "Desde: $($matches[1])" -ForegroundColor Cyan
    }
    if ($last -match '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)') {
        Write-Host "Hasta: $($matches[1])" -ForegroundColor Cyan
    }
}