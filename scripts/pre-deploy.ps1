# Script de Pre-deploy para TeAlquilamos Bot
# Verifica dependencias y build antes del deploy

Write-Host "🔍 Verificando sincronización de dependencias..." -ForegroundColor Cyan

# Verificar si pnpm está instalado
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  pnpm no está instalado. Instalando..." -ForegroundColor Yellow
    npm install -g pnpm
}

# Verificar si pnpm-lock.yaml está actualizado
Write-Host "🔧 Verificando lockfile..." -ForegroundColor Cyan
$lockCheck = pnpm install --frozen-lockfile --dry-run 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  El lockfile necesita actualización" -ForegroundColor Yellow
    pnpm install
    git add pnpm-lock.yaml
    git commit -m "chore: update pnpm-lock.yaml"
    Write-Host "✅ Lockfile actualizado" -ForegroundColor Green
} else {
    Write-Host "✅ Lockfile sincronizado" -ForegroundColor Green
}

# Verificar build local
Write-Host "🏗️  Probando build..." -ForegroundColor Cyan
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build falló localmente" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Build exitoso" -ForegroundColor Green
}

# Verificar variables de entorno críticas
Write-Host "🔐 Verificando configuración..." -ForegroundColor Cyan
$requiredVars = @("OPENAI_API_KEY", "WHAPI_TOKEN", "ASSISTANT_ID")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (!(Test-Path "env:$var")) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "⚠️  Variables de entorno faltantes: $($missingVars -join ', ')" -ForegroundColor Yellow
    Write-Host "💡 Asegúrate de configurarlas en Cloud Run" -ForegroundColor Blue
} else {
    Write-Host "✅ Variables de entorno configuradas" -ForegroundColor Green
}

Write-Host "🚀 Todo listo para deploy" -ForegroundColor Green
Write-Host "📋 Próximos pasos:" -ForegroundColor Blue
Write-Host "   1. git push origin master" -ForegroundColor White
Write-Host "   2. Verificar Cloud Build en: https://console.cloud.google.com/cloud-build/builds" -ForegroundColor White
Write-Host "   3. Verificar despliegue en: https://console.cloud.google.com/run" -ForegroundColor White 