# Script para filtrar logs de Railway
# Uso: .\filter-railway-logs.ps1 [filter-type] [log-file]
param(
    [string]$FilterType = "all",
    [string]$LogFile = $null
)

Write-Host "Railway Logs Filter" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

# Si no se especifica archivo, usar el más reciente
if (-not $LogFile) {
    $latestLog = Get-ChildItem "logs\railway-downloads\railway-logs-*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestLog) {
        $LogFile = $latestLog.FullName
        Write-Host "Usando archivo más reciente: $($latestLog.Name)" -ForegroundColor Green
    } else {
        Write-Host "ERROR: No se encontraron archivos de logs" -ForegroundColor Red
        Write-Host "Ejecuta primero: .\download-railway-logs.ps1" -ForegroundColor Yellow
        exit 1
    }
}

if (-not (Test-Path $LogFile)) {
    Write-Host "ERROR: Archivo no encontrado: $LogFile" -ForegroundColor Red
    exit 1
}

Write-Host "Filtrando: $FilterType" -ForegroundColor Yellow
Write-Host "Archivo: $LogFile" -ForegroundColor Gray

# Definir filtros disponibles
$filters = @{
    "errors" = @("ERROR", "FATAL", "ALERT")
    "warnings" = @("WARN", "WARNING")
    "messages" = @("MESSAGE_RECEIVED", "MESSAGE_SENT", "MESSAGE_PROCESS")
    "openai" = @("OPENAI_REQUEST", "OPENAI_RESPONSE")
    "beds24" = @("BEDS24_REQUEST", "BEDS24_RESPONSE", "BEDS24_API_CALL")
    "context" = @("CONTEXT_INJECTION", "CONTEXT_DEBUG", "CONTEXT_CACHE")
    "threads" = @("THREAD_CREATED", "THREAD_PERSIST", "THREAD_CLEANUP")
    "webhook" = @("WEBHOOK", "WHAPI")
    "memory" = @("GUEST_MEMORY", "SYNC_NEEDED")
    "all" = @("*")
}

if (-not $filters.ContainsKey($FilterType)) {
    Write-Host "ERROR: Tipo de filtro no válido: $FilterType" -ForegroundColor Red
    Write-Host "Tipos disponibles:" -ForegroundColor Yellow
    $filters.Keys | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    exit 1
}

$patterns = $filters[$FilterType]

Write-Host ""
Write-Host "Resultados del filtro '$FilterType':" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

if ($patterns -eq "*") {
    # Mostrar todas las líneas
    Get-Content $LogFile | Select-Object -Last 20
} else {
    # Aplicar filtros específicos
    $results = Get-Content $LogFile | Select-String $patterns
    if ($results) {
        $results | Select-Object -Last 20 | ForEach-Object {
            Write-Host $_ -ForegroundColor White
        }
    } else {
        Write-Host "No se encontraron resultados para el filtro '$FilterType'" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Comandos adicionales:" -ForegroundColor Cyan
Write-Host "   .\filter-railway-logs.ps1 errors" -ForegroundColor Gray
Write-Host "   .\filter-railway-logs.ps1 openai" -ForegroundColor Gray
Write-Host "   .\filter-railway-logs.ps1 messages" -ForegroundColor Gray
Write-Host "   .\filter-railway-logs.ps1 all" -ForegroundColor Gray 