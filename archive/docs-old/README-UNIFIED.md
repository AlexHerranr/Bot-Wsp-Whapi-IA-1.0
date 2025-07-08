# 🤖 TeAlquilamos Bot - Versión Unificada

## Un código, múltiples entornos

Bot de WhatsApp con IA integrada que funciona automáticamente tanto en desarrollo local como en Google Cloud Run sin necesidad de cambios manuales.

## 🚀 Inicio Rápido

### Desarrollo Local
```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (crear .env)
cp .env.example .env  # Editar con tus credenciales

# 3. Iniciar con ngrok (recomendado)
npm run dev:local

# O solo el bot
npm run dev
```

### Deploy a Cloud Run
```bash
# Build y deploy
npm run deploy

# Deploy directo (automático)
npm run deploy:auto
```

## 🎯 Características Principales

### ✅ Configuración Automática
- **Detección de entorno**: Automática (local vs Cloud Run)
- **Puerto dinámico**: 3008 (local) / 8080 (Cloud Run)
- **Webhook automático**: URLs configuradas por entorno
- **Logs optimizados**: Detallados (local) / Producción (Cloud Run)

### ✅ Desarrollo Sin Fricciones
- **Hot reload**: Cambios automáticos en desarrollo
- **Ngrok integrado**: Webhook público para testing
- **Health checks**: Monitoreo automático
- **Scripts unificados**: Un comando para cada tarea

### ✅ Deploy Simplificado
- **Build automático**: Rollup + TypeScript
- **Docker optimizado**: Multi-stage para Cloud Run
- **CI/CD ready**: GitHub Actions compatible
- **Monitoreo**: Logs estructurados en Google Cloud

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Bot básico (puerto 3008)
npm run dev:local    # Bot + ngrok (recomendado)
npm run dev:cloud    # Simular Cloud Run localmente

# Deploy
npm run deploy       # Build + deploy manual
npm run deploy:auto  # Deploy automático directo

# Utilidades
npm run config       # Ver configuración actual
npm run health-check:local  # Health check local
npm run health-check        # Health check Cloud Run
npm run build        # Solo build
```

## 🔧 Configuración

### Variables de Entorno Requeridas
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
ASSISTANT_ID=asst_your-assistant-id-here
WHAPI_TOKEN=your-whapi-token-here
WHAPI_API_URL=https://gate.whapi.cloud/
```

### Configuración Automática por Entorno

#### Desarrollo Local
- Puerto: `3008`
- Webhook: `https://actual-bobcat-handy.ngrok-free.app/hook`
- Logs: Detallados en consola + archivos
- OpenAI: 45s timeout, 3 reintentos

#### Cloud Run
- Puerto: `8080`
- Webhook: `https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook`
- Logs: Optimizados para producción
- OpenAI: 30s timeout, 2 reintentos

## 🏗️ Arquitectura

```
src/
├── app.ts                   # Aplicación principal unificada
├── config/
│   └── environment.ts       # Sistema de configuración automática
├── handlers/                # Manejadores de IA (OpenAI, Gemini)
├── services/                # Servicios (Beds24, escalamiento)
├── utils/                   # Utilidades (logs, persistencia, etc.)
└── types/                   # Tipos TypeScript

docs/
├── deployment/              # Documentación de deployment
│   ├── README.md           # Guía principal de deployment
│   ├── HISTORIAL_SOLUCION_CLOUD_RUN.md
│   └── ...
├── development/             # Guías de desarrollo
│   └── local-setup.md      # Setup local detallado
└── ...
```

## 🔍 Endpoints

### Desarrollo Local (puerto 3008)
- `http://localhost:3008/` - Información del servicio
- `http://localhost:3008/health` - Health check
- `http://localhost:3008/hook` - Webhook WhatsApp
- `http://localhost:3008/config` - Configuración actual

### Cloud Run (puerto 8080)
- `https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/`
- `https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/health`
- `https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook`

## 🧪 Testing

```bash
# Verificar configuración
npm run config

# Health check local
npm run health-check:local

# Health check Cloud Run
npm run health-check

# Logs en tiempo real
tail -f logs/debug.log
```

## 🔄 Flujo de Desarrollo

1. **Desarrollo**: `npm run dev:local`
2. **Testing**: Probar webhooks con ngrok
3. **Commit**: Cambios a git
4. **Deploy**: `npm run deploy`
5. **Verificar**: `npm run health-check`

## 📚 Documentación

- **[Deployment Guide](docs/deployment/README.md)** - Guía completa de deployment
- **[Local Setup](docs/development/local-setup.md)** - Configuración local detallada
- **[Troubleshooting](docs/deployment/HISTORIAL_SOLUCION_CLOUD_RUN.md)** - Solución de problemas

## 🚀 Funcionalidades

### IA Integrada
- **OpenAI GPT-4**: Respuestas inteligentes
- **Gemini**: Respaldo y funcionalidades específicas
- **Contexto persistente**: Memoria de conversaciones
- **Funciones personalizadas**: Beds24, escalamiento, etc.

### Integración WhatsApp
- **Whapi.cloud**: Proveedor de WhatsApp
- **Webhooks**: Recepción automática de mensajes
- **Typing indicators**: Indicadores de escritura
- **Etiquetas**: Sistema de etiquetado automático

### Servicios Adicionales
- **Beds24**: Integración con sistema de reservas
- **Escalamiento humano**: Transferencia a operadores
- **Memoria de huéspedes**: Persistencia de datos
- **Logs estructurados**: Monitoreo y debugging

## 🔧 Mantenimiento

### Limpieza del Proyecto
```bash
# Ejecutar script de limpieza (si es necesario)
node scripts/cleanup-project.js
```

### Actualización de Dependencias
```bash
npm update
npm audit fix
```

### Backup
Los archivos importantes se respaldan automáticamente en:
- `backup-files/` - Archivos antiguos
- `logs/` - Logs históricos
- Git - Control de versiones

## 🆘 Soporte

Si tienes problemas:

1. **Verificar configuración**: `npm run config`
2. **Revisar logs**: `tail -f logs/debug.log`
3. **Health check**: `npm run health-check:local`
4. **Documentación**: Revisar `docs/`

## 📝 Changelog

### v1.0.0-unified
- ✅ Sistema de configuración automática
- ✅ Detección de entorno automática
- ✅ Scripts unificados
- ✅ Documentación reorganizada
- ✅ Limpieza de archivos duplicados
- ✅ Deploy simplificado

---

**Desarrollado por**: Alexander - TeAlquilamos  
**Versión**: 1.0.0-unified  
**Fecha**: Enero 2025 