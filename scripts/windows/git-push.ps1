# Script simple para hacer push - NO REQUIERE CONFIGURACIÓN
# Uso: .\scripts\windows\git-push.ps1 ["mensaje opcional"]

param(
    [string]$Message = "Auto commit - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

Write-Host "🚀 Haciendo push automático..." -ForegroundColor Green

# Usar la ruta completa de Git (siempre funciona)
$GitExe = "C:\Program Files\Git\bin\git.exe"

# 1. Agregar todos los archivos
Write-Host "📁 Agregando archivos..." -ForegroundColor Yellow
& $GitExe add .

# 2. Hacer commit
Write-Host "💾 Haciendo commit con mensaje: $Message" -ForegroundColor Yellow
& $GitExe commit -m $Message

# 3. Push al repositorio
Write-Host "🌐 Enviando al repositorio..." -ForegroundColor Yellow
& $GitExe push origin master

Write-Host "✅ Push completado exitosamente!" -ForegroundColor Green
Write-Host "🎉 Todos los cambios han sido enviados al repositorio" -ForegroundColor Green 