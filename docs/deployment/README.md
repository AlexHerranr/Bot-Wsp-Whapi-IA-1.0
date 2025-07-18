# 🚀 Deployment Guide - TeAlquilamos Bot

> **Nota histórica:** Este proyecto fue desplegado originalmente en Google Cloud Run, pero desde julio 2025 la plataforma de despliegue definitiva es Railway. Toda la documentación y configuración está ahora optimizada para Railway. Si necesitas referencias antiguas de Cloud Run, consulta el historial de cambios o los archivos archivados.

## Configuración Unificada (Un código, múltiples entornos)

Este bot está diseñado para funcionar automáticamente tanto en desarrollo local como en Railway sin necesidad de cambios manuales en el código.

## 🎯 Configuración Automática

### Detección de Entorno
El sistema detecta automáticamente el entorno:
- **Local**: Cuando no hay variable `RAILWAY_URL`
- **Railway**: Cuando existe `RAILWAY_URL` o `NODE_ENV=production`

### Variables Dinámicas
```typescript
// Configuración automática por entorno
Local:
- Puerto: 3008
- Webhook: https://actual-bobcat-handy.ngrok-free.app/hook
- Logs: Detallados
- OpenAI: Timeout 45s, 3 reintentos

Railway:
- Puerto: 8080
- Webhook: https://bot-wsp-whapi-ia-production.up.railway.app/hook
- Logs: Producción
- OpenAI: Timeout 30s, 2 reintentos
```

## 🛠️ Scripts Disponibles

### Desarrollo Local
```bash
# Desarrollo básico
npm run dev

# Desarrollo con ngrok (recomendado)
npm run dev:local
```

### Deployment a Railway
```bash
# Railway despliega automáticamente con cada push
git add .
git commit -m "feat: Actualización del bot"
git push origin main
```

### Health Checks
```bash
# Health check local
npm run health-check:local

# Health check Railway
npm run health-check

# Ver configuración actual
npm run config
```

## 📋 Variables de Entorno Requeridas

### Básicas (Obligatorias)
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
ASSISTANT_ID=asst_your-assistant-id-here
WHAPI_TOKEN=your-whapi-token-here
WHAPI_API_URL=https://gate.whapi.cloud/
```

### Avanzadas (Opcionales)
```env
# Forzar entorno específico
NODE_ENV=production

# Configurar puerto específico
PORT=3008

# URLs personalizadas
WEBHOOK_URL=https://your-custom-webhook.com/hook
BASE_URL=https://your-custom-base.com
```

## 🔄 Flujo de Desarrollo

### 1. Desarrollo Local
```bash
# Iniciar desarrollo con ngrok
npm run dev:local

# El bot estará disponible en:
# - Local: http://localhost:3008
# - Webhook: https://actual-bobcat-handy.ngrok-free.app/hook
```

### 2. Testing
```bash
# Verificar configuración
npm run config

# Health check
npm run health-check:local
```

### 3. Deploy a Cloud Run
```bash
# Build y deploy
npm run deploy

# Verificar deployment
npm run health-check
```

## 🏗️ Arquitectura del Sistema

```
src/
├── app-unified.ts           # Aplicación principal unificada
├── config/
│   └── environment.ts       # Sistema de configuración automática
├── handlers/               # Manejadores de IA
├── services/               # Servicios (Beds24, etc.)
└── utils/                  # Utilidades

docs/
├── deployment/             # Documentación de deployment
├── development/            # Guías de desarrollo
└── archive/               # Documentación archivada
```

## 🔧 Troubleshooting

### Problema: Bot no funciona en local después de deploy
**Solución**: El sistema es automático, no deberías tener problemas. Verifica:
```bash
npm run config  # Ver configuración actual
npm run health-check:local  # Verificar salud local
```

### Problema: Webhook no recibe mensajes
**Solución**: Verifica la URL del webhook:
- Local: `https://actual-bobcat-handy.ngrok-free.app/hook`
- Cloud Run: `https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook`

### Problema: Logs muy verbosos en producción
**Solución**: El sistema configura automáticamente los logs por entorno. Si necesitas cambiar:
```env
LOG_LEVEL=production
ENABLE_DETAILED_LOGS=false
```

## 📊 Monitoreo

### Endpoints de Salud
- `/health` - Estado básico del servidor
- `/ready` - Estado de inicialización completa
- `/` - Información general del servicio
- `/config` - Configuración actual (solo en desarrollo)

### Logs Estructurados
Los logs se guardan automáticamente en:
- **Local**: `./logs/` (logs detallados)
- **Cloud Run**: Google Cloud Logging (logs optimizados)

## 🚀 Próximos Pasos

1. **CI/CD Automático**: Configurar GitHub Actions para deploy automático
2. **Monitoring**: Implementar alertas y métricas
3. **Scaling**: Configurar auto-scaling en Cloud Run
4. **Backup**: Sistema de backup automático de threads

---

**Nota**: Este sistema está diseñado para ser "fire and forget". Una vez configurado, no necesitas cambiar código entre entornos. 