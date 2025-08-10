# 📊 Sistema de Logging Técnico Compacto

Sistema de logging optimizado para monitoreo técnico detallado con formatos compactos de una línea, diseñado específicamente para tu bot de WhatsApp con integraciones OpenAI, Beds24 y PostgreSQL.

## 🎯 **Características Principales**

✅ **UNA LÍNEA por métrica** - Formato compacto sin perder información crítica  
✅ **Datos completos** - Todas las métricas importantes capturadas  
✅ **Fácil parsing** - Para dashboards, alertas y análisis  
✅ **Compatible** - Se integra con tu sistema actual sin breaking changes  
✅ **Dual environment** - Optimizado para local y Railway  

---

## 📋 **Nuevos Tipos de Logs Implementados**

### **🏨 Beds24 API Raw Data**
```
[BEDS24_RAW] 57300...251: success:true rooms:5 offers:5 data:[173207:850000:1|173307:1050000:1|173308:1050000:1|173309:1050000:1|173311:1050000:1] status:200 dur:845ms err:0
```

### **🤖 OpenAI Prompts Completos**
```
[OPENAI_PROMPT] 57300...251: thread:th_threa...KCk len:207 content:"SrAlex|ColegaJefe,cotizacion|2025-08-05_19:51|Me gustaria Consultar Disponibilidad Para Unas fechas Somos 3 personas Del 5 al 10 de noviembre."
```

### **🔢 Métricas de Tokens**
```
[TOKENS_METRIC] 57300...251: in:1240 out:3737 total:4977 model:gpt-4 thread:th_threa...KCk
```

### **⏱️ Latencias Detalladas**
```
[LATENCY_METRIC] 57300...251: openai:14000ms beds24:845ms whapi:230ms db:18ms total:15063ms
```

### **📈 Estadísticas de Uso**
```
[USAGE_STATS] sys: msgs:542/hr chunks:1246 avgLen:182ch funcs:24 errs:0
```

### **💾 Operaciones de Base de Datos**
```
[DB_QUERY] 57300...251: type:enrich time:12ms res:labels=2 name="Sr Alex" cache:updated
```

### **🗄️ Métricas de Caché**
```
[CACHE_METRIC] sys: hits:82% misses:18% size:34MB users:124 evicts:12
```

### **📦 Métricas de Buffer**
```
[BUFFER_METRIC] sys: active:8 merged:45 abandoned:2 voice:12 text:542
```

### **🧵 Métricas de Thread**
```
[THREAD_METRIC] 57300...251: id:th_threa...KCk msgs:12 tokens:47267 reused:true age:45m
```

### **⚙️ Performance de Funciones**
```
[FUNC_PERF] 57300...251: check_availability:845ms api:680ms db:120ms calls:1 errs:0
```

### **💻 Métricas del Sistema**
```
[SYS_METRIC] sys: mem:120/512MB cpu:5% conn:24 uptime:12h34m activeUsers:124
```

### **⚠️ Alertas de Rate Limiting**
```
[RATE_WARN] sys: openai:80%(21/25rpm) whapi:45%(450/1000rpm) beds24:ok
```

### **🔄 Fallbacks y Recovery**
```
[FALLBACK] 57300...251: reason:tokenCount>limit action:truncateThread retry:1
```

---

## 🚀 **Uso en el Código**

### **1. Importar Funciones**
```typescript
import { 
    logBeds24Raw, 
    logOpenAIPrompt, 
    logTokensMetric,
    logLatencyMetric,
    logFuncPerf 
} from '../utils/logging';

// Para tracking automático
import { 
    trackMessage, 
    trackFunction, 
    trackLatencies 
} from '../utils/logging/collectors';
```

### **2. En Beds24 Service**
```typescript
// src/plugins/hotel/services/beds24/beds24.service.ts
import { logBeds24Response } from '../../../utils/logging/integrations';

async function queryAvailability(params: any) {
    const startTime = Date.now();
    
    try {
        const response = await this.httpClient.get('/inventory/rooms/offers', { params });
        const duration = `${Date.now() - startTime}ms`;
        
        // 🔧 NUEVO: Log raw data compacto
        logBeds24Response(
            params.userId || 'system',
            response.data,
            duration,
            true
        );
        
        return response.data;
    } catch (error) {
        logBeds24Response(params.userId || 'system', { error: error.message }, '0ms', false);
        throw error;
    }
}
```

### **3. En OpenAI Service**
```typescript
// src/core/services/openai.service.ts
import { logOpenAIPromptSent, logTokenUsage } from '../../utils/logging/integrations';

async function sendMessage(userId: string, threadId: string, content: string) {
    // 🔧 NUEVO: Log prompt completo antes de enviar
    logOpenAIPromptSent(userId, threadId, content, content.length);
    
    const response = await openai.beta.threads.runs.create(threadId, {
        assistant_id: this.assistantId
    });
    
    // Después de recibir respuesta con tokens
    if (response.usage) {
        logTokenUsage(
            userId, 
            threadId, 
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        );
    }
}
```

### **4. En Database Service**
```typescript
// src/core/services/database.service.ts
import { logDatabaseOperation } from '../../utils/logging/integrations';

async function enrichUser(userId: string) {
    const startTime = Date.now();
    
    try {
        const result = await this.prisma.clientView.findUnique({
            where: { userId }
        });
        
        const duration = Date.now() - startTime;
        
        // 🔧 NUEVO: Log operación DB
        logDatabaseOperation(
            userId,
            'enrich',
            duration,
            result ? `labels=${result.labels?.length || 0} name="${result.name}"` : 'not_found',
            true // cache was updated
        );
        
        return result;
    } catch (error) {
        logDatabaseOperation(userId, 'enrich', Date.now() - startTime, `error:${error.message}`, false);
        throw error;
    }
}
```

### **5. En Check Availability Function**
```typescript
// src/plugins/hotel/functions/check-availability.ts
import { logFunctionPerformance } from '../../../utils/logging/integrations';

export async function checkAvailability(args: any) {
    const startTime = Date.now();
    let apiTime = 0;
    let dbTime = 0;
    
    try {
        // Beds24 API call
        const apiStart = Date.now();
        const availability = await beds24Service.queryAvailability(args);
        apiTime = Date.now() - apiStart;
        
        // Database lookup
        const dbStart = Date.now();
        const apartmentDetails = await apartmentService.getDetails(availability.roomIds);
        dbTime = Date.now() - dbStart;
        
        const totalTime = Date.now() - startTime;
        
        // 🔧 NUEVO: Log performance detallada
        logFunctionPerformance(
            args.userId || 'system',
            'check_availability',
            totalTime,
            apiTime,
            dbTime,
            1, // calls
            0  // errors
        );
        
        return formatAvailabilityResponse(availability, apartmentDetails);
    } catch (error) {
        logFunctionPerformance(
            args.userId || 'system',
            'check_availability',
            Date.now() - startTime,
            apiTime,
            dbTime,
            1, // calls
            1  // errors
        );
        throw error;
    }
}
```

---

## 📊 **Métricas Automáticas**

El sistema recolecta automáticamente métricas cada minuto:

```typescript
// Se ejecuta automáticamente cada 60 segundos
[SYS_METRIC] sys: mem:120/512MB cpu:5% conn:24 uptime:12h34m activeUsers:124
[CACHE_METRIC] sys: hits:82% misses:18% size:34MB users:124 evicts:12
[BUFFER_METRIC] sys: active:8 merged:45 abandoned:2 voice:12 text:542
[USAGE_STATS] sys: msgs:542/hr chunks:1246 avgLen:182ch funcs:24 errs:0
```

---

## 🔍 **Parsing y Análisis**

### **Extracción de Métricas con RegEx**
```bash
# Buscar latencias altas de OpenAI
grep "LATENCY_METRIC.*openai:[0-9]\{5,\}" logs/

# Extraer uso de tokens por usuario
grep "TOKENS_METRIC" logs/ | awk -F'total:' '{print $2}' | awk '{print $1}'

# Contar errores por hora
grep "$(date +%Y-%m-%d.*%H)" logs/ | grep "errs:[1-9]" | wc -l
```

### **Dashboard Queries**
```sql
-- Para un dashboard que parsee estos logs
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(CAST(REGEXP_EXTRACT(message, r'openai:(\d+)ms') AS INT64)) as avg_openai_latency,
    AVG(CAST(REGEXP_EXTRACT(message, r'beds24:(\d+)ms') AS INT64)) as avg_beds24_latency
FROM logs 
WHERE category = 'LATENCY_METRIC'
GROUP BY hour
ORDER BY hour DESC;
```

---

## ⚠️ **Alertas Recomendadas**

### **1. Alta Latencia OpenAI**
```
ALERT: OpenAI latency > 30s
Query: LATENCY_METRIC.*openai:([3-9][0-9]{4,}|[1-9][0-9]{5,})ms
```

### **2. Rate Limiting**
```
ALERT: API rate > 80%
Query: RATE_WARN.*[89][0-9]%|100%
```

### **3. Memoria Alta**
```
ALERT: Memory usage > 400MB
Query: SYS_METRIC.*mem:([4-9][0-9]{2}|[1-9][0-9]{3,})/
```

### **4. Errores Frecuentes**
```
ALERT: Error rate > 5%
Query: USAGE_STATS.*errs:([5-9]|[1-9][0-9]+)
```

---

## 🔧 **Configuración**

### **Variables de Entorno**
```bash
# Habilitar logs compactos (default: true en Railway)
RAILWAY_COMPACT_LOGS=true

# Intervalo de métricas automáticas (default: 60000ms)
METRICS_COLLECTION_INTERVAL=60000

# Límites para alertas
OPENAI_RATE_LIMIT=25
WHAPI_RATE_LIMIT=1000
MAX_MEMORY_MB=400
```

### **En tu main.ts**
```typescript
// Importar para inicializar collectors automáticamente
import './utils/logging/collectors';

// Opcional: configurar intervalos custom
import { metricsCollector } from './utils/logging/collectors';
```

---

## 📈 **Beneficios del Sistema**

✅ **Monitoreo Completo** - Cada aspecto del bot está monitoreado  
✅ **Troubleshooting Rápido** - Logs compactos pero informativos  
✅ **Performance Tracking** - Métricas detalladas de latencias  
✅ **Resource Monitoring** - Memoria, CPU, conexiones  
✅ **Business Intelligence** - Patrones de uso, conversiones  
✅ **Alertas Proactivas** - Detección temprana de problemas  

---

## 🎯 **Próximos Pasos**

1. **Integrar en servicios existentes** - Añadir llamadas de logging en puntos clave
2. **Configurar dashboard** - Parsear logs para visualización en tiempo real  
3. **Implementar alertas** - Sistema de notificaciones basado en métricas
4. **Optimizar rendimiento** - Usar métricas para identificar bottlenecks

El sistema está listo para implementación y proporcionará visibilidad completa de tu bot con el formato compacto que necesitas.