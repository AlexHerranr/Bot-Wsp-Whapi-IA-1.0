# Script para descargar todos los logs de Railway desde el inicio de la aplicación
# Uso: .\download-full-railway-logs.ps1 [output-dir]
param(
    [string]$OutputDir = "logs\railway-downloads"
)

Write-Host "Railway FULL Logs Downloader" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# Verificar si Railway CLI está instalado
try {
    $railwayVersion = railway --version 2>$null
    if (-not $railwayVersion) {
        Write-Host "ERROR: Railway CLI no está instalado" -ForegroundColor Red
        Write-Host "Instala con: npm install -g @railway/cli" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Railway CLI encontrado: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Railway CLI no está disponible" -ForegroundColor Red
    exit 1
}

# Verificar autenticación con Railway
Write-Host "Verificando autenticación..." -ForegroundColor Yellow
try {
    $authCheck = railway whoami 2>$null
    if (-not $authCheck -or $authCheck -match "not logged in") {
        Write-Host "ERROR: No estás autenticado en Railway" -ForegroundColor Red
        Write-Host "Ejecuta: railway login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Autenticado como: $authCheck" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo verificar autenticación" -ForegroundColor Red
    Write-Host "Ejecuta: railway login" -ForegroundColor Yellow
    exit 1
}

# Verificar que el proyecto esté enlazado
Write-Host "Verificando enlace del proyecto..." -ForegroundColor Yellow
try {
    $projectInfo = railway status 2>$null
    if (-not $projectInfo) {
        Write-Host "ERROR: Proyecto no enlazado" -ForegroundColor Red
        Write-Host "Ejecuta: railway link" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Proyecto enlazado correctamente" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo verificar el enlace del proyecto" -ForegroundColor Red
    Write-Host "Ejecuta: railway link" -ForegroundColor Yellow
    exit 1
}

# Crear directorio
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Creado directorio: $OutputDir" -ForegroundColor Green
}

# Generar archivo nuevo con el mismo formato que el script original
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-$timestamp.txt"

Write-Host ""
Write-Host "Descargando TODOS los logs desde el inicio..." -ForegroundColor Cyan
Write-Host "Archivo: $logFile" -ForegroundColor Gray
Write-Host "Nota: Esto puede tomar varios minutos dependiendo del historial" -ForegroundColor Yellow

# Ejecutar railway logs para obtener todos los logs disponibles del deployment actual
# Railway logs por defecto muestra todo el historial disponible del deployment
$cmd = "railway logs > `"$logFile`" 2>&1"
$process = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru

# Dejar que descargue por más tiempo para capturar historial más extenso
Write-Host "Descargando logs por 2 minutos para capturar máximo historial..." -ForegroundColor Yellow
Start-Sleep -Seconds 120

# Terminar proceso
if (-not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit()
}

Write-Host "Descarga completada" -ForegroundColor Green

# Mostrar resumen
Write-Host ""
Write-Host "Resumen de descarga:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan

if (Test-Path $logFile) {
    $lineCount = (Get-Content $logFile -ErrorAction SilentlyContinue).Count
    $fileInfo = Get-Item $logFile
    $txtSize = $fileInfo.Length
    $sizeKB = [math]::Round($txtSize / 1024, 2)
    $sizeMB = [math]::Round($txtSize / 1048576, 2)
    
    Write-Host "Archivo: $($fileInfo.Name)" -ForegroundColor Green
    Write-Host "Líneas: $lineCount" -ForegroundColor Green
    Write-Host "Tamaño: $sizeKB KB ($sizeMB MB)" -ForegroundColor Green
    Write-Host "Creado: $($fileInfo.CreationTime)" -ForegroundColor Green
    
    # Mostrar las primeras 3 líneas (inicio de la sesión)
    Write-Host ""
    Write-Host "Inicio de logs (primeras 3 líneas):" -ForegroundColor Yellow
    Get-Content $logFile | Select-Object -First 3 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
    
    Write-Host "   ..." -ForegroundColor DarkGray
    
    # Mostrar las últimas 3 líneas (estado actual)
    Write-Host ""
    Write-Host "Estado actual (últimas 3 líneas):" -ForegroundColor Yellow
    Get-Content $logFile | Select-Object -Last 3 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
    
} else {
    Write-Host "ERROR: No se encontró el archivo de logs" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Comandos útiles para análisis:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Errores y warnings:" -ForegroundColor Yellow
Write-Host "   Get-Content '$logFile' | Select-String 'ERROR|WARN|FATAL'" -ForegroundColor Gray
Write-Host ""
Write-Host "Actividad de mensajes:" -ForegroundColor Yellow  
Write-Host "   Get-Content '$logFile' | Select-String 'MESSAGE_RECEIVED|MESSAGE_SENT'" -ForegroundColor Gray
Write-Host ""
Write-Host "Interacciones con OpenAI:" -ForegroundColor Yellow
Write-Host "   Get-Content '$logFile' | Select-String 'OPENAI_REQUEST|OPENAI_RESPONSE'" -ForegroundColor Gray
Write-Host ""
Write-Host "Inicios y reinicios del bot:" -ForegroundColor Yellow
Write-Host "   Get-Content '$logFile' | Select-String 'BOT_START|APPLICATION_START|RESTART'" -ForegroundColor Gray
Write-Host ""
Write-Host "Timeline de eventos críticos:" -ForegroundColor Yellow
Write-Host "   Get-Content '$logFile' | Select-String 'START|STOP|ERROR|RESTART' | Select-Object -First 20" -ForegroundColor Gray
Write-Host ""
Write-Host "Para análisis específicos:" -ForegroundColor Yellow
Write-Host "   .\enterprise-logs.ps1 100" -ForegroundColor Gray
Write-Host "   .\simple-logs.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "¡Descarga completa finalizada!" -ForegroundColor Green