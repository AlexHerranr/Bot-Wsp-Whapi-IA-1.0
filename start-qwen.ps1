# Script para iniciar Qwen-Code con configuración personalizada
# Este script configura las variables de entorno temporalmente para Qwen-Code

Write-Host "🚀 Iniciando Qwen-Code..." -ForegroundColor Green

# Configurar variables de entorno para Qwen-Code
# Reemplaza 'your_api_key_here' con tu API key real de Alibaba Cloud ModelStudio
$env:OPENAI_API_KEY = "your_api_key_here"
$env:OPENAI_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
$env:OPENAI_MODEL = "qwen3-coder-plus"

Write-Host "✅ Variables de entorno configuradas:" -ForegroundColor Yellow
Write-Host "   OPENAI_API_KEY: $env:OPENAI_API_KEY" -ForegroundColor Cyan
Write-Host "   OPENAI_BASE_URL: $env:OPENAI_BASE_URL" -ForegroundColor Cyan
Write-Host "   OPENAI_MODEL: $env:OPENAI_MODEL" -ForegroundColor Cyan

Write-Host ""
Write-Host "📝 Para obtener tu API key:" -ForegroundColor Yellow
Write-Host "   1. Ve a: https://modelstudio.console.alibabacloud.com/" -ForegroundColor White
Write-Host "   2. Regístrate/Inicia sesión" -ForegroundColor White
Write-Host "   3. Activa ModelStudio" -ForegroundColor White
Write-Host "   4. Ve a API Key y genera una nueva" -ForegroundColor White
Write-Host "   5. Reemplaza 'your_api_key_here' en este script" -ForegroundColor White

Write-Host ""
Write-Host "⚠️  IMPORTANTE: Reemplaza 'your_api_key_here' con tu API key real antes de continuar" -ForegroundColor Red

# Verificar si la API key está configurada
if ($env:OPENAI_API_KEY -eq "your_api_key_here") {
    Write-Host ""
    Write-Host "❌ Error: Debes configurar tu API key real en este script" -ForegroundColor Red
    Write-Host "   Edita este archivo y reemplaza 'your_api_key_here' con tu API key" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🎯 Iniciando Qwen-Code..." -ForegroundColor Green
Write-Host "   Usa /help para ver comandos disponibles" -ForegroundColor Cyan
Write-Host "   Usa /exit para salir" -ForegroundColor Cyan
Write-Host ""

# Iniciar Qwen-Code
qwen 