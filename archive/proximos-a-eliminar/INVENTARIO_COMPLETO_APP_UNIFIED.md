# 📋 INVENTARIO COMPLETO Y DETALLADO - app-unified.ts (Versión Actualizada)

## Introducción
Este documento es un inventario exhaustivo y actualizado del archivo `app-unified.ts`, basado en un análisis línea por línea del código proporcionado. Cubre todas las dependencias, variables, funciones, flujos de datos, métricas de complejidad y aspectos clave. El análisis se organiza por secciones principales, priorizando la estructura general, luego componentes clave como imports, globals, funciones principales y auxiliares, para facilitar la comprensión y mantenimiento. Cada elemento se describe con referencias directas al código (e.g., "const variable = ...: sirve para..."), enfocándose en explicaciones detalladas de su propósito, uso y flujo, con código resumido donde es relevante.

**Archivo analizado:** `src/app-unified.ts`  
**Versión:** Unificada (Enero 2025, con optimizaciones en buffers, locks, voice handling y cleanups)  
**Líneas totales:** Aproximadamente 2,974 (incluyendo comentarios y espacios)  
**Propósito general:** Bot de WhatsApp unificado para entornos locales y Cloud Run, integrando OpenAI para procesamiento de mensajes (voice-to-text, text-to-voice), buffering unificado, persistencia de threads y perfiles, monitoreo de métricas, locks con colas para evitar race conditions, y manejo de function calling. Enfocado en UX conversacional con respuestas naturales y manejo de media.  

El código enfatiza unificación (buffer global único), manejo de voz (transcripción y generación), y cleanups automáticos. Se explica cada parte con énfasis en cómo interactúa con el resto del sistema, sin planes de optimización.

## 🏗️ ESTRUCTURA GENERAL DEL ARCHIVO

El archivo sigue una estructura modular: imports al inicio, globals y constantes, helpers globales, Express app y main, manejadores de errores, endpoints, procesamiento principal, inicialización y cleanups, y funciones específicas de webhooks y OpenAI. El flujo inicia con inicialización (config, OpenAI, server), pasa a webhooks (entrada de datos), buffering (agrupación), locks (secuencialidad), OpenAI (procesamiento), y salida (respuestas a WhatsApp).  

1. **Imports y Dependencias** (Líneas 1-100): Carga módulos externos (e.g., express) e internos (e.g., logging utils) para todo el sistema.  
2. **Variables Globales y Constantes** (Líneas 100-200): Estado compartido como buffers (globalMessageBuffers: Map para mensajes agrupados) y flags (isServerInitialized: boolean para readiness).  
3. **Funciones Helpers Globales** (Líneas 200-400): Utilidades como transcribeAudio (async function para Whisper) y acquireThreadLock (async para locks).  
4. **Aplicación Express y Main** (Líneas 400-600): Inicializa app (const app = express()), carga config (appConfig: AppConfig), setup OpenAI (openaiClient: OpenAI), endpoints/webhooks, y handlers.  
5. **Manejadores de Errores Globales** (Líneas 600-700): Captura uncaughtException (process.on('uncaughtException', ...)) y unhandledRejection con logs y shutdown.  
6. **Funciones Auxiliares y Endpoints** (Líneas 700-1000): setupEndpoints (function para routes como /health), setupSignalHandlers (function para SIGTERM/SIGINT), y sendWhatsAppMessage (async function para texto/voz).  
7. **Procesamiento Principal** (Líneas 1000-2000): processGlobalBuffer (async para buffer), updateTypingStatus (function para typing), addToGlobalBuffer (function para agregar mensajes), y processWithOpenAI (async core con threads/runs).  
8. **Inicialización y Cleanups** (Líneas 2000-2500): initializeBot (async para orphans y intervals), recoverOrphanedRuns (async para cancelar runs viejos), y processWebhook (async para entradas).  
9. **Funciones Específicas de Webhooks y OpenAI** (Líneas 2500-fin): Anidadas en setupWebhooks: processCombinedMessage (async para cola), analyzeImage (async para visión), subscribeToPresence (async para presences), getRelevantContext (async para temporal), processUserMessages (async para agrupar/procesar).

**Flujo de Datos General:**  
- Entrada: Webhooks (body: {messages, presences}) → Validación (skip bot messages via botSentMessages: Set<string>) → Buffer (addToGlobalBuffer: function con 5s ventana) → Locks (acquireThreadLock: async para secuencialidad).  
- Procesamiento: Media (transcribeAudio: async para voz, analyzeImage: async para imágenes) → Contexto (getRelevantContext: async con fecha/hora/labels) → OpenAI (processWithOpenAI: async con threads, polling, tools via executeFunction).  
- Salida: Respuestas (sendWhatsAppMessage: async con chunks/TTS si lastInputVoice: boolean) → Logs (logSuccess: function estructurado), métricas (setTokensUsed: function), persistencia (threadPersistence.setThread: function).  
- Monitoreo: Logs categorizados (e.g., logOpenAIRequest: function), métricas (setLatency: function), dashboard (botDashboard.setupRoutes: function), cleanups (setInterval para caches/buffers).  
- Excepciones: Errores → Logs (logError: function) + graceful exit; Race conditions → Backoff (e.g., addAttempts: number con delay).

**Dependencias Principales:**  
- Externas: dotenv/config (para env vars), express (para app: express()), OpenAI (para openaiClient: OpenAI), etc.  
- Internas: ./config/environment.js (para appConfig: AppConfig), ./utils/logging/index.js (para logInfo: function, etc.), ./utils/persistence/index.js (para threadPersistence: object), ./utils/whapi/index.js (para whapiLabels: object), ./utils/monitoring/dashboard.js (para botDashboard: object), ./routes/metrics.js (para metricsRouter: express.Router), ./utils/context/historyInjection.js (para injectHistory: async function), ./utils/simpleLockManager.js (para simpleLockManager: object), ./functions/registry/function-registry.js (para executeFunction: async function), ./utils/userStateManager.js (para UserState: type).

## 📦 IMPORTS Y DEPENDENCIAS DETALLADAS

Imports priorizados por core (externos primero, internos por categoría). Cada import se usa para inicializar clientes (e.g., openaiClient: OpenAI) o utils (e.g., logInfo: function), con flujo de datos desde main (carga config) hacia processing (e.g., openaiClient en processWithOpenAI).

**Core y Externas (Líneas 1-10):**  
- "dotenv/config": Carga .env vars automáticamente al inicio, permitiendo acceso a secrets como OPENAI_API_KEY: string para configs sensibles en todo el script.  
- express, { Request, Response }: Framework para crear app: express() y manejar routes como /hook: POST con tipos Request/Response para webhooks.  
- http: Crea server: http.Server base para listen(appConfig.port: number).  
- OpenAI: Cliente principal openaiClient: OpenAI para APIs como beta.threads.create(): Promise<Thread> en threads/runs/TTS/transcriptions.  
- fast-levenshtein: Para distancia Levenshtein (levenshtein: function), posiblemente remanente para fuzzy matching en textos, no usado explícitamente.  
- path/fs.promises: Para manejo de paths y archivos async, e.g., path.join('tmp', 'audio', filename: string) y fs.writeFile(audioPath: string, audioBuffer: Buffer) en voice responses.

**Configuración (Líneas 11-20):**  
- { AppConfig, loadAndValidateConfig, logEnvironmentConfig }: Tipo AppConfig: {host: string, port: number, secrets: {OPENAI_API_KEY: string, ...}, ...} para configs unificadas; loadAndValidateConfig(): Promise<AppConfig> valida env vars; logEnvironmentConfig(): void logs entorno.

**Logging (Líneas 21-60):**  
- 30+ funciones como logInfo(category: string, message: string, details?: any): void para tracing estructurado (JSON con categorías como OPENAI_REQUEST: string); usadas globalmente, e.g., en processWithOpenAI para logOpenAIRequest: function.

**Persistencia y WHAPI (Líneas 61-70):**  
- { threadPersistence }: Object con métodos como getThread(userId: string): {threadId: string, ...} | null para persistir threads; getAllThreadsInfo(): Record<string, {threadId: string, ...}> para stats.  
- { guestMemory }: Object con getOrCreateProfile(userId: string): Promise<{name: string, whapiLabels: any[]}> para perfiles usuarios.  
- { whapiLabels }: Object con getChatInfo(userId: string): Promise<{name: string, labels: any[]}> para labels y chat info.  
- getConfig(): AppConfig para acceso runtime a configs.

**Monitoreo y User State (Líneas 71-80):**  
- { botDashboard }: Object con setupRoutes(app: express()): void para dashboard web de monitoreo.  
- metricsRouter: express.Router y funciones como incrementFallbacks(): void, setTokensUsed(tokens: number): void para métricas Prometheus.  
- type { UserState }: {lastInputVoice: boolean} para estados usuario en globalUserStates: Map<string, UserState>.

**Contexto, Locks y Otros (Líneas 81-90):**  
- { injectHistory, cleanupExpiredCaches, getCacheStats }: async injectHistory(threadId: string, userId: string): Promise<boolean> para historial; cleanupExpiredCaches(): void para TTL; getCacheStats(): {historyCache: number, ...} para stats.  
- { simpleLockManager }: Object con acquireUserLock(userId: string): Promise<boolean> para locks híbridos con colas.

## 🌐 VARIABLES GLOBALES Y ESTADO

Globals para estado compartido, inicializados en main/initializeBot y modificados en webhooks/processing. Flujo: Creados vacíos → Actualizados (e.g., addToGlobalBuffer modifica buffers) → Leídos (e.g., processGlobalBuffer usa buffers) → Limpiados (setInterval).

- appConfig: AppConfig: Configuración cargada con host: string, port: number, secrets: {OPENAI_API_KEY: string, ...}, usada para URLs y timeouts en todo el sistema.  
- openaiClient: OpenAI: Instancia para APIs, creada con apiKey: string y timeout: number, usada en processWithOpenAI para threads.runs.create().  
- server: http.Server: Servidor Express iniciado con listen(), para manejar requests como /hook.  
- isServerInitialized: boolean = false: Flag para readiness, seteado a true en initializeBot(), chequeado en /hook para skip si false.  
- webhookCounts: Map<string, {lastLog: number, count: number}>: Rate limiting para logs de webhooks inválidos, actualizado en processWebhook para evitar spam.  
- activeProcessing: Set<string>: Set de userIds en procesamiento, agregado en processGlobalBuffer para prevenir duplicados.  
- globalMessageBuffers: Map<string, {messages: string[], chatId: string, userName: string, lastActivity: number, timer: NodeJS.Timeout | null}>: Buffer unificado para mensajes/typing, agregado via addToGlobalBuffer y procesado en processGlobalBuffer con ventana de 5s.  
- BUFFER_WINDOW_MS: number = 5000: Constante para timer de buffer, usada en setTimeout para delays variables (2s para media).  
- botSentMessages: Set<string>: IDs de mensajes enviados por bot, agregado en sendWhatsAppMessage para skip self-loops en processWebhook.  
- globalUserStates: Map<string, UserState>: Estados como lastInputVoice: boolean para decidir TTS, seteado en addToGlobalBuffer si isVoice.  
- MAX_MESSAGE_LENGTH: number = 5000: Límite para mensajes procesados, usado implícitamente en combinaciones de buffer.  
- subscribedPresences: Set<string>: Usuarios suscritos a presences, agregado en subscribeToPresence para evitar resuscripciones.  
- contextCache: Map<string, {context: string, timestamp: number}>: Cache de contexto temporal con TTL 1h, seteado en getRelevantContext para reutilización.

## 🔧 FUNCIONES PRINCIPALES DETALLADAS

Funciones priorizadas por flujo: Main → Setup → Processing → Helpers → Cleanups. Cada una explicada con propósito, flujo, dependencias y características clave, referenciando código.

### **Main Function (Líneas ~400-600)**
async function main(): Promise<void>: Inicialización asíncrona del sistema. Flujo: Carga config via loadAndValidateConfig(): Promise<AppConfig> → Inicializa openaiClient: OpenAI → setupEndpoints() y setupWebhooks() → Inicia server: http.Server → setupSignalHandlers() → initializeBot(). Maneja errores con servidor mínimo en catch (minimalApp: express() para /health). Dependencias: appConfig, openaiClient. Características: Logs iniciales con console.log() y logServerStart: function; fallback si falla config.

### **Setup Endpoints (Líneas ~700-900)**
function setupEndpoints(): void: Configura routes Express. Flujo: botDashboard.setupRoutes(app) → app.get('/health', ...): Response con stats como threadPersistence.getStats(): {activeThreads: number, ...} → app.post('/hook', async ...): Responde 200 inmediato, procesa async via processWebhook(body: any) → app.get('/', ...): Info con status: string → app.get('/locks', ...): Stats via simpleLockManager.getStats() → app.post('/locks/clear', ...): Limpia locks si environment !== 'cloud-run' → app.get('/audio/:filename', async ...): Sirve audio temporal con fs.readFile(audioPath: string). Dependencias: threadPersistence, simpleLockManager, fs. Características: Validación regex para filename: string; headers como 'Content-Type': 'audio/ogg'.

### **Setup Webhooks (Líneas ~2500-fin)**
function setupWebhooks(): void: Configura lógica de webhooks. Flujo: Define subscribedPresences: Set<string> y contextCache: Map para presences/contexto → processCombinedMessage: async (userId: string, combinedText: string, ...): Agrega a cola via simpleLockManager.addToQueue() y procesa via processWithOpenAI → analyzeImage: async (imageUrl: string, userId: string, messageId?: string): Analiza con openaiClient.chat.completions.create({model: 'gpt-4o-mini', ...}) para visión → subscribeToPresence: async (userId: string): Suscribe via POST a /presences/${userId} si no en subscribedPresences → getRelevantContext: async (userId: string): Genera contexto con fecha/hora (timeZone: 'America/Bogota'), labels via guestMemory.getOrCreateProfile() y whapiLabels.getChatInfo() → processUserMessages: async (userId: string): Agrupa buffer y procesa con tracing via startRequestTracing(userId: string). Dependencias: simpleLockManager, openaiClient, whapi API. Características: TTS si voice flag; chunks en respuestas.

### **Process With OpenAI (Líneas ~1411-2390, anidada)**
async function processWithOpenAI(userMsg: string, userJid: string, ...): Promise<string>: Core para procesar con Assistant API. Flujo: Obtiene/crea thread via threadPersistence.getThread() → Limpia runs via cleanupOldRuns() → Agrega mensaje con contexto (getRelevantContext(): string) y voice instructions si isVoiceMessage: boolean → Crea run via openaiClient.beta.threads.runs.create({assistant_id: string}) → Polling con attempts: number < 30 → Maneja requires_action via executeFunction() y submitToolOutputs() → Obtiene respuesta via messages.list({limit: 1}) → Métricas como setTokensUsed(run.usage.total_tokens: number). Dependencias: threadPersistence, openaiClient, executeFunction. Características: Backoff (addAttempts: number < 15) para race conditions; fallbacks para empty responses; tool tracing via registerToolCall().

### **Initialize Bot (Líneas ~2000-2200)**
async function initializeBot(): Promise<void>: Post-inicio setup. Flujo: recoverOrphanedRuns() en background → setInterval para cleanupExpiredCaches() cada 10min, buffer cleanup cada 10min, memory logs cada 5min (logInfo('MEMORY_USAGE', {memory: {heapUsedMB: number, ...}})). Dependencias: recoverOrphanedRuns, cleanupExpiredCaches, process.memoryUsage(). Características: Memory alerts si heapUsedMB > 300 o heapUsagePercent > 95; isServerInitialized = true.

### **Recover Orphaned Runs (Líneas ~2200-2300)**
async function recoverOrphanedRuns(): Promise<void>: Cancela runs activos viejos al boot. Flujo: threads = threadPersistence.getAllThreadsInfo() → Para cada thread, lista runs via openaiClient.beta.threads.runs.list({limit: 10}) → Si status in ['queued', 'in_progress', ...] y ageMinutes > 10, cancela via runs.cancel(). Dependencias: openaiClient, threadPersistence. Características: Contadores runsChecked/runsCancelled: number; logs via logWarning('ORPHANED_RUN_CANCELLED', ...).

### **Process Webhook (Líneas ~2700-fin)**
async function processWebhook(body: any): Promise<void>: Maneja body de webhook. Flujo: Si presences, updateTypingStatus(userId: string, true/false) por status: string → Si messages, skip from_me excepto manuales (botSentMessages.has(id: string)) → Transcribe voz via transcribeAudio(audioUrl: string) o analiza imagen via analyzeImage() → addToGlobalBuffer() para texto/voz → Para manuales (from_me && text), agrupa en buffer y sincroniza como assistant message con nota "[Mensaje manual ... - NO RESPONDER]". Dependencias: transcribeAudio, addToGlobalBuffer, openaiClient. Características: Rate limiting via webhookCounts; suscripción presence si nuevo thread.

## 📊 ANÁLISIS DE COMPLEJIDAD

**Funciones Más Complejas (por LOC y CC, sin optimizaciones):**  
| Función | LOC Aprox. | CC Aprox. | Razón |  
|---------|------------|-----------|-------|  
| processWithOpenAI | 1000+ | >50 | Polling (attempts: number), backoff (addAttempts: number), tool handling (toolCalls: array), métricas (setTokensUsed: function). |  
| processWebhook | 400 | 30 | Loops por messages/presences (for...of), branching por type (if type === 'voice'), manuales (if from_me). |  
| sendWhatsAppMessage | 300 | 20 | TTS/texto (if shouldUseVoice: boolean), chunks (chunks: string[] = message.split(/\n\n+/)), delays (await Promise(resolve, delay: number)). |  
| setupEndpoints | 200 | 15 | Múltiples routes (app.get('/health', ...)), validaciones (if !filename.match(/^voice_/)). |  
| initializeBot | 200 | 10 | setInterval múltiples (para cleanups, memory logs), async recoverOrphanedRuns(). |

## 🔄 FLUJOS DE DATOS PRINCIPALES

### **Flujo 1: Mensaje Usuario (Texto/Voz)**
Webhook body: {messages: array} → processWebhook (skip bot via botSentMessages: Set) → transcribeAudio si voice (audioUrl: string) → addToGlobalBuffer (messages.push(text: string)) → processGlobalBuffer después de BUFFER_WINDOW_MS: number → Cola via simpleLockManager.addToQueue() → processWithOpenAI (agrega a thread, crea run) → sendWhatsAppMessage (chunks o TTS si lastInputVoice: boolean).

### **Flujo 2: Mensaje Manual Agente**
Webhook message.from_me: boolean = true → Buffer 5s (addToGlobalBuffer) → Agrega a thread como assistant (openaiClient.beta.threads.messages.create({role: 'assistant', content: combinedMessage})) + system note ({role: 'user', content: '[Mensaje manual ... - NO RESPONDER]'}).

### **Flujo 3: Presence (Typing)**
Webhook presences: array → updateTypingStatus (clearTimeout(timer), setTimeout(processGlobalBuffer, BUFFER_WINDOW_MS)) → Prolonga buffer.

### **Flujo 4: Function Calling**
processWithOpenAI run.status: string = 'requires_action' → Interim si check_availability ("Permítame consultar...") → executeFunction(functionName: string) → submitToolOutputs(toolOutputs: array) → Polling backoff (postAttempts: number < 5) → Respuesta final.

### **Flujo 5: Cleanups Automáticos**
initializeBot → setInterval: cleanupExpiredCaches() cada 10min, buffer cleanup (if now - lastActivity > 15min) cada 10min, memory logs (if heapUsedMB > 300) cada 5min; recoverOrphanedRuns al boot.

# 📋 INVENTARIO COMPLETO Y DETALLADO - app-unified.ts (Versión Actualizada)

## Introducción
Este documento es un inventario exhaustivo y actualizado del archivo `app-unified.ts`, basado en un análisis línea por línea del código proporcionado. Cubre todas las dependencias, variables, funciones, flujos de datos, métricas de complejidad y aspectos clave. El análisis se organiza por secciones principales, priorizando la estructura general, luego componentes clave como imports, globals, funciones principales y auxiliares, para facilitar la comprensión y mantenimiento. Cada elemento se describe con referencias directas al código (e.g., "const variable = ...: sirve para..."), enfocándose en explicaciones detalladas de su propósito, uso y flujo, con código resumido donde es relevante.

**Archivo analizado:** `src/app-unified.ts`  
**Versión:** Unificada (Enero 2025, con optimizaciones en buffers, locks, voice handling y cleanups)  
**Líneas totales:** Aproximadamente 2,974 (incluyendo comentarios y espacios)  
**Propósito general:** Bot de WhatsApp unificado para entornos locales y Cloud Run, integrando OpenAI para procesamiento de mensajes (voice-to-text, text-to-voice), buffering unificado, persistencia de threads y perfiles, monitoreo de métricas, locks con colas para evitar race conditions, y manejo de function calling. Enfocado en UX conversacional con respuestas naturales y manejo de media.  

El código enfatiza unificación (buffer global único), manejo de voz (transcripción y generación), y cleanups automáticos. Se explica cada parte con énfasis en cómo interactúa con el resto del sistema, sin planes de optimización. Para la refactorización, se añade una sección nueva de "Aspectos Potenciales para Refactor" al final, identificando remanentes no usados (e.g., levenshtein importado pero no utilizado), duplicados posibles, y sugerencias para no escapar nada (e.g., env vars implícitas).

## 🏗️ ESTRUCTURA GENERAL DEL ARCHIVO

El archivo sigue una estructura modular: imports al inicio, globals y constantes, helpers globales, Express app y main, manejadores de errores, endpoints, procesamiento principal, inicialización y cleanups, y funciones específicas de webhooks y OpenAI. El flujo inicia con inicialización (config, OpenAI, server), pasa a webhooks (entrada de datos), buffering (agrupación), locks (secuencialidad), OpenAI (procesamiento), y salida (respuestas a WhatsApp).  

1. **Imports y Dependencias** (Líneas 1-100): Carga módulos externos (e.g., express) e internos (e.g., logging utils) para todo el sistema.  
2. **Variables Globales y Constantes** (Líneas 100-200): Estado compartido como buffers (globalMessageBuffers: Map para mensajes agrupados) y flags (isServerInitialized: boolean para readiness).  
3. **Funciones Helpers Globales** (Líneas 200-400): Utilidades como transcribeAudio (async function para Whisper) y acquireThreadLock (async para locks).  
4. **Aplicación Express y Main** (Líneas 400-600): Inicializa app (const app = express()), carga config (appConfig: AppConfig), setup OpenAI (openaiClient: OpenAI), endpoints/webhooks, y handlers.  
5. **Manejadores de Errores Globales** (Líneas 600-700): Captura uncaughtException (process.on('uncaughtException', ...)) y unhandledRejection con logs y shutdown.  
6. **Funciones Auxiliares y Endpoints** (Líneas 700-1000): setupEndpoints (function para routes como /health), setupSignalHandlers (function para SIGTERM/SIGINT), y sendWhatsAppMessage (async function para texto/voz).  
7. **Procesamiento Principal** (Líneas 1000-2000): processGlobalBuffer (async para buffer), updateTypingStatus (function para typing), addToGlobalBuffer (function para agregar mensajes), y processWithOpenAI (async core con threads/runs).  
8. **Inicialización y Cleanups** (Líneas 2000-2500): initializeBot (async para orphans y intervals), recoverOrphanedRuns (async para cancelar runs viejos), y processWebhook (async para entradas).  
9. **Funciones Específicas de Webhooks y OpenAI** (Líneas 2500-fin): Anidadas en setupWebhooks: processCombinedMessage (async para cola), analyzeImage (async para visión), subscribeToPresence (async para presences), getRelevantContext (async para temporal), processUserMessages (async para agrupar/procesar).

**Flujo de Datos General:**  
- Entrada: Webhooks (body: {messages, presences}) → Validación (skip bot messages via botSentMessages: Set<string>) → Buffer (addToGlobalBuffer: function con 5s ventana) → Locks (acquireThreadLock: async para secuencialidad).  
- Procesamiento: Media (transcribeAudio: async para voz, analyzeImage: async para imágenes) → Contexto (getRelevantContext: async con fecha/hora/labels) → OpenAI (processWithOpenAI: async con threads, polling, tools via executeFunction).  
- Salida: Respuestas (sendWhatsAppMessage: async con chunks/TTS si lastInputVoice: boolean) → Logs (logSuccess: function estructurado), métricas (setTokensUsed: function), persistencia (threadPersistence.setThread: function).  
- Monitoreo: Logs categorizados (e.g., logOpenAIRequest: function), métricas (setLatency: function), dashboard (botDashboard.setupRoutes: function), cleanups (setInterval para caches/buffers).  
- Excepciones: Errores → Logs (logError: function) + graceful exit; Race conditions → Backoff (e.g., addAttempts: number con delay).

**Dependencias Principales:**  
- Externas: dotenv/config (para env vars), express (para app: express()), OpenAI (para openaiClient: OpenAI), etc.  
- Internas: ./config/environment.js (para appConfig: AppConfig), ./utils/logging/index.js (para logInfo: function, etc.), ./utils/persistence/index.js (para threadPersistence: object), ./utils/whapi/index.js (para whapiLabels: object), ./utils/monitoring/dashboard.js (para botDashboard: object), ./routes/metrics.js (para metricsRouter: express.Router), ./utils/context/historyInjection.js (para injectHistory: async function), ./utils/simpleLockManager.js (para simpleLockManager: object), ./functions/registry/function-registry.js (para executeFunction: async function), ./utils/userStateManager.js (para UserState: type).

**Adición para Refactorización:** Nota sobre remanentes: levenshtein importado pero no usado (posible remoción); env vars como ENABLE_VOICE_TRANSCRIPTION, TTS_VOICE, IMAGE_ANALYSIS_MODEL implícitas en código — listar todas para config centralizada.

## 📦 IMPORTS Y DEPENDENCIAS DETALLADAS

Imports priorizados por core (externos primero, internos por categoría). Cada import se usa para inicializar clientes (e.g., openaiClient: OpenAI) o utils (e.g., logInfo: function), con flujo de datos desde main (carga config) hacia processing (e.g., openaiClient en processWithOpenAI).

**Core y Externas (Líneas 1-10):**  
- "dotenv/config": Carga .env vars automáticamente al inicio, permitiendo acceso a secrets como OPENAI_API_KEY: string para configs sensibles en todo el script.  
- express, { Request, Response }: Framework para crear app: express() y manejar routes como /hook: POST con tipos Request/Response para webhooks.  
- http: Crea server: http.Server base para listen(appConfig.port: number).  
- OpenAI: Cliente principal openaiClient: OpenAI para APIs como beta.threads.create(): Promise<Thread> en threads/runs/TTS/transcriptions.  
- fast-levenshtein: Para distancia Levenshtein (levenshtein: function), posiblemente remanente para fuzzy matching en textos, no usado explícitamente (sugerir remoción en refactor).  
- path/fs.promises: Para manejo de paths y archivos async, e.g., path.join('tmp', 'audio', filename: string) y fs.writeFile(audioPath: string, audioBuffer: Buffer) en voice responses.

**Configuración (Líneas 11-20):**  
- { AppConfig, loadAndValidateConfig, logEnvironmentConfig }: Tipo AppConfig: {host: string, port: number, secrets: {OPENAI_API_KEY: string, ...}, ...} para configs unificadas; loadAndValidateConfig(): Promise<AppConfig> valida env vars; logEnvironmentConfig(): void logs entorno.

**Logging (Líneas 21-60):**  
- 30+ funciones como logInfo(category: string, message: string, details?: any): void para tracing estructurado (JSON con categorías como OPENAI_REQUEST: string); usadas globalmente, e.g., en processWithOpenAI para logOpenAIRequest: function.

**Persistencia y WHAPI (Líneas 61-70):**  
- { threadPersistence }: Object con métodos como getThread(userId: string): {threadId: string, ...} | null para persistir threads; getAllThreadsInfo(): Record<string, {threadId: string, ...}> para stats.  
- { guestMemory }: Object con getOrCreateProfile(userId: string): Promise<{name: string, whapiLabels: any[]}> para perfiles usuarios.  
- { whapiLabels }: Object con getChatInfo(userId: string): Promise<{name: string, labels: any[]}> para labels y chat info.  
- getConfig(): AppConfig para acceso runtime a configs.

**Monitoreo y User State (Líneas 71-80):**  
- { botDashboard }: Object con setupRoutes(app: express()): void para dashboard web de monitoreo.  
- metricsRouter: express.Router y funciones como incrementFallbacks(): void, setTokensUsed(tokens: number): void para métricas Prometheus.  
- type { UserState }: {lastInputVoice: boolean} para estados usuario en globalUserStates: Map<string, UserState>.

**Contexto, Locks y Otros (Líneas 81-90):**  
- { injectHistory, cleanupExpiredCaches, getCacheStats }: async injectHistory(threadId: string, userId: string): Promise<boolean> para historial; cleanupExpiredCaches(): void para TTL; getCacheStats(): {historyCache: number, ...} para stats.  
- { simpleLockManager }: Object con acquireUserLock(userId: string): Promise<boolean> para locks híbridos con colas.

## 🌐 VARIABLES GLOBALES Y ESTADO

Globals para estado compartido, inicializados en main/initializeBot y modificados en webhooks/processing. Flujo: Creados vacíos → Actualizados (e.g., addToGlobalBuffer modifica buffers) → Leídos (e.g., processGlobalBuffer usa buffers) → Limpiados (setInterval).

- appConfig: AppConfig: Configuración cargada con host: string, port: number, secrets: {OPENAI_API_KEY: string, ...}, usada para URLs y timeouts en todo el sistema.  
- openaiClient: OpenAI: Instancia para APIs, creada con apiKey: string y timeout: number, usada en processWithOpenAI para threads.runs.create().  
- server: http.Server: Servidor Express iniciado con listen(), para manejar requests como /hook.  
- isServerInitialized: boolean = false: Flag para readiness, seteado a true en initializeBot(), chequeado en /hook para skip si false.  
- webhookCounts: Map<string, {lastLog: number, count: number}>: Rate limiting para logs de webhooks inválidos, actualizado en processWebhook para evitar spam.  
- activeProcessing: Set<string>: Set de userIds en procesamiento, agregado en processGlobalBuffer para prevenir duplicados.  
- globalMessageBuffers: Map<string, {messages: string[], chatId: string, userName: string, lastActivity: number, timer: NodeJS.Timeout | null}>: Buffer unificado para mensajes/typing, agregado via addToGlobalBuffer y procesado en processGlobalBuffer con ventana de 5s.  
- BUFFER_WINDOW_MS: number = 5000: Constante para timer de buffer, usada en setTimeout para delays variables (2s para media).  
- botSentMessages: Set<string>: IDs de mensajes enviados por bot, agregado en sendWhatsAppMessage para skip self-loops en processWebhook.  
- globalUserStates: Map<string, UserState>: Estados como lastInputVoice: boolean para decidir TTS, seteado en addToGlobalBuffer si isVoice.  
- MAX_MESSAGE_LENGTH: number = 5000: Límite para mensajes procesados, usado implícitamente en combinaciones de buffer.  
- subscribedPresences: Set<string>: Usuarios suscritos a presences, agregado en subscribeToPresence para evitar resuscripciones.  
- contextCache: Map<string, {context: string, timestamp: number}>: Cache de contexto temporal con TTL 1h, seteado en getRelevantContext para reutilización.

**Adición para Refactorización:** terminalLog: object con métodos como message(user: string, text: string): void para logs limpios en terminal — central para UX dev, sugerir mover a módulo logging si no se usa en producción.

## 🔧 FUNCIONES PRINCIPALES DETALLADAS

Funciones priorizadas por flujo: Main → Setup → Processing → Helpers → Cleanups. Cada una explicada con propósito, flujo, dependencias y características clave, referenciando código.

### **Main Function (Líneas ~400-600)**
async function main(): Promise<void>: Inicialización asíncrona del sistema. Flujo: Carga config via loadAndValidateConfig(): Promise<AppConfig> → Inicializa openaiClient: OpenAI → setupEndpoints() y setupWebhooks() → Inicia server: http.Server → setupSignalHandlers() → initializeBot(). Maneja errores con servidor mínimo en catch (minimalApp: express() para /health). Dependencias: appConfig, openaiClient. Características: Logs iniciales con console.log() y logServerStart: function; fallback si falla config.

### **Setup Endpoints (Líneas ~700-900)**
function setupEndpoints(): void: Configura routes Express. Flujo: botDashboard.setupRoutes(app) → app.get('/health', ...): Response con stats como threadPersistence.getStats(): {activeThreads: number, ...} → app.post('/hook', async ...): Responde 200 inmediato, procesa async via processWebhook(body: any) → app.get('/', ...): Info con status: string → app.get('/locks', ...): Stats via simpleLockManager.getStats() → app.post('/locks/clear', ...): Limpia locks si environment !== 'cloud-run' → app.get('/audio/:filename', async ...): Sirve audio temporal con fs.readFile(audioPath: string). Dependencias: threadPersistence, simpleLockManager, fs. Características: Validación regex para filename: string; headers como 'Content-Type': 'audio/ogg'.

### **Setup Webhooks (Líneas ~2500-fin)**
function setupWebhooks(): void: Configura lógica de webhooks. Flujo: Define subscribedPresences: Set<string> y contextCache: Map para presences/contexto → processCombinedMessage: async (userId: string, combinedText: string, ...): Agrega a cola via simpleLockManager.addToQueue() y procesa via processWithOpenAI → analyzeImage: async (imageUrl: string, userId: string, messageId?: string): Analiza con openaiClient.chat.completions.create({model: 'gpt-4o-mini', ...}) para visión → subscribeToPresence: async (userId: string): Suscribe via POST a /presences/${userId} si no en subscribedPresences → getRelevantContext: async (userId: string): Genera contexto con fecha/hora (timeZone: 'America/Bogota'), labels via guestMemory.getOrCreateProfile() y whapiLabels.getChatInfo() → processUserMessages: async (userId: string): Agrupa buffer y procesa con tracing via startRequestTracing(userId: string). Dependencias: simpleLockManager, openaiClient, whapi API. Características: TTS si voice flag; chunks en respuestas.

### **Process With OpenAI (Líneas ~1411-2390, anidada)**
async function processWithOpenAI(userMsg: string, userJid: string, ...): Promise<string>: Core para procesar con Assistant API. Flujo: Obtiene/crea thread via threadPersistence.getThread() → Limpia runs via cleanupOldRuns() → Agrega mensaje con contexto (getRelevantContext(): string) y voice instructions si isVoiceMessage: boolean → Crea run via openaiClient.beta.threads.runs.create({assistant_id: string}) → Polling con attempts: number < 30 → Maneja requires_action via executeFunction() y submitToolOutputs() → Obtiene respuesta via messages.list({limit: 1}) → Métricas como setTokensUsed(run.usage.total_tokens: number). Dependencias: threadPersistence, openaiClient, executeFunction. Características: Backoff (addAttempts: number < 15) para race conditions; fallbacks para empty responses; tool tracing via registerToolCall().

### **Initialize Bot (Líneas ~2000-2200)**
async function initializeBot(): Promise<void>: Post-inicio setup. Flujo: recoverOrphanedRuns() en background → setInterval para cleanupExpiredCaches() cada 10min, buffer cleanup cada 10min, memory logs cada 5min (logInfo('MEMORY_USAGE', {memory: {heapUsedMB: number, ...}})). Dependencias: recoverOrphanedRuns, cleanupExpiredCaches, process.memoryUsage(). Características: Memory alerts si heapUsedMB > 300 o heapUsagePercent > 95; isServerInitialized = true.

### **Recover Orphaned Runs (Líneas ~2200-2300)**
async function recoverOrphanedRuns(): Promise<void>: Cancela runs activos viejos al boot. Flujo: threads = threadPersistence.getAllThreadsInfo() → Para cada thread, lista runs via openaiClient.beta.threads.runs.list({limit: 10}) → Si status in ['queued', 'in_progress', ...] y ageMinutes > 10, cancela via runs.cancel(). Dependencias: openaiClient, threadPersistence. Características: Contadores runsChecked/runsCancelled: number; logs via logWarning('ORPHANED_RUN_CANCELLED', ...).

### **Process Webhook (Líneas ~2700-fin)**
async function processWebhook(body: any): Promise<void>: Maneja body de webhook. Flujo: Si presences, updateTypingStatus(userId: string, true/false) por status: string → Si messages, skip from_me excepto manuales (botSentMessages.has(id: string)) → Transcribe voz via transcribeAudio(audioUrl: string) o analiza imagen via analyzeImage() → addToGlobalBuffer() para texto/voz → Para manuales (from_me && text), agrupa en buffer y sincroniza como assistant message con nota "[Mensaje manual ... - NO RESPONDER]". Dependencias: transcribeAudio, addToGlobalBuffer, openaiClient. Características: Rate limiting via webhookCounts; suscripción presence si nuevo thread.

## 🔧 FUNCIONES AUXILIARES DETALLADAS

Funciones secundarias que soportan las principales, agrupadas por categoría. Estas son clave para no escapar en refactor (e.g., helpers como getShortUserId usados en logs y IDs).

**Helpers Generales (Líneas ~700-1000):**  
- getTimestamp(): string: Genera ISO timestamp (new Date().toISOString(): string), usada en logs como console.log(`${getTimestamp()} ...`).  
- getShortUserId(jid: string): string: Limpia JID a parte antes de '@' (jid.split('@')[0]: string), usada en logs y IDs para privacidad.  
- cleanContactName(rawName: any): string: Limpia nombre removiendo no-alphanum (replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/gi, ''): string), usada en userName para display.  
- invalidateUserCaches(userId: string): void: Invalida caches (chatInfoCache.delete(userId): void), llamada en cambios de estado para refresco.  
- getPrecomputedContextBase(): {date: string, time: string}: Cachea fecha/hora con TTL (CONTEXT_BASE_CACHE_TTL: number = 60000), usada en getRelevantContext para optimización.  
- getOrCreateUserState(userId: string, ...): UserState: Crea/ obtiene estado (globalUserStates.set(userId, userState): void), usada en voice flags.  
- getCachedChatInfo(userId: string): Promise<any>: Cachea chat info con TTL (CHAT_INFO_CACHE_TTL: number = 300000), usada en contexto.

**Media Helpers (Líneas ~200-400):**  
- transcribeAudio(audioUrl: string, ...): Promise<string>: Descarga y transcribe con Whisper (openai.audio.transcriptions.create({model: 'whisper-1'}: object)), maneja errores con fallback text.  
- analyzeImage(imageUrl: string, ...): Promise<string>: Analiza imagen con GPT-4o-mini (chat.completions.create({model: 'gpt-4o-mini'}: object)), prompt genérico adaptable.  

**Cleanup Helpers (Líneas 2000-2500):**  
- cleanupOldRuns(threadId: string, userId: string): Promise<number>: Lista y cancela runs viejos (>10min), contadores para logs.  
- recoverOrphanedRuns(): Promise<void>: Itera threads y llama cleanupOldRuns, logs stats.

**Adición para Refactorización:** Incluir env vars implícitas: ENABLE_VOICE_TRANSCRIPTION: string, TTS_VOICE: string, IMAGE_ANALYSIS_MODEL: string, VOICE_THRESHOLD: string — centralizar en config para fácil override.

## 📊 ANÁLISIS DE COMPLEJIDAD

**Funciones Más Complejas (por LOC y CC, sin optimizaciones):**  
| Función | LOC Aprox. | CC Aprox. | Razón |  
|---------|------------|-----------|-------|  
| processWithOpenAI | 1000+ | >50 | Polling (attempts: number), backoff (addAttempts: number), tool handling (toolCalls: array), métricas (setTokensUsed: function). |  
| processWebhook | 400 | 30 | Loops por messages/presences (for...of), branching por type (if type === 'voice'), manuales (if from_me). |  
| sendWhatsAppMessage | 300 | 20 | TTS/texto (if shouldUseVoice: boolean), chunks (chunks: string[] = message.split(/\n\n+/)), delays (await Promise(resolve, delay: number)). |  
| setupEndpoints | 200 | 15 | Múltiples routes (app.get('/health', ...)), validaciones (if !filename.match(/^voice_/)). |  
| initializeBot | 200 | 10 | setInterval múltiples (para cleanups, memory logs), async recoverOrphanedRuns(). |

**Métricas Globales:**  
- Funciones totales: ~50 (principales + auxiliares).  
- Imports: 20+ (externos ~10, internos ~15).  
- Globals: ~15 (maps/sets ~8, constantes ~5).  
- Env Vars Usadas: ~10 (e.g., NODE_ENV, PORT, OPENAI_API_KEY) — sugerir doc central para refactor.

## 🔄 FLUJOS DE DATOS PRINCIPALES

### **Flujo 1: Mensaje Usuario (Texto/Voz)**
Webhook body: {messages: array} → processWebhook (skip bot via botSentMessages: Set) → transcribeAudio si voice (audioUrl: string) → addToGlobalBuffer (messages.push(text: string)) → processGlobalBuffer después de BUFFER_WINDOW_MS: number → Cola via simpleLockManager.addToQueue() → processWithOpenAI (agrega a thread, crea run) → sendWhatsAppMessage (chunks o TTS si lastInputVoice: boolean).

### **Flujo 2: Mensaje Manual Agente**
Webhook message.from_me: boolean = true → Buffer 5s (addToGlobalBuffer) → Agrega a thread como assistant (openaiClient.beta.threads.messages.create({role: 'assistant', content: combinedMessage})) + system note ({role: 'user', content: '[Mensaje manual ... - NO RESPONDER]'}).

### **Flujo 3: Presence (Typing)**
Webhook presences: array → updateTypingStatus (clearTimeout(timer), setTimeout(processGlobalBuffer, BUFFER_WINDOW_MS)) → Prolonga buffer.

### **Flujo 4: Function Calling**
processWithOpenAI run.status: string = 'requires_action' → Interim si check_availability ("Permítame consultar...") → executeFunction(functionName: string) → submitToolOutputs(toolOutputs: array) → Polling backoff (postAttempts: number < 5) → Respuesta final.

### **Flujo 5: Cleanups Automáticos**
initializeBot → setInterval: cleanupExpiredCaches() cada 10min, buffer cleanup (if now - lastActivity > 15min) cada 10min, memory logs (if heapUsedMB > 300) cada 5min; recoverOrphanedRuns al boot.

**Adición para Refactorización:** Flujo de media: analyzeImage prompt es específico (hotel), pero función genérica — mover prompt a config env para abstracción.

## 🚧 ASPECTOS POTENCIALES PARA REFACTOR (Adición Nueva)

Para asegurar nada escape en refactor:
- **Remanentes No Usados:** levenshtein importado pero no llamado — remover para limpiar.
- **Duplicados Posibles:** terminalLog methods (e.g., response: function) similar a log functions — unificar en logging module.
- **Env Vars Implícitas:** Lista completa: NODE_ENV, PORT, OPENAI_API_KEY, WHAPI_API_URL, WHAPI_TOKEN, ENABLE_VOICE_TRANSCRIPTION, VOICE_THRESHOLD, VOICE_RANDOM_PROBABILITY, TTS_VOICE, IMAGE_ANALYSIS_MODEL, TERMINAL_LOGS_FUNCTIONS, DETAILED_LOGS, DEBUG_LOGS — centralizar en AppConfig con defaults.
- **Dependencias Externas No Cubiertas:** function-registry.js (executeFunction) es externo — documentar como hook para industrias.
- **Potenciales Módulos:** Separar voice (transcribeAudio, TTS) en media module; context (getRelevantContext) configurable via callbacks para timezone/labels.
- **Tests Pendientes:** Ningún test explícito — añadir Jest coverage >80% en base.
- **Complejidad Alta:** processWithOpenAI >50 CC — dividir en subfunciones (e.g., handlePolling, handleTools).

---

*Documento creado: July 24, 2025*  
*Versión: 2.0 - Con Adiciones para Refactor*  
*Autor: Grok - Basado en análisis de Alexander - TeAlquilamos*