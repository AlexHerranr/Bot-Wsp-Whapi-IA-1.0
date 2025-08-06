# Script ultra simple para eliminar archivos y descargar logs
param([string]$OutputDir = "logs\railway-downloads")

Write-Host "Eliminación FORZADA de logs" -ForegroundColor Cyan

# Crear directorio
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Creado directorio: $OutputDir" -ForegroundColor Green
}

# ELIMINACIÓN FORZADA
$existingFiles = Get-ChildItem -Path $OutputDir -Filter "railway-logs-*.txt" -ErrorAction SilentlyContinue
if ($existingFiles) {
    Write-Host "Eliminando $($existingFiles.Count) archivos..." -ForegroundColor Yellow
    
    foreach ($file in $existingFiles) {
        # Intentar eliminación normal
        try {
            Remove-Item -Path $file.FullName -Force
            Write-Host "   ✓ $($file.Name)" -ForegroundColor Green
        } catch {
            # Eliminación forzada con CMD
            $cmd = "del /f /q `"$($file.FullName)`""
            cmd /c $cmd 2>$null
            
            if (Test-Path $file.FullName) {
                Write-Host "   ❌ $($file.Name) - BLOQUEADO" -ForegroundColor Red
            } else {
                Write-Host "   ✓ $($file.Name) - FORZADO" -ForegroundColor Green
            }
        }
    }
}

# Generar archivo nuevo
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-$timestamp.txt"

Write-Host ""
Write-Host "Descargando logs por 5 minutos..." -ForegroundColor Cyan
Write-Host "Archivo: $logFile" -ForegroundColor Gray

# Ejecutar railway logs
$cmd = "railway logs > `"$logFile`" 2>&1"
$process = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru

# Esperar 5 minutos
Start-Sleep -Seconds 300

# Terminar proceso
if (-not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit()
}

# Mostrar resultado
if (Test-Path $logFile) {
    $lineCount = (Get-Content $logFile).Count
    $size = (Get-Item $logFile).Length
    Write-Host "✅ Logs descargados: $lineCount líneas ($size bytes)" -ForegroundColor Green
} else {
    Write-Host "❌ No se pudo crear el archivo" -ForegroundColor Red
} 