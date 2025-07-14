# Script simple para actualizar claves API
# Uso: .\scripts\update-keys.ps1

Write-Host "🔑 Actualizando claves API..." -ForegroundColor Green

# Actualizar OpenAI API Key
Write-Host "📝 Actualizando OPENAI_API_KEY..." -ForegroundColor Yellow
echo "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" | gcloud secrets versions add OPENAI_API_KEY --project=gen-lang-client-0318357688 --data-file=-

# Actualizar Assistant ID
Write-Host "📝 Actualizando ASSISTANT_ID..." -ForegroundColor Yellow
echo "asst_KkDuq2r9cL5EZSZa95sXkpVR" | gcloud secrets versions add ASSISTANT_ID --project=gen-lang-client-0318357688 --data-file=-

# Actualizar WHAPI Token
Write-Host "📝 Actualizando WHAPI_TOKEN..." -ForegroundColor Yellow
echo "hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ" | gcloud secrets versions add WHAPI_TOKEN --project=gen-lang-client-0318357688 --data-file=-

Write-Host ""
Write-Host "✅ Claves actualizadas correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Ahora puedes hacer push y el trigger automático desplegará con las claves actualizadas." -ForegroundColor Cyan 