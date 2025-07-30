# 🚀 Guía Completa de Migración Modular - TeAlquilamos Bot

*Transformación de app-unified.ts (3,779 líneas) a arquitectura modular escalable*

---

## 📑 **INVENTARIO COMPLETO VERIFICADO**

### **Variables Globales (25 identificadas)**
```typescript
// Configuración y servicios principales
appConfig, openaiClient, server, isServerInitialized

// Gestión de estado y buffers
globalMessageBuffers, globalUserStates, activeProcessing, pendingImages, 
botSentMessages, userRetryState

// Sistemas de cache
contextCache, chatInfoCache, precomputedContextBase

// Control de flujo
webhookCounts, typingLogTimestamps, subscribedPresences, simpleLockManager

// Logging y monitoreo
terminalLog, botDashboard, metricsRouter

// Constantes de configuración
CHAT_INFO_CACHE_TTL, CONTEXT_CACHE_TTL, BUFFER_WINDOW_MS, 
TYPING_EXTENDED_MS, SHOW_FUNCTION_LOGS
```

### **Métodos de terminalLog (20 activos)**
```typescript
// Logs principales (4)
message, typing, processing, response

// Logs de error (6)
error, openaiError, imageError, voiceError, functionError, whapiError

// Logs de funciones (3)
functionStart, functionProgress, functionCompleted

// Logs de sistema (2)
startup, newConversation

// Logs de media (3)
image, voice, recording

// Logs de resultados (2)
availabilityResult, externalApi
```

### **Funcionalidades Críticas**
- **Webhooks**: processWebhook con presences/messages handling
- **OpenAI Integration**: Threads, runs, polling con backoff progresivo
- **Media Processing**: transcribeAudio (Whisper + fs temporal), analyzeImage (Vision multimodal)
- **Buffering System**: Timer inteligente 5s/10s según actividad
- **Caching**: 3 sistemas con TTLs específicos (5min, 1h, 1min)
- **Function Calling**: Registry dinámico con check_availability
- **Validation**: validateAndCorrectResponse con retry interno
- **Cleanup**: recoverOrphanedRuns, cleanupOldRuns, cleanupExpiredCaches
- **Monitoring**: Dashboard real-time + Prometheus metrics

### **Elementos Obsoletos a Eliminar**
- `guestMemory` (import comentado sin uso)
- Buffers comentados: `userMessageBuffers`, `manualTimers`
- Logs comentados: `logMessageReceived`, `logOpenAIRequest`, etc.
- Importación dinámica: `executeFunction` → registry estático

---

## 🎯 **OBJETIVO Y ARQUITECTURA TARGET**

### **Objetivo Principal**
Transformar el monolito en arquitectura modular manteniendo 100% funcionalidad, agregando persistencia SQL y preparando para múltiples verticales de negocio.

### **Arquitectura Modular Final (Refactorizada)**
```
src/
├── core/                          // NÚCLEO REUTILIZABLE (~80% del código)  
│   ├── api/                       
│   │   ├── server.ts             // Express, endpoints, health checks
│   │   └── webhook-processor.ts   // processWebhook, presences handling
│   │
│   ├── processing/                
│   │   ├── openai-service.ts     // processWithOpenAI con IContextProvider
│   │   └── cleanup-service.ts    // recoverOrphanedRuns, cleanupOldRuns
│   │
│   ├── state/                     
│   │   ├── buffer-manager.ts     // globalMessageBuffers, timers inteligentes
│   │   ├── user-state-manager.ts // globalUserStates, activeProcessing
│   │   ├── presence-manager.ts   // subscribedPresences, suscripciones WHAPI
│   │   ├── media-manager.ts      // pendingImages, botSentMessages
│   │   ├── cache-manager.ts      // Unificación de caches con LRU
│   │   └── locks.ts              // simpleLockManager con colas
│   │
│   ├── services/                  
│   │   ├── whatsapp.service.ts   // sendWhatsAppMessage, indicators
│   │   ├── media.service.ts      // transcribeAudio, analyzeImage
│   │   ├── database.service.ts   // Prisma client, persistencia
│   │   ├── label.service.ts      // [NUEVO] API genérica para etiquetas WHAPI
│   │   └── function-registry.ts  // IFunctionRegistry implementation
│   │
│   ├── monitoring/                
│   │   ├── dashboard.ts          // botDashboard, WebSocket, UI
│   │   └── metrics.ts            // metricsRouter, Prometheus
│   │
│   └── utils/                     
│       ├── terminal-log.ts       // 20 métodos de logging unificados
│       ├── rate-limiter.ts       // webhookCounts, typingLogTimestamps
│       ├── identifiers.ts        // getShortUserId, cleanContactName
│       └── constants.ts          // TTLs, timeouts, configuraciones
│
├── plugins/                       // MÓDULOS DE NEGOCIO (~20% del código)
│   └── hotel/                     
│       ├── functions/             
│       │   └── check-availability.ts // Implementación específica
│       ├── services/              
│       │   └── beds24-client.ts  // API client para Beds24
│       ├── logic/                 
│       │   ├── labels.ts         // [REFACTORIZADO] Lista hotelera + lógica específica
│       │   ├── context.ts        // [REFACTORIZADO] Implementa IContextProvider
│       │   └── validation.ts     // validateAndCorrectResponse, userRetryState
│       └── hotel.plugin.ts       // Punto de entrada del plugin
│
├── shared/                        
│   ├── interfaces.ts             // [AMPLIADO] IContextProvider, ILabelManager
│   └── types.ts                  // UserState, WHAPIMessage, etc.
│
├── config/                        
│   └── environment.ts            // Validación и carga de variables
│
└── main.ts                       // Bootstrap y composición
```

**🔧 Cambios Clave en la Arquitectura:**

1. **`core/services/label.service.ts`** - **NUEVO**: Manejo genérico de etiquetas WHAPI
2. **`plugins/hotel/logic/labels.ts`** - **REFACTORIZADO**: Solo lógica específica hotelera  
3. **`plugins/hotel/logic/context.ts`** - **REFACTORIZADO**: Implementa `IContextProvider`
4. **`shared/interfaces.ts`** - **AMPLIADO**: Define `IContextProvider` e `ILabelManager`
5. **`core/processing/openai-service.ts`** - **ACTUALIZADO**: Usa `IContextProvider` inyectado

**🛡️ Mejoras Críticas para Robustez en Producción:**

6. **`shared/validation.ts`** - **[CRÍTICO NUEVO]**: Esquemas Zod para validación de webhooks
7. **`core/utils/retry-utils.ts`** - **[CRÍTICO NUEVO]**: Retry logic con backoff exponencial
8. **`core/api/webhook-validator.ts`** - **[CRÍTICO NUEVO]**: Validador de entrada para webhooks

---

## 🔍 **ANÁLISIS DE LABELS Y CONTEXTO: ¿GENÉRICO (CORE) O ESPECÍFICO (PLUGIN)?**

Tu observación sobre si los módulos de labels y context deberían ser genéricos es excelente y muy acertada. Demuestra una profunda comprensión de la arquitectura. La respuesta es matizada y nos lleva a una mejora clave del plan: **separar el mecanismo de la implementación**.

Tienes razón: el concepto de tener etiquetas para un cliente y de generar un contexto para una conversación es universal. Sin embargo, la implementación actual en tu código es altamente específica para la hotelería.

### **Analicemos cada uno:**

#### **1. Labels**

**El Mecanismo (Genérico - Debe ir en el Core):** La capacidad de obtener, añadir o quitar una etiqueta de un contacto a través de la API de Whapi es una funcionalidad genérica. Al core no le importa si la etiqueta es "Potencial", "Pedido Entregado" o "Soporte Nivel 2". Debería existir un `LabelManager` en el core que se encargue de la comunicación con la API.

**La Implementación (Específica - Debe ir en el Plugin):** La lista de etiquetas relevantes (`['Potencial', 'Reservado', 'VIP', ...]`) y la lógica de negocio que depende de ellas (por ejemplo, "si el cliente tiene la etiqueta 'VIP', ofrecer un trato preferencial") es 100% específica de la hotelería. Esto se queda en `plugins/hotel/logic/labels.ts`.

#### **2. Context**

**El Mecanismo (Genérico - Debe ir en el Core):** El core necesita saber que puede solicitar una "cadena de texto de contexto" para inyectarla en el prompt de la IA. Para esto, se define una interfaz genérica, como `IContextProvider`.

**La Implementación (Específica - Debe ir en el Plugin):** La función `getRelevantContext` actual es muy específica:

- Usa la zona horaria "America/Bogota".
- Formatea el texto como "Fecha: ... | Hora: ... (Colombia)".
- Interpreta las etiquetas de hotelería para construir la parte de "Status: ...".

Por lo tanto, la implementación concreta de `IContextProvider` pertenece al `plugins/hotel/logic/context.ts`.

### **💡 Solución Arquitectónica Ideal (Modificación Menor al Plan)**

Para reflejar esta separación y hacer el core aún más reutilizable, podemos hacer un pequeño ajuste en la arquitectura propuesta.

**Modificar la Arquitectura Target para que quede así:**

```
src/
├── core/
│   └── services/
│       ├── label.service.ts      // (+) NUEVO: Lógica genérica para interactuar con Whapi Labels
│       └── ...
├── plugins/
│   └── hotel/
│       └── logic/
│           ├── labels.ts         // Contiene la LISTA de labels hoteleros y la lógica específica
│           ├── context.ts        // Implementa la interfaz IContextProvider con lógica hotelera
│           └── ...
└── shared/
    └── interfaces.ts         // (+) AÑADIR: export interface IContextProvider { ... }
```

### **¿Qué significa esto en la práctica?**

1. **`core/services/label.service.ts`:** Tendrá métodos como `getLabels(userId): Promise<string[]>` y `setLabels(userId, labels: string[]): Promise<void>`. No sabe nada de hoteles.

2. **`plugins/hotel/logic/labels.ts`:** Usará el `LabelService` del core para obtener las etiquetas, pero contendrá la lógica específica, como `const RELEVANT_HOTEL_LABELS = ['Potencial', 'Reservado'];` y funciones como `isVip(userId): boolean`.

3. **`plugins/hotel/logic/context.ts`:** Implementará la interfaz `IContextProvider` definida en `shared/interfaces.ts`, construyendo el string de contexto específico para el hotel, tal como lo hace ahora.

4. El `openai-service.ts` del core ya no conocerá `getRelevantContext` directamente, sino que recibirá una implementación de `IContextProvider` a través de inyección de dependencias.

Con este ajuste, tu plan no solo es perfecto, sino que alcanza un nivel de desacoplamiento y reutilización de élite. Responde perfectamente a tu acertada intuición de que ciertos conceptos son más genéricos de lo que el plan inicial reflejaba.

---

## 📋 **ETAPA 1: PREPARACIÓN Y ANÁLISIS**

### **1.1 Auditoría Pre-Migración**
```bash
# Crear checklist de verificación
cat > migration-checklist.md << 'EOF'
# Migration Checklist

## Globals (25 total)
- [ ] appConfig → config/environment.ts
- [ ] openaiClient → core/services/openai.service.ts
- [ ] server, isServerInitialized → core/api/server.ts
- [ ] globalMessageBuffers → core/state/buffer-manager.ts
- [ ] globalUserStates → core/state/user-state-manager.ts
- [ ] activeProcessing → core/state/user-state-manager.ts
- [ ] pendingImages → core/state/media-manager.ts
- [ ] botSentMessages → core/state/media-manager.ts
- [ ] userRetryState → plugins/hotel/logic/validation.ts
- [ ] contextCache → core/state/cache-manager.ts
- [ ] chatInfoCache → core/state/cache-manager.ts
- [ ] precomputedContextBase → plugins/hotel/logic/context.ts
- [ ] webhookCounts → core/utils/rate-limiter.ts
- [ ] typingLogTimestamps → core/utils/rate-limiter.ts
- [ ] subscribedPresences → core/state/presence-manager.ts
- [ ] simpleLockManager → core/state/locks.ts
- [ ] terminalLog → core/utils/terminal-log.ts
- [ ] botDashboard → core/monitoring/dashboard.ts
- [ ] metricsRouter → core/monitoring/metrics.ts
- [ ] Constants (5) → core/utils/constants.ts

## Functions to Migrate
- [ ] processWebhook → core/api/webhook-processor.ts
- [ ] processWithOpenAI → core/processing/openai-service.ts
- [ ] transcribeAudio → core/services/media.service.ts
- [ ] analyzeImage → core/services/media.service.ts
- [ ] sendWhatsAppMessage → core/services/whatsapp.service.ts
- [ ] check_availability → plugins/hotel/functions/
- [ ] validateAndCorrectResponse → plugins/hotel/logic/validation.ts
- [ ] getRelevantContext → plugins/hotel/logic/context.ts
- [ ] Cleanup functions → core/processing/cleanup-service.ts

## Obsoletes to Remove
- [ ] guestMemory import and references
- [ ] userMessageBuffers (commented)
- [ ] manualTimers (commented)  
- [ ] Commented log imports
- [ ] Dynamic executeFunction import
EOF

# Verificar estado actual
echo "=== Estado Actual del Sistema ==="
echo "Líneas totales: $(wc -l < src/app-unified.ts)"
echo "Globals activos: $(grep -c "^const\|^let" src/app-unified.ts | grep -v "//")"
echo "Funciones: $(grep -c "^async function\|^function" src/app-unified.ts)"
echo "Imports: $(grep -c "^import" src/app-unified.ts)"
```

### **1.2 Setup del Entorno**
```bash
# Crear rama y backup
git checkout -b refactor/modular-architecture
cp src/app-unified.ts src/app-unified.backup.ts

# Crear estructura de directorios
mkdir -p src/{core/{api,processing,state,services,monitoring,utils},plugins/hotel/{functions,services,logic},shared,config}

# Crear archivos críticos para robustez en producción
touch src/shared/validation.ts    # Esquemas Zod para validación de webhooks
touch src/core/utils/retry-utils.ts    # Retry logic con backoff exponencial  
touch src/core/api/webhook-validator.ts    # Validador de webhooks

# Instalar dependencias necesarias
npm install lru-cache @types/lru-cache
npm install zod  # Para validación de esquemas (CRÍTICO)
npm install --save-dev @types/node

# Crear archivo de auditoría automatizada
cat > scripts/audit-migration.sh << 'BASH'
#!/bin/bash
echo "🔍 Auditoría de Migración..."

# Check globals
GLOBALS_IN_UNIFIED=$(grep -c "^const\|^let" src/app-unified.ts 2>/dev/null || echo 0)
echo "Globals en app-unified.ts: $GLOBALS_IN_UNIFIED"

# Check terminal log methods
if [ -f "src/core/utils/terminal-log.ts" ]; then
    METHODS=$(grep -c "^\s*[a-zA-Z]*:" src/core/utils/terminal-log.ts)
    echo "Métodos en terminalLog: $METHODS (esperado: 20)"
fi

# Check for obsoletes
OBSOLETES=$(grep -r "guestMemory\|userMessageBuffers\|manualTimers" src/ 2>/dev/null | wc -l)
echo "Referencias obsoletas: $OBSOLETES (esperado: 0)"

echo "✅ Auditoría completada"
BASH

chmod +x scripts/audit-migration.sh
```

---

## 🛠️ **ETAPA 2: EXTRACCIÓN DEL CORE**

### **2.1 Interfaces y Tipos Compartidos (Refactorizados)**
```typescript
// src/shared/interfaces.ts
export interface ToolCallFunction {
  (args: any, context?: any): Promise<string>;
}

export interface IFunctionRegistry {
  register(name: string, func: ToolCallFunction): void;
  execute(name: string, args: any, context?: any): Promise<string>;
  has(name: string): boolean;
  list(): string[];
}

export interface ICacheManager {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

// [NUEVO] Abstracción genérica para manejo de etiquetas
export interface ILabelManager {
  getLabels(userId: string): Promise<string[]>;
  setLabels(userId: string, labels: string[]): Promise<void>;
  addLabel(userId: string, label: string): Promise<void>;
  removeLabel(userId: string, label: string): Promise<void>;
  hasLabel(userId: string, label: string): Promise<boolean>;
}

// [NUEVO] Abstracción genérica para generación de contexto
export interface IContextProvider {
  getRelevantContext(
    userId: string,
    profile: any,
    chatInfo: any,
    requestId?: string
  ): Promise<string>;
  
  needsRefresh(
    userId: string,
    lastContext: any,
    profile: any,
    chatInfo: any
  ): boolean;
  
  // Metadata para debugging
  getProviderInfo(): {
    name: string;
    version: string;
    features: string[];
  };
}

// [CRÍTICO] Validación de esquemas para webhooks - Mejora de seguridad y robustez
export interface WebhookMessage {
  id: string;
  type: 'text' | 'voice' | 'audio' | 'ptt' | 'image';
  from: string;
  chat_id: string;
  from_me: boolean;
  text?: { body: string };
  voice?: { link: string };
  audio?: { link: string };
  ptt?: { link: string };
  image?: { link: string };
}

export interface WebhookPresence {
  contact_id: string;
  status: 'typing' | 'recording' | 'online' | 'offline' | 'pending';
}

export interface WebhookPayload {
  messages?: WebhookMessage[];
  presences?: WebhookPresence[];
}

// src/shared/types.ts
export interface UserState {
  userId: string;
  isTyping: boolean;
  lastTypingTimestamp: number;
  lastMessageTimestamp: number;
  messages: string[];
  chatId: string;
  userName: string;
  typingEventsCount: number;
  averageTypingDuration: number;
  lastInputVoice: boolean;
  lastTyping: number;
  isCurrentlyRecording?: boolean;
}

export interface MessageBuffer {
  messages: string[];
  chatId: string;
  userName: string;
  lastActivity: number;
  timer: NodeJS.Timeout | null;
  currentDelay?: number;
}

export interface ThreadRecord {
  threadId: string;
  chatId: string;
  userName?: string;
  lastActivity: Date;
  labels?: string[];
}
```

### **2.1.1 Esquemas de Validación (CRÍTICO - Mejora de Seguridad)**
```typescript
// src/shared/validation.ts
import { z } from 'zod';

// Esquema para validar mensajes de webhook
export const WebhookMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'voice', 'audio', 'ptt', 'image']),
  from: z.string(),
  chat_id: z.string(),
  from_me: z.boolean(),
  text: z.object({ body: z.string() }).optional(),
  voice: z.object({ link: z.string().url() }).optional(),
  audio: z.object({ link: z.string().url() }).optional(),
  ptt: z.object({ link: z.string().url() }).optional(),
  image: z.object({ link: z.string().url() }).optional(),
});

// Esquema para validar presencias de webhook
export const WebhookPresenceSchema = z.object({
  contact_id: z.string(),
  status: z.enum(['typing', 'recording', 'online', 'offline', 'pending']),
});

// Esquema principal para validar payload completo de webhook
export const WebhookPayloadSchema = z.object({
  messages: z.array(WebhookMessageSchema).optional(),
  presences: z.array(WebhookPresenceSchema).optional(),
});

// Función de validación con manejo de errores
export function validateWebhookPayload(payload: unknown): {
  success: boolean;
  data?: z.infer<typeof WebhookPayloadSchema>;
  errors?: string[];
} {
  try {
    const validatedData = WebhookPayloadSchema.parse(payload);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed with unknown error'] };
  }
}
```

### **2.2 Utilidades Base**
```typescript
// src/core/utils/identifiers.ts
export const getShortUserId = (jid: string): string => {
  if (typeof jid === 'string') {
    const cleaned = jid.split('@')[0] || jid;
    return cleaned;
  }
  return 'unknown';
};

export const cleanContactName = (rawName: any): string => {
  if (!rawName || typeof rawName !== 'string') return 'Usuario';
  
  let cleaned = rawName
    .trim()
    .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned.substring(0, 50) || 'Usuario';
};

// src/core/utils/constants.ts
export const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
export const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora
export const CONTEXT_BASE_CACHE_TTL = 60 * 1000; // 1 minuto
export const BUFFER_WINDOW_MS = 5000; // 5 segundos
export const TYPING_EXTENDED_MS = 10000; // 10 segundos
export const MAX_MESSAGE_LENGTH = 5000;
export const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false';
```

### **2.2.1 Mejoras Críticas para Robustez en Producción**

#### **Retry Logic con Backoff Exponencial (CRÍTICO)**
```typescript
// src/core/utils/retry-utils.ts
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,     // 1 segundo inicial
  maxDelay: 10000,     // Máximo 10 segundos
  backoffFactor: 2     // Duplicar delay cada retry
};

/**
 * Ejecuta una función con retry automático y backoff exponencial
 * CRÍTICO para llamadas a APIs externas (Whapi, OpenAI, etc.)
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Si es el último intento, lanzar el error
      if (attempt > config.maxRetries) {
        throw new Error(`Operation failed after ${config.maxRetries} retries: ${lastError.message}`);
      }

      // Calcular delay con backoff exponencial
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );

      // Log del retry para debugging
      console.warn(`Retry ${attempt}/${config.maxRetries} after ${delay}ms. Error: ${lastError.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Wrapper específico para fetch con retry automático
 * CRÍTICO para transcribeAudio, analyzeImage y llamadas a Whapi
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retryOptions?: Partial<RetryOptions>
): Promise<Response> {
  return executeWithRetry(async () => {
    const response = await fetch(url, options);
    
    // Considerar códigos 5xx y timeouts como retry-ables
    if (response.status >= 500 || response.status === 429) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Otros errores no son retry-ables (4xx, etc.)
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as any).noRetry = true;
      throw error;
    }
    
    return response;
  }, retryOptions);
}
```

#### **Validación de Webhooks en Punto de Entrada (CRÍTICO)**
```typescript
// src/core/api/webhook-validator.ts
import { validateWebhookPayload } from '../../shared/validation';
import { TerminalLog } from '../utils/terminal-log';

export class WebhookValidator {
  constructor(private terminalLog: TerminalLog) {}

  /**
   * Valida payload de webhook ANTES de procesamiento
   * CRÍTICO: Previene errores en cascada por datos malformados
   */
  validate(payload: unknown, requestId: string): {
    isValid: boolean;
    data?: any;
    errors?: string[];
  } {
    // Log del payload recibido para debugging
    this.terminalLog.message(requestId, 'webhook_received', 
      `Validating webhook payload: ${JSON.stringify(payload).substring(0, 200)}...`);

    const validation = validateWebhookPayload(payload);

    if (!validation.success) {
      this.terminalLog.error(requestId, 'webhook_validation_failed', 
        `Invalid webhook payload: ${validation.errors?.join(', ')}`);
      
      return {
        isValid: false,
        errors: validation.errors
      };
    }

    this.terminalLog.message(requestId, 'webhook_validated', 
      `Webhook payload validated successfully`);

    return {
      isValid: true,
      data: validation.data
    };
  }

  /**
   * Middleware Express para validación automática
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      const validation = this.validate(req.body, req.headers['x-request-id'] || 'unknown');
      
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Invalid webhook payload',
          details: validation.errors
        });
      }

      // Adjuntar datos validados al request
      req.validatedWebhook = validation.data;
      next();
    };
  }
}
```

### **2.3 Sistema de Logging Unificado**
```typescript
// src/core/utils/terminal-log.ts
import { BotDashboard } from '../monitoring/dashboard';

export class TerminalLog {
  constructor(private dashboard: BotDashboard) {}

  message(user: string, text: string): void {
    const logMsg = `👤 ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}}"`;
    console.log(logMsg);
    this.dashboard.addLog(logMsg);
  }

  typing(user: string): void {
    console.log(`✍️ ${user} está escribiendo...`);
  }

  processing(user: string): void {
    // Eliminado intencionalmente - no mostrar en terminal
  }

  response(user: string, text: string, duration: number): void {
    const logMsg = `🤖 OpenAI → ${user} (${(duration/1000).toFixed(1)}s)`;
    console.log(logMsg);
    this.dashboard.addLog(logMsg);
  }

  error(message: string): void {
    console.log(`❌ Error: ${message}`);
  }

  openaiError(user: string, error: string): void {
    console.log(`❌ Error enviar a OpenAI → ${user}: ${error}`);
  }

  imageError(user: string, error: string): void {
    console.log(`❌ Error al procesar imagen → ${user}: ${error}`);
  }

  voiceError(user: string, error: string): void {
    console.log(`❌ Error al procesar audio → ${user}: ${error}`);
  }

  functionError(functionName: string, error: string): void {
    console.log(`❌ Error en función ${functionName}: ${error}`);
  }

  whapiError(operation: string, error: string): void {
    console.log(`❌ Error WHAPI (${operation}): ${error}`);
  }

  functionStart(name: string, args?: any): void {
    if (name === 'check_availability' && args) {
      const { startDate, endDate } = args;
      const start = startDate?.split('-').slice(1).join('/');
      const end = endDate?.split('-').slice(1).join('/');
      const nights = args.endDate && args.startDate ? 
        Math.round((new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / (1000 * 60 * 60 * 24)) : '?';
      console.log(`⚙️ check_availability(${start}-${end}, ${nights} noches)`);
    } else {
      console.log(`⚙️ ${name}()`);
    }
  }

  functionProgress(name: string, step: string, data?: any): void {
    // Eliminado - logs redundantes
  }

  functionCompleted(name: string, result?: any, duration?: number): void {
    // Se maneja en availabilityResult
  }

  startup(): void {
    console.clear();
    console.log('\n=== Bot TeAlquilamos Iniciado ===');
    console.log(`🚀 Servidor: ${process.env.HOST || 'localhost'}:${process.env.PORT || 3008}`);
    console.log(`🔗 Webhook: ${process.env.WEBHOOK_URL || 'configurando...'}`);
    console.log('✅ Sistema listo\n');
  }

  newConversation(user: string): void {
    console.log(`\n📨 Nueva conversación con ${user}`);
  }

  image(user: string): void {
    console.log(`📷 ${user}: [Imagen recibida]`);
  }

  voice(user: string): void {
    const logMsg = `🎤 ${user}: [Nota de voz recibida]`;
    console.log(logMsg);
    this.dashboard.addLog(logMsg);
  }

  recording(user: string): void {
    console.log(`🎙️ ${user} está grabando...`);
  }

  availabilityResult(completas: number, splits: number, duration?: number): void {
    const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
    const logMsg = `🏠 ${completas} completa${completas !== 1 ? 's' : ''} + ${splits} alternativa${splits !== 1 ? 's' : ''}${durationStr}`;
    console.log(logMsg);
    this.dashboard.addLog(logMsg);
  }

  externalApi(service: string, action: string, result?: string): void {
    const timestamp = new Date().toLocaleTimeString();
    if (result) {
      console.log(`🔗 [${timestamp}] ${service} → ${action} → ${result}`);
    } else {
      console.log(`🔗 [${timestamp}] ${service} → ${action}...`);
    }
  }
}
```

### **2.4 Cache Manager Unificado**
```typescript
// src/core/state/cache-manager.ts
import { LRUCache } from 'lru-cache';
import { ICacheManager } from '../../shared/interfaces';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number;
}

export class CacheManager implements ICacheManager {
  private cache: LRUCache<string, CacheEntry<any>>;
  private timers: Map<string, NodeJS.Timeout>;

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache({ max: maxSize });
    this.timers = new Map();
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl
    };

    this.cache.set(key, entry);

    // Set auto-cleanup timer if TTL specified
    if (ttl) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Specific cache instances
  static createContextCache(): CacheManager {
    return new CacheManager(500); // Context cache
  }

  static createChatInfoCache(): CacheManager {
    return new CacheManager(1000); // Chat info cache
  }
}
```

### **2.5 Buffer Manager**
```typescript
// src/core/state/buffer-manager.ts
import { MessageBuffer } from '../../shared/types';
import { BUFFER_WINDOW_MS, TYPING_EXTENDED_MS } from '../utils/constants';

export class BufferManager {
  private buffers: Map<string, MessageBuffer> = new Map();
  
  constructor(
    private processCallback: (userId: string) => Promise<void>
  ) {}

  addMessage(
    userId: string, 
    message: string, 
    chatId: string, 
    userName: string,
    isVoice: boolean = false
  ): void {
    let buffer = this.buffers.get(userId);
    
    if (!buffer) {
      buffer = {
        messages: [],
        chatId,
        userName,
        lastActivity: Date.now(),
        timer: null
      };
      this.buffers.set(userId, buffer);
    } else {
      // Update userName if better one available
      if (userName && userName !== 'Usuario') {
        buffer.userName = userName;
      }
    }

    // Check buffer limit
    if (buffer.messages.length >= 50) {
      this.processBuffer(userId);
      return;
    }

    buffer.messages.push(message);
    buffer.lastActivity = Date.now();

    // Set intelligent timer
    const triggerType = isVoice ? 'voice' : 'message';
    this.setIntelligentTimer(userId, chatId, userName, triggerType);
  }

  private setIntelligentTimer(
    userId: string, 
    chatId: string, 
    userName: string, 
    triggerType: 'message' | 'voice' | 'typing' | 'recording'
  ): void {
    const buffer = this.buffers.get(userId);
    if (!buffer) return;

    let bufferDelay = BUFFER_WINDOW_MS;

    switch (triggerType) {
      case 'message':
        bufferDelay = BUFFER_WINDOW_MS; // 5s
        break;
      case 'voice':
        bufferDelay = 8000; // 8s
        break;
      case 'typing':
      case 'recording':
        bufferDelay = TYPING_EXTENDED_MS; // 10s
        break;
    }

    // Only reconfigure if new delay is greater
    const shouldSetNewTimer = !buffer.timer || 
      (buffer.currentDelay && bufferDelay > buffer.currentDelay);

    if (shouldSetNewTimer) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }

      buffer.timer = setTimeout(() => {
        this.processBuffer(userId);
      }, bufferDelay);

      buffer.currentDelay = bufferDelay;
    }
  }

  private async processBuffer(userId: string): Promise<void> {
    const buffer = this.buffers.get(userId);
    if (!buffer || buffer.messages.length === 0) return;

    // Clear timer
    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = null;
    }

    // Process messages
    await this.processCallback(userId);

    // Clean up if empty
    if (buffer.messages.length === 0) {
      this.buffers.delete(userId);
    }
  }

  getBuffer(userId: string): MessageBuffer | undefined {
    return this.buffers.get(userId);
  }

  clearBuffer(userId: string): void {
    const buffer = this.buffers.get(userId);
    if (buffer) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
      this.buffers.delete(userId);
    }
  }

  // Cleanup old buffers
  cleanup(maxAge: number = 15 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, buffer] of this.buffers.entries()) {
      if (now - buffer.lastActivity > maxAge) {
        this.clearBuffer(userId);
        cleaned++;
      }
    }

    return cleaned;
  }
}
```

### **2.6 Media Service**
```typescript
// src/core/services/media.service.ts
import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { TerminalLog } from '../utils/terminal-log';

export class MediaService {
  constructor(
    private openai: OpenAI,
    private terminalLog: TerminalLog,
    private config: any
  ) {}

  async transcribeAudio(
    audioUrl: string | undefined, 
    userId: string, 
    userName?: string, 
    messageId?: string
  ): Promise<string> {
    try {
      let finalAudioUrl = audioUrl;
      
      // Get URL from WHAPI if needed
      if (!finalAudioUrl && messageId) {
        finalAudioUrl = await this.fetchAudioUrl(messageId);
      }
      
      if (!finalAudioUrl) {
        throw new Error('No se pudo obtener la URL del audio');
      }
      
      // Download audio
      const audioResponse = await fetch(finalAudioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Error descargando audio: ${audioResponse.status}`);
      }
      
      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Create temp file
      const tempDir = path.join(process.cwd(), 'tmp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempAudioPath = path.join(tempDir, `audio_${Date.now()}.ogg`);
      await fs.writeFile(tempAudioPath, Buffer.from(audioBuffer));
      
      try {
        // Create read stream for OpenAI
        const { createReadStream } = await import('fs');
        const audioStream = createReadStream(tempAudioPath);
        
        // Transcribe with Whisper
        const transcription = await this.openai.audio.transcriptions.create({
          file: audioStream as any,
          model: 'whisper-1',
          language: 'es'
        });
        
        return transcription.text || 'No se pudo transcribir el audio';
        
      } finally {
        // Always cleanup temp file
        await fs.unlink(tempAudioPath).catch(() => {});
      }
      
    } catch (error) {
      const displayName = userName || userId;
      this.terminalLog.voiceError(displayName, error.message);
      throw error;
    }
  }

  async analyzeImage(
    imageUrl: string | undefined, 
    userId: string, 
    userName?: string, 
    messageId?: string
  ): Promise<string> {
    try {
      let finalImageUrl = imageUrl;
      
      // Get URL from WHAPI if needed
      if (!finalImageUrl && messageId) {
        finalImageUrl = await this.fetchImageUrl(messageId);
      }
      
      if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
        throw new Error('URL de imagen inválida o no disponible');
      }
      
      // Analyze with Vision
      const visionResponse = await this.openai.chat.completions.create({
        model: process.env.IMAGE_ANALYSIS_MODEL || 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Analiza esta imagen en el contexto de un hotel. Describe brevemente qué ves, enfocándote en: habitaciones, instalaciones, documentos, o cualquier elemento relevante para consultas hoteleras. Máximo 100 palabras.' 
            },
            { 
              type: 'image_url', 
              image_url: { 
                url: finalImageUrl,
                detail: 'low'
              } 
            }
          ]
        }],
        max_tokens: 150,
        temperature: 0.3
      });
      
      return visionResponse.choices[0].message.content || 'Imagen recibida';
      
    } catch (error) {
      const displayName = userName || userId;
      this.terminalLog.imageError(displayName, error.message);
      throw error;
    }
  }

  private async fetchAudioUrl(messageId: string): Promise<string | undefined> {
    const response = await fetch(
      `${this.config.WHAPI_API_URL}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.WHAPI_TOKEN}`
        }
      }
    );
    
    if (!response.ok) return undefined;
    
    const data = await response.json();
    return data.audio?.link || data.voice?.link || data.ptt?.link;
  }

  private async fetchImageUrl(messageId: string): Promise<string | undefined> {
    const response = await fetch(
      `${this.config.WHAPI_API_URL}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.WHAPI_TOKEN}`
        }
      }
    );
    
    if (!response.ok) return undefined;
    
    const data = await response.json();
    return data.image?.link;
  }
}
```

### **2.7 OpenAI Processing Service**
```typescript
// src/core/processing/openai-service.ts
import OpenAI from 'openai';
import { IFunctionRegistry } from '../../shared/interfaces';
import { ThreadPersistence } from '../services/thread-persistence';
import { TerminalLog } from '../utils/terminal-log';

export class OpenAIProcessingService {
  constructor(
    private openai: OpenAI,
    private functionRegistry: IFunctionRegistry,
    private threadPersistence: ThreadPersistence,
    private terminalLog: TerminalLog,
    private config: any
  ) {}

  async processWithOpenAI(
    userMsg: string,
    userId: string,
    chatId: string,
    userName: string,
    requestId?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Get or create thread
      let threadId = this.threadPersistence.getThread(userId)?.threadId;
      const isNewThread = !threadId;
      
      if (isNewThread) {
        const thread = await this.openai.beta.threads.create();
        threadId = thread.id;
        this.threadPersistence.setThread(userId, threadId, chatId, userName);
        this.terminalLog.newConversation(userName);
      }

      // Add message to thread
      await this.addMessageWithRetry(threadId, userMsg);

      // Create and run
      let run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: this.config.ASSISTANT_ID
      });

      // Poll for completion
      run = await this.pollRun(threadId, run.id);

      // Handle different run statuses
      if (run.status === 'completed') {
        return await this.extractResponse(threadId, userName, startTime);
      } else if (run.status === 'requires_action') {
        return await this.handleFunctionCalling(
          threadId, 
          run, 
          userId, 
          userName, 
          chatId,
          startTime,
          requestId
        );
      } else {
        throw new Error(`Run failed with status: ${run.status}`);
      }
      
    } catch (error) {
      this.terminalLog.openaiError(userName, error.message);
      
      // Handle context length exceeded
      if (this.isContextLengthError(error)) {
        return await this.handleContextLengthExceeded(
          userMsg, 
          userId, 
          chatId, 
          userName, 
          requestId
        );
      }
      
      throw error;
    }
  }

  private async addMessageWithRetry(threadId: string, message: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
      try {
        // Check for active runs
        const existingRuns = await this.openai.beta.threads.runs.list(threadId, { limit: 5 });
        const activeRuns = existingRuns.data.filter(r => 
          ['queued', 'in_progress', 'requires_action'].includes(r.status)
        );
        
        if (activeRuns.length > 0) {
          const backoffDelay = Math.min((attempts + 1) * 1000, 5000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          attempts++;
          continue;
        }
        
        // Add message
        await this.openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: message
        });
        
        break;
        
      } catch (error) {
        if (this.isRaceConditionError(error) && attempts < maxAttempts - 1) {
          const backoffDelay = Math.min((attempts + 1) * 1000, 5000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          attempts++;
        } else {
          throw error;
        }
      }
    }
  }

  private async pollRun(threadId: string, runId: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 30;
    const pollingInterval = 1000;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
      if (!['queued', 'in_progress'].includes(run.status)) {
        return run;
      }
      
      attempts++;
    }
    
    throw new Error('Run polling timeout');
  }

  private async handleFunctionCalling(
    threadId: string,
    run: any,
    userId: string,
    userName: string,
    chatId: string,
    startTime: number,
    requestId?: string
  ): Promise<string> {
    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
    const toolOutputs = [];
    
    // Execute tool calls
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      this.terminalLog.functionStart(functionName, functionArgs);
      
      try {
        const result = await this.functionRegistry.execute(
          functionName, 
          functionArgs,
          { userId, userName, requestId }
        );
        
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: typeof result === 'string' ? result : JSON.stringify(result)
        });
        
      } catch (error) {
        this.terminalLog.functionError(functionName, error.message);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: `Error ejecutando función: ${error.message}`
        });
      }
    }
    
    // Submit tool outputs
    await this.openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
      tool_outputs: toolOutputs
    });
    
    // Poll for completion
    const completedRun = await this.pollRunAfterTools(threadId, run.id);
    
    if (completedRun.status === 'completed') {
      return await this.extractResponse(threadId, userName, startTime);
    } else {
      throw new Error('Run no completado después de tool outputs');
    }
  }

  private async pollRunAfterTools(threadId: string, runId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
      if (run.status === 'completed') {
        return run;
      }
      
      if (!['queued', 'in_progress'].includes(run.status)) {
        return run;
      }
      
      const backoffDelay = Math.min((attempts + 1) * 500, 5000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      attempts++;
    }
    
    throw new Error('Polling timeout after tools');
  }

  private async extractResponse(
    threadId: string, 
    userName: string, 
    startTime: number
  ): Promise<string> {
    const messages = await this.openai.beta.threads.messages.list(threadId, { limit: 1 });
    const assistantMessage = messages.data[0];
    
    if (!assistantMessage?.content?.[0]) {
      throw new Error('No assistant message found');
    }
    
    const content = assistantMessage.content[0];
    if (content.type !== 'text' || !content.text?.value) {
      throw new Error('Invalid response content');
    }
    
    const duration = Date.now() - startTime;
    this.terminalLog.response(userName, content.text.value, duration);
    
    return content.text.value;
  }

  private isContextLengthError(error: any): boolean {
    return error?.code === 'context_length_exceeded' || 
           error?.message?.includes('maximum context length') ||
           error?.message?.includes('context_length_exceeded');
  }

  private isRaceConditionError(error: any): boolean {
    return error?.message?.includes('while a run') && 
           error?.message?.includes('is active');
  }

  private async handleContextLengthExceeded(
    userMsg: string,
    userId: string,
    chatId: string,
    userName: string,
    requestId?: string
  ): Promise<string> {
    // Create new thread
    const newThread = await this.openai.beta.threads.create();
    this.threadPersistence.setThread(userId, newThread.id, chatId, userName);
    
    // Retry with new thread
    return this.processWithOpenAI(userMsg, userId, chatId, userName, requestId);
  }
}
```

---

## 🏨 **ETAPA 3: EXTRACCIÓN DEL PLUGIN HOTELERO**

### **3.1 Estructura del Plugin**
```typescript
// src/plugins/hotel/hotel.plugin.ts
import { IFunctionRegistry } from '../../shared/interfaces';
import { checkAvailability } from './functions/check-availability';
import { HotelLabels } from './logic/labels';
import { HotelContext } from './logic/context';
import { HotelValidation } from './logic/validation';

export class HotelPlugin {
  private labels: HotelLabels;
  private context: HotelContext;
  private validation: HotelValidation;

  constructor(config: any) {
    this.labels = new HotelLabels(config);
    this.context = new HotelContext(config);
    this.validation = new HotelValidation();
  }

  register(registry: IFunctionRegistry): void {
    // Register hotel-specific functions
    registry.register('check_availability', async (args, context) => {
      return checkAvailability(args, context);
    });
  }

  getLabels(): HotelLabels {
    return this.labels;
  }

  getContext(): HotelContext {
    return this.context;
  }

  getValidation(): HotelValidation {
    return this.validation;
  }
}
```

### **3.2 Labels Hoteleros**
```typescript
// src/plugins/hotel/logic/labels.ts
export class HotelLabels {
  private readonly HOTEL_LABELS = [
    'Potencial',
    'Consulta',
    'Reservado',
    'VIP',
    'Check-in',
    'Check-out',
    'Cancelado',
    'Repetidor'
  ];

  constructor(private config: any) {}

  async applyLabel(userId: string, label: string): Promise<void> {
    if (!this.HOTEL_LABELS.includes(label)) {
      throw new Error(`Label inválido: ${label}`);
    }

    const response = await fetch(
      `${this.config.WHAPI_API_URL}/contacts/${userId}/labels`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.config.WHAPI_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ labels: [label] })
      }
    );

    if (!response.ok) {
      throw new Error(`Error aplicando label: ${response.status}`);
    }
  }

  async getLabels(userId: string): Promise<string[]> {
    const response = await fetch(
      `${this.config.WHAPI_API_URL}/contacts/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.WHAPI_TOKEN}`
        }
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.labels?.map((l: any) => l.name) || [];
  }

  getAvailableLabels(): string[] {
    return [...this.HOTEL_LABELS];
  }
}
```

### **3.3 Contexto Hotelero**
```typescript
// src/plugins/hotel/logic/context.ts
import { CacheManager } from '../../../core/state/cache-manager';
import { CONTEXT_BASE_CACHE_TTL } from '../../../core/utils/constants';

interface ContextBase {
  date: string;
  time: string;
  timestamp: number;
}

export class HotelContext {
  private contextBaseCache: ContextBase | null = null;
  private contextCache: CacheManager;

  constructor(private config: any) {
    this.contextCache = new CacheManager(100);
  }

  async getRelevantContext(
    userId: string,
    profile: any,
    chatInfo: any,
    requestId?: string
  ): Promise<string> {
    const cached = this.contextCache.get<string>(userId);
    if (cached) return cached;

    // Get temporal context
    const { date, time } = this.getPrecomputedContextBase();
    
    // Extract client info
    const clientName = profile?.name || 'Cliente';
    const contactName = chatInfo?.name || clientName;
    
    // Get labels
    const profileLabels = profile?.whapiLabels?.map((l: any) => l.name) || [];
    const chatLabels = chatInfo?.labels?.map((l: any) => l.name) || [];
    const allLabels = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2);
    
    // Build context
    let context = `Fecha: ${date} | Hora: ${time} (Colombia)\n`;
    context += `Cliente: ${clientName} | Contacto WhatsApp: ${contactName}`;
    if (allLabels.length > 0) {
      context += ` | Status: ${allLabels.join(', ')}`;
    }
    context += `\n---\nMensaje del cliente:\n`;
    
    // Cache for 1 hour
    this.contextCache.set(userId, context, 60 * 60 * 1000);
    
    return context;
  }

  private getPrecomputedContextBase(): { date: string; time: string } {
    const now = Date.now();
    
    // Check cache
    if (this.contextBaseCache && 
        (now - this.contextBaseCache.timestamp) < CONTEXT_BASE_CACHE_TTL) {
      return {
        date: this.contextBaseCache.date,
        time: this.contextBaseCache.time
      };
    }
    
    // Generate new
    const currentDate = new Date().toLocaleDateString('es-ES', { 
      timeZone: 'America/Bogota', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      timeZone: 'America/Bogota', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    this.contextBaseCache = { 
      date: currentDate, 
      time: currentTime, 
      timestamp: now 
    };
    
    return { date: currentDate, time: currentTime };
  }

  needsTemporalContext(thread: any, profile: any, chatInfo: any): {
    needed: boolean;
    reason: string;
  } {
    if (!thread) {
      return { needed: true, reason: 'primer_mensaje' };
    }

    // Check time (every 3 hours)
    const lastActivity = new Date(thread.lastActivity);
    const now = new Date();
    const hoursElapsed = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed >= 3) {
      return { needed: true, reason: 'tiempo_3h' };
    }

    // Check name changes
    const currentClientName = profile?.name || 'Cliente';
    const currentContactName = chatInfo?.name || currentClientName;
    const storedName = thread.name || thread.userName;
    
    if (currentClientName !== storedName || currentContactName !== storedName) {
      return { needed: true, reason: 'cambio_nombre' };
    }

    // Check label changes
    const profileLabels = profile?.whapiLabels?.map((l: any) => l.name) || [];
    const chatLabels = chatInfo?.labels?.map((l: any) => l.name) || [];
    const currentLabels = [...new Set([...profileLabels, ...chatLabels])].sort();
    const storedLabels = (thread.labels || []).sort();
    
    if (JSON.stringify(currentLabels) !== JSON.stringify(storedLabels)) {
      return { needed: true, reason: 'cambio_labels' };
    }

    return { needed: false, reason: 'no_cambios' };
  }
}
```

### **3.4 Validación Hotelera**
```typescript
// src/plugins/hotel/logic/validation.ts
interface RetryState {
  retryCount: number;
  lastRetryTime: number;
}

export class HotelValidation {
  private userRetryState: Map<string, RetryState> = new Map();

  isQuoteOrPriceMessage(message: string): boolean {
    const sensitivePatterns = [
      /\$\d+[.,]?\d*/g,                    // $840.000, $210,000
      /\d+[.,]?\d*\s*(cop|pesos?)/gi,      // 840000 COP, 210 pesos
      /\d+\s*noches?/gi,                    // 4 noches
      /https?:\/\/\S+/i,                    // URLs
      /wa\.me\/p/i                          // WhatsApp links
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(message));
  }

  validateAndCorrectResponse(
    responseText: string, 
    toolOutputs: string[]
  ): {
    correctedResponse: string;
    hadErrors: boolean;
    needsRetry: boolean;
    discrepancies: string[];
  } {
    let correctedResponse = responseText;
    const discrepancies: string[] = [];
    let needsRetry = false;

    // Extract apartment names and prices from tool outputs
    const apartments: Map<string, number> = new Map();
    const priceRegex = /(\w+(?:\s+\w+)*?):\s*\$?([\d,]+)/g;
    
    for (const output of toolOutputs) {
      let match;
      while ((match = priceRegex.exec(output)) !== null) {
        const name = match[1].trim();
        const price = parseInt(match[2].replace(/,/g, ''));
        apartments.set(name.toLowerCase(), price);
      }
    }

    // Check for discrepancies
    for (const [aptName, correctPrice] of apartments) {
      const nameRegex = new RegExp(`${aptName}[^$]*?\\$?([\\d,]+)`, 'gi');
      const matches = responseText.matchAll(nameRegex);
      
      for (const match of matches) {
        const mentionedPrice = parseInt(match[1].replace(/,/g, ''));
        if (Math.abs(mentionedPrice - correctPrice) > 100) {
          discrepancies.push(
            `${aptName}: mencionado $${mentionedPrice}, correcto $${correctPrice}`
          );
          
          // Correct the price
          correctedResponse = correctedResponse.replace(
            match[0],
            match[0].replace(match[1], correctPrice.toLocaleString())
          );
        }
      }
    }

    // Determine if retry is needed
    if (discrepancies.length > 2 || 
        discrepancies.some(d => d.includes('fecha') || d.includes('nombre'))) {
      needsRetry = true;
    }

    return {
      correctedResponse,
      hadErrors: discrepancies.length > 0,
      needsRetry,
      discrepancies
    };
  }

  canRetry(userId: string): boolean {
    const now = Date.now();
    const retryState = this.userRetryState.get(userId);
    
    return !retryState || 
           retryState.retryCount === 0 || 
           (now - retryState.lastRetryTime) > 300000; // 5 minutes
  }

  markRetry(userId: string): void {
    this.userRetryState.set(userId, {
      retryCount: 1,
      lastRetryTime: Date.now()
    });
  }

  // Cleanup old retry states
  cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [userId, state] of this.userRetryState.entries()) {
      if (now - state.lastRetryTime > maxAge) {
        this.userRetryState.delete(userId);
      }
    }
  }
}
```

### **3.5 Check Availability Function**
```typescript
// src/plugins/hotel/functions/check-availability.ts
import { Beds24Client } from '../services/beds24-client';

export async function checkAvailability(
  args: {
    startDate: string;
    endDate: string;
    guests?: number;
    nights?: number;
  },
  context?: any
): Promise<string> {
  const beds24 = new Beds24Client(process.env.BEDS24_API_KEY!);
  
  try {
    // Calculate nights if not provided
    const nights = args.nights || calculateNights(args.startDate, args.endDate);
    
    // Search availability
    const results = await beds24.searchAvailability({
      arrival: args.startDate,
      departure: args.endDate,
      numAdults: args.guests || 2,
      numNights: nights
    });

    // Format response
    if (!results || results.length === 0) {
      return 'No hay disponibilidad para las fechas solicitadas.';
    }

    // Separate complete stays from splits
    const completeStays = results.filter(r => !r.isSplit);
    const splitStays = results.filter(r => r.isSplit);

    let response = '';
    
    if (completeStays.length > 0) {
      response += 'Apartamentos disponibles para estadía completa:\n\n';
      completeStays.forEach(apt => {
        response += `${apt.name}: $${apt.totalPrice.toLocaleString()} (${nights} noches)\n`;
      });
    }

    if (splitStays.length > 0) {
      response += '\n\nOpciones con cambio de apartamento:\n\n';
      splitStays.forEach(split => {
        response += `${split.name}: $${split.totalPrice.toLocaleString()}\n`;
      });
    }

    return response;

  } catch (error) {
    console.error('Error en check_availability:', error);
    return 'Error al verificar disponibilidad. Por favor intente nuevamente.';
  }
}

function calculateNights(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
```

---

## 🔧 **ETAPA 4: ENSAMBLAJE Y MAIN**

### **4.1 Function Registry Implementation**
```typescript
// src/core/services/function-registry.ts
import { IFunctionRegistry, ToolCallFunction } from '../../shared/interfaces';

export class FunctionRegistry implements IFunctionRegistry {
  private functions: Map<string, ToolCallFunction> = new Map();

  register(name: string, func: ToolCallFunction): void {
    if (this.functions.has(name)) {
      throw new Error(`Function ${name} already registered`);
    }
    this.functions.set(name, func);
  }

  execute(name: string, args: any, context?: any): Promise<string> {
    const func = this.functions.get(name);
    if (!func) {
      throw new Error(`Function ${name} not found`);
    }
    return func(args, context);
  }

  has(name: string): boolean {
    return this.functions.has(name);
  }

  list(): string[] {
    return Array.from(this.functions.keys());
  }
}
```

### **4.2 Core Bot Class**
```typescript
// src/core/bot.ts
import express from 'express';
import { Server } from './api/server';
import { WebhookProcessor } from './api/webhook-processor';
import { OpenAIProcessingService } from './processing/openai-service';
import { BufferManager } from './state/buffer-manager';
import { CacheManager } from './state/cache-manager';
import { MediaService } from './services/media.service';
import { BotDashboard } from './monitoring/dashboard';
import { MetricsRouter } from './monitoring/metrics';
import { TerminalLog } from './utils/terminal-log';
import { IFunctionRegistry } from '../shared/interfaces';

export interface BotConfig {
  functionRegistry: IFunctionRegistry;
  plugin?: any;
}

export class CoreBot {
  private app: express.Application;
  private server: Server;
  private webhookProcessor: WebhookProcessor;
  private openaiService: OpenAIProcessingService;
  private bufferManager: BufferManager;
  private mediaService: MediaService;
  private dashboard: BotDashboard;
  private terminalLog: TerminalLog;

  constructor(private config: BotConfig) {
    this.app = express();
    this.initialize();
  }

  private initialize(): void {
    // Initialize components
    this.dashboard = new BotDashboard();
    this.terminalLog = new TerminalLog(this.dashboard);
    
    // Initialize services
    this.mediaService = new MediaService(
      /* openai client */,
      this.terminalLog,
      /* config */
    );

    this.openaiService = new OpenAIProcessingService(
      /* openai client */,
      this.config.functionRegistry,
      /* thread persistence */,
      this.terminalLog,
      /* config */
    );

    // Initialize state managers
    this.bufferManager = new BufferManager(
      async (userId) => {
        // Process buffer callback
        const buffer = this.bufferManager.getBuffer(userId);
        if (!buffer) return;

        const combinedMessage = buffer.messages.join('\n');
        const response = await this.openaiService.processWithOpenAI(
          combinedMessage,
          userId,
          buffer.chatId,
          buffer.userName
        );

        // Send response
        await this.sendWhatsAppMessage(buffer.chatId, response);
        
        // Clear buffer
        buffer.messages = [];
      }
    );

    // Initialize server and webhook processor
    this.server = new Server(this.app, this.dashboard);
    this.webhookProcessor = new WebhookProcessor(
      this.bufferManager,
      this.mediaService,
      this.terminalLog,
      this.config.plugin
    );

    // Setup routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        functions: this.config.functionRegistry.list()
      });
    });

    // Webhook endpoint
    this.app.post('/hook', async (req, res) => {
      res.status(200).json({ received: true });
      
      try {
        await this.webhookProcessor.process(req.body);
      } catch (error) {
        console.error('Webhook processing error:', error);
      }
    });

    // Dashboard routes
    this.dashboard.setupRoutes(this.app);

    // Metrics routes
    const metricsRouter = new MetricsRouter();
    this.app.use('/metrics', metricsRouter.getRouter());
  }

  async start(): Promise<void> {
    const port = process.env.PORT || 3008;
    const host = process.env.HOST || '0.0.0.0';

    await this.server.listen(port, host);
    this.terminalLog.startup();

    // Start cleanup intervals
    this.startCleanupTasks();
  }

  private startCleanupTasks(): void {
    // Buffer cleanup every 10 minutes
    setInterval(() => {
      const cleaned = this.bufferManager.cleanup();
      if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired buffers`);
      }
    }, 10 * 60 * 1000);

    // Cache cleanup every hour
    setInterval(() => {
      // Cleanup various caches
    }, 60 * 60 * 1000);
  }

  private async sendWhatsAppMessage(chatId: string, message: string): Promise<void> {
    // Implementation of WhatsApp message sending
    // (moved from original code)
  }
}
```

### **4.3 Main Entry Point**
```typescript
// src/main.ts
import 'dotenv/config';
import OpenAI from 'openai';
import { CoreBot } from './core/bot';
import { FunctionRegistry } from './core/services/function-registry';
import { HotelPlugin } from './plugins/hotel/hotel.plugin';
import { loadAndValidateConfig } from './config/environment';

async function main() {
  try {
    console.log('🚀 Iniciando TeAlquilamos Bot...');
    
    // Load configuration
    const config = await loadAndValidateConfig();
    
    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: config.secrets.OPENAI_API_KEY
    });

    // Create function registry
    const functionRegistry = new FunctionRegistry();
    
    // Initialize hotel plugin
    const hotelPlugin = new HotelPlugin(config);
    hotelPlugin.register(functionRegistry);

    // Create and start bot
    const bot = new CoreBot({
      functionRegistry,
      plugin: hotelPlugin
    });

    await bot.start();
    
    console.log('✅ Bot iniciado exitosamente');

  } catch (error) {
    console.error('❌ Error fatal durante inicialización:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('⛔ Excepción no capturada:', error);
  setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⛔ Promesa rechazada no manejada:', reason);
  setTimeout(() => process.exit(1), 2000);
});

// Handle shutdown signals
const shutdown = (signal: string) => {
  console.log(`\n📴 Señal ${signal} recibida, cerrando...`);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the application
main();
```

---

## 💾 **ETAPA 5: DATABASE Y PERSISTENCIA**

### **5.1 Prisma Schema**
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  phoneNumber  String   @unique
  name         String?
  threadId     String?
  createdAt    DateTime @default(now())
  lastActivity DateTime @default(now())
  threads      Thread[]
}

model Thread {
  id           String    @id @default(cuid())
  openaiId     String    @unique
  userId       String
  chatId       String?
  userName     String?
  labels       Json?     // Array of hotel labels
  metadata     Json?     // Additional metadata
  createdAt    DateTime  @default(now())
  lastActivity DateTime  @default(now())
  lastMessage  DateTime?
  
  user         User      @relation(fields: [userId], references: [id])
  messages     Message[]
}

model Message {
  id        String   @id @default(cuid())
  threadId  String
  role      String   // 'user' | 'assistant' | 'system'
  content   String   @db.Text
  metadata  Json?
  createdAt DateTime @default(now())
  
  thread    Thread   @relation(fields: [threadId], references: [id])
}
```

### **5.2 Database Service**
```typescript
// src/core/services/database.service.ts
import { PrismaClient } from '@prisma/client';
import { ThreadRecord } from '../../shared/types';

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Thread operations
  async saveThread(
    userId: string, 
    threadId: string, 
    chatId?: string, 
    userName?: string
  ): Promise<void> {
    await this.prisma.thread.upsert({
      where: { openaiId: threadId },
      update: {
        lastActivity: new Date(),
        lastMessage: new Date(),
        chatId: chatId || undefined,
        userName: userName || undefined
      },
      create: {
        openaiId: threadId,
        userId,
        chatId,
        userName
      }
    });
  }

  async getThread(userId: string): Promise<ThreadRecord | null> {
    const thread = await this.prisma.thread.findFirst({
      where: { userId },
      orderBy: { lastActivity: 'desc' }
    });

    if (!thread) return null;

    return {
      threadId: thread.openaiId,
      chatId: thread.chatId || '',
      userName: thread.userName,
      lastActivity: thread.lastActivity,
      labels: thread.labels as string[] || []
    };
  }

  async updateThreadLabels(threadId: string, labels: string[]): Promise<void> {
    await this.prisma.thread.update({
      where: { openaiId: threadId },
      data: { labels }
    });
  }

  // User operations
  async saveUser(phoneNumber: string, name?: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { phoneNumber },
      update: {
        name: name || undefined,
        lastActivity: new Date()
      },
      create: {
        phoneNumber,
        name
      }
    });
  }

  // Message logging (optional)
  async logMessage(
    threadId: string, 
    role: 'user' | 'assistant' | 'system', 
    content: string,
    metadata?: any
  ): Promise<void> {
    const thread = await this.prisma.thread.findUnique({
      where: { openaiId: threadId }
    });

    if (thread) {
      await this.prisma.message.create({
        data: {
          threadId: thread.id,
          role,
          content,
          metadata
        }
      });
    }
  }

  // Cleanup operations
  async cleanupOldThreads(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.thread.deleteMany({
      where: {
        lastActivity: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }
}
```

---

## ✅ **ETAPA 6: TESTING Y VALIDACIÓN**

### **6.1 Test Suite Structure**
```typescript
// tests/core/utils/terminal-log.test.ts
import { TerminalLog } from '../../../src/core/utils/terminal-log';
import { BotDashboard } from '../../../src/core/monitoring/dashboard';

describe('TerminalLog', () => {
  let terminalLog: TerminalLog;
  let mockDashboard: jest.Mocked<BotDashboard>;

  beforeEach(() => {
    mockDashboard = {
      addLog: jest.fn()
    } as any;
    
    terminalLog = new TerminalLog(mockDashboard);
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('message logs correctly with dashboard integration', () => {
    terminalLog.message('TestUser', 'Hello world');
    
    expect(console.log).toHaveBeenCalledWith('👤 TestUser: "Hello world"');
    expect(mockDashboard.addLog).toHaveBeenCalledWith('👤 TestUser: "Hello world"');
  });

  test('response logs with duration', () => {
    terminalLog.response('TestUser', 'Response text', 3500);
    
    expect(console.log).toHaveBeenCalledWith('🤖 OpenAI → TestUser (3.5s)');
    expect(mockDashboard.addLog).toHaveBeenCalled();
  });

  // Add tests for all 20 methods
});

// tests/core/services/media.test.ts
import { MediaService } from '../../../src/core/services/media.service';
import { promises as fs } from 'fs';

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn()
  }
}));

describe('MediaService', () => {
  let mediaService: MediaService;

  beforeEach(() => {
    // Setup mocks
  });

  test('transcribeAudio cleans up temp files', async () => {
    const mockUnlink = fs.unlink as jest.Mock;
    
    // Test transcription
    await mediaService.transcribeAudio('http://test.url', 'user123');
    
    // Verify cleanup was called
    expect(mockUnlink).toHaveBeenCalled();
  });

  test('handles transcription errors gracefully', async () => {
    // Test error handling
  });
});
```

### **6.2 Integration Tests**
```typescript
// tests/integration/webhook-flow.test.ts
describe('Webhook Flow Integration', () => {
  test('processes text message end-to-end', async () => {
    const webhook = {
      messages: [{
        from: '1234567890@s.whatsapp.net',
        chat_id: '1234567890@s.whatsapp.net',
        type: 'text',
        text: { body: 'Hola, necesito información' },
        from_name: 'Test User'
      }]
    };

    const response = await request(app)
      .post('/hook')
      .send(webhook);

    expect(response.status).toBe(200);
    // Verify buffer was created
    // Verify OpenAI was called
    // Verify response was sent
  });

  test('handles check_availability function', async () => {
    // Test function calling flow
  });
});
```

### **6.3 Performance Tests**
```typescript
// tests/performance/concurrent-users.test.ts
describe('Performance Tests', () => {
  test('handles 200 concurrent users', async () => {
    const users = Array(200).fill(null).map((_, i) => ({
      id: `user${i}@s.whatsapp.net`,
      message: `Message from user ${i}`
    }));

    const startTime = Date.now();
    
    await Promise.all(
      users.map(user => 
        processMessage(user.id, user.message)
      )
    );

    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(30000); // 30 seconds max
    // Verify no memory leaks
    // Verify all messages processed
  });
});
```

---

## 🚀 **ETAPA 7: DEPLOYMENT Y MIGRATION**

### **7.1 Migration Script**
```bash
#!/bin/bash
# scripts/migrate.sh

echo "🚀 Starting modular migration..."

# Step 1: Backup
echo "📦 Creating backup..."
cp src/app-unified.ts backups/app-unified.$(date +%Y%m%d_%H%M%S).ts

# Step 2: Create structure
echo "📁 Creating directory structure..."
mkdir -p src/{core/{api,processing,state,services,monitoring,utils},plugins/hotel/{functions,services,logic},shared,config}

# Step 3: Run migration
echo "🔄 Running migration..."
npm run migrate

# Step 4: Run tests
echo "🧪 Running tests..."
npm test

# Step 5: Audit
echo "🔍 Running audit..."
./scripts/audit-migration.sh

echo "✅ Migration complete!"
```

### **7.2 Deployment Checklist**
```markdown
## Pre-Deployment Checklist

### Code Migration
- [ ] All 25 globals migrated
- [ ] All 20 terminalLog methods working
- [ ] All obsoletes removed
- [ ] Media service (transcribeAudio, analyzeImage) migrated
- [ ] Validation logic migrated
- [ ] Function registry implemented
- [ ] **[CRÍTICO]** Zod validation schemas implemented (shared/validation.ts)
- [ ] **[CRÍTICO]** Retry logic with exponential backoff (core/utils/retry-utils.ts)
- [ ] **[CRÍTICO]** Webhook validator integrated in API layer

### Database
- [ ] PostgreSQL instance created
- [ ] DATABASE_URL configured
- [ ] Schema migrated with Prisma
- [ ] Test data migration successful

### Testing
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met

### Environment
- [ ] All environment variables set
- [ ] Railway/Cloud Run configured
- [ ] Monitoring dashboard accessible
- [ ] Metrics endpoint working

### Rollback Plan
- [ ] Backup of app-unified.ts verified
- [ ] Rollback script tested
- [ ] Team aware of rollback procedure
```

### **7.3 Final Validation**
```bash
# Run complete validation suite
npm run validate:all

# Check production readiness
npm run audit:production

# Deploy to staging
git push origin refactor/modular-architecture

# After staging validation
git checkout main
git merge refactor/modular-architecture
git push origin main
```

---

## 📊 **MÉTRICAS DE ÉXITO**

### **Técnicas**
- **Reducción de complejidad**: De 3,779 líneas a <500 líneas por módulo
- **Tiempo de respuesta**: <2s para 95% de mensajes
- **Uso de memoria**: <500MB bajo carga normal
- **Cobertura de tests**: >80% en core, 100% en plugin

### **Arquitecturales**
- **Separación de concerns**: 100% (core vs plugin)
- **Reusabilidad**: 80% del código es genérico
- **Mantenibilidad**: Cambios aislados por módulo
- **Escalabilidad**: Nuevos plugins sin tocar core

### **Operacionales**
- **Zero downtime**: Durante migración
- **Zero data loss**: Todos los threads migrados
- **Performance**: Igual o mejor que monolito
- **Monitoreo**: Dashboard y métricas funcionando

---

## 🎯 **CONCLUSIÓN**

Esta guía proporciona un camino completo y detallado para migrar el bot monolítico a una arquitectura modular profesional. Siguiendo estas etapas paso a paso, lograrás:

1. **Código modular y mantenible**
2. **Separación clara core/plugin**
3. **Persistencia robusta con PostgreSQL**
4. **Testing completo y automatizado**
5. **Base sólida para futuros plugins**

El resultado es un sistema que mantiene 100% de la funcionalidad original mientras gana en flexibilidad, mantenibilidad y escalabilidad para soportar múltiples verticales de negocio.

**¡Éxito en tu migración!** 🚀

---

## 🎯 **MEJORAS ESPECÍFICAS IMPLEMENTADAS**

### **1. Contenedor de Inyección de Dependencias (DI)**

Para llevar la arquitectura al siguiente nivel de escalabilidad:

#### **Instalación y Configuración**
```bash
npm install reflect-metadata tsyringe
npm install --save-dev @types/node
```

#### **Container Service**
```typescript
// src/core/container/di-container.ts
import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';
import { IFunctionRegistry, ICacheManager, IThreadPersistence } from '../../shared/interfaces';
import { FunctionRegistry } from '../services/function-registry';
import { CacheManager } from '../state/cache-manager';
import { DatabaseService } from '../services/database.service';
import { AppConfig } from '../../config/environment';
import { MediaService } from '../services/media.service';
import { OpenAIProcessingService } from '../processing/openai-service';
import { TerminalLog } from '../utils/terminal-log';
import { BotDashboard } from '../monitoring/dashboard';
import OpenAI from 'openai';

export class DIContainer {
  private static _instance: DependencyContainer;

  static get instance(): DependencyContainer {
    if (!this._instance) {
      this._instance = container.createChildContainer();
      this.registerServices();
    }
    return this._instance;
  }

  private static registerServices(): void {
    const container = this._instance;

    // Register configuration as singleton
    container.registerSingleton('AppConfig', AppConfig);

    // Register core services
    container.registerSingleton('DatabaseService', DatabaseService);
    container.register('ICacheManager', { useClass: CacheManager });
    container.register('IFunctionRegistry', { useClass: FunctionRegistry });
    
    // Register OpenAI client
    container.register('OpenAI', {
      useFactory: () => {
        const config = container.resolve(AppConfig);
        return new OpenAI({ apiKey: config.secrets.OPENAI_API_KEY });
      }
    });

    // Register monitoring
    container.registerSingleton('BotDashboard', BotDashboard);
    container.register('TerminalLog', {
      useFactory: () => {
        const dashboard = container.resolve(BotDashboard);
        return new TerminalLog(dashboard);
      }
    });

    // Register media service
    container.register('MediaService', {
      useFactory: () => {
        const openai = container.resolve<OpenAI>('OpenAI');
        const terminalLog = container.resolve<TerminalLog>('TerminalLog');
        const config = container.resolve<AppConfig>('AppConfig');
        return new MediaService(openai, terminalLog, config);
      }
    });

    // Register OpenAI processing service
    container.register('OpenAIProcessingService', {
      useFactory: () => {
        const openai = container.resolve<OpenAI>('OpenAI');
        const functionRegistry = container.resolve<IFunctionRegistry>('IFunctionRegistry');
        const threadPersistence = container.resolve<IThreadPersistence>('IThreadPersistence');
        const terminalLog = container.resolve<TerminalLog>('TerminalLog');
        const config = container.resolve<AppConfig>('AppConfig');
        return new OpenAIProcessingService(openai, functionRegistry, threadPersistence, terminalLog, config);
      }
    });
  }

  static resolve<T>(token: string | symbol): T {
    return this.instance.resolve<T>(token);
  }

  static registerInstance<T>(token: string | symbol, instance: T): void {
    this.instance.registerInstance<T>(token, instance);
  }
}
```

#### **CoreBot Refactorizado con DI**
```typescript
// src/core/bot.ts
import { injectable, inject } from 'tsyringe';
import express from 'express';
import { Server } from './api/server';
import { WebhookProcessor } from './api/webhook-processor';
import { OpenAIProcessingService } from './processing/openai-service';
import { BufferManager } from './state/buffer-manager';
import { MediaService } from './services/media.service';
import { BotDashboard } from './monitoring/dashboard';
import { TerminalLog } from './utils/terminal-log';
import { IFunctionRegistry } from '../shared/interfaces';
import { AppConfig } from '../config/environment';

@injectable()
export class CoreBot {
  private app: express.Application;
  private server: Server;
  private webhookProcessor: WebhookProcessor;
  private bufferManager: BufferManager;

  constructor(
    @inject('OpenAIProcessingService') private openaiService: OpenAIProcessingService,
    @inject('MediaService') private mediaService: MediaService,
    @inject('BotDashboard') private dashboard: BotDashboard,
    @inject('TerminalLog') private terminalLog: TerminalLog,
    @inject('IFunctionRegistry') private functionRegistry: IFunctionRegistry,
    @inject('AppConfig') private config: AppConfig
  ) {
    this.app = express();
    this.initialize();
  }

  private initialize(): void {
    // Initialize buffer manager with callback
    this.bufferManager = new BufferManager(
      async (userId) => {
        const buffer = this.bufferManager.getBuffer(userId);
        if (!buffer) return;

        const combinedMessage = buffer.messages.join('\n');
        const response = await this.openaiService.processWithOpenAI(
          combinedMessage,
          userId,
          buffer.chatId,
          buffer.userName
        );

        await this.sendWhatsAppMessage(buffer.chatId, response);
        buffer.messages = [];
      }
    );

    // Initialize server and webhook processor
    this.server = new Server(this.app, this.dashboard);
    this.webhookProcessor = new WebhookProcessor(
      this.bufferManager,
      this.mediaService,
      this.terminalLog,
      null // plugin injected separately
    );

    this.setupRoutes();
  }

  // Rest of the methods remain the same
  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        functions: this.functionRegistry.list()
      });
    });

    this.app.post('/hook', async (req, res) => {
      res.status(200).json({ received: true });
      
      try {
        await this.webhookProcessor.process(req.body);
      } catch (error) {
        console.error('Webhook processing error:', error);
      }
    });

    this.dashboard.setupRoutes(this.app);
  }

  async start(): Promise<void> {
    const port = this.config.PORT || 3008;
    const host = this.config.HOST || '0.0.0.0';

    await this.server.listen(port, host);
    this.terminalLog.startup();
    this.startCleanupTasks();
  }

  private startCleanupTasks(): void {
    setInterval(() => {
      const cleaned = this.bufferManager.cleanup();
      if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired buffers`);
      }
    }, 10 * 60 * 1000);
  }

  private async sendWhatsAppMessage(chatId: string, message: string): Promise<void> {
    // Implementation remains the same
  }
}
```

#### **Main.ts con DI**
```typescript
// src/main.ts
import 'reflect-metadata';
import 'dotenv/config';
import { DIContainer } from './core/container/di-container';
import { CoreBot } from './core/bot';
import { HotelPlugin } from './plugins/hotel/hotel.plugin';
import { IFunctionRegistry } from './shared/interfaces';

async function main() {
  try {
    console.log('🚀 Iniciando TeAlquilamos Bot con DI...');
    
    // Initialize DI container
    const container = DIContainer.instance;
    
    // Initialize hotel plugin
    const hotelPlugin = new HotelPlugin();
    const functionRegistry = container.resolve<IFunctionRegistry>('IFunctionRegistry');
    hotelPlugin.register(functionRegistry);
    
    // Register plugin in container
    container.registerInstance('HotelPlugin', hotelPlugin);
    
    // Create and start bot (DI handles all dependencies)
    const bot = container.resolve(CoreBot);
    await bot.start();
    
    console.log('✅ Bot iniciado exitosamente con DI');

  } catch (error) {
    console.error('❌ Error fatal durante inicialización:', error);
    process.exit(1);
  }
}

main();
```

### **2. Refactorización de ThreadPersistence a Interfaz**

Crear una interfaz para el manejo de persistencia que permite cambiar entre implementaciones:

#### **Interfaz IThreadPersistence**
```typescript
// src/shared/interfaces.ts (añadir a interfaces existentes)
export interface IThreadPersistence {
  getThread(userId: string): ThreadRecord | null;
  setThread(userId: string, threadId: string, chatId?: string, userName?: string): void;
  updateThread(userId: string, updates: Partial<ThreadRecord>): void;
  deleteThread(userId: string): void;
  getAllThreads(): ThreadRecord[];
  cleanup(maxAge: number): number;
}
```

#### **Implementación en Memoria**
```typescript
// src/core/services/memory-thread-persistence.ts
import { IThreadPersistence } from '../../shared/interfaces';
import { ThreadRecord } from '../../shared/types';

export class MemoryThreadPersistence implements IThreadPersistence {
  private threads: Map<string, ThreadRecord> = new Map();

  getThread(userId: string): ThreadRecord | null {
    return this.threads.get(userId) || null;
  }

  setThread(userId: string, threadId: string, chatId?: string, userName?: string): void {
    this.threads.set(userId, {
      threadId,
      chatId: chatId || '',
      userName,
      lastActivity: new Date(),
      labels: []
    });
  }

  updateThread(userId: string, updates: Partial<ThreadRecord>): void {
    const existing = this.threads.get(userId);
    if (existing) {
      this.threads.set(userId, { ...existing, ...updates });
    }
  }

  deleteThread(userId: string): void {
    this.threads.delete(userId);
  }

  getAllThreads(): ThreadRecord[] {
    return Array.from(this.threads.values());
  }

  cleanup(maxAge: number): number {
    const now = new Date().getTime();
    let cleaned = 0;

    for (const [userId, thread] of this.threads.entries()) {
      if (now - thread.lastActivity.getTime() > maxAge) {
        this.threads.delete(userId);
        cleaned++;
      }
    }

    return cleaned;
  }
}
```

#### **Implementación con Base de Datos**
```typescript
// src/core/services/database-thread-persistence.ts
import { IThreadPersistence } from '../../shared/interfaces';
import { ThreadRecord } from '../../shared/types';
import { DatabaseService } from './database.service';

export class DatabaseThreadPersistence implements IThreadPersistence {
  constructor(private db: DatabaseService) {}

  getThread(userId: string): ThreadRecord | null {
    // Implementación síncrona que cache internamente
    // En producción, usar cache + async background sync
    return this.getCachedThread(userId);
  }

  setThread(userId: string, threadId: string, chatId?: string, userName?: string): void {
    // Sync to cache immediately, async to DB
    this.setCachedThread(userId, threadId, chatId, userName);
    this.syncToDatabase(userId, threadId, chatId, userName);
  }

  updateThread(userId: string, updates: Partial<ThreadRecord>): void {
    const existing = this.getThread(userId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.setCachedThread(userId, updated.threadId, updated.chatId, updated.userName);
      this.syncToDatabase(userId, updated.threadId, updated.chatId, updated.userName);
    }
  }

  deleteThread(userId: string): void {
    this.deleteCachedThread(userId);
    this.deleteFromDatabase(userId);
  }

  getAllThreads(): ThreadRecord[] {
    return this.getAllCachedThreads();
  }

  cleanup(maxAge: number): number {
    // Implementation for cleanup
    return 0;
  }

  // Private cache methods
  private getCachedThread(userId: string): ThreadRecord | null {
    // Implementation
    return null;
  }

  private setCachedThread(userId: string, threadId: string, chatId?: string, userName?: string): void {
    // Implementation
  }

  private deleteCachedThread(userId: string): void {
    // Implementation
  }

  private getAllCachedThreads(): ThreadRecord[] {
    // Implementation
    return [];
  }

  private async syncToDatabase(userId: string, threadId: string, chatId?: string, userName?: string): Promise<void> {
    await this.db.saveThread(userId, threadId, chatId, userName);
  }

  private async deleteFromDatabase(userId: string): Promise<void> {
    // Implementation
  }
}
```

#### **Registro en DI Container**
```typescript
// src/core/container/di-container.ts (actualizar registerServices)
private static registerServices(): void {
  const container = this._instance;

  // ... otros registros ...

  // Register thread persistence (configurable)
  const useDatabase = process.env.USE_DATABASE_PERSISTENCE === 'true';
  
  if (useDatabase) {
    container.register('IThreadPersistence', {
      useFactory: () => {
        const db = container.resolve<DatabaseService>('DatabaseService');
        return new DatabaseThreadPersistence(db);
      }
    });
  } else {
    container.register('IThreadPersistence', { useClass: MemoryThreadPersistence });
  }

  // ... resto de registros ...
}
```

### **3. Manejo Centralizado de Configuración**

Implementar una clase de configuración robusta que sea inyectable y validada:

#### **AppConfig Mejorado**
```typescript
// src/config/environment.ts
import { z } from 'zod';
import { injectable } from 'tsyringe';

// Schema de validación con Zod
const ConfigSchema = z.object({
  // Server configuration
  PORT: z.string().transform(Number).default('3008'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // API Keys y secrets
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API Key is required'),
  WHAPI_TOKEN: z.string().min(1, 'WHAPI Token is required'),
  WHAPI_API_URL: z.string().url('Invalid WHAPI API URL'),
  ASSISTANT_ID: z.string().min(1, 'Assistant ID is required'),
  BEDS24_API_KEY: z.string().min(1, 'Beds24 API Key is required'),
  
  // Database
  DATABASE_URL: z.string().url('Invalid Database URL').optional(),
  USE_DATABASE_PERSISTENCE: z.string().transform(val => val === 'true').default('false'),
  
  // Feature flags
  TERMINAL_LOGS_FUNCTIONS: z.string().transform(val => val !== 'false').default('true'),
  IMAGE_ANALYSIS_MODEL: z.string().default('gpt-4o-mini'),
  
  // Cache TTLs (in milliseconds)
  CHAT_INFO_CACHE_TTL: z.string().transform(Number).default('300000'), // 5 min
  CONTEXT_CACHE_TTL: z.string().transform(Number).default('3600000'), // 1 hour
  CONTEXT_BASE_CACHE_TTL: z.string().transform(Number).default('60000'), // 1 min
  
  // Buffer settings
  BUFFER_WINDOW_MS: z.string().transform(Number).default('5000'),
  TYPING_EXTENDED_MS: z.string().transform(Number).default('10000'),
  MAX_MESSAGE_LENGTH: z.string().transform(Number).default('5000'),
  
  // Webhook settings
  WEBHOOK_URL: z.string().url('Invalid Webhook URL').optional(),
});

type ConfigType = z.infer<typeof ConfigSchema>;

@injectable()
export class AppConfig {
  public readonly PORT: number;
  public readonly HOST: string;
  public readonly NODE_ENV: 'development' | 'production' | 'test';
  
  // Secrets (private access only through getters)
  private readonly _secrets: {
    OPENAI_API_KEY: string;
    WHAPI_TOKEN: string;
    WHAPI_API_URL: string;
    ASSISTANT_ID: string;
    BEDS24_API_KEY: string;
  };
  
  // Public configuration
  public readonly database: {
    url?: string;
    usePersistence: boolean;
  };
  
  public readonly features: {
    showFunctionLogs: boolean;
    imageAnalysisModel: string;
  };
  
  public readonly cache: {
    chatInfoTTL: number;
    contextTTL: number;
    contextBaseTTL: number;
  };
  
  public readonly buffer: {
    windowMs: number;
    typingExtendedMs: number;
    maxMessageLength: number;
  };
  
  public readonly webhook: {
    url?: string;
  };

  constructor() {
    // Load and validate environment variables
    const rawConfig = this.loadEnvironment();
    const validatedConfig = this.validateConfig(rawConfig);
    
    // Map to class properties
    this.PORT = validatedConfig.PORT;
    this.HOST = validatedConfig.HOST;
    this.NODE_ENV = validatedConfig.NODE_ENV;
    
    this._secrets = {
      OPENAI_API_KEY: validatedConfig.OPENAI_API_KEY,
      WHAPI_TOKEN: validatedConfig.WHAPI_TOKEN,
      WHAPI_API_URL: validatedConfig.WHAPI_API_URL,
      ASSISTANT_ID: validatedConfig.ASSISTANT_ID,
      BEDS24_API_KEY: validatedConfig.BEDS24_API_KEY,
    };
    
    this.database = {
      url: validatedConfig.DATABASE_URL,
      usePersistence: validatedConfig.USE_DATABASE_PERSISTENCE,
    };
    
    this.features = {
      showFunctionLogs: validatedConfig.TERMINAL_LOGS_FUNCTIONS,
      imageAnalysisModel: validatedConfig.IMAGE_ANALYSIS_MODEL,
    };
    
    this.cache = {
      chatInfoTTL: validatedConfig.CHAT_INFO_CACHE_TTL,
      contextTTL: validatedConfig.CONTEXT_CACHE_TTL,
      contextBaseTTL: validatedConfig.CONTEXT_BASE_CACHE_TTL,
    };
    
    this.buffer = {
      windowMs: validatedConfig.BUFFER_WINDOW_MS,
      typingExtendedMs: validatedConfig.TYPING_EXTENDED_MS,
      maxMessageLength: validatedConfig.MAX_MESSAGE_LENGTH,
    };
    
    this.webhook = {
      url: validatedConfig.WEBHOOK_URL,
    };
  }

  // Secure access to secrets
  get secrets() {
    return { ...this._secrets }; // Return copy to prevent mutation
  }

  // Utility methods
  get isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.NODE_ENV === 'test';
  }

  private loadEnvironment(): Record<string, string | undefined> {
    return {
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      NODE_ENV: process.env.NODE_ENV,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      WHAPI_TOKEN: process.env.WHAPI_TOKEN,
      WHAPI_API_URL: process.env.WHAPI_API_URL,
      ASSISTANT_ID: process.env.ASSISTANT_ID,
      BEDS24_API_KEY: process.env.BEDS24_API_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      USE_DATABASE_PERSISTENCE: process.env.USE_DATABASE_PERSISTENCE,
      TERMINAL_LOGS_FUNCTIONS: process.env.TERMINAL_LOGS_FUNCTIONS,
      IMAGE_ANALYSIS_MODEL: process.env.IMAGE_ANALYSIS_MODEL,
      CHAT_INFO_CACHE_TTL: process.env.CHAT_INFO_CACHE_TTL,
      CONTEXT_CACHE_TTL: process.env.CONTEXT_CACHE_TTL,
      CONTEXT_BASE_CACHE_TTL: process.env.CONTEXT_BASE_CACHE_TTL,
      BUFFER_WINDOW_MS: process.env.BUFFER_WINDOW_MS,
      TYPING_EXTENDED_MS: process.env.TYPING_EXTENDED_MS,
      MAX_MESSAGE_LENGTH: process.env.MAX_MESSAGE_LENGTH,
      WEBHOOK_URL: process.env.WEBHOOK_URL,
    };
  }

  private validateConfig(rawConfig: Record<string, string | undefined>): ConfigType {
    try {
      return ConfigSchema.parse(rawConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw new Error(`Configuration validation failed:\n${missingVars.join('\n')}`);
      }
      throw error;
    }
  }

  // For debugging (without secrets)
  public getPublicConfig(): Omit<ConfigType, keyof AppConfig['_secrets']> {
    const { OPENAI_API_KEY, WHAPI_TOKEN, WHAPI_API_URL, ASSISTANT_ID, BEDS24_API_KEY, ...publicConfig } = 
      this.validateConfig(this.loadEnvironment());
    return publicConfig;
  }
}

// Factory function for testing
export function createTestConfig(overrides: Partial<ConfigType> = {}): AppConfig {
  const originalEnv = process.env;
  
  // Set test environment
  process.env = {
    ...originalEnv,
    OPENAI_API_KEY: 'test-key',
    WHAPI_TOKEN: 'test-token',
    WHAPI_API_URL: 'https://test.api.com',
    ASSISTANT_ID: 'test-assistant',
    BEDS24_API_KEY: 'test-beds24',
    ...Object.entries(overrides).reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>)
  };
  
  const config = new AppConfig();
  
  // Restore original environment
  process.env = originalEnv;
  
  return config;
}
```

#### **Instalación de Dependencias**
```bash
npm install zod
npm install --save-dev @types/node
```

#### **Uso en Servicios con DI**
```typescript
// src/core/services/media.service.ts (ejemplo de uso)
import { injectable, inject } from 'tsyringe';
import { AppConfig } from '../../config/environment';

@injectable()
export class MediaService {
  constructor(
    @inject('OpenAI') private openai: OpenAI,
    @inject('TerminalLog') private terminalLog: TerminalLog,
    @inject('AppConfig') private config: AppConfig
  ) {}

  async analyzeImage(imageUrl: string, userId: string): Promise<string> {
    // Use config instead of direct process.env access
    const visionResponse = await this.openai.chat.completions.create({
      model: this.config.features.imageAnalysisModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Analiza esta imagen...' },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
        ]
      }],
      max_tokens: 150,
      temperature: 0.3
    });

    return visionResponse.choices[0].message.content || 'Imagen recibida';
  }

  private async fetchImageUrl(messageId: string): Promise<string | undefined> {
    // Use config for API access
    const response = await fetch(
      `${this.config.secrets.WHAPI_API_URL}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.secrets.WHAPI_TOKEN}`
        }
      }
    );
    
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.image?.link;
  }
}
```

### **4. Formalización de Estructura de Plugins**

Crear un sistema de plugins verdaderamente plug-and-play que permita cargar dinámicamente funcionalidades específicas:

#### **Interfaz IPlugin**
```typescript
// src/shared/interfaces.ts (añadir a interfaces existentes)
export interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  
  // Lifecycle methods
  initialize(container: any): Promise<void>;
  register(registry: IFunctionRegistry): void;
  shutdown?(): Promise<void>;
  
  // Health check
  isHealthy(): boolean;
  
  // Metadata
  getMetadata(): PluginMetadata;
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies?: string[];
  features: string[];
  configSchema?: any;
}

export interface IPluginManager {
  loadPlugin(plugin: IPlugin): Promise<void>;
  unloadPlugin(name: string): Promise<void>;
  getPlugin(name: string): IPlugin | undefined;
  listPlugins(): PluginMetadata[];
  isPluginLoaded(name: string): boolean;
}
```

#### **Plugin Manager**
```typescript
// src/core/plugins/plugin-manager.ts
import { injectable, inject } from 'tsyringe';
import { IPlugin, IPluginManager, IFunctionRegistry, PluginMetadata } from '../../shared/interfaces';
import { TerminalLog } from '../utils/terminal-log';

@injectable()
export class PluginManager implements IPluginManager {
  private plugins: Map<string, IPlugin> = new Map();
  private pluginStates: Map<string, 'loading' | 'loaded' | 'error' | 'unloaded'> = new Map();

  constructor(
    @inject('IFunctionRegistry') private functionRegistry: IFunctionRegistry,
    @inject('TerminalLog') private terminalLog: TerminalLog
  ) {}

  async loadPlugin(plugin: IPlugin): Promise<void> {
    const { name } = plugin;
    
    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} is already loaded`);
    }

    try {
      this.pluginStates.set(name, 'loading');
      this.terminalLog.startup(); // Log plugin loading
      console.log(`🔌 Loading plugin: ${name} v${plugin.version}`);

      // Initialize plugin
      await plugin.initialize(null); // Pass DI container if needed
      
      // Register plugin functions
      plugin.register(this.functionRegistry);
      
      // Store plugin
      this.plugins.set(name, plugin);
      this.pluginStates.set(name, 'loaded');
      
      console.log(`✅ Plugin loaded successfully: ${name}`);
      
    } catch (error) {
      this.pluginStates.set(name, 'error');
      this.terminalLog.error(`Failed to load plugin ${name}: ${error.message}`);
      throw error;
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not loaded`);
    }

    try {
      console.log(`🔌 Unloading plugin: ${name}`);
      
      // Call shutdown if available
      if (plugin.shutdown) {
        await plugin.shutdown();
      }
      
      // Remove from registry (would need to extend IFunctionRegistry)
      // this.functionRegistry.unregisterPlugin(name);
      
      // Remove from manager
      this.plugins.delete(name);
      this.pluginStates.set(name, 'unloaded');
      
      console.log(`✅ Plugin unloaded: ${name}`);
      
    } catch (error) {
      this.terminalLog.error(`Failed to unload plugin ${name}: ${error.message}`);
      throw error;
    }
  }

  getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(plugin => plugin.getMetadata());
  }

  isPluginLoaded(name: string): boolean {
    return this.pluginStates.get(name) === 'loaded';
  }

  // Health check for all plugins
  checkPluginsHealth(): Record<string, boolean> {
    const health: Record<string, boolean> = {};
    
    for (const [name, plugin] of this.plugins.entries()) {
      try {
        health[name] = plugin.isHealthy();
      } catch (error) {
        health[name] = false;
        this.terminalLog.error(`Health check failed for plugin ${name}: ${error.message}`);
      }
    }
    
    return health;
  }

  // Get plugin statistics
  getStatistics() {
    const stats = {
      total: this.plugins.size,
      loaded: 0,
      loading: 0,
      error: 0,
      unloaded: 0
    };

    for (const state of this.pluginStates.values()) {
      stats[state]++;
    }

    return stats;
  }
}
```

#### **Base Plugin Class**
```typescript
// src/shared/plugin-base.ts
import { IPlugin, IFunctionRegistry, PluginMetadata } from './interfaces';

export abstract class BasePlugin implements IPlugin {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;

  // Default implementations
  async initialize(container: any): Promise<void> {
    // Override in derived classes if needed
  }

  abstract register(registry: IFunctionRegistry): void;

  async shutdown(): Promise<void> {
    // Override in derived classes if needed
  }

  isHealthy(): boolean {
    // Default health check - override for specific checks
    return true;
  }

  getMetadata(): PluginMetadata {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      features: this.getFeatures(),
      dependencies: this.getDependencies()
    };
  }

  // Abstract methods for derived classes
  protected abstract getFeatures(): string[];
  protected getDependencies(): string[] {
    return [];
  }

  // Utility method for logging
  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  protected logError(message: string, error?: Error): void {
    console.error(`[${this.name}] ERROR: ${message}`, error);
  }
}
```

#### **HotelPlugin Refactorizado**
```typescript
// src/plugins/hotel/hotel.plugin.ts
import { injectable } from 'tsyringe';
import { BasePlugin } from '../../shared/plugin-base';
import { IFunctionRegistry } from '../../shared/interfaces';
import { checkAvailability } from './functions/check-availability';
import { HotelLabels } from './logic/labels';
import { HotelContext } from './logic/context';
import { HotelValidation } from './logic/validation';

@injectable()
export class HotelPlugin extends BasePlugin {
  readonly name = 'hotel';
  readonly version = '1.0.0';
  readonly description = 'Plugin para funcionalidades hoteleras - TeAlquilamos';

  private labels!: HotelLabels;
  private context!: HotelContext;
  private validation!: HotelValidation;

  async initialize(container: any): Promise<void> {
    this.log('Initializing Hotel Plugin...');
    
    // Initialize hotel-specific services
    this.labels = new HotelLabels(container?.resolve('AppConfig'));
    this.context = new HotelContext(container?.resolve('AppConfig'));
    this.validation = new HotelValidation();
    
    this.log('Hotel Plugin initialized successfully');
  }

  register(registry: IFunctionRegistry): void {
    this.log('Registering hotel functions...');
    
    // Register hotel-specific functions
    registry.register('check_availability', async (args, context) => {
      try {
        return await checkAvailability(args, context);
      } catch (error) {
        this.logError('Error in check_availability', error);
        throw error;
      }
    });

    // Could register more functions here
    // registry.register('book_room', async (args, context) => { ... });
    // registry.register('cancel_booking', async (args, context) => { ... });
    
    this.log('Hotel functions registered successfully');
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Hotel Plugin...');
    
    // Cleanup resources if needed
    if (this.validation) {
      this.validation.cleanup();
    }
    
    this.log('Hotel Plugin shutdown completed');
  }

  isHealthy(): boolean {
    // Check if all components are working
    try {
      return !!(this.labels && this.context && this.validation);
    } catch (error) {
      this.logError('Health check failed', error);
      return false;
    }
  }

  // Public getters for accessing services
  getLabels(): HotelLabels {
    return this.labels;
  }

  getContext(): HotelContext {
    return this.context;
  }

  getValidation(): HotelValidation {
    return this.validation;
  }

  protected getFeatures(): string[] {
    return [
      'availability_check',
      'room_booking',
      'price_calculation',
      'hotel_labels',
      'context_management',
      'validation_system'
    ];
  }

  protected getDependencies(): string[] {
    return ['AppConfig', 'DatabaseService'];
  }
}
```

---

## 🎯 **RESUMEN DE MEJORAS IMPLEMENTADAS**

### **Beneficios Arquitectónicos**

1. **Inyección de Dependencias**: Desacoplamiento total, testabilidad mejorada, configuración centralizada
2. **Persistencia Abstracta**: Flexibilidad para cambiar entre memoria y base de datos sin modificar código
3. **Configuración Robusta**: Validación automática, tipado fuerte, manejo seguro de secrets
4. **Sistema de Plugins**: Carga dinámica, lifecycle management, health checks, API de gestión

### **Impacto en Escalabilidad**

- **Nuevos Verticales**: Crear un `RestaurantPlugin` o `ECommercePlugin` es trivial
- **Testing**: Mocks automáticos, configuración de test, aislamiento de componentes  
- **Mantenimiento**: Cambios aislados por módulo, dependency injection facilita actualizaciones
- **Monitoreo**: Health checks por plugin, métricas granulares, debugging mejorado

### **Preparación para Producción**

- **Zero Downtime**: Plugins pueden cargarse/descargarse en caliente
- **Configuración Segura**: Secrets manejados correctamente, validación automática
- **Observabilidad**: Logs estructurados, métricas por plugin, health endpoints
- **Escalabilidad Horizontal**: DI facilita distribución de servicios

Con estas mejoras, el sistema no solo migra exitosamente desde el monolito, sino que se convierte en una plataforma empresarial robusta, lista para escalar a cualquier vertical de negocio con una arquitectura de clase mundial.