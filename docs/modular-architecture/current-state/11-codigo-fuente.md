# 11. Código Fuente Principal

Este documento ofrece un análisis exhaustivo del archivo monolítico `app-unified.ts` (aproximadamente 3,779 líneas), basado en el estado actual del sistema. Se desglosa la estructura por secciones con rangos de líneas aproximados, se incluyen extractos clave de código para ilustrar funcionalidades críticas, se evalúa la complejidad (ciclomática y cognitiva), se identifican problemas arquitectónicos (acoplamiento, responsabilidades mezcladas y mantenibilidad), se detallan patrones de diseño presentes y ausentes, y se proporciona una guía para la migración modular con funciones candidatas para extracción y una estructura objetivo de módulos.

El análisis se basa exclusivamente en el contenido del archivo, destacando áreas de alto impacto en performance (e.g., polling de OpenAI), reliability (e.g., manejo de locks y cleanups) y UX (e.g., buffering inteligente).

## Estructura General del Archivo

El archivo `app-unified.ts` es un script monolítico que integra todas las funcionalidades del bot, desde configuración hasta procesamiento de mensajes. Su estructura sigue un flujo lineal: imports, variables globales, funciones utilitarias, procesamiento principal, setup del servidor y manejadores globales, culminando en la función principal. Esto facilita la ejecución secuencial pero complica la mantenibilidad debido al acoplamiento.

### Estadísticas del Archivo `app-unified.ts`
- **Líneas totales**: 3,779 (incluyendo comentarios y espacios en blanco).
- **Funciones principales**: ~92 (52 nombradas, 28 anónimas en callbacks, 12 métodos en `terminalLog`).
- **Imports**: 30+ módulos (15 externos como OpenAI y Express, 15 internos como logging y persistence).
- **Variables globales**: 26+ (Maps para estados, Sets para control, constantes para TTLs).
- **Endpoints Express**: 12 rutas (e.g., /health, /hook, /metrics, /locks, /audio/:filename, dashboard routes).
- **Tamaño estimado**: ~180KB (sin minificación).
- **Complejidad estimada**: **Alta**. Funciones clave como `processWithOpenAI` y `processWebhook` tienen una alta complejidad ciclomática (muchos caminos condicionales) y cognitiva (lógica anidada difícil de seguir), superando las buenas prácticas recomendadas.

## Distribución por Secciones

### 1. Imports (líneas ~1-150)
Esta sección carga dependencias externas e internas. Incluye core Node.js (http, path, fs), librerías externas (OpenAI, express, levenshtein) y módulos propios (logging, persistence, whapi). Hay imports obsoletos comentados (e.g., guestMemory) para registro histórico.

Extracto clave:
```typescript
import "dotenv/config";
import express, { Request, Response } from 'express';
import http from 'http';
import OpenAI from 'openai';
import levenshtein from 'fast-levenshtein';
import path from 'path';
import fs from 'fs/promises';

// Configuración y utilidades
import { AppConfig, loadAndValidateConfig, logEnvironmentConfig } from './config/environment.js';

// Sistema de logging
import { /* ~20 funciones de log */ } from './utils/logging/index.js';

// Persistencia y APIs
import { threadPersistence } from './utils/persistence/index.js';
import { whapiLabels } from './utils/whapi/index.js';
import type { UserState } from './utils/userStateManager.js';
import { botDashboard } from './utils/monitoring/dashboard.js';
import { validateAndCorrectResponse } from './utils/response-validator.js';

// Métricas y context
import metricsRouter, { incrementFallbacks, setTokensUsed, setLatency, incrementMessages } from './routes/metrics.js';
import { cleanupExpiredCaches, getCacheStats } from './utils/context/historyInjection.js';

// Locks
import { simpleLockManager } from './utils/simpleLockManager.js';
```

Complejidad: Baja (solo declaraciones). Problema: Imports dinámicos (e.g., function-registry.js) aumentan complejidad runtime.

### 2. Variables Globales (líneas ~150-400)
Define estados compartidos (Maps/Sets para buffers, caches, locks) y configuraciones (TTLs, flags). Incluye `terminalLog` con ~20 métodos para logging visual.

Extracto clave:
```typescript
let appConfig: AppConfig;
let openaiClient: OpenAI;
let server: http.Server;
let isServerInitialized = false;

// Sistema de logs limpios
const terminalLog = { /* ~20 métodos: message, typing, response, error, etc. */ };

// Rate limiting y caches
const webhookCounts = new Map<string, { lastLog: number; count: number }>();
const typingLogTimestamps = new Map<string, number>();
const chatInfoCache = new Map<string, { data: any; timestamp: number }>();
const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000;
const contextCache = new Map<string, { context: string, timestamp: number }>();
const CONTEXT_CACHE_TTL = 60 * 60 * 1000;

// Estados y buffers
const activeProcessing = new Set<string>();
const globalMessageBuffers = new Map<string, { messages: string[], chatId: string, userName: string, lastActivity: number, timer: NodeJS.Timeout | null, currentDelay?: number }>();
const BUFFER_WINDOW_MS = 5000;
const TYPING_EXTENDED_MS = 10000;
const pendingImages = new Map<string, string[]>();
const botSentMessages = new Set<string>();
const globalUserStates = new Map<string, UserState>();
const userRetryState = new Map<string, { retryCount: number; lastRetryTime: number }>();
const subscribedPresences = new Set<string>();
const MAX_MESSAGE_LENGTH = 5000;

// Tipos WHAPI
interface WHAPIMediaLink { /* ... */ }
interface WHAPIMessage { /* ... */ }
interface WHAPIError { /* ... */ }
```

Complejidad: Media (muchas estructuras de datos dependientes). Problema: Dependencia global genera race conditions.

### 3. Funciones Utilitarias (líneas ~400-2500)
Incluye helpers (getTimestamp, getShortUserId), gestión de estados (getOrCreateUserState, getCachedChatInfo), media (transcribeAudio, analyzeImage), locks (acquireThreadLock, releaseThreadLock), buffering (addToGlobalBuffer, setIntelligentTimer, processGlobalBuffer), envío de mensajes (sendWhatsAppMessage, sendTypingIndicator), OpenAI utils (cleanupOldRuns, isRunActive, recoverOrphanedRuns), y contexto (getPrecomputedContextBase, getRelevantContext).

Extracto clave (ejemplo: buffering):
```typescript
function addToGlobalBuffer(userId: string, messageText: string, chatId: string, userName: string, isVoice: boolean = false): void {
    /* Crea o actualiza buffer, agrega mensaje, setea timer inteligente */
}

function setIntelligentTimer(userId: string, chatId: string, userName: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void {
    /* Calcula delay dinámico, setea timeout */
}

async function processGlobalBuffer(userId: string): Promise<void> {
    /* Verifica typing, procesa mensajes combinados con locks */
}
```

Complejidad: Alta (ciclomática >10 en processGlobalBuffer debido a condicionales; cognitiva alta en timers inteligentes). Problema: Funciones con múltiples responsabilidades (e.g., logging + negocio).

### 4. Procesamiento Principal y Flujos (líneas ~2500-3000)
Incluye setupEndpoints, setupSignalHandlers, setupWebhooks, initializeBot, processWebhook, processCombinedMessage, processWithOpenAI.

Extracto clave (processWithOpenAI):
```typescript
async function processWithOpenAI(userMsg: string, userJid: string, chatId: string = null, userName: string = null, requestId?: string): Promise<string> {
    /* Maneja indicators, thread creation, context injection, multimodal content, run creation/polling, function calling, validation */
}
```

Complejidad: Muy alta (ciclomática ~20 en polling y function calling; cognitiva >30 por nesting). Problema: Lógica central con alto acoplamiento a globals.

### 5. Servidor Express (líneas ~3000-3500)
Configura app Express con middleware y rutas (/health, /hook, /metrics, /locks, /audio/:filename, dashboard).

Extracto clave:
```typescript
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/metrics', metricsRouter);

app.get('/health', (req, res) => { /* ... */ });
app.post('/hook', async (req, res) => { /* Responde 200, procesa async */ });
/* Otras rutas */
```

Complejidad: Baja (rutas simples). Problema: Rutas mezcladas con lógica de negocio.

### 6. Manejadores Globales (líneas ~3500-3700)
Maneja uncaughtException, unhandledRejection, signals (SIGTERM, SIGINT).

Extracto clave:
```typescript
process.on('uncaughtException', (error, origin) => { /* Log y exit */ });
process.on('unhandledRejection', (reason, promise) => { /* Log y exit */ });
```

Complejidad: Baja. Problema: Shutdown no siempre graceful (timers no siempre cleared).

### 7. Función Principal (líneas ~3700-3779)
Inicializa config, OpenAI, endpoints, webhooks, server, signals.

Extracto clave:
```typescript
const main = async () => {
    /* Logs iniciales, load config, init OpenAI, setup endpoints/webhooks, create server, initializeBot, setup signals */
};
main();
```

Complejidad: Media (secuencial). Problema: Punto de entrada único para todo.

## Análisis de Complejidad

### Métricas Detalladas
- **Ciclomática**: Alto en processWithOpenAI (~25 por condicionales en polling/function calling); promedio ~8.
- **Cognitiva**: Muy alto en setIntelligentTimer (>15 por nesting/condicionales); promedio ~10.
- **Profundidad de Nesting**: Hasta 6 niveles en processWebhook (if-else anidados).
- **Longitud de Funciones**: Alto (processWithOpenAI >200 líneas).
- **Duplicación**: Media (error handling similar en múltiples funciones).
- **Magic Numbers**: Alto (TTLs como 5000 hardcoded).

### Problemas de Arquitectura
- **Acoplamiento Fuerte**: Más del 80% de las funciones dependen directamente de variables globales (`appConfig`, `openaiClient`, `globalMessageBuffers`). Esto crea un "efecto dominó": un cambio en una variable global puede romper inesperadamente múltiples funciones no relacionadas, haciendo el mantenimiento riesgoso.
- **Responsabilidades Mezcladas (Violación del SRP)**: El archivo único actúa simultáneamente como servidor web, orquestador de IA, gestor de estado, cliente de APIs externas y lógica de negocio específica de hotelería. Esto hace imposible probar o modificar una funcionalidad (e.g., el buffering) sin afectar a las demás.
- **Mantenibilidad**: Índice MI ~55 (bajo por complejidad y tamaño); cambios afectan múltiples áreas.

## Patrones de Diseño

### Presentes
- **Singleton**: Globals como terminalLog actúan como singletons.
- **Observer**: Webhooks observan eventos de Whapi.
- **Facade**: terminalLog simplifica logging.
- **Strategy**: Timers inteligentes varían por tipo (implícito).

### Ausentes
- **Dependency Injection**: Dependencias hardcoded.
- **Repository**: Persistencia mezclada (JSON files directos).
- **Command**: Operaciones no encapsuladas.
- **Circuit Breaker**: No para APIs externas (e.g., Beds24 timeouts).

## Análisis de Riesgos y "Code Smells" Específicos

Más allá de la estructura general, el código presenta "code smells" (indicios de problemas más profundos) que la migración debe resolver:

- **"Magic Numbers" y Strings Literales**: El código está repleto de números y strings hardcodeados que dificultan la configuración y el mantenimiento.
  - **Ejemplos**: `BUFFER_WINDOW_MS = 5000`, `TYPING_EXTENDED_MS = 10000`, `maxAttempts = 30`, el string `'check_availability'` se usa directamente en la lógica en lugar de una constante. Esto debería centralizarse en un archivo de configuración.

- **Manejo de Errores Inconsistente**: Algunas funciones lanzan errores (`throw error`), mientras que otras los capturan y retornan un valor por defecto (e.g., `return ''` en `processWithOpenAI`). Esto hace que el comportamiento del sistema ante fallos sea impredecible.

- **Exposición de Rutas de Sistema**: El endpoint `/audio/:filename` sirve archivos directamente desde el directorio `tmp`. Aunque existe una validación con regex, esta práctica es riesgosa y podría ser vulnerable a ataques de "Path Traversal" si la validación falla o se modifica incorrectamente en el futuro.

## Extractos de Código Crítico

### Performance: Polling de OpenAI
```typescript
// En processWithOpenAI
let attempts = 0;
while (['queued', 'in_progress'].includes(run.status) && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
    attempts++;
}
```

### Reliability: Cleanup de Runs
```typescript
async function cleanupOldRuns(threadId: string, userId: string): Promise<number> {
    /* Lista runs, cancela activos >10min */
}
```

### UX: Buffering Inteligente
```typescript
function setIntelligentTimer(/* ... */): void {
    /* Calcula delay por tipo, setea timeout */
}
```

## Guía Estratégica para la Migración Modular

Este análisis valida la necesidad de la refactorización descrita en el **Plan de Migración**. La estructura monolítica actual ha alcanzado su límite de mantenibilidad. La migración debe seguir un enfoque disciplinado para separar las responsabilidades y desacoplar la lógica de negocio del núcleo del bot.

### Alineación con el `MIGRATION_PLAN.md`

El objetivo es transformar este archivo monolítico en la arquitectura profesional definida en el plan:

1.  **Definir las Fronteras (Core vs. Plugin):**
    -   **Código del Núcleo (Core)**: Funciones como `setupEndpoints`, `processWebhook`, `sendWhatsAppMessage`, `addToGlobalBuffer`, `setIntelligentTimer`, `processGlobalBuffer` y la lógica de `simpleLockManager` formarán el corazón reutilizable del bot.
    -   **Código del Plugin de Hotelería**: La implementación de `check_availability` (actualmente en `function-registry.js`), el cliente de la API de Beds24, el formateo de sus resultados y la lógica de inyección de contexto temporal (`getRelevantContext`) se aislarán en el módulo `plugins/hotel/`.

2.  **Implementar la Inyección de Dependencias (DI):**
    -   La función `processWithOpenAI` es el candidato principal. Actualmente, importa dinámicamente y ejecuta funciones (`executeFunction`), creando un acoplamiento fuerte. En la nueva arquitectura, recibirá un `IFunctionRegistry` como parámetro. El núcleo solo sabrá cómo *ejecutar* una función, sin conocer *cuál* o *cómo* se implementa.

3.  **Estructura Objetivo Validada:**
    -   La estructura propuesta en el plan con directorios `src/core/`, `src/plugins/hotel/` y `src/shared/` es la correcta para lograr el desacoplamiento. `app-unified.ts` eventualmente desaparecerá y será reemplazado por `src/main.ts`, un archivo mucho más pequeño cuya única responsabilidad será inicializar y conectar el núcleo con los plugins.

### Pasos Tácticos para Desmantelar `app-unified.ts`

La migración debe realizarse de forma incremental, siguiendo el método "Branch and Refactor":

1.  **Extraer Utilidades Puras**: Funciones como `getShortUserId` y `cleanContactName` son las primeras en moverse a `src/core/utils/`, ya que no tienen dependencias.
2.  **La lógica de polling, manejo de tool calls y validación de respuestas se convertirán en sus propias unidades, más fáciles de probar y mantener.