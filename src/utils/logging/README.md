# 🤖 Sistema de Logging Centralizado

> **🎯 PUNTO DE ENTRADA TÉCNICO: Implementación centralizada del sistema de logging para el bot de WhatsApp.**

## 📋 **Archivos del Sistema**

| Archivo | Propósito | Tipo de Log |
|---------|-----------|-------------|
| **[index.ts](index.ts)** | 🎯 Punto de entrada principal | Todos |
| **[types.ts](types.ts)** | 📝 Definiciones TypeScript | N/A |
| **[console-logger.ts](console-logger.ts)** | 🖥️ Logs limpios terminal | Tipo 1 |
| **[file-logger.ts](file-logger.ts)** | 📁 Logs detallados archivos | Tipo 2 |
| **[cloud-logger.ts](cloud-logger.ts)** | ☁️ Logs estructurados Cloud | Tipo 3 |

## 🎯 **Cómo Funciona**

### **Detección Automática de Entorno**
```typescript
// El sistema detecta automáticamente dónde está ejecutándose
const isCloudRun = !!process.env.K_SERVICE;
const isLocal = !isCloudRun;

// Y activa los loggers apropiados:
// Local: Console + File
// Cloud: Structured logs
```

### **Configuración Unificada**
```typescript
export const LOGGING_CONFIG: LogConfig = {
    environment: process.env.NODE_ENV || 'development',
    isCloudRun: !!process.env.K_SERVICE,
    
    console: { enabled: true, level: 'INFO', format: 'simple' },
    file: { enabled: !process.env.K_SERVICE, level: 'DEBUG', format: 'detailed' },
    cloud: { enabled: !!process.env.K_SERVICE, level: 'INFO', format: 'structured' }
};
```

## 🚀 **Uso en el Código**

### **Importación Simple**
```typescript
// Importar el sistema completo
import { log, logInfo, logError, logSuccess } from '@/utils/logging';

// O importar específico
import { consoleLog } from '@/utils/logging/console-logger';
import { fileLog } from '@/utils/logging/file-logger';
```

### **Logging Básico**
```typescript
// Función principal - decide automáticamente qué loggers usar
log('INFO', 'MESSAGE_RECEIVED', 'Usuario envió mensaje', { userId: '573003913251' });

// Funciones de conveniencia
logInfo('OPENAI_REQUEST', 'Procesando con IA');
logError('BEDS24_ERROR', 'Error consultando disponibilidad', { error: details });
logSuccess('BOT_READY', 'Bot inicializado correctamente');
```

### **Logging Específico por Tipo**
```typescript
// Solo para terminal (desarrollo)
consoleLog('INFO', 'MESSAGE_RECEIVED', 'Usuario 573003913251: "Consulta"');

// Solo para archivo (debugging detallado)
fileLog('DEBUG', 'FUNCTION_CALLING', 'Ejecutando función', { args, threadId });

// Solo para Cloud (producción)
cloudLog('INFO', 'SYSTEM_HEALTH', 'Métricas del sistema', { memory, cpu });
```

## 🔧 **Configuración por Entorno**

### **Desarrollo Local**
- ✅ **Console logs**: Súper limpios, solo esencial
- ✅ **File logs**: Técnicos completos con JSON
- ❌ **Cloud logs**: Desactivados

### **Cloud Run Producción**
- ❌ **Console logs**: Desactivados (opcional)
- ❌ **File logs**: No persistentes en Cloud Run
- ✅ **Cloud logs**: Estructurados para Google Cloud Console

## 📊 **Tipos de Logs Soportados**

### **Categorías Principales**
```typescript
// Mensajes y comunicación
'MESSAGE_RECEIVED', 'MESSAGE_PROCESS', 'WHATSAPP_SEND'

// OpenAI y funciones  
'OPENAI_REQUEST', 'OPENAI_RESPONSE', 'FUNCTION_CALLING_START'

// Integración Beds24
'BEDS24_REQUEST', 'BEDS24_API_CALL', 'BEDS24_RESPONSE_DETAIL'

// Sistema y threads
'THREAD_CREATED', 'THREAD_PERSIST', 'SERVER_START', 'BOT_READY'

// Estados
'ERROR', 'WARNING', 'SUCCESS'
```

### **Niveles de Log**
```typescript
type LogLevel = 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
```

## 🎨 **Formatos de Salida**

### **Console (Tipo 1): Simple y Limpio**
```
👤 Usuario 573003913251: "Consulta disponibilidad" → ⏱️ 10s...
🤖 Bot → Completado (28.5s) → "Para las fechas del 15 al 20..."
⚙️ Ejecutando función: check_availability
```

### **File (Tipo 2): Técnico Detallado**
```
[2025-07-10T01:18:06.722Z] [INFO] FUNCTION_CALLING_START [app-unified.ts]: OpenAI requiere ejecutar 1 función(es) | {"shortUserId":"573003913251","threadId":"thread_6YLULxd75f351plgSL8M4rxl"}
```

### **Cloud (Tipo 3): Estructurado JSON**
```json
{
  "timestamp": "2025-07-10T01:18:06.722Z",
  "severity": "INFO", 
  "category": "FUNCTION_CALLING_START",
  "message": "OpenAI requiere ejecutar 1 función(es)",
  "details": {"shortUserId": "573003913251"},
  "labels": {"component": "whatsapp-bot", "environment": "production"}
}
```

## 🔄 **Migración desde Sistema Anterior**

### **Compatibilidad Legacy**
```typescript
// El sistema mantiene compatibilidad con el logger anterior
export { detailedLog } from '../logger';

// Puedes seguir usando la función anterior
detailedLog('INFO', 'CATEGORY', 'mensaje', details);
```

### **Migración Gradual**
1. **Importar nuevo sistema**: `import { log } from '@/utils/logging'`
2. **Reemplazar llamadas**: `detailedLog()` → `log()`
3. **Aprovechar nuevas funciones**: `logInfo()`, `logError()`, etc.

## 🤖 **Para IAs: Puntos Clave**

### **Arquitectura**
- **index.ts** es el punto de entrada único
- **Detección automática** de entorno (local vs Cloud Run)
- **Tres loggers especializados** para diferentes propósitos
- **Configuración centralizada** en una sola estructura

### **Flujo de Decisión**
1. Código llama `log(level, category, message, details)`
2. Sistema verifica configuración por entorno
3. Activa loggers apropiados automáticamente
4. Cada logger formatea según su propósito

### **Beneficios**
- **Un solo punto de configuración**
- **Comportamiento automático por entorno**
- **Formatos optimizados por uso**
- **Compatibilidad con código existente**
- **Fácil extensión y mantenimiento**

---

**🤖 Para IAs**: Este sistema centraliza TODA la lógica de logging del proyecto. Es el lugar definitivo para entender cómo funcionan los logs en cada entorno. 