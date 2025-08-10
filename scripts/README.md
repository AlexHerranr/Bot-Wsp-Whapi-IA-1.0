# Scripts Esenciales

## 🤖 Assistant Management
- `assistant-cli.js` - CLI para gestión OpenAI
- `update-assistant-smart.js` - Actualizar assistant
- `update-functions.js` - Actualizar functions
- `update-prompt.js` - Actualizar prompt
- `cleanup-threads.js` - Limpiar threads
- `add-rag-file.js` - Agregar archivos RAG

## 🪟 Windows
- `start-dev-local.ps1` - Desarrollo local con ngrok
- `start-bot.ps1` - Iniciar bot
- `stop-bot.bat` - Detener bot
- `ngrok-manager.ps1` - Gestión ngrok
- `download-railway-logs.ps1` - Logs Railway
- `view-logs.ps1` - Ver logs
- `add-secret-values.ps1` - Configurar secrets

## 🚀 Uso Rápido
```bash
# Desarrollo local
./scripts/windows/start-dev-local.ps1

# Gestión assistant
npm run assistant

# Ver logs Railway
railway logs --follow

## 📦 Logs
- `scripts/logs/download-railway-logs.js` - Descarga y estadísticas de logs (salva en `logs/railway/`)
- `scripts/maintenance/clean-logs.js` - Limpieza de logs antiguos (`--keep N`)
```