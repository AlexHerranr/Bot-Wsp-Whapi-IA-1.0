# Script para configurar Railway CLI y autenticación
# Uso: .\setup-railway.ps1

Write-Host "Railway Setup - Bot TeAlquilamos" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Verificar si Node.js está instalado
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) {
        Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
        Write-Host "Descarga desde: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js no está disponible" -ForegroundColor Red
    exit 1
}

# Verificar si npm está disponible
Write-Host "Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>$null
    if (-not $npmVersion) {
        Write-Host "ERROR: npm no está disponible" -ForegroundColor Red
        exit 1
    }
    Write-Host "npm encontrado: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: npm no está disponible" -ForegroundColor Red
    exit 1
}

# Instalar Railway CLI globalmente
Write-Host "Instalando Railway CLI..." -ForegroundColor Yellow
try {
    npm install -g @railway/cli
    Write-Host "Railway CLI instalado correctamente" -ForegroundColor Green
} catch {
    Write-Host "ERROR: No se pudo instalar Railway CLI" -ForegroundColor Red
    Write-Host "Intenta ejecutar como administrador" -ForegroundColor Yellow
    exit 1
}

# Verificar instalación
Write-Host "Verificando instalación..." -ForegroundColor Yellow
try {
    $railwayVersion = railway --version 2>$null
    Write-Host "Railway CLI verificado: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Railway CLI no se instaló correctamente" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configuración de autenticación:" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Verificar si ya está autenticado
Write-Host "Verificando autenticación actual..." -ForegroundColor Yellow
try {
    $currentUser = railway whoami 2>$null
    if ($currentUser -and $currentUser -notmatch "not logged in") {
        Write-Host "Ya estás autenticado como: $currentUser" -ForegroundColor Green
        $skipAuth = $true
    } else {
        $skipAuth = $false
    }
} catch {
    $skipAuth = $false
}

# Proceso de autenticación
if (-not $skipAuth) {
    Write-Host "Iniciando proceso de autenticación..." -ForegroundColor Yellow
    Write-Host "Se abrirá tu navegador para autenticarte" -ForegroundColor Cyan
    
    try {
        railway login
        Write-Host "Autenticación completada" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: No se pudo completar la autenticación" -ForegroundColor Red
        Write-Host "Ejecuta manualmente: railway login" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Configuración de proyecto:" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Verificar si el proyecto ya está enlazado
Write-Host "Verificando enlace del proyecto..." -ForegroundColor Yellow
try {
    $projectInfo = railway status 2>$null
    if ($projectInfo) {
        Write-Host "Proyecto ya está enlazado" -ForegroundColor Green
        Write-Host "   $projectInfo" -ForegroundColor Gray
    } else {
        Write-Host "Enlazando proyecto..." -ForegroundColor Yellow
        railway link
        Write-Host "Proyecto enlazado correctamente" -ForegroundColor Green
    }
} catch {
    Write-Host "ERROR: No se pudo verificar/enlazar el proyecto" -ForegroundColor Red
    Write-Host "Ejecuta manualmente: railway link" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Resumen de configuración:" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
Write-Host "npm: $npmVersion" -ForegroundColor Green
Write-Host "Railway CLI: $railwayVersion" -ForegroundColor Green

if ($skipAuth) {
    Write-Host "Autenticación: Ya configurada ($currentUser)" -ForegroundColor Green
} else {
    Write-Host "Autenticación: Configurada" -ForegroundColor Green
}

Write-Host "Proyecto: Enlazado" -ForegroundColor Green

Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "   .\download-railway-logs.ps1" -ForegroundColor Gray
Write-Host "   railway logs" -ForegroundColor Gray
Write-Host "   railway status" -ForegroundColor Gray

Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Cyan
Write-Host "   railway whoami          # Verificar usuario" -ForegroundColor Gray
Write-Host "   railway projects        # Listar proyectos" -ForegroundColor Gray
Write-Host "   railway deployments     # Ver deployments" -ForegroundColor Gray
Write-Host "   railway logs            # Ver logs en tiempo real" -ForegroundColor Gray 