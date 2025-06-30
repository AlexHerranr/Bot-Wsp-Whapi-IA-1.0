# Simple log viewer para Bot TeAlquilamos
param(
    [int]$Lines = 20
)

$LogFile = "logs\bot-$(Get-Date -Format 'yyyy-MM-dd').log"

Write-Host "Bot TeAlquilamos - Logs Técnicos" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Archivo: $LogFile" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $LogFile)) {
    Write-Host "ERROR: Archivo de logs no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "Últimas $Lines líneas:" -ForegroundColor Yellow
Write-Host ""

Get-Content $LogFile -Tail $Lines | ForEach-Object {
    try {
        $log = $_ | ConvertFrom-Json
        $time = [DateTime]::Parse($log.timestamp).ToString("HH:mm:ss")
        
        $color = switch ($log.level) {
            "ERROR" { "Red" }
            "SUCCESS" { "Green" }
            "WARNING" { "Yellow" }
            default { "Cyan" }
        }
        
        Write-Host "[$time] [$($log.level)] $($log.category): $($log.message)" -ForegroundColor $color
    }
    catch {
        Write-Host $_ -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Visualización completada" -ForegroundColor Green 