# Script simple para descargar logs de Railway
param([string]$OutputDir = "logs\railway-downloads")

Write-Host "Railway Logs Downloader - FORZADO" -ForegroundColor Cyan

# Crear directorio si no existe
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Creado directorio: $OutputDir" -ForegroundColor Green
} else {
    # ELIMINACIÓN FORZADA de archivos anteriores
    $existingFiles = Get-ChildItem -Path $OutputDir -Filter "railway-logs-*.txt" -ErrorAction SilentlyContinue
    if ($existingFiles) {
        Write-Host "Eliminando $($existingFiles.Count) archivos anteriores..." -ForegroundColor Yellow
        
        foreach ($file in $existingFiles) {
            try {
                # Método 1: PowerShell normal
                Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                Write-Host "   ✓ Eliminado: $($file.Name)" -ForegroundColor Green
            } catch {
                Write-Host "   ⚠️ Bloqueado: $($file.Name)" -ForegroundColor Yellow
                
                # Método 2: CMD forzado
                $cmd = "del /f /q `"$($file.FullName)`""
                $result = cmd /c $cmd 2>&1
                
                if (Test-Path $file.FullName) {
                    Write-Host "   ❌ No se pudo eliminar: $($file.Name)" -ForegroundColor Red
                } else {
                    Write-Host "   ✓ Eliminado forzadamente: $($file.Name)" -ForegroundColor Green
                }
            }
        }
    }
}

# Generar archivo de logs
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-$timestamp.txt"

Write-Host ""
Write-Host "Capturando logs por 5 minutos..." -ForegroundColor Cyan
Write-Host "Archivo: $logFile" -ForegroundColor Gray

try {
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
    
    if (Test-Path $logFile) {
        $lineCount = (Get-Content $logFile).Count
        $size = (Get-Item $logFile).Length
        Write-Host "✅ Logs descargados: $lineCount líneas ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ No se pudo crear el archivo" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Cyan
Write-Host "   Get-Content `"$logFile`" | Select-String 'ERROR'" -ForegroundColor Gray
Write-Host "   Get-Content `"$logFile`" | Select-String 'MESSAGE'" -ForegroundColor Gray 