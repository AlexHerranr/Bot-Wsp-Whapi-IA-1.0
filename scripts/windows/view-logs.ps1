# Script para visualizar logs del bot TeAlquilamos
# Uso: .\view-logs.ps1 [opciones]
# Opciones: tail, errors, recent

param(
    [string]$Action = "recent",
    [int]$Lines = 50,
    [int]$Minutes = 60
)

$LogsDir = "..\..\logs"
$LogFile = Join-Path $LogsDir "bot-$(Get-Date -Format 'yyyy-MM-dd').log"

# Colores para diferentes tipos de logs
$Colors = @{
    'INFO' = 'Cyan'
    'SUCCESS' = 'Green'
    'WARNING' = 'Yellow'
    'ERROR' = 'Red'
    'DEBUG' = 'Magenta'
}

# Funciones auxiliares
function Format-LogEntry {
    param($LogEntry)
    
    try {
        $log = $LogEntry | ConvertFrom-Json
        $timestamp = [DateTime]::Parse($log.timestamp).ToString("HH:mm:ss")
        $color = $Colors[$log.level]
        
        # Formato con colores
        Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
        Write-Host "[$($log.level)] " -NoNewline -ForegroundColor $color
        Write-Host "$($log.category): " -NoNewline -ForegroundColor White
        Write-Host $log.message -ForegroundColor Gray
        
        # Mostrar detalles si existen y no están vacíos
        if ($log.details -and ($log.details | Get-Member -MemberType NoteProperty).Count -gt 0) {
            Write-Host "  Details: $($log.details | ConvertTo-Json -Compress)" -ForegroundColor DarkGray
        }
    }
    catch {
        # Si no es JSON válido, mostrar línea raw
        Write-Host $LogEntry -ForegroundColor DarkGray
    }
}

function Show-Help {
    Write-Host @"
🤖 BOT TEALQUILAMOS - VISUALIZADOR DE LOGS TÉCNICOS
=======================================================

OPCIONES:
  tail                    - Ver logs en tiempo real
  recent [lines]          - Ver últimas N líneas (default: 50)
  errors [minutes]        - Solo errores de últimos N minutos (default: 60)

EJEMPLOS:
  .\view-logs.ps1 tail
  .\view-logs.ps1 recent 100
  .\view-logs.ps1 errors 30

ARCHIVOS:
  Logs: $LogFile
  Directorio: $LogsDir
"@ -ForegroundColor Yellow
}

# Verificar que existe el archivo de logs
if (-not (Test-Path $LogFile)) {
    Write-Host "❌ Archivo de logs no encontrado: $LogFile" -ForegroundColor Red
    Write-Host "💡 Asegúrate de que el bot esté corriendo o haya corrido hoy" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Archivo de logs: $LogFile" -ForegroundColor Green
Write-Host "📊 Tamaño: $([math]::Round((Get-Item $LogFile).Length / 1KB, 2)) KB" -ForegroundColor Cyan
Write-Host ""

switch ($Action.ToLower()) {
    "tail" {
        Write-Host "🔄 LOGS EN TIEMPO REAL (Ctrl+C para salir)" -ForegroundColor Yellow
        Write-Host "=" * 60 -ForegroundColor Gray
        
        Get-Content $LogFile -Tail 10 | ForEach-Object { Format-LogEntry $_ }
        Write-Host ""
        
        Get-Content $LogFile -Wait -Tail 0 | ForEach-Object { 
            Format-LogEntry $_
        }
    }
    
    "errors" {
        Write-Host "❌ ERRORES DE LOS ÚLTIMOS $Minutes MINUTOS" -ForegroundColor Red
        Write-Host "=" * 60 -ForegroundColor Gray
        
        $cutoffTime = (Get-Date).AddMinutes(-$Minutes)
        $errorCount = 0
        
        Get-Content $LogFile | ForEach-Object {
            try {
                $log = $_ | ConvertFrom-Json
                $logTime = [DateTime]::Parse($log.timestamp)
                
                if ($log.level -eq "ERROR" -and $logTime -gt $cutoffTime) {
                    Format-LogEntry $_
                    $errorCount++
                }
            }
            catch {
                # Ignorar líneas que no son JSON
            }
        }
        
        Write-Host ""
        if ($errorCount -eq 0) {
            Write-Host "✅ No se encontraron errores en los últimos $Minutes minutos" -ForegroundColor Green
        } else {
            Write-Host "📊 Total de errores encontrados: $errorCount" -ForegroundColor Red
        }
    }
    
    "recent" {
        Write-Host "📋 ÚLTIMAS $Lines LÍNEAS DE LOG" -ForegroundColor Cyan
        Write-Host "=" * 60 -ForegroundColor Gray
        
        Get-Content $LogFile -Tail $Lines | ForEach-Object {
            Format-LogEntry $_
        }
    }
    
    "help" {
        Show-Help
    }
    
    default {
        Write-Host "❌ Opción no válida: $Action" -ForegroundColor Red
        Write-Host ""
        Show-Help
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Visualización completada" -ForegroundColor Green 