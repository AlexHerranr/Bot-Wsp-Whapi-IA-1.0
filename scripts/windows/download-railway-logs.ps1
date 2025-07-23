# Script para descargar logs de Railway de los últimos 10 minutos
# Uso: .\download-railway-logs.ps1 [output-dir]
param(
    [string]$OutputDir = "logs\railway-downloads"
)

Write-Host "Railway Logs Downloader" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

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

# Crear directorio de salida si no existe
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Creado directorio: $OutputDir" -ForegroundColor Green
}

# Generar timestamp para el archivo
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "$OutputDir\railway-logs-$timestamp.txt"

Write-Host ""
Write-Host "Descargando logs..." -ForegroundColor Yellow
Write-Host "   Archivo: $logFile" -ForegroundColor Gray

# Descargar logs usando un método más simple
Write-Host "Capturando logs por 30 segundos..." -ForegroundColor Cyan
try {
    # Usar cmd para ejecutar railway logs y redirigir la salida
    $cmd = "railway logs > `"$logFile`" 2>&1"
    
    # Crear un proceso que ejecute el comando
    $process = Start-Process -FilePath "cmd" -ArgumentList "/c", $cmd -NoNewWindow -PassThru
    
    # Esperar 30 segundos
    Start-Sleep -Seconds 30
    
    # Terminar el proceso
    if (-not $process.HasExited) {
        $process.Kill()
        $process.WaitForExit()
    }
    
    if (Test-Path $logFile) {
        $txtSize = (Get-Item $logFile).Length
        $lineCount = (Get-Content $logFile).Count
        Write-Host "Logs descargados: $lineCount líneas ($txtSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "ERROR: No se pudo crear el archivo de logs" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR al descargar logs: $($_.Exception.Message)" -ForegroundColor Red
}

# Mostrar resumen
Write-Host ""
Write-Host "Resumen de descarga:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan

if (Test-Path $logFile) {
    $lineCount = (Get-Content $logFile).Count
    $txtSize = (Get-Item $logFile).Length
    Write-Host "TXT: $lineCount líneas ($txtSize bytes)" -ForegroundColor Green
    
    # Mostrar las últimas 5 líneas como preview
    Write-Host ""
    Write-Host "Preview (últimas 5 líneas):" -ForegroundColor Yellow
    Get-Content $logFile | Select-Object -Last 5 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
} else {
    Write-Host "ERROR: No se encontró el archivo de logs" -ForegroundColor Red
}

Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Cyan
Write-Host "   Get-Content $logFile | Select-String 'ERROR|WARN|FATAL'" -ForegroundColor Gray
Write-Host "   Get-Content $logFile | Select-String 'MESSAGE_RECEIVED|MESSAGE_SENT'" -ForegroundColor Gray
Write-Host "   Get-Content $logFile | Select-String 'OPENAI_REQUEST|OPENAI_RESPONSE'" -ForegroundColor Gray
Write-Host ""
Write-Host "Para filtrar logs específicos:" -ForegroundColor Yellow
Write-Host "   .\enterprise-logs.ps1 50" -ForegroundColor Gray
Write-Host "   .\simple-logs.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Configuración inicial:" -ForegroundColor Yellow
Write-Host "   npm install -g @railway/cli" -ForegroundColor Gray
Write-Host "   railway login" -ForegroundColor Gray
Write-Host "   railway link" -ForegroundColor Gray 