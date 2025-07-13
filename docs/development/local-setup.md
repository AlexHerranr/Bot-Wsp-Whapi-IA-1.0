# 🏠 Desarrollo Local - TeAlquilamos Bot

## Configuración Rápida

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Crear archivo `.env` en la raíz del proyecto:
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
ASSISTANT_ID=asst_your-assistant-id-here
WHAPI_TOKEN=your-whapi-token-here
WHAPI_API_URL=https://gate.whapi.cloud/
```

### 3. Iniciar Desarrollo
```bash
# Opción 1: Solo el bot (puerto 3008)
npm run dev

# Opción 2: Bot + ngrok (recomendado)
npm run dev:local
```

## 🔧 Configuración Automática Local

El sistema detecta automáticamente que estás en desarrollo local y configura:

- **Puerto**: 3008
- **Host**: localhost
- **Webhook URL**: https://actual-bobcat-handy.ngrok-free.app/hook
- **Logs**: Detallados y en consola
- **OpenAI**: Timeout 45s, 3 reintentos

## 🚇 Ngrok (Recomendado)

### ¿Por qué usar ngrok?
- Permite recibir webhooks de WhatsApp en tu máquina local
- URL pública estable para testing
- Configuración automática

### Configuración de ngrok
El dominio está pre-configurado: `actual-bobcat-handy.ngrok-free.app`

Si necesitas cambiar el dominio:
1. Editar `src/config/environment.ts`
2. Actualizar `package.json` scripts
3. Configurar en WhatsApp el nuevo webhook

## 🔍 Debugging

### Ver Configuración Actual
```bash
npm run config
```

### Health Check
```bash
npm run health-check:local
```

### 🌐 Ngrok Inspect - Debug de Webhooks
```bash
# URL para ver todos los requests que llegan a tu webhook
http://localhost:4040/inspect/http
```

**¿Por qué es CRÍTICO?**
- ✅ Ver eventos de mensajes en tiempo real
- ✅ Ver eventos de presencia (typing)
- ✅ Debuggear problemas de webhook
- ✅ Verificar que Whapi envíe datos correctamente

**Flujo de puertos:**
- **3008**: Tu bot (aplicación Node.js)
- **4040**: Ngrok inspect (herramienta de debug)
- **ngrok-free.app**: Túnel público que conecta ambos

**Cómo usar:**
1. Inicia tu bot: `npm run dev:local`
2. Abre en navegador: `http://localhost:4040/inspect/http`
3. Envía mensajes desde WhatsApp
4. Observa los requests en tiempo real

### Logs
Los logs se muestran en consola y se guardan en:
- `./logs/debug.log` - Logs detallados
- `./logs/error.log` - Solo errores

## 📊 Endpoints Disponibles

### Desarrollo Local (puerto 3008)
- `http://localhost:3008/` - Información del servicio
- `http://localhost:3008/health` - Health check
- `http://localhost:3008/ready` - Estado de inicialización
- `http://localhost:3008/hook` - Webhook de WhatsApp
- `http://localhost:3008/config` - Configuración actual (solo en desarrollo)

### Ngrok (público)
- `https://actual-bobcat-handy.ngrok-free.app/hook` - Webhook público

## 🛠️ Scripts de Desarrollo

```bash
# Desarrollo básico
npm run dev

# Desarrollo con ngrok
npm run dev:local

# Simular Cloud Run localmente
npm run dev:cloud

# Usar versión anterior (fallback)
npm run dev:old

# Ver configuración
npm run config

# Health check
npm run health-check:local
```

## 🔄 Hot Reload

El sistema usa `tsx --watch` para hot reload automático:
- Cambios en `src/**/*.ts` se recargan automáticamente
- Cambios en `config/**/*.json` también se detectan
- No necesitas reiniciar el servidor

## 🐛 Troubleshooting

### Puerto 3008 ocupado
```bash
# Verificar qué proceso usa el puerto
netstat -ano | findstr :3008

# Matar proceso si es necesario
taskkill /PID <process_id> /F
```

### Ngrok no funciona
```bash
# Verificar instalación de ngrok
ngrok version

# Reinstalar si es necesario
npm install -g ngrok
```

### Variables de entorno no cargadas
```bash
# Verificar archivo .env existe
dir .env

# Verificar contenido
type .env
```

### Logs no aparecen
El sistema de logs está optimizado:
- En desarrollo: Logs detallados en consola
- Logs importantes se guardan en `./logs/`
- Usar `npm run config` para verificar configuración

## 📝 Desarrollo de Funcionalidades

### Estructura Recomendada
```
src/
├── app-unified.ts          # Aplicación principal (NO EDITAR)
├── config/
│   └── environment.ts      # Configuración (NO EDITAR)
├── handlers/               # Agregar nuevos handlers aquí
├── services/               # Agregar nuevos servicios aquí
└── utils/                  # Utilidades compartidas
```

### Agregar Nueva Funcionalidad
1. Crear handler en `src/handlers/`
2. Crear servicio en `src/services/` si es necesario
3. Importar en `app-unified.ts`
4. Testing local con `npm run dev:local`
5. Deploy con `npm run deploy`

## 🚀 Siguientes Pasos

Una vez que el desarrollo local funciona:
1. Probar funcionalidad completa
2. Hacer commit de cambios
3. Deploy a Cloud Run con `npm run deploy`
4. Verificar funcionamiento en producción

---

**Nota**: Este setup está diseñado para ser plug-and-play. Si tienes problemas, revisa que todas las variables de entorno estén configuradas correctamente. 