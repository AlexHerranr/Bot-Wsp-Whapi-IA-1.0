# Script simple para actualizar claves API
# Uso: .\scripts\update-keys.ps1

Write-Host "🔑 Actualizando claves API..." -ForegroundColor Green

# Actualizar OpenAI API Key
Write-Host "📝 Actualizando OPENAI_API_KEY..." -ForegroundColor Yellow
Write-Host "⚠️  IMPORTANTE: Reemplaza 'sk-xxxxxx' con tu API key real" -ForegroundColor Red
echo "sk-xxxxxx" | gcloud secrets versions add OPENAI_API_KEY --project=gen-lang-client-0318357688 --data-file=-

# Actualizar Assistant ID
Write-Host "📝 Actualizando ASSISTANT_ID..." -ForegroundColor Yellow
Write-Host "⚠️  IMPORTANTE: Reemplaza 'asst-xxxxxx' con tu Assistant ID real" -ForegroundColor Red
echo "asst-xxxxxx" | gcloud secrets versions add ASSISTANT_ID --project=gen-lang-client-0318357688 --data-file=-

# Actualizar WHAPI Token
Write-Host "📝 Actualizando WHAPI_TOKEN..." -ForegroundColor Yellow
Write-Host "⚠️  IMPORTANTE: Reemplaza 'whapi-xxxxxx' con tu token real" -ForegroundColor Red
echo "whapi-xxxxxx" | gcloud secrets versions add WHAPI_TOKEN --project=gen-lang-client-0318357688 --data-file=-

Write-Host ""
Write-Host "✅ Claves actualizadas correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Ahora puedes hacer push y el trigger automático desplegará con las claves actualizadas." -ForegroundColor Cyan 