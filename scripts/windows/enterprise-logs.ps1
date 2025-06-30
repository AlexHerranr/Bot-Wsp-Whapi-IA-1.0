# Script Enterprise para visualizar logs con Correlation IDs
# Uso: .\enterprise-logs.ps1 [lines] [userId]
param(
    [int]$Lines = 20,
    [string]$UserId = $null,
    [string]$CorrelationId = $null
)

$LogFile = "logs\bot-$(Get-Date -Format 'yyyy-MM-dd').log"

Write-Host "🏢 Enterprise Logs - Bot TeAlquilamos" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Archivo: $LogFile" -ForegroundColor Gray

if (-not (Test-Path $LogFile)) {
    Write-Host "❌ ERROR: Archivo de logs no encontrado" -ForegroundColor Red
    exit 1
}

# Función para extraer información del log
function Parse-LogLine {
    param($Line)
    
    # Formato: [timestamp] [level] category [file] {correlationId}: message
    if ($Line -match '^\[([^\]]+)\] \[([^\]]+)\] ([A-Z_]+)(?:\s*\[([^\]]+)\])?(?:\s*\{([^}]+)\})?: (.+)$') {
        return @{
            Timestamp = $matches[1]
            Level = $matches[2]
            Category = $matches[3]
            File = if ($matches[4]) { $matches[4] } else { "unknown" }
            CorrelationId = if ($matches[5]) { $matches[5] } else { $null }
            Message = $matches[6]
            OriginalLine = $Line
        }
    }
    return $null
}

# Función para formatear colores
function Get-LogColor {
    param($Level)
    switch ($Level) {
        "INFO" { return "Cyan" }
        "SUCCESS" { return "Green" }
        "WARNING" { return "Yellow" }
        "ERROR" { return "Red" }
        "DEBUG" { return "Magenta" }
        default { return "White" }
    }
}

# Leer y procesar logs
$logLines = Get-Content $LogFile -Tail $Lines

Write-Host ""
Write-Host "Últimas $Lines líneas:" -ForegroundColor Yellow

# Filtrar por usuario o correlation ID si se especifica
if ($UserId -or $CorrelationId) {
    if ($UserId) {
        Write-Host "🔍 Filtrando por usuario: $UserId" -ForegroundColor Gray
    }
    if ($CorrelationId) {
        Write-Host "🔍 Filtrando por correlation ID: $CorrelationId" -ForegroundColor Gray
    }
    Write-Host ""
}

foreach ($line in $logLines) {
    $parsed = Parse-LogLine $line
    
    if ($parsed) {
        # Aplicar filtros
        if ($UserId -and $parsed.Message -notmatch $UserId) { continue }
        if ($CorrelationId -and $parsed.CorrelationId -ne $CorrelationId) { continue }
        
        $color = Get-LogColor $parsed.Level
        $time = [DateTime]::Parse($parsed.Timestamp).ToString("HH:mm:ss")
        $corrDisplay = if ($parsed.CorrelationId) { " [$($parsed.CorrelationId.Substring(4, 4))]" } else { "" }
        
        # Formato enterprise mejorado
        Write-Host "[$time]" -ForegroundColor Gray -NoNewline
        Write-Host " [$($parsed.Level)]" -ForegroundColor $color -NoNewline
        Write-Host " $($parsed.Category)" -ForegroundColor White -NoNewline
        Write-Host " [$($parsed.File)]" -ForegroundColor DarkGray -NoNewline
        Write-Host $corrDisplay -ForegroundColor Yellow -NoNewline
        Write-Host ": " -ForegroundColor Gray -NoNewline
        Write-Host $parsed.Message -ForegroundColor White
    } else {
        # Línea que no se pudo parsear
        Write-Host $line -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "💡 Uso avanzado:" -ForegroundColor Cyan
Write-Host "  .\enterprise-logs.ps1 50           # Últimas 50 líneas" -ForegroundColor Gray
Write-Host "  .\enterprise-logs.ps1 30 573003   # Filtrar por usuario" -ForegroundColor Gray
Write-Host "  .\enterprise-logs.ps1 20 '' req_  # Filtrar por correlation ID" -ForegroundColor Gray 