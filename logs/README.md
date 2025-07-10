# 📋 Sistema de Logging - Bot WhatsApp TeAlquilamos

> **🤖 PARA IAs: Este es el ÍNDICE PRINCIPAL del sistema de logging. Comienza aquí para entender todo el sistema.**

## 🎯 **Visión General del Sistema**

Este proyecto maneja **3 tipos diferentes de logs** según el entorno y propósito:

| Tipo | Ubicación | Propósito | Formato |
|------|-----------|-----------|---------|
| **🖥️ Terminal** | `src/utils/logging/console-logger.ts` | Logs limpios desarrollo | Simple y legible |
| **📁 Local Files** | `logs/local-development/` | Logs técnicos detallados | Completo con JSON |
| **☁️ Cloud Run** | `logs/cloud-production/` | Logs producción procesados | Estructurado |

## 📂 **Estructura de Directorios**

```
logs/
├── README.md                           # 🎯 ESTE ARCHIVO - Índice principal
├── local-development/                  # 📁 Tipo 2: Logs desarrollo local
│   ├── README.md                       # Cómo funcionan logs locales
│   └── sessions/                       # Archivos de sesión individuales
│       ├── bot-session-2025-07-10T01-17-56.log
│       └── ...
├── cloud-production/                   # ☁️ Tipo 3: Logs Cloud Run
│   ├── README.md                       # Cómo funcionan logs Cloud
│   └── processed/                      # Logs procesados por parser
│       ├── session_20250710_141020_1752156620.txt
│       └── ...
└── .gitkeep                           # Mantener estructura en git
```

## 🔗 **Navegación Rápida para IAs**

### **📖 Documentación Principal**
- **[src/utils/logging/README.md](../src/utils/logging/README.md)** - Sistema centralizado de logging
- **[tools/log-tools/README.md](../tools/log-tools/README.md)** - Herramientas de análisis

### **📁 Por Tipo de Log**
- **[local-development/README.md](local-development/README.md)** - Logs detallados locales
- **[cloud-production/README.md](cloud-production/README.md)** - Logs Cloud Run procesados

### **🔧 Herramientas**
- **[../tools/log-tools/cloud-parser/README.md](../tools/log-tools/cloud-parser/README.md)** - Parser de Cloud Run

## 🎯 **Cómo Funciona el Sistema**

### **🖥️ Tipo 1: Console Logs (Terminal Limpio)**
```typescript
// En desarrollo local - Terminal súper limpio
👤 Usuario 573003913251: "Consulta disponibilidad" → ⏱️ 10s...
🤖 Bot → Completado (28.5s) → "Para las fechas del 15 al 20..."
⚙️ Ejecutando función: check_availability
✅ Beds24 → 2 opciones encontradas
```

### **📁 Tipo 2: File Logs (Desarrollo Local Detallado)**
```typescript
// En archivos locales - Información técnica completa
[2025-07-10T01:18:06.722Z] [INFO] FUNCTION_CALLING_START [app-unified.ts]: OpenAI requiere ejecutar 1 función(es) | {"shortUserId":"573003913251","threadId":"thread_6YLULxd75f351plgSL8M4rxl","runId":"run_zo2dVj8y0jdiGmRIZ4n5UHi9","toolCallsCount":1}
```

### **☁️ Tipo 3: Cloud Logs (Producción Procesada)**
```typescript
// Cloud Run procesado - Formato legible de logs de producción
[2025-07-10 14:10:20] 👤 USER: [94m7/10 [14:10][0m [36m? 573003913251:[0m "Me gustaría consultar disponibilidad"
[2025-07-10 14:10:36] ℹ️ INFO: [94m7/10 [14:10][0m [32m[BOT][0m → 2 msgs → OpenAI
```

## 🎛️ **Configuración Automática**

El sistema detecta automáticamente el entorno y activa los logs apropiados:

- **Local Development**: Console + File logs
- **Cloud Run Production**: Cloud logs → procesados por parser

## 🚀 **Inicio Rápido para Desarrolladores**

### **Ver Logs en Tiempo Real**
```bash
# Desarrollo local
npm run dev  # Logs limpios en terminal + archivos detallados

# Analizar logs de Cloud Run
cd tools/log-tools/cloud-parser
python parse_bot_logs.py --hours 2
```

### **Ubicaciones de Archivos**
```bash
# Logs locales más recientes
ls logs/local-development/sessions/

# Logs Cloud procesados más recientes  
ls logs/cloud-production/processed/
```

## 🤖 **Guía de Navegación para IAs**

### **📋 Orden Recomendado de Lectura**
1. **Este archivo** - Visión general del sistema
2. **[src/utils/logging/index.ts](../src/utils/logging/index.ts)** - Punto de entrada centralizado
3. **[src/utils/logging/types.ts](../src/utils/logging/types.ts)** - Definiciones TypeScript
4. **Cada tipo específico**:
   - `console-logger.ts` - Terminal limpio
   - `file-logger.ts` - Archivos detallados
   - `cloud-logger.ts` - Cloud Run
5. **READMEs específicos** en cada subcarpeta

### **🔍 Buscar Información Específica**
- **Configuración**: `src/utils/logging/index.ts`
- **Tipos y estructuras**: `src/utils/logging/types.ts`
- **Ejemplos reales**: Archivos en `sessions/` y `processed/`
- **Herramientas**: `tools/log-tools/`

### **📊 Entender el Flujo**
1. **Código genera log** → `src/utils/logging/index.ts`
2. **Decisión automática** → Console + File (local) o Cloud (producción)
3. **Almacenamiento** → Carpetas específicas por tipo
4. **Análisis** → Herramientas en `tools/log-tools/`

## 🔧 **Mantenimiento**

- **Limpieza automática**: Máximo 5 sesiones locales, 10 archivos Cloud
- **Rotación**: Automática por timestamp
- **Backup**: Los logs importantes se mantienen en git (ejemplos)

## 🔧 **Configuración por Entorno**

### **Desarrollo Local**
- ✅ **Console logs**: Súper limpios, solo esencial
- ✅ **File logs**: Técnicos completos con JSON
- ❌ **Cloud logs**: Desactivados

### **Cloud Run Producción**
- ❌ **Console logs**: Desactivados (opcional)
- ❌ **File logs**: No persistentes en Cloud Run
- ✅ **Cloud logs**: Estructurados para Google Cloud Console

## 🎯 **Filtrado Inteligente - Qué se Incluye/Excluye**

### **✅ LOGS QUE SE INCLUYEN (Información Crítica)**

#### **📨 Mensajes y Comunicación**
- `MESSAGE_RECEIVED` - Mensajes de usuarios con preview
- `MESSAGE_PROCESS` - Procesamiento de mensajes agrupados
- `WHATSAPP_SEND` - Envío exitoso de respuestas
- `WHATSAPP_CHUNKS_COMPLETE` - Mensajes largos divididos

#### **🤖 OpenAI y Funciones**
- `OPENAI_REQUEST` - Solicitudes: adding_message, creating_run
- `OPENAI_RESPONSE` - Respuestas y run completado
- `OPENAI_RUN_COMPLETED` - Estados de completion con duración
- `FUNCTION_CALLING_START` - Inicio de ejecución de funciones
- `FUNCTION_EXECUTING` - Ejecución con argumentos completos
- `FUNCTION_HANDLER` - Manejo y resultados de funciones

#### **🏨 Integración Beds24**
- `BEDS24_REQUEST` - Consultas a Beds24 con parámetros
- `BEDS24_API_CALL` - Llamadas API con fechas y propiedades
- `BEDS24_RESPONSE_DETAIL` - Respuestas completas (datos crudos)
- `BEDS24_RESPONSE_SUMMARY` - Resumen de disponibilidad

#### **🧵 Gestión de Threads**
- `THREAD_CREATED` - Creación de threads con IDs
- `THREAD_REUSE` - Reutilización de threads existentes
- `THREAD_CLEANUP` - Limpieza y persistencia
- `THREAD_PERSIST` - Guardado de estado

#### **🚨 Estados Críticos**
- `ERROR` - Todos los errores con contexto completo
- `WARNING` - Advertencias importantes (excluye webhooks vacíos)
- `SUCCESS` - Operaciones exitosas críticas
- `SERVER_START` - Inicio del bot y configuración
- `BOT_READY` - Bot completamente inicializado

### **❌ LOGS QUE SE EXCLUYEN (Ruido Técnico)**

#### **🔇 Logs Repetitivos Sin Valor**
- `WEBHOOK` - Webhooks vacíos sin mensajes
- `WEBHOOK_STATUS` - Status de webhooks sin contenido
- `WEBHOOK_SKIP` - Webhooks ignorados
- `HEALTH_CHECK` - Health checks del sistema
- `USER_ID_EXTRACTION` - Extracción de IDs (muy repetitivo)
- `NAME_EXTRACTION` - Extracción de nombres
- `BOT_MESSAGE_FILTERED` - Mensajes del bot ignorados

#### **🏗️ Metadata de Infraestructura**
- `HTTP_REQUEST` - Metadata HTTP (latency, IPs, headers)
- `CLOUD_RUN_METADATA` - Metadata de Cloud Run
- `TRACE_SPANS` - Información de tracing
- `BUILD_INFO` - Información de build y deployment

#### **🔧 Logs Técnicos Internos**
- `USER_DEBUG` - Debug interno de usuarios
- `THREAD_LOOKUP` - Búsquedas internas de threads
- `THREAD_GET` - Obtención de threads (excepto críticos)
- `THREAD_CHECK` - Verificaciones de threads
- `MESSAGE_DETAIL` - Detalles internos de mensajes
- `DEBUG_FILE` - Archivos de debug
- `STARTUP` - Procesos de startup internos
- `CONFIG` - Configuración interna
- `APP_INIT` - Inicialización de aplicación
- `OPENAI_INIT` - Inicialización de OpenAI
- `LOGGER_INIT` - Inicialización del logger

#### **⚙️ Procesamiento Interno**
- `MESSAGE_BUFFER` - Buffer interno de mensajes
- `TIMER` - Timers internos
- `CONVERSATION_FLOW` - Flujo interno de conversación
- `BOT_MESSAGE_TRACKED` - Seguimiento interno de mensajes
- `BOT_MESSAGE_CLEANUP` - Limpieza interna
- `MANUAL_DETECTED` - Detección manual interna
- `MANUAL_BUFFER_CREATE` - Creación de buffers manuales
- `MANUAL_BUFFERING` - Buffering manual
- `MANUAL_PROCESSING` - Procesamiento manual
- `MANUAL_SYNC_START` - Inicio de sincronización manual
- `MANUAL_SYNC_SUCCESS` - Éxito de sincronización
- `MANUAL_SYNC_ERROR` - Error de sincronización
- `MANUAL_NO_THREAD` - Sin thread en modo manual

#### **🧹 Logs de Limpieza y Sanitización**
- `RESPONSE_SANITIZED` - Respuestas sanitizadas
- `MESSAGE_SANITIZED` - Mensajes sanitizados
- `BEDS24_DEBUG_OUTPUT` - Debug de Beds24
- `CONTACT_API` - API de contactos
- `CONTACT_API_DETAILED` - Detalles de API de contactos

#### **🏷️ Etiquetas y Contexto**
- `CONTEXT_LABELS` - Etiquetas de contexto
- `NEW_THREAD_LABELS` - Etiquetas de nuevos threads
- `LABELS_24H` - Actualización de etiquetas 24h
- `THREAD_DETAILS` - Detalles de threads
- `OPENAI_INTERNAL` - Procesos internos de OpenAI
- `RUN_QUEUE` - Cola de ejecución
- `BUFFER_TIMER_RESET` - Reset de timers de buffer

#### **🐛 Logs de Debug**
- Todos los logs con nivel `DEBUG` se excluyen de console
- Se mantienen en archivos locales para debugging técnico

### **🎛️ CONFIGURACIÓN PERSONALIZADA**

#### **Variables de Entorno**
```bash
# Nivel global de logs
LOG_LEVEL=INFO|DEBUG|WARNING|ERROR

# Logs detallados en Cloud Run
ENABLE_DETAILED_LOGS=true|false

# Entorno de ejecución
NODE_ENV=development|production
K_SERVICE=nombre-servicio  # Detecta Cloud Run automáticamente
```

#### **Configuración por Categoría** (`src/utils/log-config.ts`)
```typescript
categories: {
    USER_ID_EXTRACTION: false,        // Forzar desactivar
    BOT_MESSAGE_FILTERED: false,      // Forzar desactivar
    WEBHOOK_STATUS: false,            // Forzar desactivar
    RUN_QUEUE: false,                 // Forzar desactivar
    CONTEXT_LABELS_EMPTY: false,      // Forzar desactivar
    
    // Solo activar en DEBUG
    THREAD_LOOKUP: LOG_LEVEL === 'DEBUG',
    OPENAI_REQUEST: LOG_LEVEL === 'DEBUG'
}
```

## 📊 **Tipos de Logs Soportados**

---

**🤖 Para IAs**: Este sistema está diseñado para ser completamente autodocumentado. Cada archivo tiene comentarios explicativos y cada carpeta tiene su README específico. 