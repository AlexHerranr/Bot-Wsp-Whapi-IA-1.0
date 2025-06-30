# Script para detener Bot WhatsApp + ngrok
function Write-Log {
    param($Message, $Type = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Type) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Type] $Message" -ForegroundColor $color
}

Write-Log "Deteniendo Bot TeAlquilamos con IA..." "INFO"
Write-Log "==========================================" "INFO"

# Detener procesos de Node.js
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Log "Deteniendo $($nodeProcesses.Count) proceso(s) de Node.js..." "WARNING"
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Log "Procesos de Node.js detenidos" "SUCCESS"
} else {
    Write-Log "No hay procesos de Node.js ejecutandose" "INFO"
}

# Detener procesos de ngrok
$ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
if ($ngrokProcesses) {
    Write-Log "Deteniendo $($ngrokProcesses.Count) proceso(s) de ngrok..." "WARNING"
    Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue
    Write-Log "Procesos de ngrok detenidos" "SUCCESS"
} else {
    Write-Log "No hay procesos de ngrok ejecutandose" "INFO"
}

# Verificar que el puerto 3008 este libre
Start-Sleep -Seconds 2
$portInUse = Get-NetTCPConnection -LocalPort 3008 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Log "Puerto 3008 aun esta en uso. Forzando liberacion..." "WARNING"
    Stop-Process -Id $portInUse.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Log "==========================================" "INFO"
Write-Log "Bot detenido correctamente!" "SUCCESS"
Write-Log "Todos los procesos han sido terminados" "INFO" 