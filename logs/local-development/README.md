# 📁 Logs de Desarrollo Local - Tipo 2

> **🤖 PARA IAs: Logs técnicos detallados guardados en archivos durante desarrollo local.**

## 🎯 **Propósito**

Estos logs contienen **toda la información técnica** necesaria para debugging detallado durante desarrollo local. Incluyen:

- ✅ Timestamps precisos ISO
- ✅ Categorías técnicas específicas
- ✅ Información del archivo fuente
- ✅ Detalles JSON completos
- ✅ Información de sesión y usuario

## 📂 **Estructura de Archivos**

```
local-development/
├── README.md                           # 🎯 ESTE ARCHIVO
└── sessions/                           # Archivos de sesión individuales
    ├── bot-session-2025-07-10T01-17-56.log
    ├── bot-session-2025-07-10T01-37-40.log
    └── ...
```

## 📝 **Formato de Logs**

### **Estructura Estándar**
```
[TIMESTAMP] [LEVEL] CATEGORY [source]: Message | {json_details}
```

### **Ejemplo Real**
```
[2025-07-10T01:18:06.722Z] [INFO] FUNCTION_CALLING_START [app-unified.ts]: OpenAI requiere ejecutar 1 función(es) | {"shortUserId":"573003913251","threadId":"thread_6YLULxd75f351plgSL8M4rxl","runId":"run_zo2dVj8y0jdiGmRIZ4n5UHi9","toolCallsCount":1,"functions":[{"id":"call_1VPq033qxN4U5lun0pYouiuf","name":"check_availability","argsLength":49}],"environment":"local"}
```

## 🔍 **Categorías de Logs Incluidas**

### **📨 Mensajes y Comunicación**
- `MESSAGE_RECEIVED` - Mensajes de usuarios
- `MESSAGE_PROCESS` - Procesamiento de mensajes
- `WHATSAPP_SEND` - Envío de respuestas
- `WHATSAPP_CHUNKS_COMPLETE` - Mensajes largos divididos

### **🤖 OpenAI y Funciones**
- `OPENAI_REQUEST` - Solicitudes a OpenAI
- `OPENAI_RESPONSE` - Respuestas de OpenAI
- `FUNCTION_CALLING_START` - Inicio de funciones
- `FUNCTION_EXECUTING` - Ejecución de funciones
- `FUNCTION_HANDLER` - Manejo de funciones

### **🏨 Integración Beds24**
- `BEDS24_REQUEST` - Consultas a Beds24
- `BEDS24_API_CALL` - Llamadas API
- `BEDS24_RESPONSE_DETAIL` - Respuestas completas
- `BEDS24_PROCESSING` - Procesamiento de datos

### **🔧 Sistema y Threads**
- `THREAD_CREATED` - Creación de threads
- `THREAD_PERSIST` - Guardado de threads
- `THREAD_CLEANUP` - Limpieza de threads
- `SERVER_START` - Inicio del servidor
- `BOT_READY` - Bot inicializado

### **⚠️ Errores y Warnings**
- `ERROR` - Todos los errores
- `WARNING` - Advertencias importantes
- `SUCCESS` - Operaciones exitosas

## 📊 **Header de Sesión**

Cada archivo comienza con información de contexto:

```
=== NUEVA SESIÓN DEL BOT ===
Timestamp: 2025:07:10 01:17:56 (Colombia UTC-5)
Session ID: session-2025-07-10T01-17-56
PID: 17536
Node Version: v22.16.0
Log Type: Desarrollo Local Detallado
=============================
```

## 🎛️ **Configuración**

### **Ubicación del Código**
- **Logger**: `src/utils/logging/file-logger.ts`
- **Configuración**: `src/utils/logging/index.ts`

### **Parámetros**
- **Directorio**: `logs/local-development/sessions`
- **Máximo sesiones**: 5 (limpieza automática)
- **Buffer**: 50 entradas o 100ms
- **Formato**: Detallado con JSON

## 🚀 **Uso**

### **Automático**
Los logs se generan automáticamente cuando ejecutas:
```bash
npm run dev
```

### **Ubicación de Archivos**
```bash
# Ver sesiones más recientes
ls -la logs/local-development/sessions/

# Ver última sesión
tail -f logs/local-development/sessions/bot-session-*.log
```

### **Análisis**
```bash
# Buscar errores
grep "ERROR" logs/local-development/sessions/*.log

# Buscar usuario específico
grep "573003913251" logs/local-development/sessions/*.log

# Ver funciones ejecutadas
grep "FUNCTION_" logs/local-development/sessions/*.log
```

## 🔄 **Mantenimiento Automático**

- **Limpieza**: Se mantienen solo las últimas 5 sesiones
- **Rotación**: Automática por timestamp
- **Buffer**: Optimizado para rendimiento
- **Encoding**: UTF-8 para caracteres especiales

## 🤖 **Para IAs: Cómo Analizar**

### **Flujo Típico de Sesión**
1. **SERVER_START** - Bot iniciando
2. **THREAD_PERSIST** - Cargando threads existentes
3. **MESSAGE_RECEIVED** - Usuario envía mensaje
4. **OPENAI_REQUEST** - Procesando con IA
5. **FUNCTION_CALLING_START** - Ejecutando funciones
6. **BEDS24_REQUEST** - Consultando disponibilidad
7. **OPENAI_RESPONSE** - Respuesta generada
8. **WHATSAPP_SEND** - Enviando respuesta

### **Información Clave por Categoría**
- **shortUserId**: ID del usuario (ej: "573003913251")
- **threadId**: Thread de OpenAI (ej: "thread_6YLULxd75f351plgSL8M4rxl")
- **runId**: Run de OpenAI (ej: "run_zo2dVj8y0jdiGmRIZ4n5UHi9")
- **duration**: Tiempo de ejecución en ms
- **environment**: Siempre "local" en estos logs

### **Debugging Común**
- **Errores de OpenAI**: Buscar `OPENAI_` + `ERROR`
- **Problemas Beds24**: Buscar `BEDS24_` + `ERROR`
- **Timeouts**: Buscar `duration` > 30000
- **Usuarios específicos**: Buscar por número de teléfono

---

**🤖 Para IAs**: Estos logs contienen la información MÁS COMPLETA del sistema. Úsalos para entender el flujo técnico detallado y debugging profundo. 