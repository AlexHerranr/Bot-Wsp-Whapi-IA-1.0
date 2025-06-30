# Script para iniciar Bot WhatsApp + ngrok en una sola terminal
param(
    [switch]$Verbose
)

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

function Test-Port {
    param($Port)
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        return $connection -ne $null
    } catch {
        return $false
    }
}

function Wait-ForPort {
    param($Port, $Timeout = 30)
    $startTime = Get-Date
    Write-Log "Esperando que el puerto $Port este disponible..." "INFO"
    
    while ((Get-Date) -lt ($startTime.AddSeconds($Timeout))) {
        if (Test-Port $Port) {
            Write-Log "Puerto $Port esta disponible" "SUCCESS"
            return $true
        }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    Write-Host ""
    Write-Log "Timeout: El puerto $Port no esta disponible despues de $Timeout segundos" "ERROR"
    return $false
}

# ===== INICIO DEL SCRIPT =====
Write-Log "Iniciando Bot TeAlquilamos con IA..." "INFO"
Write-Log "==========================================" "INFO"

# Paso 1: Detener procesos existentes
Write-Log "Paso 1/4: Deteniendo procesos existentes..." "INFO"
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
$ngrokProcesses = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Log "Deteniendo $($nodeProcesses.Count) proceso(s) de Node.js..." "WARNING"
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
}

if ($ngrokProcesses) {
    Write-Log "Deteniendo $($ngrokProcesses.Count) proceso(s) de ngrok..." "WARNING"
    Stop-Process -Name "ngrok" -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2
Write-Log "Procesos detenidos correctamente" "SUCCESS"

# Paso 2: Verificar que el puerto 3008 este libre
Write-Log "Paso 2/4: Verificando puerto 3008..." "INFO"
if (Test-Port 3008) {
    Write-Log "Puerto 3008 aun esta en uso. Esperando liberacion..." "WARNING"
    Start-Sleep -Seconds 3
    if (Test-Port 3008) {
        Write-Log "Error: Puerto 3008 no se libero" "ERROR"
        exit 1
    }
}
Write-Log "Puerto 3008 esta libre" "SUCCESS"

# Paso 3: Iniciar el bot
Write-Log "Paso 3/4: Iniciando aplicacion..." "INFO"
Write-Log "Ejecutando: npm run dev" "INFO"

# Iniciar el bot en segundo plano
$botJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev
}

Write-Log "Aplicacion iniciada en segundo plano" "SUCCESS"

# Esperar a que el bot se inicie
Write-Log "Esperando que la aplicacion se inicie..." "INFO"
if (Wait-ForPort 3008 30) {
    Write-Log "Aplicacion iniciada correctamente en puerto 3008" "SUCCESS"
} else {
    Write-Log "Error: La aplicacion no se inicio correctamente" "ERROR"
    Stop-Job $botJob -ErrorAction SilentlyContinue
    exit 1
}

# Paso 4: Iniciar ngrok
Write-Log "Paso 4/4: Ejecutando ngrok..." "INFO"
Write-Log "Ejecutando: ngrok http 3008 --domain=actual-bobcat-handy.ngrok-free.app" "INFO"

# Iniciar ngrok en segundo plano
$ngrokJob = Start-Job -ScriptBlock {
    ngrok http 3008 --domain=actual-bobcat-handy.ngrok-free.app
}

Write-Log "ngrok iniciado en segundo plano" "SUCCESS"

# Esperar un momento para que ngrok se conecte
Start-Sleep -Seconds 5

# ===== RESUMEN FINAL =====
Write-Log "==========================================" "INFO"
Write-Log "Bot iniciado correctamente!" "SUCCESS"
Write-Log "URL del bot: https://actual-bobcat-handy.ngrok-free.app" "INFO"
Write-Log "Monitoreo: http://localhost:4040" "INFO"
Write-Log "Logs de la aplicacion:" "INFO"

# Mostrar logs en tiempo real
Write-Log "Presiona Ctrl+C para detener todo" "WARNING"
Write-Log "==========================================" "INFO"

try {
    while ($true) {
        # Mostrar logs del bot
        $botOutput = Receive-Job $botJob -ErrorAction SilentlyContinue
        if ($botOutput) {
            foreach ($line in $botOutput) {
                Write-Host $line
            }
        }
        
        # Verificar que los procesos sigan corriendo
        if ((Get-Job $botJob).State -eq "Failed") {
            Write-Log "La aplicacion se detuvo inesperadamente" "ERROR"
            break
        }
        
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Log "Deteniendo todos los procesos..." "WARNING"
} finally {
    # Limpiar
    Stop-Job $botJob -ErrorAction SilentlyContinue
    Stop-Job $ngrokJob -ErrorAction SilentlyContinue
    Remove-Job $botJob -ErrorAction SilentlyContinue
    Remove-Job $ngrokJob -ErrorAction SilentlyContinue
    
    Write-Log "Todos los procesos detenidos" "INFO"
} 