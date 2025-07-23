# 📊 Sistema de Logging - Índice Principal

## 🎯 **Descripción General**

Este directorio contiene **toda la documentación** del sistema de logging del bot de WhatsApp. El sistema implementa **8 niveles de log**, **17 categorías específicas**, **filtros inteligentes** y **agregación automática** optimizada para Google Cloud Run.

## 🚀 **Niveles de Log Implementados (8 Niveles)**

### **📋 Jerarquía Completa:**
```typescript
type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'FATAL' | 'ALERT';
```

### **🎯 Descripción de Cada Nivel:**
- **🔍 `TRACE`** - Debugging profundo (solo desarrollo local)
- **🐛 `DEBUG`** - Información de debugging
- **ℹ️ `INFO`** - Información general
- **✅ `SUCCESS`** - Operaciones exitosas
- **⚠️ `WARNING`** - Advertencias
- **❌ `ERROR`** - Errores
- **💀 `FATAL`** - Errores críticos
- **🚨 `ALERT`** - Alertas de monitoreo

## 🏷️ **Terminología Técnica**

### **📊 Estructura de un Log Completo:**
```
[2025-07-16T14:10:58.631Z] [SUCCESS] MESSAGE_RECEIVED [index.ts]: Mensaje recibido | {"userId":"573003913251","type":"text"}
|_____________________| |________| |_______________| |________| |________________| |________________________|
    TIMESTAMP ISO 8601    LOG LEVEL   LOG CATEGORY   SOURCE    MESSAGE TEXT       JSON PAYLOAD
```

### **🎯 Componentes del Sistema:**
- **📅 Timestamp ISO 8601**: `YYYY-MM-DDTHH:mm:ss.sssZ` (UTC)
- **🏷️ Log Level**: Severidad del mensaje (TRACE → ALERT)
- **📛 Log Category**: Tipo de evento (`MESSAGE_RECEIVED`, `OPENAI_REQUEST`, etc.)
- **📄 Source File**: Archivo donde se generó el log (`[index.ts]`)
- **💬 Message Text**: Descripción humana del evento
- **📊 JSON Payload**: Datos estructurados para análisis

## 📚 **Documentación Disponible**

### **🎯 Documentación Principal:**

#### **1. 📖 `docs/logging/LOGGING_SYSTEM_COMPLETE.md`** - **DOCUMENTACIÓN TÉCNICA COMPLETA**
- ✅ **Implementación completa** del sistema
- ✅ **17 categorías** de logging detalladas
- ✅ **8 niveles de log** con ejemplos
- ✅ **Terminología técnica** completa
- ✅ **Guías de implementación** para desarrolladores
- ✅ **Estructura ISO 8601** documentada
- ✅ **Ejemplos de código** para cada nivel
- ✅ **Estrategia de logging** (dónde sí/no agregar logs)
- ✅ **Configuración por entorno** (desarrollo vs producción)
- ✅ **Métricas y monitoreo** completo
- ✅ **Seguridad y sanitización** de datos
- ✅ **Testing y validación** en Cloud Run
- ✅ **Referencias y estándares** de la industria
- ✅ **Mantenimiento y actualizaciones**
- ✅ **Checklist de implementación**

#### **2. 🔧 `src/utils/logging/README.md`** - **PUNTO DE ENTRADA TÉCNICO**
- ✅ **Funciones de conveniencia** para cada nivel
- ✅ **Ejemplos de uso** prácticos
- ✅ **Importación y configuración** básica
- ✅ **Categorías disponibles** organizadas
- ✅ **Estrategia de logging** resumida
- ✅ **Configuración por entorno** simplificada
- ✅ **Métricas básicas** y monitoreo
- ✅ **Seguridad** y sanitización
- ✅ **Testing** y validación
- ✅ **Enlaces** a documentación completa

### **📁 Estructura de Directorios:**

```
logs/
├── README.md                    # 📖 Este archivo - Índice principal
├── cloud-production/            # ☁️ Logs de producción en Cloud
│   └── processed/              # 📊 Logs procesados y analizados
├── local-development/           # 💻 Logs de desarrollo local
│   ├── README.md               # 📖 Guía de desarrollo local
│   └── sessions/               # 📁 Sesiones de desarrollo
├── railway-downloads/           # 🚂 Logs descargados de Railway
│   └── *.txt, *.json           # 📄 Archivos de logs con timestamps
└── README.md                   # 📖 Documentación general
```

## 💻 **Cómo Usar el Sistema**

### **📝 Importación Básica:**
```typescript
// Importar funciones específicas
import { logInfo, logSuccess, logError } from '@/utils/logging';

// O importar todas las funciones
import { 
    logTrace, logDebug, logInfo, logSuccess, 
    logWarning, logError, logFatal, logAlert 
} from '@/utils/logging';
```

### **🎯 Ejemplo de Uso:**
```typescript
// Log de información general
logInfo('MESSAGE_RECEIVED', 'Mensaje recibido de WhatsApp', {
    userId: '573003913251',
    messageType: 'text',
    timestamp: new Date().toISOString()
});

// Log de éxito
logSuccess('MESSAGE_SENT', 'Respuesta enviada exitosamente', {
    userId: '573003913251',
    messageLength: mensaje.length,
    duration: 1500
});

// Log de error
logError('API_CALL_FAILED', 'Error al llamar API externa', {
    url: 'https://api.externa.com',
    error: error.message,
    statusCode: error.status
});
```

## 🏷️ **Categorías de Logging Disponibles**

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

## 📊 **Métricas y Monitoreo**

### **Endpoint de Métricas:**
```
GET /metrics
```

### **Métricas Disponibles:**
- **Total de logs** por nivel y categoría
- **Performance** (latencia, throughput)
- **Filtros** y eficiencia de agregación
- **Errores** y warnings

## 🔒 **Seguridad y Sanitización**

### **Datos Protegidos Automáticamente:**
- **Números de teléfono**: `573001234567` → `573****4567`
- **API Keys**: `sk-1234567890abcdef` → `sk-******90abcdef`
- **Tokens JWT**: Mantiene header, enmascara payload
- **Emails**: `usuario@dominio.com` → `us***@dominio.com`

## 🧪 **Testing y Validación**

### **Ejecutar Tests:**
```bash
# Tests de logging
npm test -- --grep "logging"

# Tests específicos
npm test -- --grep "log levels"
npm test -- --grep "sanitization"
npm test -- --grep "aggregation"
```

### **Validación en Cloud Run:**
```bash
# Verificar logs en producción
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tu-servicio" --limit=50
```

## 🚂 **Logs de Railway**

### **Descarga Automática de Logs:**
```powershell
# Descargar logs del deployment más reciente
.\scripts\windows\download-railway-logs.ps1

# Descargar logs de un deployment específico
.\scripts\windows\download-railway-logs.ps1 ae0abf4

# Especificar directorio de salida
.\scripts\windows\download-railway-logs.ps1 ae0abf4 "C:\temp\logs"
```

### **Configuración Inicial de Railway:**
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Autenticarse
railway login

# Enlazar proyecto
railway link
```

### **Análisis de Logs Descargados:**
```powershell
# Filtrar errores críticos
Get-Content logs\railway-downloads\railway-logs-*.txt | Select-String '☠️|🚨'

# Filtrar mensajes de WhatsApp
Get-Content logs\railway-downloads\railway-logs-*.txt | Select-String '💬'

# Filtrar respuestas de OpenAI
Get-Content logs\railway-downloads\railway-logs-*.txt | Select-String '🤖'

# Análisis JSON de errores
Get-Content logs\railway-downloads\railway-logs-*.json | ConvertFrom-Json | Where-Object { $_.level -eq 'error' }
```

### **Características del Script:**
- ✅ **Verificación automática** de Railway CLI
- ✅ **Autenticación** y enlace de proyecto
- ✅ **Descarga dual** (TXT + JSON)
- ✅ **Timestamps** automáticos en archivos
- ✅ **Estadísticas** de descarga
- ✅ **Manejo de errores** robusto
- ✅ **Sugerencias** de comandos útiles

## 📚 **Referencias y Estándares**

### **Estándares de la Industria:**
- **RFC 5424**: Syslog Protocol
- **Winston**: Node.js logging framework
- **Log4j**: Java logging framework
- **Python logging**: Python standard library

### **Niveles de Log Estándar:**
```typescript
// Estándar RFC 5424
type RFC5424Level = 
  | 'EMERGENCY'  // 0 - Sistema inutilizable
  | 'ALERT'      // 1 - Acción inmediata requerida
  | 'CRITICAL'   // 2 - Condición crítica
  | 'ERROR'      // 3 - Error
  | 'WARNING'    // 4 - Advertencia
  | 'NOTICE'     // 5 - Condición normal pero significativa
  | 'INFO'       // 6 - Mensaje informativo
  | 'DEBUG';     // 7 - Mensaje de debug
```

## 🔄 **Mantenimiento y Actualizaciones**

### **Limpieza Automática:**
- **Logs locales**: Limpieza cada 24 horas
- **Archivos de sesión**: Máximo 5 archivos
- **Cache de memoria**: Limpieza cada 10 minutos
- **Métricas**: Reset diario

### **Monitoreo de Performance:**
- **Latencia**: Máximo 100ms por log
- **Memoria**: Máximo 50MB de buffer
- **Throughput**: Máximo 1000 logs/segundo
- **Almacenamiento**: Máximo 1GB por día

## 📋 **Checklist de Implementación**

### ✅ **Configuración Básica:**
- [ ] Niveles de log configurados
- [ ] Categorías definidas
- [ ] Filtros aplicados
- [ ] Sanitización habilitada

### ✅ **Monitoreo:**
- [ ] Métricas habilitadas
- [ ] Dashboard configurado
- [ ] Alertas configuradas
- [ ] Tests implementados

### ✅ **Documentación:**
- [ ] Guías de uso actualizadas
- [ ] Ejemplos de código
- [ ] Troubleshooting
- [ ] Referencias técnicas

## 🤖 **Para IAs: Navegación Rápida**

### **📖 Documentación Completa:**
- **Implementación técnica**: `docs/logging/LOGGING_SYSTEM_COMPLETE.md`
- **Punto de entrada**: `src/utils/logging/README.md`
- **Desarrollo local**: `logs/local-development/README.md`

### **🔧 Archivos de Implementación:**
- **Funciones principales**: `src/utils/logging/index.ts`
- **Configuración**: `src/utils/log-config.ts`
- **Logger base**: `src/utils/logger.ts`

### **📊 Herramientas de Análisis:**
- **Parser de logs**: `tools/log-tools/cloud-parser/`
- **Tests**: `tests/logging/`
- **Métricas**: Endpoint `/metrics`
- **Railway logs**: `scripts/windows/download-railway-logs.ps1`

---

**Última actualización**: Julio 2025 - V2.2  
**Responsable**: Sistema de Logging  
**Estado**: ✅ Completamente implementado y documentado 