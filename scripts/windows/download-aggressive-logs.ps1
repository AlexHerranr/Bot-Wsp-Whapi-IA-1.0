# Estrategia agresiva - múltiples intentos con pausas
param([string]$OutputDir = "logs\railway-downloads")

Write-Host "Estrategia AGRESIVA - Múltiples intentos" -ForegroundColor Red

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-AGGRESSIVE-$timestamp.txt"

Write-Host "Intento 1: 5 minutos..." -ForegroundColor Yellow
$cmd = "railway logs > `"$logFile`" 2>&1"
$p1 = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru
Start-Sleep -Seconds 300
if (-not $p1.HasExited) { $p1.Kill(); $p1.WaitForExit() }

Write-Host "Pausa 30 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 30

Write-Host "Intento 2: Appendeando 5 minutos más..." -ForegroundColor Yellow
$cmd = "railway logs >> `"$logFile`" 2>&1"
$p2 = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru
Start-Sleep -Seconds 300
if (-not $p2.HasExited) { $p2.Kill(); $p2.WaitForExit() }

if (Test-Path $logFile) {
    $lines = (Get-Content $logFile -ErrorAction SilentlyContinue).Count
    $sizeKB = [math]::Round((Get-Item $logFile).Length / 1024, 2)
    Write-Host "RESULTADO: $lines líneas, $sizeKB KB" -ForegroundColor Green
}