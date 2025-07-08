# Setup Environment for Bot Development
# Ejecutar este script antes de trabajar con el bot

Write-Host "Configurando entorno de desarrollo..." -ForegroundColor Green

# Añadir Git al PATH si no está
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if (!$gitCommand) {
    $gitPath = "C:\Program Files\Git\bin"
    if (Test-Path $gitPath) {
        $env:PATH += ";$gitPath"
        Write-Host "✓ Git añadido al PATH" -ForegroundColor Green
    } else {
        Write-Host "⚠ Git no encontrado en $gitPath" -ForegroundColor Yellow
    }
}

# Verificar herramientas
Write-Host "`nVerificando herramientas:" -ForegroundColor Cyan
try {
    $gitVersion = git --version
    Write-Host "✓ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git no disponible" -ForegroundColor Red
}

try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js no disponible" -ForegroundColor Red
}

try {
    $npmVersion = npm --version
    Write-Host "✓ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm no disponible" -ForegroundColor Red
}

Write-Host "`n🚀 Entorno configurado. Puedes usar git, node y npm." -ForegroundColor Green
Write-Host "💡 Para uso permanente, ejecuta este script al inicio de cada sesión." -ForegroundColor Yellow 