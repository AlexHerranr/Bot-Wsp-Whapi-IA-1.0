# Script para descargar logs históricos de Railway por tiempo específico
# Uso: .\download-historical-logs.ps1 [horas-atras] [output-dir]
param(
    [int]$HoursBack = 1,
    [string]$OutputDir = "logs\railway-downloads"
)

Write-Host "Railway Historical Logs Downloader" -ForegroundColor Cyan
Write-Host "Descargando logs de las últimas $HoursBack horas" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Cyan

# Verificar Railway CLI
try {
    $railwayVersion = railway --version 2>$null
    if (-not $railwayVersion) {
        Write-Host "ERROR: Railway CLI no está instalado" -ForegroundColor Red
        exit 1
    }
    Write-Host "Railway CLI: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Railway CLI no disponible" -ForegroundColor Red
    exit 1
}

# Crear directorio
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Calcular tiempo de descarga basado en horas solicitadas
$downloadMinutes = [math]::Max(10, $HoursBack * 5)  # Mínimo 10 min, 5 min por hora
Write-Host "Tiempo de descarga estimado: $downloadMinutes minutos" -ForegroundColor Yellow

# Generar archivo
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-${HoursBack}h-$timestamp.txt"

Write-Host ""
Write-Host "Iniciando descarga..." -ForegroundColor Cyan
Write-Host "Archivo: $logFile" -ForegroundColor Gray

# Ejecutar railway logs con tiempo extendido
$cmd = "railway logs > `"$logFile`" 2>&1"
$process = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru

Write-Host "Descargando por $downloadMinutes minutos..." -ForegroundColor Yellow
Start-Sleep -Seconds ($downloadMinutes * 60)

# Terminar proceso
if (-not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit()
}

# Mostrar resumen
Write-Host ""
Write-Host "Descarga completada" -ForegroundColor Green

if (Test-Path $logFile) {
    $lineCount = (Get-Content $logFile -ErrorAction SilentlyContinue).Count
    $fileInfo = Get-Item $logFile
    $sizeKB = [math]::Round($fileInfo.Length / 1024, 2)
    
    Write-Host "Líneas capturadas: $lineCount" -ForegroundColor Green
    Write-Host "Tamaño: $sizeKB KB" -ForegroundColor Green
    
    # Mostrar rango temporal
    $firstLine = Get-Content $logFile | Select-Object -First 1
    $lastLine = Get-Content $logFile | Select-Object -Last 1
    
    if ($firstLine -match '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)') {
        $startTime = $matches[1]
        Write-Host "Logs desde: $startTime" -ForegroundColor Cyan
    }
    
    if ($lastLine -match '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)') {
        $endTime = $matches[1]
        Write-Host "Logs hasta: $endTime" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "Preview (últimas 3 líneas):" -ForegroundColor Yellow
    Get-Content $logFile | Select-Object -Last 3 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
    
} else {
    Write-Host "ERROR: Archivo no encontrado" -ForegroundColor Red
}

Write-Host ""
Write-Host "Ejemplos de uso:" -ForegroundColor Cyan
Write-Host "   .\download-historical-logs.ps1 1    # Última hora" -ForegroundColor Gray
Write-Host "   .\download-historical-logs.ps1 6    # Últimas 6 horas" -ForegroundColor Gray
Write-Host "   .\download-historical-logs.ps1 24   # Último día" -ForegroundColor Gray