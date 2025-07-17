# 💻 Sistema de Logging - Desarrollo Local

## 🎯 **Descripción General**

Este directorio contiene **logs de desarrollo local** del bot de WhatsApp. En desarrollo local, el sistema utiliza **8 niveles de log** completos, **logs detallados** y **formato legible** para debugging.

## 🚀 **Niveles de Log en Desarrollo Local**

### **📋 Todos los Niveles Disponibles:**
```typescript
type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'FATAL' | 'ALERT';
```

### **🎯 Configuración de Desarrollo:**
```typescript
// Desarrollo local - Todos los niveles visibles
const config = {
    level: 'TRACE',              // 🔍 Nivel más detallado
    enableDetailedLogs: true,    // 📊 Logs completos
    maxLogsPerMinute: 5000,      // 🚀 Sin límites estrictos
    enableLogAggregation: false  // 📝 Sin agregación
};
```

## 🏷️ **Terminología Técnica**

### **📊 Estructura de un Log en Desarrollo:**
```
[2025-07-16T14:10:58.631Z] [SUCCESS] MESSAGE_RECEIVED [index.ts]: Mensaje recibido | {"userId":"573003913251","type":"text"}
|_____________________| |________| |_______________| |________| |________________| |________________________|
    TIMESTAMP ISO 8601    LOG LEVEL   LOG CATEGORY   SOURCE    MESSAGE TEXT       JSON PAYLOAD
```

### **🎯 Componentes Visibles en Desarrollo:**
- **📅 Timestamp ISO 8601**: `YYYY-MM-DDTHH:mm:ss.sssZ` (UTC)
- **🏷️ Log Level**: Severidad del mensaje (TRACE → ALERT)
- **📛 Log Category**: Tipo de evento (`MESSAGE_RECEIVED`, `OPENAI_REQUEST`, etc.)
- **📄 Source File**: Archivo donde se generó el log (`[index.ts]`)
- **💬 Message Text**: Descripción humana del evento
- **📊 JSON Payload**: Datos estructurados para análisis

## 💻 **Cómo Usar en Desarrollo Local**

### **📝 Importación para Desarrollo:**
```typescript
// Importar todas las funciones para debugging completo
import { 
    logTrace,    // 🔍 Debugging profundo
    logDebug,    // 🐛 Información de debugging
    logInfo,     // ℹ️ Información general
    logSuccess,  // ✅ Operaciones exitosas
    logWarning,  // ⚠️ Advertencias
    logError,    // ❌ Errores
    logFatal,    // 💀 Errores críticos
    logAlert     // 🚨 Alertas de monitoreo
} from '@/utils/logging';
```

### **🎯 Ejemplos de Uso en Desarrollo:**

#### **1. 🔍 TRACE - Debugging Profundo**
```typescript
function procesarMensaje(mensaje: string) {
    logTrace('FUNCTION_ENTRY', 'Entrando a procesarMensaje', {
        mensajeLength: mensaje.length,
        timestamp: Date.now(),
        args: arguments
    });
    
    // ... lógica de procesamiento
    
    logTrace('FUNCTION_EXIT', 'Saliendo de procesarMensaje', {
        resultado: 'procesado',
        duracion: Date.now() - startTime
    });
}
```

#### **2. 🐛 DEBUG - Información de Debugging**
```typescript
function validarDatos(datos: any) {
    logDebug('DATA_VALIDATION', 'Validando estructura de datos', {
        tipo: typeof datos,
        propiedades: Object.keys(datos),
        tieneId: !!datos.id,
        esArray: Array.isArray(datos)
    });
}
```

#### **3. ℹ️ INFO - Información General**
```typescript
app.post('/hook', async (req, res) => {
    logInfo('WEBHOOK_RECEIVED', 'Mensaje recibido de WhatsApp', {
        userId: req.body.entry[0]?.changes[0]?.value?.contacts[0]?.wa_id,
        messageType: req.body.entry[0]?.changes[0]?.value?.messages[0]?.type,
        timestamp: new Date().toISOString(),
        bodySize: JSON.stringify(req.body).length
    });
});
```

#### **4. ✅ SUCCESS - Operaciones Exitosas**
```typescript
async function enviarRespuesta(userId: string, mensaje: string) {
    try {
        await whapi.sendMessage(userId, mensaje);
        logSuccess('MESSAGE_SENT', 'Respuesta enviada exitosamente', {
            userId,
            mensajeLength: mensaje.length,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });
    } catch (error) {
        logError('MESSAGE_SEND_FAILED', 'Error al enviar mensaje', { userId, error });
    }
}
```

#### **5. ⚠️ WARNING - Advertencias**
```typescript
function procesarPago(pago: any) {
    if (pago.monto > 1000000) {
        logWarning('PAYMENT_HIGH_AMOUNT', 'Pago con monto alto detectado', {
            monto: pago.monto,
            userId: pago.userId,
            limite: 1000000,
            timestamp: new Date().toISOString()
        });
    }
}
```

#### **6. ❌ ERROR - Errores**
```typescript
async function llamarAPI() {
    try {
        const response = await fetch('https://api.externa.com/datos');
        return await response.json();
    } catch (error) {
        logError('API_CALL_FAILED', 'Error al llamar API externa', {
            url: 'https://api.externa.com/datos',
            error: error.message,
            statusCode: error.status,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}
```

#### **7. 💀 FATAL - Errores Críticos**
```typescript
function inicializarBaseDeDatos() {
    try {
        // ... lógica de inicialización
    } catch (error) {
        logFatal('DB_INIT_FAILED', 'Error crítico al inicializar base de datos', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        process.exit(1); // Parar el sistema
    }
}
```

#### **8. 🚨 ALERT - Alertas de Monitoreo**
```typescript
function monitorearPerformance(tiempoRespuesta: number) {
    if (tiempoRespuesta > 30000) { // 30 segundos
        logAlert('PERFORMANCE_DEGRADED', 'Tiempo de respuesta muy alto', {
            tiempoRespuesta,
            limite: 30000,
            timestamp: new Date().toISOString()
        });
    }
}
```

## 🏷️ **Categorías de Logging en Desarrollo**

### **📱 Mensajes y Comunicación (4 categorías)**
- **`MESSAGE_RECEIVED`** - Mensajes entrantes de WhatsApp
- **`MESSAGE_PROCESS`** - Procesamiento de mensajes agrupados
- **`WHATSAPP_SEND`** - Envío de respuestas a WhatsApp
- **`WHATSAPP_CHUNKS_COMPLETE`** - Completado de mensajes largos

### **🤖 OpenAI y Funciones (5 categorías)**
- **`OPENAI_REQUEST`** - Solicitudes a OpenAI API
- **`OPENAI_RESPONSE`** - Respuestas de OpenAI API
- **`FUNCTION_CALLING_START`** - Inicio de ejecución de funciones
- **`FUNCTION_EXECUTING`** - Ejecución específica de función
- **`FUNCTION_HANDLER`** - Manejo de resultados de función

### **🏨 Integración Beds24 (4 categorías)**
- **`BEDS24_REQUEST`** - Solicitudes de disponibilidad
- **`BEDS24_API_CALL`** - Llamadas a API Beds24
- **`BEDS24_RESPONSE_DETAIL`** - Respuestas detalladas de Beds24
- **`BEDS24_PROCESSING`** - Procesamiento de datos de disponibilidad

### **🧵 Sistema y Threads (4 categorías)**
- **`THREAD_CREATED`** - Creación de threads OpenAI
- **`THREAD_PERSIST`** - Persistencia de threads
- **`THREAD_CLEANUP`** - Limpieza de threads
- **`SERVER_START`** - Inicio del servidor HTTP
- **`BOT_READY`** - Bot completamente inicializado

## 🎯 **Estrategia de Logging en Desarrollo**

### **✅ DÓNDE SÍ Agregar Logs (Desarrollo):**
- **Puntos de entrada/salida** de funciones importantes
- **Decisiones críticas** del sistema
- **Errores** y excepciones
- **Estados de cambio** importantes
- **Métricas** de performance
- **Interacciones** con APIs externas
- **Debugging** de flujos complejos
- **Validación** de datos

### **❌ DÓNDE NO Agregar Logs (Desarrollo):**
- **Bucles internos** de procesamiento
- **Funciones auxiliares** simples
- **Código de validación** básico
- **Operaciones** muy frecuentes (>1000/min)

## 📁 **Estructura de Archivos de Desarrollo**

### **📂 Directorio de Sesiones:**
```
logs/local-development/
├── README.md                    # 📖 Este archivo
├── sessions/                    # 📁 Sesiones de desarrollo
│   ├── bot-session-2025-07-16T14-10-58.log  # 📄 Log de sesión actual
│   ├── bot-session-2025-07-16T10-30-15.log  # 📄 Log de sesión anterior
│   └── ...                      # 📄 Más sesiones
└── README.md                    # 📖 Documentación general
```

### **📄 Formato de Archivo de Sesión:**
```
=== NUEVA SESIÓN DEL BOT ===
Timestamp: 2025:07:16 14:10:58 (Colombia UTC-5)
Session ID: session-2025-07-16T14-10-58
PID: 17280
Node Version: v22.16.0
=============================

[2025-07-16T14:10:58.631Z] [SUCCESS] LOGGER_INIT [unknown.ts]: Sistema de logging por sesión inicializado | {"sessionId":"session-2025-07-16T14-10-58","logFile":"logs\\bot-session-2025-07-16T14-10-58.log","maxSessions":5,"bufferInterval":100,"maxBufferSize":50}
[2025-07-16T14:10:58.742Z] [INFO] THREAD_PERSIST [index.ts]: 0 threads cargados desde archivo | {"threadsCount":0,"source":"file_load","file":"tmp/threads.json"}
...
```

## 🔧 **Configuración de Desarrollo**

### **🌍 Variables de Entorno (Desarrollo):**
```bash
# Habilitar logs detallados
ENABLE_DETAILED_LOGS=true

# Nivel de log más detallado
LOG_LEVEL=TRACE

# Sin límites estrictos
MAX_LOGS_PER_MINUTE=5000

# Sin agregación
ENABLE_LOG_AGGREGATION=false
```

### **📊 Configuración Automática:**
```typescript
// El sistema detecta automáticamente que está en desarrollo
const isCloudRun = !!process.env.K_SERVICE || !!process.env.RAILWAY_URL;
const isLocal = !isCloudRun;

// Y aplica configuración de desarrollo
if (isLocal) {
    // Todos los niveles visibles
    // Logs detallados habilitados
    // Sin límites estrictos
    // Sin agregación
}
```

## 📊 **Métricas en Desarrollo**

### **Endpoint de Métricas:**
```
GET /metrics
```

### **Métricas Disponibles en Desarrollo:**
- **Total de logs** por nivel y categoría
- **Performance** (latencia, throughput)
- **Filtros** y eficiencia de agregación
- **Errores** y warnings
- **Debugging** de flujos

## 🔒 **Seguridad en Desarrollo**

### **Datos Protegidos Automáticamente:**
- **Números de teléfono**: `573001234567` → `573****4567`
- **API Keys**: `sk-1234567890abcdef` → `sk-******90abcdef`
- **Tokens JWT**: Mantiene header, enmascara payload
- **Emails**: `usuario@dominio.com` → `us***@dominio.com`

### **⚠️ Nota de Seguridad:**
En desarrollo local, algunos datos sensibles pueden ser más visibles para facilitar el debugging, pero siempre se aplica sanitización básica.

## 🧪 **Testing en Desarrollo**

### **Ejecutar Tests:**
```bash
# Tests de logging
npm test -- --grep "logging"

# Tests específicos
npm test -- --grep "log levels"
npm test -- --grep "sanitization"
npm test -- --grep "aggregation"
```

### **Validación Local:**
```bash
# Verificar logs locales
tail -f logs/local-development/sessions/bot-session-*.log

# Analizar logs específicos
grep "ERROR" logs/local-development/sessions/bot-session-*.log
grep "WARNING" logs/local-development/sessions/bot-session-*.log
```

## 🔄 **Mantenimiento en Desarrollo**

### **Limpieza Automática:**
- **Logs locales**: Limpieza cada 24 horas
- **Archivos de sesión**: Máximo 5 archivos
- **Cache de memoria**: Limpieza cada 10 minutos

### **Monitoreo de Performance:**
- **Latencia**: Máximo 100ms por log
- **Memoria**: Máximo 50MB de buffer
- **Throughput**: Máximo 1000 logs/segundo

## 📚 **Documentación Relacionada**

### **📖 Documentación Completa:**
- **Implementación técnica**: `docs/logging/LOGGING_SYSTEM_COMPLETE.md`
- **Punto de entrada**: `src/utils/logging/README.md`
- **Índice principal**: `logs/README.md`

### **🔧 Archivos de Implementación:**
- **Funciones principales**: `src/utils/logging/index.ts`
- **Configuración**: `src/utils/log-config.ts`
- **Logger base**: `src/utils/logger.ts`

---

**Última actualización**: Julio 2025 - V2.2  
**Responsable**: Sistema de Logging  
**Estado**: ✅ Completamente implementado y documentado 