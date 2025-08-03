# Ngrok Manager Script
# Maneja problemas de sesiones simultáneas de ngrok

param(
    [string]$Action = "check"
)

Write-Host "Ngrok Manager - Gestion de sesiones" -ForegroundColor Cyan

function Show-NgrokStatus {
    Write-Host "`nEstado actual de ngrok:" -ForegroundColor Yellow
    
    # Verificar si ngrok está instalado
    $ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $ngrokPath) {
        Write-Host "Ngrok no está instalado o no está en el PATH" -ForegroundColor Red
        return $false
    }
    
    Write-Host "Ngrok está instalado" -ForegroundColor Green
    
    # Verificar sesiones activas
    try {
        $sessions = ngrok api tunnels list 2>$null
        if ($sessions) {
            Write-Host "Hay sesiones activas de ngrok" -ForegroundColor Yellow
            Write-Host "Visita: https://dashboard.ngrok.com/agents" -ForegroundColor Cyan
            return $false
        }
    } catch {
        Write-Host "No se pudo verificar sesiones (normal si no hay autenticacion)" -ForegroundColor Gray
    }
    
    return $true
}

function Start-NgrokAlternative {
    Write-Host "`nIniciando alternativa sin ngrok..." -ForegroundColor Green
    
    # Opción 1: Solo el bot sin ngrok
    Write-Host "`nOpciones disponibles:" -ForegroundColor Yellow
    Write-Host "1. Solo bot (sin ngrok) - puerto 3008" -ForegroundColor White
    Write-Host "2. Usar localtunnel (alternativa a ngrok)" -ForegroundColor White
    Write-Host "3. Usar serveo (alternativa gratuita)" -ForegroundColor White
    Write-Host "4. Configurar ngrok con archivo de configuracion" -ForegroundColor White
    
    $choice = Read-Host "`nSelecciona una opcion (1-4)"
    
    switch ($choice) {
        "1" {
            Write-Host "`nIniciando solo el bot..." -ForegroundColor Green
            npm run dev
        }
        "2" {
            Write-Host "`nInstalando localtunnel..." -ForegroundColor Green
            npm install -g localtunnel
            Write-Host "`nIniciando con localtunnel..." -ForegroundColor Green
            Start-Process powershell -ArgumentList "-Command", "concurrently -k -n BOT,TUNNEL -c green,cyan `"npm run dev`" `"lt --port 3008 --subdomain tealquilamos-bot`""
        }
        "3" {
            Write-Host "`nIniciando con serveo..." -ForegroundColor Green
            Start-Process powershell -ArgumentList "-Command", "concurrently -k -n BOT,TUNNEL -c green,cyan `"npm run dev`" `"ssh -R 80:localhost:3008 serveo.net`""
        }
        "4" {
            Write-Host "`nConfigurando ngrok con archivo..." -ForegroundColor Green
            Setup-NgrokConfig
        }
        default {
            Write-Host "Opcion invalida" -ForegroundColor Red
        }
    }
}

function Setup-NgrokConfig {
    Write-Host "`nConfigurando ngrok con archivo de configuracion..." -ForegroundColor Green
    
    $configPath = "$env:USERPROFILE\.ngrok2\ngrok.yml"
    $configDir = Split-Path $configPath -Parent
    
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $config = @"
version: "2"
authtoken: YOUR_AUTH_TOKEN_HERE
tunnels:
  bot-tunnel:
    proto: http
    addr: 3008
    domain: actual-bobcat-handy.ngrok-free.app
"@
    
    $config | Out-File -FilePath $configPath -Encoding UTF8
    Write-Host "Archivo de configuracion creado en: $configPath" -ForegroundColor Green
    Write-Host "Edita el archivo y reemplaza YOUR_AUTH_TOKEN_HERE con tu token" -ForegroundColor Yellow
    Write-Host "Luego usa: ngrok start --all" -ForegroundColor Cyan
}

function Kill-NgrokSessions {
    Write-Host "`nIntentando terminar sesiones de ngrok..." -ForegroundColor Yellow
    
    try {
        # Terminar procesos de ngrok
        Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "Procesos de ngrok terminados" -ForegroundColor Green
    } catch {
        Write-Host "No se encontraron procesos de ngrok ejecutandose" -ForegroundColor Gray
    }
    
    Write-Host "`nPara terminar sesiones remotas:" -ForegroundColor Yellow
    Write-Host "1. Ve a: https://dashboard.ngrok.com/agents" -ForegroundColor Cyan
    Write-Host "2. Termina las sesiones activas" -ForegroundColor Cyan
    Write-Host "3. Vuelve a intentar: npm run dev:local" -ForegroundColor Cyan
}

# Ejecutar según la acción
switch ($Action.ToLower()) {
    "check" {
        $canStart = Show-NgrokStatus
        if (-not $canStart) {
            Write-Host "`nQue quieres hacer?" -ForegroundColor Yellow
            Write-Host "1. Terminar sesiones de ngrok" -ForegroundColor White
            Write-Host "2. Usar alternativa sin ngrok" -ForegroundColor White
            Write-Host "3. Configurar ngrok con archivo" -ForegroundColor White
            
            $choice = Read-Host "`nSelecciona una opcion (1-3)"
            
            switch ($choice) {
                "1" { Kill-NgrokSessions }
                "2" { Start-NgrokAlternative }
                "3" { Setup-NgrokConfig }
                default { Write-Host "Opcion invalida" -ForegroundColor Red }
            }
        } else {
            Write-Host "`nNgrok esta listo para usar" -ForegroundColor Green
            Write-Host "Ejecuta: npm run dev:local" -ForegroundColor Cyan
        }
    }
    "kill" { Kill-NgrokSessions }
    "alternative" { Start-NgrokAlternative }
    "config" { Setup-NgrokConfig }
    default {
        Write-Host "Accion no reconocida. Usa: check, kill, alternative, config" -ForegroundColor Red
    }
}

Write-Host "`nNgrok Manager completado" -ForegroundColor Green 