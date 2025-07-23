# 🤖 TeAlquilamos Bot - WhatsApp AI Assistant

> **Bot inteligente de WhatsApp para gestión de reservas y consultas de alojamiento**

Un asistente virtual avanzado que utiliza **OpenAI GPT-4** y **WhatsApp Business API** para gestionar consultas de reservas, disponibilidad y atención al cliente de manera inteligente y natural.

---

## 🎯 **Características Principales**

### **🤖 IA Avanzada**
- **OpenAI GPT-4** con Assistants API
- **Contexto persistente** entre conversaciones
- **Contexto temporal optimizado** con fecha/hora AM/PM y nombres claros
- **Respuestas naturales** y contextualizadas
- **Función de escalamiento** a agentes humanos

### **💬 WhatsApp Integration**
- **WhatsApp Business API** (Whapi)
- **Mensajes en tiempo real**
- **División inteligente de mensajes** en párrafos para mejor UX
- **Typing indicators diferenciados** (3s primer mensaje, 2s siguientes)
- **Sistema de etiquetas** automático
- **Buffer basado en typing** para respuestas naturales
- **🆕 Sistema inteligente de nombres** - Extrae nombres reales de webhooks y los mantiene en buffer

### **🏨 Gestión de Reservas**
- **Integración Beds24** para consultas de disponibilidad
- **Sistema de reservas** automatizado
- **Gestión de fechas** inteligente
- **Información de propiedades** en tiempo real

### **⚡ Performance Optimizada**
- **Respuestas rápidas** (<2 segundos)
- **Cache inteligente** de historial y contexto (TTL 1 hora)
- **Sistema de lock** para prevenir duplicados
- **Detección de reinicio** para contexto fresco
- **Métricas en tiempo real**

---

## 🆕 **Sistema Inteligente de Nombres y Typing**

### **🎯 Objetivo**
El bot extrae automáticamente los nombres reales de los usuarios desde los webhooks de WhatsApp y los mantiene disponibles para todos los eventos (mensajes, typing, etc.).

### **🔄 Flujo de Funcionamiento**

#### **1. Recepción de Mensaje**
```json
{
    "messages": [{
        "from": "573003913251",
        "chat_name": "Sr Alex",        // ← Nombre real del usuario
        "from_name": "573003913251",   // ← ID numérico (no usado)
        "text": { "body": "hola" }
    }]
}
```

#### **2. Almacenamiento en Buffer**
```typescript
// Se guarda en globalMessageBuffers
userId: "573003913251" → userName: "Sr Alex"
```

#### **3. Evento de Typing**
```json
{
    "presences": [{
        "contact_id": "573003913251",  // ← Solo ID, sin nombre
        "status": "typing"
    }]
}
```

#### **4. Búsqueda Inteligente**
```typescript
// Busca en el buffer y encuentra el nombre
const buffer = globalMessageBuffers.get(userId);
if (buffer) {
    terminalLog.typing(buffer.userName);  // "✍️ Sr Alex está escribiendo..."
} else {
    terminalLog.typing(getShortUserId(userId));  // Fallback: "✍️ 573003913251 está escribiendo..."
}
```

### **📊 Resultado en Terminal (Logs Limpios)**

```
[BOT] === Bot TeAlquilamos Iniciado ===
[BOT] 🚀 Servidor: localhost:3008
[BOT] 🔗 Webhook: https://actual-bobcat-handy.ngrok-free.app/hook
[BOT] ✅ Sistema listo

[BOT] 📨 Nueva conversación con Sr Alex
[BOT] ✍️ Sr Alex está escribiendo...
[BOT] 👤 Sr Alex: "hola como va todo"
[BOT] ✍️ Sr Alex está escribiendo...
[BOT] 👤 Sr Alex: "se dice"
[BOT] ✍️ Sr Alex está escribiendo...
[BOT] 👤 Sr Alex: "voy"
[BOT] 👤 Sr Alex: "a probar un mensaje"
[BOT] 👤 Sr Alex: "largo"
[BOT] ⏰ ✍️ Sr Alex dejó de escribir.
[BOT] 🤖 OpenAI → Sr Alex: "Hola, todo va bien, gracias. Veo que estás probando un mensa..." (9.3s)
```

**📖 [Ver Guía Completa de Logs de Terminal](./docs/logging/TERMINAL_LOGS_GUIDE.md)**

### **🔧 Ventajas del Sistema**
- **Nombres reales** en lugar de IDs numéricos
- **Consistencia** entre mensajes y typing
- **Fallback inteligente** cuando no hay buffer
- **Sin llamadas adicionales** a APIs externas
- **Performance optimizada** usando datos del webhook
- **Logs limpios** enfocados en el flujo humano

---

## 🚀 **Plataforma de Despliegue**

### **Railway - Plataforma Definitiva**
- **URL de Producción**: https://bot-wsp-whapi-ia-production.up.railway.app
- **Despliegue Automático**: Con cada push a GitHub
- **Configuración Simplificada**: Variables de entorno en Railway Dashboard
- **Monitoreo Integrado**: Logs y métricas en Railway Console

### **Configuración Railway**
- **Puerto**: 8080 (configuración automática)
- **Variables de Entorno**: Configuradas en Railway Dashboard
- **Logs**: Integrados en Railway Console
- **Monitoreo**: Métricas en tiempo real

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, TypeScript
- **IA**: OpenAI GPT-4, Assistants API
- **WhatsApp**: WhatsApp Business API (Whapi)
- **Alojamiento**: Railway (plataforma definitiva)
- **Base de Datos**: Beds24API
- **Logging**: Sistema personalizado con niveles configurables

---

## 📦 Instalación y Configuración

### **Prerrequisitos**
- Node.js 18+ 
- Cuenta de OpenAI con API key
- Cuenta de WhatsApp Business API
- Cuenta de Beds24(opcional)

### **Instalación Local**
```bash
# Clonar repositorio
git clone <repository-url>
cd Bot-Wsp-Whapi-IA

# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build
```

### **Variables de Entorno Requeridas**
```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key
ASSISTANT_ID=your_assistant_id

# WhatsApp Business API
WHAPI_TOKEN=your_whapi_token
WHAPI_API_URL=https://gate.whapi.cloud/

# Beds24 (opcional)
BEDS24_API_KEY=your_beds24key
BEDS24_AUTHENTICATION_TOKEN=your_auth_token
```

---

## 🚀 Despliegue en Railway

### **Despliegue Automático**
```bash
# Railway se despliega automáticamente con cada push
git add .
git commit -m "feat: Actualización del bot"
git push origin main
```

### **Configuración Manual en Railway**
1. **Conectar repositorio** de GitHub a Railway
2. **Configurar variables de entorno** en Railway Dashboard
3*Configurar puerto**: 8080. **Configurar comando de inicio**: `npm start`

### **Variables de Entorno en Railway**
Configurar en Railway Dashboard:
- `OPENAI_API_KEY`
- `ASSISTANT_ID`
- `WHAPI_TOKEN`
- `WHAPI_API_URL`
- `NODE_ENV=production`

---

## 📊 Monitoreo y Logs

### **Logs Clave para Monitorear**
```typescript
// Sistema de inyección de historial
HISTORY_INJECTION_COMPLETED' // Inyección exitosa
HISTORY_INJECTION_SKIP' // Inyección saltadaHISTORY_COMPRESSED' // Historial comprimido

// Sistema de cache
HISTORY_CACHE_HIT' // Cache hit
CACHE_CLEANUP' // Cleanup ejecutado

// Funciones de OpenAI
OPENAI_FUNCTION_CALL' // Llamada a función
OPENAI_RESPONSE_RECEIVED' // Respuesta recibida

// Sistema de etiquetas
LABELS_SYNC_START' // Sincronización iniciada
LABELS_SYNC_COMPLETE' // Sincronización completada
```

### **Endpoints de Monitoreo**
- **Health Check**: `GET /health`
- **Métricas**: `GET /metrics`
- **Estado del sistema**: `GET /ready`

---

## 🏗️ Arquitectura del Sistema

### **Componentes Principales**
```
src/
├── app-unified.ts              # Aplicación principal
├── config/                     # Configuración
│   ├── environment.ts          # Variables de entorno
│   └── secrets.ts              # Gestión de secretos
├── functions/                  # Funciones de OpenAI
│   ├── availability/           # Consultas de disponibilidad
│   ├── booking/                # Gestión de reservas
│   └── context/                # Contexto de conversación
├── handlers/                   # Manejadores de eventos
│   ├── ai_handler.interface.ts # Interfaz de IA
│   └── function-handler.ts     # Manejador de funciones
├── services/                   # Servicios externos
│   ├── beds24                 # Integración Beds24
│   └── escalation/             # Escalamiento a humano
├── utils/                      # Utilidades
│   ├── context/                # Gestión de contexto
│   ├── logging/                # Sistema de logs
│   └── persistence/            # Persistencia de datos
└── types/                      # Tipos TypeScript
```

### **Flujo de Procesamiento**1*Recepción de mensaje** via webhook de WhatsApp2**Validación y pre-procesamiento** del mensaje3ección de contexto** histórico si es necesario
4*Procesamiento por OpenAI** con funciones específicas5ución de funciones** (consultas Beds24, etc.)
6ación de respuesta** contextualizada
7. **Envío de respuesta** via WhatsApp API
8**Actualización de etiquetas** y contexto

---

## 📚 Documentación

### **🗺️ Navegación Rápida (5minutos)**
- **[Guía de Navegación](docs/NAVIGATION_GUIDE.md)** - **🎯 EMPIEZA AQUÍ** - Mapa completo del proyecto
- **[Inicio Rápido](QUICK_START.md)** - Configuración inicial
- **[Arquitectura del Sistema](docs/ARCHITECTURE.md)** - Diseño completo

### **📖 Documentación Técnica**
- **[Índice de Documentación](docs/INDEX.md)** - Documentación completa
- **[API Reference](docs/API_ENDPOINTS.md)** - Endpoints disponibles
- **[Guía de Despliegue](docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md)** - Despliegue completo

### **🔧 Desarrollo y Mantenimiento**
- **[Guía de Desarrollo](docs/development/local-setup.md)** - Configuración local
- **[Troubleshooting](docs/guides/TROUBLESHOOTING_AND_FAQ.md)** - Solución de problemas
- **[Sistema de Logging](docs/logging/LOGGING_SYSTEM_COMPLETE.md)** - Monitoreo y logs

### **📋 Características Específicas**
- **[Integración Beds24docs/features/BEDS24_INTEGRATION_COMPLETE.md)** - Gestión de disponibilidad
- **[Contexto de Conversación](docs/features/CONTEXTO_HISTORIAL_CONVERSACION.md)** - Memoria persistente
- **[Sistema de Etiquetas](docs/features/SISTEMA_ETIQUETAS_SIMPLE.md)** - Organización automática
- **[Sistema de Buffer](docs/features/TYPING_BASED_BUFFER.md)** - Respuestas naturales

### **🔧 Herramientas y Utilidades**
- **[Herramientas del Bot](docs/guides/HERRAMIENTAS_BOT.md)** - Scripts y utilidades
- **[Estado del Proyecto](docs/progress/ESTADO_FINAL_PROYECTO.md)** - Estado actual y métricas

---

## 🔧 Desarrollo

### **Scripts Disponibles**
```bash
# Desarrollo
npm run dev              # Desarrollo local
npm run build            # Compilar TypeScript
npm run start            # Iniciar en producción

# Testing
npm run test             # Ejecutar tests
npm run health-check     # Verificar estado

# Utilidades
npm run clean            # Limpiar archivos temporales
npm run logs             # Ver logs en tiempo real
```

### **Estructura de Desarrollo**
- **TypeScript** para type safety
- **ESLint** para calidad de código
- **Prettier** para formateo
- **Jest** para testing

---

## 📈 Métricas y Performance

### **Tiempos de Respuesta**
- **Respuesta inicial**: <2egundos
- **Procesamiento de mensaje**: <1undo
- **Inyección de historial**: <500
- **Consulta Beds24: <3egundos

### **Disponibilidad**
- **Uptime**:990.9ailway)
- **Health Check**: Respuesta inmediata
- **Recuperación de errores**: Automática

---

## 🤝 Contribución

### **Proceso de Desarrollo**
1. **Fork** del repositorio2. **Crear branch** para nueva funcionalidad
3 **Desarrollar** y testear cambios4*Commit** con mensajes descriptivos
5. **Push** y crear Pull Request

### **Estándares de Código**
- **TypeScript** para todo el código nuevo
- **ESLint** para mantener calidad
- **Tests** para nuevas funcionalidades
- **Documentación** actualizada

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🆘 Soporte

### **Contacto**
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/Bot-Wsp-Whapi-IA/issues)
- **Documentación**: [docs/](docs/)
- **Troubleshooting**: [docs/guides/TROUBLESHOOTING_AND_FAQ.md](docs/guides/TROUBLESHOOTING_AND_FAQ.md)

### **Estado del Proyecto**
- **Versión**: 20Estable)
- **Plataforma**: Railway (Producción)
- **Última Actualización**: Julio 2025- **Estado**: ✅ **OPERATIVO**

---

*Desarrollado con ❤️ para TeAlquilamos*