# 📊 Sistema de Logging - Punto de Entrada Técnico

## 🎯 **Descripción General**

Este es el **punto de entrada principal** para el sistema de logging del bot de WhatsApp. El sistema implementa **8 niveles de log**, **17 categorías específicas**, **filtros inteligentes** y **agregación automática** optimizada para Google Cloud Run.

## 🚀 **Niveles de Log Disponibles (8 Niveles)**

### **📋 Jerarquía Completa:**
```typescript
type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'FATAL' | 'ALERT';
```

### **🎯 Funciones de Conveniencia:**
```typescript
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

## 🏷️ **Terminología Técnica**

### **📊 Estructura de un Log:**
```
[2025-07-16T14:10:58.631Z] [SUCCESS] MESSAGE_RECEIVED [index.ts]: Mensaje recibido | {"userId":"573003913251","type":"text"}
|_____________________| |________| |_______________| |________| |________________| |________________________|
    TIMESTAMP ISO 8601    LOG LEVEL   LOG CATEGORY   SOURCE    MESSAGE TEXT       JSON PAYLOAD
```

### **🎯 Componentes:**
- **📅 Timestamp**: Formato ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **🏷️ Log Level**: Severidad del mensaje (TRACE → ALERT)
- **📛 Log Category**: Tipo de evento (`MESSAGE_RECEIVED`, `OPENAI_REQUEST`, etc.)
- **📄 Source File**: Archivo donde se generó el log (`[index.ts]`)
- **💬 Message Text**: Descripción humana del evento
- **📊 JSON Payload**: Datos estructurados para análisis

## 💻 **Cómo Usar el Sistema**

### **📝 Importación Básica:**
```typescript
// Importar funciones específicas
import { logInfo, logSuccess, logError } from '@/utils/logging';

// O importar todas las funciones
import * as logging from '@/utils/logging';
```

### **🎯 Ejemplos de Uso:**

#### **1. 🔍 TRACE - Debugging Profundo**
```typescript
logTrace('FUNCTION_ENTRY', 'Entrando a función crítica', {
    args: arguments,
    timestamp: Date.now()
});
```

#### **2. 🐛 DEBUG - Información de Debugging**
```typescript
logDebug('DATA_VALIDATION', 'Validando estructura de datos', {
    tipo: typeof datos,
    propiedades: Object.keys(datos)
});
```

#### **3. ℹ️ INFO - Información General**
```typescript
logInfo('MESSAGE_RECEIVED', 'Mensaje recibido de WhatsApp', {
    userId: '573003913251',
    messageType: 'text',
    timestamp: new Date().toISOString()
});
```

#### **4. ✅ SUCCESS - Operaciones Exitosas**
```typescript
logSuccess('MESSAGE_SENT', 'Respuesta enviada exitosamente', {
    userId: '573003913251',
    messageLength: mensaje.length,
    duration: 1500
});
```

#### **5. ⚠️ WARNING - Advertencias**
```typescript
logWarning('API_TIMEOUT', 'Timeout en llamada a API', {
    api: 'openai',
    timeout: 30000,
    retryCount: 2
});
```

#### **6. ❌ ERROR - Errores**
```typescript
logError('API_CALL_FAILED', 'Error al llamar API externa', {
    url: 'https://api.externa.com',
    error: error.message,
    statusCode: error.status
});
```

#### **7. 💀 FATAL - Errores Críticos**
```typescript
logFatal('DB_CONNECTION_FAILED', 'Error crítico de base de datos', {
    error: error.message,
    stack: error.stack
});
// El sistema puede parar después de un log FATAL
```

#### **8. 🚨 ALERT - Alertas de Monitoreo**
```typescript
logAlert('PERFORMANCE_DEGRADED', 'Tiempo de respuesta muy alto', {
    tiempoRespuesta: 35000,
    limite: 30000
});
```

## 🏷️ **Categorías de Logging Disponibles**

### **📱 Mensajes y Comunicación (4 categorías)**
- **`MESSAGE_RECEIVED`** - Mensajes entrantes de WhatsApp
- **`MESSAGE_PROCESS`** - Procesamiento de mensajes agrupados
- **`WHATSAPP_SEND`** - Envío de respuestas a WhatsApp
- **`WHATSAPP_CHUNKS_COMPLETE`** - Completado de mensajes largos

### **🤖 OpenAI y Funciones (8 categorías)**
- **`OPENAI_SEND`** - Mensaje exacto enviado a OpenAI (contexto + mensaje)
- **`OPENAI_RESPONSE_CONTENT`** - Respuesta completa de OpenAI
- **`OPENAI_FUNC_CALL`** - Argumentos exactos que OpenAI envía a funciones
- **`OPENAI_FUNC_RESULT`** - Resultado crudo de función + formato para OpenAI
- **`OPENAI_TOOL_OUTPUTS_SENDING`** - Payload completo enviado de vuelta a OpenAI
- **`FUNCTION_CALLING_START`** - Inicio de ejecución de funciones
- **`FUNCTION_EXECUTING`** - Ejecución específica de función
- **`FUNCTION_COMPLETED`** - Función completada exitosamente

### **🏨 Integración Beds24 (4 categorías)**
- **`BEDS24_REQUEST`** - Solicitudes de disponibilidad
- **`BEDS24_API_CALL`** - Llamadas HTTP reales a API Beds24
- **`BEDS24_RESPONSE_DETAIL`** - Respuestas detalladas de Beds24 (status, datos, duración)
- **`BEDS24_PROCESSING`** - Procesamiento y transformación de datos

### **🧵 Sistema y Threads (4 categorías)**
- **`THREAD_CREATED`** - Creación de threads OpenAI
- **`THREAD_PERSIST`** - Persistencia de threads
- **`THREAD_CLEANUP`** - Limpieza de threads
- **`SERVER_START`** - Inicio del servidor HTTP
- **`BOT_READY`** - Bot completamente inicializado

## 🎯 **Estrategia de Logging**

### **✅ DÓNDE SÍ Agregar Logs:**
- **Puntos de entrada/salida** de funciones importantes
- **Decisiones críticas** del sistema
- **Errores** y excepciones
- **Estados de cambio** importantes
- **Métricas** de performance
- **Interacciones** con APIs externas

### **❌ DÓNDE NO Agregar Logs:**
- **Bucles internos** de procesamiento
- **Funciones auxiliares** simples
- **Código de validación** básico
- **Operaciones** muy frecuentes (>1000/min)

## 🔧 **Configuración por Entorno**

### **🌍 Desarrollo Local:**
```typescript
// Todos los niveles visibles
const config = {
    level: 'TRACE',
    enableDetailedLogs: true,
    maxLogsPerMinute: 5000,
    enableLogAggregation: false
};
```

### **☁️ Railway/Producción:**
```typescript
// Solo niveles importantes
const config = {
    level: 'INFO',
    enableDetailedLogs: false,
    maxLogsPerMinute: 1000,
    enableLogAggregation: true
};
```

## 🔍 **Debugging Completo de Pipeline**

### **📋 Rastreo Complete del Flujo de Datos:**

#### **1. 📱 WhatsApp → OpenAI**
```typescript
// Log: OPENAI_SEND - Mensaje exacto enviado
{
  fullContent: "Cliente: consulta disponibilidad para 2025-01-15 a 2025-01-17",
  flattenedContent: "Cliente:n/nconsulta disponibilidad...",
  contextSource: "BD temporal inject" // Incluye historial de BD
}
```

#### **2. 🤖 OpenAI → Función**
```typescript
// Log: OPENAI_FUNC_CALL - Argumentos exactos
{
  functionName: "check_availability",
  args: '{"startDate":"2025-01-15","endDate":"2025-01-17","guests":2}',
  functionId: "call_abc123"
}
```

#### **3. 🏨 Función → Beds24 API**
```typescript
// Log: BEDS24_API_CALL - Request HTTP real
{
  method: "GET",
  url: "https://api.beds24.com/v2/inventory/rooms/availability?arrival=2025-01-15&departure=2025-01-17&numAdults=2&token=***",
  timeout: 15000
}

// Log: BEDS24_RESPONSE_DETAIL - Response HTTP
{
  status: 200,
  roomsCount: 3,
  duration: "850ms",
  responseSize: 2456
}
```

#### **4. 🔄 Función → OpenAI (Formato)**
```typescript
// Log: OPENAI_FUNC_RESULT - Datos procesados
{
  apiResult: '[{"name":"Suite Deluxe","totalPrice":840000,"available":true}]',
  formattedForOpenAI: '"Apartamentos disponibles:\n- Suite Deluxe: 840,000 por 2 noches."',
  resultLength: 89
}

// Log: OPENAI_TOOL_OUTPUTS_SENDING - Payload completo
{
  fullPayload: '[{"tool_call_id":"call_abc123","output":"Apartamentos disponibles:\\n- Suite Deluxe: 840,000 por 2 noches."}]'
}
```

#### **5. 🤖 OpenAI → Cliente**
```typescript
// Log: OPENAI_RESPONSE_CONTENT - Respuesta final
{
  response: "¡Perfecto! Encontré disponibilidad para esas fechas:\n\n🏨 Suite Deluxe: $840,000 por 2 noches\n\n¿Te interesa hacer la reserva?",
  responseLength: 125
}
```

### **🔧 Validaciones Automáticas:**

#### **📅 Fechas Pasadas:**
```typescript
// Log automático si OpenAI llama función con fechas pasadas
return "Mensaje interno: llamaste a función para unas fechas pasadas, hoy es 2025-01-10, confirma con el cliente las fechas y vuelve a llamar a la función.";
```

#### **❌ Sin Datos Simulados:**
```typescript
// Log: BEDS24_CLIENT - Error real sin fallback
{
  error: "Error consultando Beds24: Connection timeout",
  fallbackToSimulated: false, // NUNCA usa datos falsos
  recommendation: "Verificar conectividad y token"
}
```

## 📊 **Métricas y Monitoreo**

### **Endpoint de Métricas:**
```
GET /metrics
```

### **Métricas Disponibles:**
- **Total de logs** por nivel y categoría
- **Performance** (latencia, throughput)
- **Pipeline completa** (WhatsApp → OpenAI → Beds24 → OpenAI → WhatsApp)
- **Filtros** y eficiencia de agregación
- **Errores** y warnings
- **Validaciones** de datos (fechas, tokens, conexiones)

## 🔒 **Seguridad y Sanitización**

### **Datos Protegidos Automáticamente:**
- **Números de teléfono**: `573001234567` → `573****4567`
- **API Keys**: `sk-1234567890abcdef` → `sk-******90abcdef`
- **Tokens JWT**: Mantiene header, enmascara payload
- **Emails**: `usuario@dominio.com` → `us***@dominio.com`

## 🧪 **Testing**

### **Ejecutar Tests:**
```bash
# Tests de logging
npm test -- --grep "logging"

# Tests específicos
npm test -- --grep "log levels"
npm test -- --grep "sanitization"
```

## 📚 **Documentación Completa**

Para información detallada sobre:
- **Implementación técnica**: Ver `docs/logging/LOGGING_SYSTEM_COMPLETE.md`
- **Arquitectura**: Ver `docs/logging/LOGGING_SYSTEM_COMPLETE.md`
- **Troubleshooting**: Ver `docs/logging/LOGGING_SYSTEM_COMPLETE.md`
- **Referencias**: Ver `docs/logging/LOGGING_SYSTEM_COMPLETE.md`

## 🔄 **Mantenimiento**

### **Limpieza Automática:**
- **Logs locales**: Cada 24 horas
- **Archivos de sesión**: Máximo 5 archivos
- **Cache de memoria**: Cada 10 minutos

### **Monitoreo de Performance:**
- **Latencia**: Máximo 100ms por log
- **Memoria**: Máximo 50MB de buffer
- **Throughput**: Máximo 1000 logs/segundo

---

**Última actualización**: Julio 2025 - V2.2  
**Estado**: ✅ Completamente implementado y documentado 