# Test script para verificar descarga de logs
$OutputDir = "logs\railway-downloads"

Write-Host "TEST: Descarga de logs Railway" -ForegroundColor Cyan

# Crear directorio
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Generar archivo nuevo
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-test-$timestamp.txt"

Write-Host "Descargando logs por 30 segundos..." -ForegroundColor Yellow
Write-Host "Archivo: $logFile" -ForegroundColor Gray

# Ejecutar railway logs con servicio especifico (30 segundos de prueba)
$cmd = "railway logs --service Bot-Wsp-Whapi-IA-1.0 > `"$logFile`" 2>&1"
$process = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru

# Esperar 30 segundos
Start-Sleep -Seconds 30

# Terminar proceso
if (-not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit()
}

# Mostrar resultado
if (Test-Path $logFile) {
    $content = Get-Content $logFile -ErrorAction SilentlyContinue
    $lineCount = if ($content) { $content.Count } else { 0 }
    $size = (Get-Item $logFile).Length
    Write-Host "EXITO: Logs descargados - $lineCount lineas ($size bytes)" -ForegroundColor Green
    
    # Mostrar preview de las primeras 3 lineas
    if ($content -and $content.Count -gt 0) {
        Write-Host "Preview:" -ForegroundColor Cyan
        $content | Select-Object -First 3 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
} else {
    Write-Host "ERROR: No se pudo crear el archivo" -ForegroundColor Red
}