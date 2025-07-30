📸 Estado Actual del Sistema v2.0

Snapshot exacto y corregido de cómo funciona el bot, basado en app-unified.ts (3,779 líneas) al 27 de Julio 2025. Documento actualizado según análisis y sugerencias para la migración modular.

🔍 ARCHIVO PRINCIPAL: app-unified.ts
Estadísticas:
Líneas: 3,779
Funciones principales: ~92 (distribuidas en ~50 funciones nombradas, ~30 inline/anónimas en callbacks y ~20 métodos en terminalLog)
Imports: 30+ módulos (incluyendo obsoletos comentados para registro y dinámicos)
Variables globales: 26+ (Maps, Sets, constantes y objetos para estado, caches y buffers)
Endpoints: 12 rutas Express (7 principales + 4 dashboard + métricas + WebSocket)
Estructura Actual (3,779 líneas):
// IMPORTS (líneas ~1-150)
import "dotenv/config"; // Configuración de entorno
import express, { Request, Response } from 'express'; // Servidor web
import http from 'http'; // Creación de servidor HTTP
import OpenAI from 'openai'; // Cliente OpenAI para Assistant API, TTS, Whisper
import levenshtein from 'fast-levenshtein'; // Distancia de strings (usado en validateAndCorrectResponse)
import path from 'path'; // Manejo de rutas de archivos (temp audio)
import fs from 'fs/promises'; // Operaciones asíncronas de archivos (audio temporal)

// Configuración y utilidades
import { AppConfig, loadAndValidateConfig, logEnvironmentConfig } from './config/environment.js';
import { getConfig } from './config/environment'; // Obsoleto, comentado

// Sistema de logging (~20 funciones)
import {
    logInfo, logSuccess, logError, logWarning, logDebug, logFatal, logAlert,
    // Obsoletos comentados pero importados:
    logMessageReceived, logOpenAIRequest, logOpenAIResponse,
    logFunctionCallingStart, logFunctionExecuting, logFunctionHandler,
    logThreadCreated, logServerStart, logOpenAIUsage, logOpenAILatency,
    logFallbackTriggered, logPerformanceMetrics,
    // Nuevas funciones de tracing:
    logRequestTracing, logToolOutputsSubmitted, logAssistantNoResponse,
    startRequestTracing, updateRequestStage, registerToolCall,
    updateToolCallStatus, endRequestTracing
} from './utils/logging/index.js';

// Persistencia y memoria
import { threadPersistence } from './utils/persistence/index.js';
import { guestMemory } from './utils/persistence/index.js'; // Obsoleto pero importado

// APIs y utilidades externas
import { whapiLabels } from './utils/whapi/index.js';
import type { UserState } from './utils/userStateManager.js';
import { botDashboard } from './utils/monitoring/dashboard.js';
import { validateAndCorrectResponse } from './utils/response-validator.js';

// Métricas y routing
import metricsRouter, { 
    incrementFallbacks, 
    setTokensUsed, 
    setLatency, 
    incrementMessages 
} from './routes/metrics.js';

// Context y caches
import { cleanupExpiredCaches, getCacheStats } from './utils/context/historyInjection.js';

// Sistema de locks
import { simpleLockManager } from './utils/simpleLockManager.js';

// Function registry (importado dinámicamente en processWithOpenAI)
// import { executeFunction } from './functions/registry/function-registry.js';
// Se importa con: const { executeFunction } = await import('./functions/registry/function-registry.js');

// VARIABLES GLOBALES (líneas ~150-400)
let appConfig: AppConfig; // Configuración cargada (entorno, secrets)
let openaiClient: OpenAI; // Cliente OpenAI inicializado
let server: http.Server; // Servidor HTTP
let isServerInitialized = false; // Flag de inicialización

// Sistema de logs limpios para terminal (objeto global con ~20 métodos)
const terminalLog = {
    // Logs principales con formato limpio
    message: (user: string, text: string) => {
        const logMsg = `👤 ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}}"`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    typing: (user: string) => console.log(`✍️ ${user} está escribiendo...`),
    processing: (user: string) => {}, // Eliminado - no mostrar en terminal
    response: (user: string, text: string, duration: number) => {
        const logMsg = `🤖 OpenAI → ${user} (${(duration/1000).toFixed(1)}s)`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    error: (message: string) => console.log(`❌ Error: ${message}`),
    openaiError: (user: string, error: string) => console.log(`❌ Error enviar a OpenAI → ${user}: ${error}`),
    imageError: (user: string, error: string) => console.log(`❌ Error al procesar imagen → ${user}: ${error}`),
    voiceError: (user: string, error: string) => console.log(`❌ Error al procesar audio → ${user}: ${error}`),
    functionError: (functionName: string, error: string) => console.log(`❌ Error en función ${functionName}: ${error}`),
    whapiError: (operation: string, error: string) => console.log(`❌ Error WHAPI (${operation}): ${error}`),
    functionStart: (name: string, args?: any) => {
        if (name === 'check_availability' && args) {
            const { startDate, endDate } = args;
            const nights = args.endDate && args.startDate ? 
                Math.round((new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / (1000 * 60 * 60 * 24)) : '?';
            console.log(`⚙️ check_availability(${startDate}-${endDate}, ${nights} noches)`);
        } else {
            console.log(`⚙️ ${name}()`);
        }
    },
    functionProgress: (name: string, step: string, data?: any) => {}, // Eliminado - logs redundantes
    functionCompleted: (name: string, result?: any, duration?: number) => {}, // Se maneja en availabilityResult
    startup: () => {
        console.clear();
        console.log('\n=== Bot TeAlquilamos Iniciado ===');
        console.log(`🚀 Servidor: ${appConfig?.host || 'localhost'}:${appConfig?.port || 3008}`);
        console.log(`🔗 Webhook: ${appConfig?.webhookUrl || 'configurando...'}`);
        console.log('✅ Sistema listo\n');
    },
    newConversation: (user: string) => console.log(`\n📨 Nueva conversación con ${user}`),
    image: (user: string) => console.log(`📷 ${user}: [Imagen recibida]`),
    voice: (user: string) => {
        const logMsg = `🎤 ${user}: [Nota de voz recibida]`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    recording: (user: string) => console.log(`🎙️ ${user} está grabando...`),
    availabilityResult: (completas: number, splits: number, duration?: number) => {
        const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
        const logMsg = `🏠 ${completas} completa${completas !== 1 ? 's' : ''} + ${splits} alternativa${splits !== 1 ? 's' : ''}${durationStr}`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    externalApi: (service: string, action: string, result?: string) => {
        const timestamp = new Date().toLocaleTimeString();
        if (result) {
            console.log(`🔗 [${timestamp}] ${service} → ${action} → ${result}`);
        } else {
            console.log(`🔗 [${timestamp}] ${service} → ${action}...`);
        }
    }
};

// Rate limiting y control
const webhookCounts = new Map<string, { lastLog: number; count: number }>(); // Rate limiting logs webhooks
const typingLogTimestamps = new Map<string, number>(); // Rate limiting typing logs (5s)

// Caches con TTL
const chatInfoCache = new Map<string, { data: any; timestamp: number }>(); // Cache info chats
const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const contextCache = new Map<string, { context: string, timestamp: number }>(); // Cache contexto temporal
const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Control de configuración
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false'; // Logs functions en terminal

// Estados y procesamiento
const activeProcessing = new Set<string>(); // Usuarios en procesamiento activo

// Buffer unificado de mensajes
const globalMessageBuffers = new Map<string, {
    messages: string[],
    chatId: string,
    userName: string,
    lastActivity: number,
    timer: NodeJS.Timeout | null,
    currentDelay?: number // Delay actual del timer para comparaciones
}>();
const BUFFER_WINDOW_MS = 5000; // 5 segundos para agrupar mensajes normales
const TYPING_EXTENDED_MS = 10000; // 10 segundos cuando usuario está escribiendo/grabando

// Media y mensajes
const pendingImages = new Map<string, string[]>(); // URLs imágenes pendientes por usuario
const botSentMessages = new Set<string>(); // IDs de mensajes enviados por bot (evitar self-loops)
const globalUserStates = new Map<string, UserState>(); // Estados de usuario completos

// Control de retries y validación
const userRetryState = new Map<string, { retryCount: number; lastRetryTime: number }>(); // Control retries (evitar loops)
// Cooldown: 5 minutos, Límite: 1 retry por usuario

// Control de suscripciones a presences
const subscribedPresences = new Set<string>(); // En setupWebhooks, evita resuscripciones duplicadas

// Constantes
const MAX_MESSAGE_LENGTH = 5000; // Límite longitud mensajes

// Tipos para WHAPI
interface WHAPIMediaLink {
    link?: string;
    id?: string;
    mime_type?: string;
    file_size?: number;
}

interface WHAPIMessage {
    id: string;
    type: string;
    audio?: WHAPIMediaLink;
    voice?: WHAPIMediaLink;
    ptt?: WHAPIMediaLink;
    image?: WHAPIMediaLink;
}

interface WHAPIError {
    error?: {
        code: number;
        message: string;
        details?: string;
    };
}

// FUNCIONES UTILITARIAS (líneas ~400-2500)

// Helpers básicos (~10 funciones)
function getTimestamp(): string {...}
function getShortUserId(jid: string): string {...}
function cleanContactName(rawName: any): string {...}
function isQuoteOrPriceMessage(message: string): boolean {...}

// Gestión de estados y caches (~10 funciones)
function getOrCreateUserState(userId: string, chatId?: string, userName?: string): UserState {...}
async function getCachedChatInfo(userId: string): Promise<any> {...}
function invalidateUserCaches(userId: string): void {...}
function getPrecomputedContextBase(): { date: string; time: string } {...}
async function getRelevantContext(userId: string, requestId?: string): Promise<string> {...}

// Media y comunicación (~10 funciones)
async function transcribeAudio(audioUrl: string | undefined, userId: string, userName?: string, messageId?: string): Promise<string> {...}
async function analyzeImage(imageUrl: string | undefined, userId: string, userName?: string, messageId?: string): Promise<string> {...}
async function sendWhatsAppMessage(chatId: string, message: string): Promise<boolean> {...}
async function sendTypingIndicator(chatId: string): Promise<void> {...}
async function sendRecordingIndicator(chatId: string): Promise<void> {...}
async function subscribeToPresence(userId: string): Promise<void> {...}

// Sistema de locks (~5 funciones)
async function acquireThreadLock(userId: string): Promise<boolean> {...}
function releaseThreadLock(userId: string): void {...}

// Buffer y procesamiento (~10 funciones)
function addToGlobalBuffer(userId: string, messageText: string, chatId: string, userName: string, isVoice: boolean = false): void {...}
function setIntelligentTimer(userId: string, chatId: string, userName: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void {...}
async function processGlobalBuffer(userId: string): Promise<void> {...}
async function processUserMessages(userId: string): Promise<void> {...}
let processCombinedMessage: (userId: string, combinedText: string, chatId: string, userName: string, messageCount: number) => Promise<void>;

// OpenAI utilities (~10 funciones)
async function cleanupOldRuns(threadId: string, userId: string): Promise<number> {...}
async function isRunActive(userId: string): Promise<boolean> {...}
async function recoverOrphanedRuns(): Promise<void> {...}
async function processWithOpenAI(userMsg: string, userJid: string, chatId: string, userName: string, requestId?: string): Promise<string> {...}

// Setup y configuración (~10 funciones)
function setupEndpoints(): void {...}
function setupSignalHandlers(): void {...}
function setupWebhooks(): void {...}
function initializeBot(): void {...}
async function processWebhook(body: any): Promise<void> {...}

// Funciones inline/anónimas en intervals y callbacks (~30+)
// - Cleanup intervals (5+)
// - Event handlers (10+)
// - Callback functions (10+)
// - Promise handlers (5+)

// SETUP Y CONFIGURACIÓN (líneas ~2500-3000)
function setupEndpoints(): void {...} // Configura todas las rutas Express
function setupSignalHandlers(): void {
    // Manejo de shutdown graceful
    const shutdown = (signal: string) => {
        logInfo('SHUTDOWN', `Señal ${signal} recibida`);
        
        // 1. Limpiar todos los timers de buffers
        for (const [userId, buffer] of globalMessageBuffers) {
            if (buffer.timer) clearTimeout(buffer.timer);
        }
        
        // 2. Cerrar servidor HTTP
        if (server) {
            server.close(() => {
                logSuccess('SHUTDOWN', 'Servidor cerrado');
                process.exit(0);
            });
        }
        
        // 3. Timeout forzado después de 5s
        setTimeout(() => {
            logWarning('SHUTDOWN', 'Cierre forzado por timeout');
            process.exit(1);
        }, 5000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
function setupWebhooks(): void {...} // Lógica webhook y processCombinedMessage
function initializeBot(): void {...} // Intervals, cleanups, recovery

// Procesamiento OpenAI principal
async function processWithOpenAI(
    userMsg: string, 
    userJid: string, 
    chatId: string = null, 
    userName: string = null, 
    requestId?: string
): Promise<string> {
    // 1. Enviar indicador según tipo de input:
    //    - Si lastInputVoice: sendRecordingIndicator()
    //    - Si no: sendTypingIndicator()
    // 2. Thread management (crear/obtener)
    // 3. subscribeToPresence() SIEMPRE
    // 4. Contexto temporal si necesario
    // 5. Crear content multimodal si hay pendingImages:
    //    content = [
    //      { type: "text", text: messageWithContext },
    //      ...pendingImages.map(url => ({ 
    //        type: "image_url", 
    //        image_url: { url } 
    //      }))
    //    ]
    // 6. Limpiar pendingImages.delete(userId) después de usar
    // 7. Run create, polling, functions, validación
}

// Procesamiento webhook
async function processWebhook(body: any): Promise<void> {...} // Messages, presences, manuales

// SERVIDOR EXPRESS (líneas ~3000-3500)
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/metrics', metricsRouter); // Métricas Prometheus (incrementFallbacks, setTokensUsed, setLatency, incrementMessages)

// setupEndpoints() configura:
app.get('/health', (req, res) => {...}); // Health check con stats
app.post('/hook', async (req: Request, res: Response) => {
    // 1. Responde 200 inmediatamente (crítico para evitar timeout Whapi)
    res.status(200).json({ received: true, timestamp: new Date().toISOString() });
    
    // 2. Procesa async en background sin bloquear respuesta
    // 3. Filtra webhooks válidos: messages, presences, statuses, chats, contacts, groups, labels, calls, channel, users
    // 4. Rate limiting para webhooks inválidos (1 log/min con webhookCounts Map)
    // 5. Llama processWebhook(req.body) con try/catch para evitar crashes
});
app.get('/', (req, res) => {...}); // Root con info bot
app.get('/locks', (req, res) => {...}); // Monitoreo locks
app.post('/locks/clear', (req, res) => {...}); // Limpia locks (solo dev)
app.get('/audio/:filename', async (req, res) => {
    // Validación: filename.match(/^voice_\d+_\d+\.(mp3|ogg)$/)
    // Content-Type dinámico: 'audio/mpeg' para .mp3, 'audio/ogg; codecs=opus' para .ogg
    // Path: path.join('tmp', 'audio', filename)
    // Verifica existencia con fs.access antes de servir
    // Cache-Control: 'no-cache, no-store, must-revalidate'
});
// botDashboard.setupRoutes(app) configura:
// - /dashboard: UI principal con logs en tiempo real
// - /dashboard/logs: Vista de logs históricos
// - /dashboard/stats: Estadísticas del sistema (threads, memoria, requests)
// - /dashboard/api/logs: WebSocket endpoint para streaming de logs
// - /dashboard/api/stats: JSON API para métricas

// MANEJADORES GLOBALES (líneas ~3500-3700)
process.on('uncaughtException', (error, origin) => {...}); // Log crítico + exit(1)
process.on('unhandledRejection', (reason, promise) => {...}); // Log crítico + exit(1)

// FUNCIÓN PRINCIPAL (líneas ~3700-3779)
const main = async () => {
    // 1. Logs iniciales (versión Node, memoria, entorno)
    // 2. loadAndValidateConfig() → appConfig
    // 3. logEnvironmentConfig()
    // 4. new OpenAI({ apiKey, timeout, maxRetries })
    // 5. setupEndpoints() → todas las rutas
    // 6. setupWebhooks() → lógica procesamiento
    // 7. http.createServer(app) → server.listen()
    // 8. initializeBot() → cleanups, intervals, recovery
    // 9. setupSignalHandlers() → shutdown graceful
    // 10. Catch: servidor mínimo si falla (puerto 8080)
};

main();


🔄 FLUJO DE PROCESAMIENTO ACTUAL
1. Recepción de Webhook (processWebhook):
WhatsApp → Whapi → POST /hook → Respuesta 200 inmediata → processWebhook(body) async
                                                    ↓
                                    Validar body (messages/presences/event)
                                                    ↓
                    ┌─────────────────────────────────────────────────────────┐
                    │ PRESENCES (typing/recording):                           │
                    │ - Actualizar userState.lastTyping = Date.now()         │
                    │ - setIntelligentTimer(10s extended)                    │
                    │ - terminalLog.typing/recording (rate limited 5s)       │
                    │ - Si status online/offline: limpiar isCurrentlyRecording│
                    └─────────────────────────────────────────────────────────┘
                                                    ↓
                    ┌─────────────────────────────────────────────────────────┐
                    │ MESSAGES:                                               │
                    │ 1. Filtrar from_me:                                     │
                    │    - Si botSentMessages.has(id): skip                  │
                    │    - Si manual real: buffer especial + sync thread     │
                    │ 2. Por tipo:                                           │
                    │    - Voice: transcribeAudio → 🎤 + texto               │
                    │    - Image: analyzeImage → 📷 + descripción (opcional) │
                    │    - Text: 📝 + texto                                  │
                    │ 3. addToGlobalBuffer() con metadata                    │
                    │ 4. setIntelligentTimer (5-10s según tipo)             │
                    └─────────────────────────────────────────────────────────┘


2. Procesamiento de Buffer (processGlobalBuffer):
Timer expira (5-10s) → processGlobalBuffer(userId)
                              ↓
        Verificar typing reciente (<10s) y msgs.length === 1
                              ↓ Si sí
                    Retrasar remainingTime (hasta 10s desde lastTyping)
                              ↓ Si no
                    Verificar activeProcessing.has(userId)
                              ↓ Si no
                    Marcar activeProcessing.add(userId)
                              ↓
                    Copiar mensajes y limpiar buffer.messages = []
                              ↓
                    Combinar mensajes con '\n'
                              ↓
                    processCombinedMessage(userId, combinedText, ...)
                              ↓
                    activeProcessing.delete(userId) en finally


3. Lógica de OpenAI (processCombinedMessage + processWithOpenAI):
processCombinedMessage(userId, combinedText, ...)
                    ↓
        isRunActive() con cleanupOldRuns previo
                    ↓ Si active
        Retry hasta 3 veces (1s delay) o cancelar requires_action
                    ↓
        simpleLockManager.addToQueue(userId, messageId, data, processFunction)
                    ↓
        processFunction():
            ↓
        startRequestTracing(userId) → updateRequestStage('init')
            ↓
        getRelevantContext() si necesario:
            - Condiciones: 3h desde último, cambio nombre/labels, primer mensaje
            - Si cambio detectado (nombre/labels):
                ├─ invalidateUserCaches(userId) // Limpia caches obsoletos
                └─ threadPersistence.updateThreadMetadata() // Actualiza metadata
            - Genera contexto temporal con fecha/hora/cliente/labels
            ↓
        processWithOpenAI(combinedText, userId, chatId, userName, requestId)
            ├─ sendTypingIndicator() o sendRecordingIndicator() según lastInputVoice
            ├─ Crear/obtener thread (threadPersistence)
            ├─ subscribeToPresence(shortUserId) SIEMPRE (no solo new threads)
            ├─ Agregar mensaje con contexto temporal
            ├─ Adjuntar pendingImages si existen como content multimodal
            ├─ openaiClient.beta.threads.runs.create()
            ├─ Polling (1s interval, max 30 attempts, backoff en race conditions)
            ├─ Si completed: obtener respuesta
            ├─ Si requires_action:
            │   ├─ Mensaje interino si check_availability complejo
            │   ├─ executeFunction() para cada tool call
            │   │   └─ registerToolCall() → updateToolCallStatus()
            │   ├─ submitToolOutputs
            │   └─ Polling post-tool (500ms-5s backoff, max 10)
            ├─ validateAndCorrectResponse()
            │   └─ Si needsRetry: correctiveMessage + retry run (userRetryState)
            └─ Si context_length_exceeded: crear thread nuevo
                    ↓
        sendWhatsAppMessage(chatId, response)
            ├─ Si lastInputVoice && !sensible: TTS nova → voice message
            ├─ Si sensible (precios/enlaces): forzar texto
            └─ División inteligente en párrafos con typing_time
                    ↓
        endRequestTracing() + métricas (tokens, latency)


4. Flujos Especiales:
Mensajes Manuales (from_me: true):
Webhook detecta from_me: true → Verificar NO es botSentMessages.has(id)
    ↓ Si es manual real
Buffer separado en globalMessageBuffers con key=chatId
    ↓
Timer 5s (BUFFER_WINDOW_MS) → Agrupar múltiples mensajes
    ↓
Procesar buffer:
    1. Crear mensaje de contexto del sistema:
       await threads.messages.create(threadId, {
         role: 'user',
         content: '[Mensaje manual de {agentName}]'
       })
    2. Agregar contenido real como assistant:
       await threads.messages.create(threadId, {
         role: 'assistant', 
         content: combinedMessage  // Mensajes agrupados
       })
    ↓
threadPersistence.setThread() actualiza metadata
Log: MANUAL_SYNC_SUCCESS con preview y stats


Media Handling:
Voice → transcribeAudio():
    - Verificar audioUrl o fetch desde WHAPI usando messageId
    - Descargar audio con fetch → arrayBuffer
    - Crear temp file: path.join('tmp', `audio_${Date.now()}.ogg`)
    - fs.writeFile(tempPath, Buffer.from(audioBuffer))
    - createReadStream para OpenAI Whisper
    - OpenAI transcription con model='whisper-1', language='es'
    - Cleanup con manejo de errores:
      await fs.unlink(tempPath).catch((err) => {
        logWarning('TEMP_FILE_CLEANUP', 'Error eliminando archivo temporal', { 
          file: tempPath, 
          error: err.message 
        });
      });
    - Retornar transcripción o 'No se pudo transcribir el audio'
    - Si error: terminalLog.voiceError(displayName, error.message) y throw

Image → pendingImages:
    - Extraer URL de message.image?.link
    - Si no hay URL, fetch desde WHAPI similar a voice
    - pendingImages.get(userId).push(imageUrl)
    - Al procesar con OpenAI:
      content: [
        { type: "text", text: messageWithContext },
        { type: "image_url", image_url: { url: imageUrl }}
      ]
    - Limpiar pendingImages.delete(userId) post-uso


Voice Responses con Fallback Inteligente:
Si lastInputVoice === true && ENABLE_VOICE_RESPONSES === 'true':
    ↓
Verificar contenido sensible con isQuoteOrPriceMessage():
    - Regex patterns:
      /\$\d+[.,]?\d*/g              // $840.000
      /\d+[.,]?\d*\s*(cop|pesos?)/gi // 840000 COP
      /\d+\s*noches?/gi             // 4 noches
      /https?:\/\/\S+/i             // URLs
      /wa\.me\/p/i                  // Enlaces WhatsApp
    ↓ Si match → Forzar texto (shouldUseVoice = false)
    
Si shouldUseVoice:
    - OpenAI TTS: model='tts-1', voice='nova', max 4000 chars
    - Convertir response a arrayBuffer → Buffer → base64
    - Crear data URL: `data:audio/mp3;base64,${base64Audio}`
    - POST a Whapi /messages/voice con media: dataUrl
    - Si OK: limpiar userState.lastInputVoice = false
    - Si error: fallback a texto normal
    
Envío de texto (normal o fallback):
    - División inteligente por párrafos (\n\n+)
    - O por listas con bullets (•, -, *)
    - typing_time: 3s primer msg, 2s siguientes
    - Guardar en botSentMessages.add(responseId)
    - Auto-delete después de 10 min


Análisis de Imágenes con Vision:
Usuario envía imagen → Webhook detecta type: 'image'
    ↓
analyzeImage(imageUrl, userId, userName, messageId):
    - Si no hay URL, fetch desde WHAPI /messages/{messageId}
    - Validar URL comienza con 'http'
    - OpenAI Vision con GPT-4o-mini:
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Analiza esta imagen en contexto hotelero...' },
          { type: 'image_url', image_url: { url: finalUrl, detail: 'low' }}
        ]
      }]
    - max_tokens: 150, temperature: 0.3
    - Retorna descripción breve (max 100 palabras)
    - Si error: terminalLog.imageError() y throw
    ↓
pendingImages.get(userId).push(imageUrl)
    ↓
Al procesar con OpenAI:
    - Adjuntar como content multimodal
    - Limpiar pendingImages.delete(userId) después


Suscripción a Presences (Siempre Activa):
processWithOpenAI() → Después de crear/obtener thread
    ↓
subscribeToPresence(shortUserId):
    - Verificar subscribedPresences.has(userId)
    - Si ya suscrito: return (evita duplicados)
    - POST /presences/{userId} sin body
    - Si 200: subscribedPresences.add(userId)
    - Si 409: También add (ya estaba suscrito)
    - Si error: Log pero continuar (no crítico)
    ↓
Usuario ahora envía eventos typing/recording automáticamente


5. Cleanup y Recovery:
AL BOOT:
    - threadPersistence.initializeCleanup()
    - recoverOrphanedRuns() en background (5s delay)
        └─ Cancelar TODOS los runs activos

INTERVALS:
    - cleanupExpiredCaches() cada 10 min
    - Memory logs cada 5 min (alert si >300MB o >95% heap)
    - User states cleanup cada 1h (>24h inactivo)
    - Global buffer cleanup cada 10 min (>15 min inactivo)
    
SHUTDOWN (SIGTERM/SIGINT):
    - Clear todos los timers
    - server.close() con timeout 5s
    - Logs de shutdown detallados


6. Sistema de Tracing:
startRequestTracing(userId) → requestId
    ↓
updateRequestStage(requestId, 'init'|'processing'|'function_calling'|'completed')
    ↓
registerToolCall(requestId, toolCallId, functionName, 'executing')
    ↓
updateToolCallStatus(requestId, toolCallId, 'success'|'error')
    ↓
endRequestTracing(requestId) → summary con duración total


🗄️ DATOS QUE MANEJA
En Memoria (Volátil con TTLs):
// BUFFERS Y ESTADOS
globalMessageBuffers: Map<string, {
    messages: string[],        // Hasta 50 msgs
    chatId: string,
    userName: string,
    lastActivity: number,      // Para cleanup >15min
    timer: NodeJS.Timeout | null,
    currentDelay?: number      // 5000ms normal, 10000ms si typing/recording activo
}>

globalUserStates: Map<string, UserState> {
    userId: string,
    isTyping: boolean,
    lastTypingTimestamp: number,
    lastMessageTimestamp: number,
    messages: string[],
    chatId: string,
    userName: string,
    typingEventsCount: number,
    averageTypingDuration: number,
    lastInputVoice: boolean,   // Para voice responses
    lastTyping: number,        // Último typing detectado
    isCurrentlyRecording?: boolean
}

// CACHES CON TTL
contextCache: Map<string, {    // TTL: 1 hora
    context: string,           // Contexto temporal formateado
    timestamp: number
}>

chatInfoCache: Map<string, {   // TTL: 5 minutos
    data: any,                 // Info de Whapi (name, labels)
    timestamp: number
}>

// CONTROL Y RATE LIMITING
activeProcessing: Set<string>  // Durante procesamiento

botSentMessages: Set<string>   // TTL: 10 minutos auto-delete
                              // IDs para evitar self-loops

userRetryState: Map<string, {  // Control retries validación
    retryCount: number,        // Max 1 retry
    lastRetryTime: number      // Cooldown 5 minutos
}>

pendingImages: Map<string, string[]>  // URLs por usuario
// Se adjuntan a OpenAI como content multimodal:
// [{ type: "text", text: msg }, { type: "image_url", image_url: { url } }]

webhookCounts: Map<string, {   // Rate limiting logs
    lastLog: number,
    count: number
}>

typingLogTimestamps: Map<string, number>  // Rate limit 5s

// CACHE TEMPORAL
precomputedContextBase: {      // TTL: 1 minuto
    date: string,
    time: string,
    timestamp: number
} | null


En Archivos JSON (Persistente):
// threads-data.json (via threadPersistence)
{
  "573001234567": {
    "threadId": "thread_abc123",
    "chatId": "573001234567@s.whatsapp.net",
    "userName": "Juan Pérez",
    "createdAt": "2025-07-27T10:30:00Z",
    "lastActivity": "2025-07-27T15:45:00Z",
    "name": "Juan Pérez",         // Para detectar cambios
    "labels": ["Consulta", "VIP"]  // Para detectar cambios
  }
}

// guest-memory.json (obsoleto pero aún importado)
{
  "573001234567": {
    "name": "Juan Pérez",
    "whapiLabels": [
      {"id": "1", "name": "Potencial"},
      {"id": "2", "name": "Consulta"}
    ],
    "lastInteraction": "2025-07-27T15:45:00Z"
  }
}


Archivos Temporales:
/tmp/
├── audio_1234567890.ogg    // Transcripción Whisper (deleted post-uso)
├── audio_1234567891.mp3    // TTS output (deleted post-envío)
└── ...

⚠️ Riesgo: Si fs.unlink() falla, archivos se acumulan
Mitigación actual: .catch(() => {}) ignora errores
Problema: No hay cleanup periódico de /tmp/


🏨 FUNCIONALIDADES ESPECÍFICAS DE HOTELERÍA
Check Availability Function:
// Registrada en function-registry.js
{
    name: "check_availability",
    description: "Verificar disponibilidad y precios en el sistema",
    parameters: {
        type: "object",
        properties: {
            startDate: { type: "string", description: "YYYY-MM-DD" },
            endDate: { type: "string", description: "YYYY-MM-DD" },
            guests: { type: "number", default: 2 }
        }
    }
}

// Ejecución:
executeFunction("check_availability", args) →
    - Calcular noches
    - Llamar Beds24 API (JSON endpoint)
    - Parsear respuesta XML
    - Aplicar timezone America/Bogota
    - Formatear: completas (disponibles) + splits (alternativas)
    - terminalLog.availabilityResult(completas, splits, duration)


Labels Hoteleros:
// Via whapiLabels y getCachedChatInfo
Etiquetas disponibles: [
    'Potencial',      // Cliente interesado
    'Consulta',       // En proceso de cotización
    'Reservado',      // Confirmó reserva
    'VIP',           // Cliente especial
    'Check-in',      // En hotel
    'Check-out',     // Salió del hotel
    'Cancelado',     // Canceló reserva
    'Repetidor'      // Cliente recurrente
]


Contexto Temporal:
// Inyectado automáticamente cada 3h o al cambiar datos
`Fecha: 27/07/2025 | Hora: 10:30 AM (Colombia)
Cliente: Juan Pérez | Contacto WhatsApp: Juan | Status: Consulta, VIP
---
Mensaje del cliente:`


Validación y Corrección:
Detección sensible: Regex para $, COP, precios, URLs (fallback voice→text)
Validación respuestas: levenshtein distance para discrepancias
Corrección: Manual o retry automático con correctiveMessage
Timezone: Todas las fechas/horas en America/Bogota

⚡ PERFORMANCE ACTUAL
Métricas Típicas:
Tiempo respuesta promedio: 3-8s (OpenAI 1-5s + Beds24 2-5s)
Memoria RAM: 150-400MB (alertas >300MB, crítico >95% heap)
CPU: 10-40% en picos (TTS/Whisper intensive)
Usuarios concurrentes: 50-200 típico, máx 500
Requests/min: 200-1000 (webhooks + API calls)
Tokens/request: 500-3000 (alertas >2000)
Bottlenecks Identificados:
OpenAI Polling: 1-3s base + backoff (puede llegar a 30s timeout)
Beds24 API: 2-5s típico, ~20% timeouts
Transcripciones Audio: 3-10s (descarga + Whisper + temp file)
TTS Generation: 2-5s para respuestas largas
Memory Growth: Caches sin límite estricto (mitigado con intervals)
Memory Leaks Potenciales:
globalMessageBuffers: Timers no cancelados en race conditions
contextCache/chatInfoCache: Crecimiento sin límite máximo
globalUserStates: Cleanup cada hora pero puede acumular
pendingImages: No tiene TTL explícito
Temp files: Si fs.unlink falla, acumulación en /tmp
🔌 INTEGRACIONES EXTERNAS
OpenAI Assistant API:
Endpoint: https://api.openai.com/v1
Assistant ID: process.env.OPENAI_ASSISTANT_ID
Models:
  - whisper-1: Transcripción audio (español)
  - tts-1: Text-to-speech (voice: nova)
  - gpt-4: Assistant principal
Functions disponibles:
  - check_availability
  - get_conversation_context
  - view_image
  - search_knowledge
Rate limits: 
  - Timeout: configurable en appConfig
  - Retries: configurable en appConfig
Manejo errores:
  - context_length_exceeded → Nuevo thread automático
  - Runs huérfanos → Cleanup automático
  - Race conditions → Backoff progresivo


Whapi Cloud:
Endpoint: ${WHAPI_API_URL} (e.g., https://gate.whapi.cloud/)
Token: ${WHAPI_TOKEN}
Endpoints usados:
  - /messages/text: Enviar mensajes texto
  - /messages/voice: Enviar notas de voz
  - /presences/{id}: Suscribir/actualizar presencia
  - /messages/{id}: Obtener info mensaje (media URLs)
  - /chats/{id}: Obtener info chat
Funcionalidades:
  - Labels management
  - Presences (typing, recording, online)
  - Media handling (images, voice)
Rate limits: No documentado
Webhooks: POST /hook


Beds24 API:
Endpoint: https://beds24.com/api/json/
Auth: 
  - apiKey: En secrets
  - propKey: En secrets
Endpoints:
  - getAvailabilities: Disponibilidad y precios
Response: XML (parseado a JSON)
Timezone: UTC → America/Bogota
Rate limits: No documentado
Timeouts: ~20% de requests
Formato respuesta:
  - roomId, units available
  - prices por noche
  - min stay requirements


🛠️ SISTEMAS AUXILIARES
Sistema de Logging (terminalLog):
// Objeto con ~20 métodos para logs limpios
terminalLog = {
    // Mensajes básicos
    message(user, text): "👤 user: text..."
    typing(user): "✍️ user está escribiendo..."
    response(user, text, duration): "🤖 OpenAI → user (Xs)"
    
    // Errores específicos
    error(message): "❌ Error: message"
    openaiError(user, error): "❌ Error enviar a OpenAI → user"
    imageError(user, error): "❌ Error al procesar imagen → user"
    voiceError(user, error): "❌ Error al procesar audio → user"
    functionError(name, error): "❌ Error en función name"
    whapiError(operation, error): "❌ Error WHAPI (operation)"
    
    // Function calling
    functionStart(name, args): "⚙️ name(args)"
    functionCompleted(name, result, duration): Log según función
    availabilityResult(completas, splits, duration): "🏠 X completas + Y alternativas (Xs)"
    
    // Sistema
    startup(): Clear + banner inicial
    newConversation(user): "📨 Nueva conversación con user"
    image(user): "📷 user: [Imagen recibida]"
    voice(user): "🎤 user: [Nota de voz recibida]"
    recording(user): "🎙️ user está grabando..."
    externalApi(service, action, result): "🔗 [timestamp] service → action"
}


Sistema de Locks (simpleLockManager):
// Sistema híbrido con locks y colas por usuario
Configuración:
    - Tipo: user-based (un lock por userId)
    - Timeout: 15 segundos (auto-release si no se libera)
    - Queue: habilitada (procesa en orden FIFO)
    - Auto-release: sí (previene deadlocks)
    - Concurrencia: 1 proceso por usuario a la vez
    
Métodos principales:
    - acquireUserLock(userId): Promise<boolean>
      └─ Intenta adquirir lock, retorna true si éxito
    - releaseUserLock(userId): void
      └─ Libera lock y procesa siguiente en cola
    - addToQueue(userId, messageId, data, processFunction): void
      └─ Agrega a cola si lock ocupado
    - processQueue(userId): Promise<void>
      └─ Procesa items en cola secuencialmente
    - hasActiveLock(userId): boolean
      └─ Verifica si usuario tiene lock activo
    - getStats(): {activeLocks: number, activeQueues: number}
      └─ Estadísticas del sistema
    - clearAll(): void
      └─ Limpia todos los locks (solo desarrollo)

Uso en el flujo:
    1. processCombinedMessage intenta acquireThreadLock
    2. Si ocupado → addToQueue con processFunction
    3. Al terminar → releaseThreadLock
    4. Auto-procesa siguiente en cola


Sistema de Tracing:
// Request lifecycle tracking
Funciones:
    - startRequestTracing(userId): string (requestId)
    - updateRequestStage(requestId, stage): void
    - registerToolCall(requestId, toolCallId, name, status): void
    - updateToolCallStatus(requestId, toolCallId, status): void
    - endRequestTracing(requestId): TracingSummary
    
Stages: init → processing → function_calling → post_tools_completed → completed
Tool status: executing → success|error


🚨 PROBLEMAS CONOCIDOS
Críticos:
Memory leaks sin mitigación completa
   - Caches crecen indefinidamente si cleanup intervals fallan
   - Causa crashes en Cloud Run tras ~24h de uptime
   - contextCache/chatInfoCache sin límite máximo de entradas
   - globalUserStates puede acumular miles de usuarios
   - Mitigación actual: Restart diario manual
Persistencia no escalable
   - JSON files para threads (I/O blocking)
   - Pérdida de memoria/estados al reiniciar
   - No soporta múltiples instancias
Código monolítico inmantenible
   - 3,779 líneas en un archivo
   - Funciones dispersas sin organización clara
   - Imports obsoletos comentados por todas partes
Runs huérfanos facturación extra
   - Si cleanup falla, runs activos indefinidos
   - Costo adicional OpenAI (~$0.03/run abandonado)
Altos:
Beds24 API inestable
   - ~20% timeouts sin retry automático
   - Afecta UX en cotizaciones
   - Sin circuit breaker
Voice handling frágil
   - Transcripciones fallan si no hay URL
   - TTS limitado a 4000 caracteres
   - Temp files pueden acumular si cleanup falla
Validación puede causar loops
   - userRetryState mitiga pero no elimina
   - Errores complejos no siempre corregibles
   - Puede agotar tokens rápidamente
Webhook processing sin deduplicación
   - Mensajes duplicados procesados múltiples veces
   - Rate limiting solo en logs, no en procesamiento
Medios:
Sin tests automatizados
   - Cambios rompen flujos sin detección
   - Regresiones frecuentes en buffers/timers
Logs excesivamente verbosos
   - ~100 logs por request en modo debug
   - Dificulta debugging real en producción
Métricas incompletas
   - No tracking de memory leaks específicos
   - No histogramas de latencia
   - No alertas automáticas configuradas
Configuración mezclada local/cloud
   - Riesgo de usar config incorrecta
   - Secrets en .env no rotados
Dashboard básico
   - Solo logs en tiempo real
   - No históricos ni analytics
   - No filtros avanzados
📊 MÉTRICAS Y MONITOREO
Endpoints de Monitoreo:
/health: Status general + thread stats
/metrics: Métricas Prometheus (fallbacks, tokens, latency)
/locks: Estado del sistema de locks
/dashboard: UI web con logs en tiempo real
/: Info general del bot
Métricas Trackeadas:
Messages procesados (incrementMessages)
Fallbacks OpenAI (incrementFallbacks)
Tokens usados (setTokensUsed)
Latencia requests (setLatency)
Memory usage (cada 5min)
Active threads/buffers
Documento generado el 27 de Julio 2025 - Versión 2.0.0-corrected
📝 NOTA IMPORTANTE PARA MIGRACIÓN
Este documento es crítico para la migración modular. Cualquier funcionalidad no documentada aquí corre el riesgo de perderse durante la refactorización. Verificar contra el código fuente completo antes de iniciar la migración.
Riesgos Críticos Identificados:
subscribedPresences no migrado puede causar spam de suscripciones WHAPI.
analyzeImage no integrado romperá procesamiento de imágenes hoteleras.
Imports dinámicos (function-registry) mal configurados causarán errores en runtime.
Cooldown de retries (userRetryState) debe mantenerse para evitar loops costosos.
Timestamp fix en runs es crítico o se cancelarán todos los runs por error de cálculo.
Manejo de mensajes manuales (from_me) es vital para la sincronización con agentes.
Checklist Pre-Migración:
[ ] Verificar que todos los Maps/Sets (userRetryState, subscribedPresences, etc.) tengan estrategia de migración.
[ ] Confirmar que todos los timers (globalMessageBuffers) se manejen correctamente en módulos.
[ ] Asegurar que botSentMessages se migre para evitar self-loops.
[ ] Validar que el cleanup de temp files (/tmp/audio_*) funcione en la nueva arquitectura.
[ ] Probar que invalidateUserCaches funcione entre módulos para mantener consistencia.
[ ] Verificar que el sistema de locks (simpleLockManager) mantenga su integridad.
[ ] Migrar la lógica de subscribeToPresence para que siga activa en cada procesamiento.
[ ] Asegurar que analyzeImage se integre con el nuevo sistema de manejo de media.
[ ] Mantener la lógica de isQuoteOrPriceMessage para el fallback de voz a texto.
[ ] Probar el flujo completo de mensajes manuales (from_me: true).


::::::::::

AGREGADO NUEVO

De acuerdo. A continuación, se redactan las secciones faltantes y las mejoras sugeridas para ser integradas directamente en el documento **"Estado Actual del Sistema v2.0"**, completando así la documentación de manera exhaustiva.

-----

### **(Sección Nueva para Agregar al Documento)**

### ⚙️ Configuración y Variables de Entorno

El comportamiento del bot se controla a través de variables de entorno, que deben ser definidas en un archivo `.env` para desarrollo local o configuradas en el entorno de despliegue (e.g., Cloud Run).

| Variable | Descripción | Valor por Defecto/Ejemplo | Criticidad |
| :--- | :--- | :--- | :--- |
| `OPENAI_ASSISTANT_ID` | ID del Asistente de OpenAI que orquesta las respuestas y funciones. | `asst_xxxxxxxxxxxxxxxx` | **Crítica** |
| `WHAPI_API_URL` | URL base de la API de Whapi Cloud. | `https://gate.whapi.cloud` | **Crítica** |
| `WHAPI_TOKEN` | Token de autorización para la API de Whapi Cloud. | `xxxxxxxxxxxxxxxxxxxxxx` | **Crítica** |
| `ENABLE_VOICE_TRANSCRIPTION` | Si es `true`, las notas de voz se transcriben usando Whisper. | `true` | Alta |
| `ENABLE_VOICE_RESPONSES` | Si es `true`, el bot responderá con notas de voz si el último input del usuario fue por voz. | `true` | Media |
| `IMAGE_ANALYSIS_MODEL` | Modelo de OpenAI Vision a utilizar para el análisis de imágenes. | `gpt-4o-mini` | Media |
| `TERMINAL_LOGS_FUNCTIONS` | Si es `false`, se ocultan los logs detallados de ejecución de funciones en la terminal para reducir el ruido. | `true` | Baja |
| `NODE_ENV` | Define el entorno de ejecución. Afecta la carga de configuración. | `development` | Alta |
| `PORT` | Puerto en el que se ejecutará el servidor Express. | `3008` | Alta |

-----

### **(Sección Nueva para Agregar al Documento)**

### 🧪 Estrategia de Testing

Para garantizar la estabilidad y prevenir regresiones, el sistema está diseñado para ser testeable. Al final del archivo `app-unified.ts` se exportan funciones clave para poder ejecutar pruebas unitarias y de integración.

**Funciones Exportadas para Testing:**

  * `getShortUserId`, `cleanContactName`, `isQuoteOrPriceMessage`: Funciones utilitarias puras.
  * `getCachedChatInfo`, `invalidateUserCaches`: Para probar la lógica de cache.
  * `transcribeAudio`, `analyzeImage`: Para mockear las APIs de OpenAI y probar el manejo de media.
  * `processWebhook`: Para simular eventos de Whapi y probar el flujo de entrada completo.

**Framework Sugerido:** Se recomienda el uso de **Vitest** o **Jest** para la ejecución de tests. Las pruebas deben mockear las dependencias externas (OpenAI, Whapi, Beds24) para aislar la lógica interna del bot y validar su comportamiento de forma predecible.

-----

### **(Sección Actualizada para Reemplazar en el Documento)**

### 🚨 PROBLEMAS CONOCIDOS Y ESTRATEGIAS DE MITIGACIÓN

| Problema Conocido | Riesgo | Mitigación Propuesta para la Migración Modular |
| :--- | :--- | :--- |
| **Memory Leaks Potenciales** | Crecimiento indefinido de caches (`contextCache`, `globalUserStates`) y buffers puede causar crashes en entornos con memoria limitada como Cloud Run. | **Implementar límites estrictos** en todos los caches (e.g., `max: 1000` entradas) usando una librería como `lru-cache`. **Crear un módulo `CacheManager`** centralizado. |
| **Acumulación de Temp Files** | Si `fs.unlink()` falla silenciosamente (`.catch(()=>{})`), el disco en `/tmp/` se llenará con archivos de audio, causando un fallo del servicio. | **Crear un `cleanupService`** que se ejecute periódicamente (e.g., cada hora) y elimine todos los archivos en `/tmp/audio/` con más de 60 minutos de antigüedad. |
| **Persistencia No Escalable** | El uso de archivos JSON para `threadPersistence` causa I/O blocking y no permite escalar a múltiples instancias del bot. | **Migrar la persistencia a una base de datos externa**. **Redis** es ideal para la gestión de threads y estados volátiles con TTL. **Firestore/MongoDB** para una persistencia más robusta. |
| **Código Monolítico Inmantenible** | 3,779 líneas en un solo archivo dificultan el desarrollo, la depuración y la incorporación de nuevas funcionalidades. | **El objetivo principal de la migración**. Refactorizar el código en módulos por dominio: `webhook`, `openai`, `whatsapp`, `state`, `functions`, `core`, etc. |
| **API de Beds24 Inestable** | \~20% de timeouts sin un mecanismo de reintento automático, afectando directamente la experiencia del usuario al solicitar cotizaciones. | **Implementar un patrón de `Retry` con `Exponential Backoff`** para las llamadas a la API de Beds24. Añadir un **`Circuit Breaker`** para dejar de intentar si la API está caída. |
| **Procesamiento de Webhook sin Deduplicación** | Whapi puede enviar webhooks duplicados. Actualmente, el sistema los procesaría múltiples veces, generando respuestas y costos duplicados. | **Implementar un cache de IDs de mensajes procesados**. Antes de procesar un mensaje, verificar si su ID ya existe en un `Set` o `Cache` con un TTL de \~5 minutos. |
| **Loops en Validación de Respuestas** | El mecanismo de reintento con `correctiveMessage` es poderoso pero puede entrar en loops si la IA no logra corregir sus errores. | El `userRetryState` (1 reintento cada 5 min) es una buena mitigación. **Reforzarlo** asegurando que el `correctiveMessage` sea cada vez más específico o añadiendo un contador global para desactivar reintentos si falla repetidamente. |

-----

### **(Sección Actualizada para Reemplazar en el Documento)**

### 🏨 FUNCIONALIDADES ESPECÍFICAS DE HOTELERÍA

... (contenido existente) ...

### 🔌 INTEGRACIONES EXTERNAS

... (contenido existente) ...

### 🛠️ SISTEMAS AUXILIARES

... (contenido existente) ...

### **(Sección Nueva para Agregar al Documento)**

### 📊 Diagramas de Flujo del Sistema

#### Flujo 1: Sincronización de Mensajes Manuales (`from_me: true`)

Este flujo es crítico para mantener el contexto del Asistente cuando un agente humano interviene en la conversación.

```ascii
[Agente envía msg en WhatsApp]
           |
           v
[POST /hook] -> (from_me: true, NO es de botSentMessages)
           |
           v
[globalMessageBuffers] -> (Agrupa mensajes del agente por 5s)
           |
           v
[Timer expira] -> (Procesa buffer del agente)
           |
           +-------------------------------------------------------------+
           |                                                             |
           v                                                             v
[OpenAI API] -> threads.messages.create()           [OpenAI API] -> threads.messages.create()
  (Paso 1: Añadir contexto del sistema)               (Paso 2: Añadir msg real como 'assistant')
  - role: 'user'                                      - role: 'assistant'
  - content: "[Mensaje manual de Agente]"             - content: "El texto combinado del agente..."
           |
           +----------------------+
                                  |
                                  v
[threadPersistence] -> (Actualiza lastActivity)
           |
           v
[Log: MANUAL_SYNC_SUCCESS]
```

#### Flujo 2: Ciclo de Procesamiento Principal con Function Calling

```ascii
[processCombinedMessage] -> (Adquiere lock, entra a la cola)
           |
           v
[processWithOpenAI] -> (startRequestTracing, getRelevantContext)
           |
           v
[OpenAI API] -> runs.create()
           |
           v
[Polling de Run] -- (status: 'in_progress') --> [Loop]
           |
 (status: 'requires_action')
           |
           v
[Ejecutar Tools] -> executeFunction('check_availability', ...)
           |
           v
[OpenAI API] -> submitToolOutputs()
           |
           v
[Polling Post-Tool] -- (status: 'in_progress') --> [Loop]
           |
  (status: 'completed')
           |
           v
[Obtener Respuesta] -> validateAndCorrectResponse()
           |
           +-- (needsRetry: true) --> [Crear correctiveMessage y re-ejecutar Run]
           |
 (needsRetry: false)
           |
           v
[sendWhatsAppMessage] -> (Enviar respuesta final al usuario)
           |
           v
[endRequestTracing] -> (Guardar métricas y logs)
```

::::::::::::::::::::::::::::::::::



# 📸 Estado Actual del Sistema

*Snapshot exacto de cómo funciona el bot ahora, basado en app-unified.ts de 3,779 líneas al 27 de Julio 2025*

---

## 🔍 **ARCHIVO PRINCIPAL: app-unified.ts**

### **Estadísticas:**
- **Líneas**: 3,779
- **Funciones principales**: ~80+ (incluyendo helpers inline y async functions)
- **Imports**: 30+ módulos (incluyendo obsoletos comentados para registro)
- **Variables globales**: 25+ (Maps, Sets, constantes y objetos para estado, caches y buffers)
- **Endpoints**: 12+ rutas Express (7 principales + dashboard routes + métricas)

### **Estructura Actual (3,779 líneas):**

```typescript
// IMPORTS (líneas ~1-150)
import "dotenv/config"; // Configuración de entorno
import express, { Request, Response } from 'express'; // Servidor web
import http from 'http'; // Creación de servidor HTTP
import OpenAI from 'openai'; // Cliente OpenAI para Assistant API, TTS, Whisper
import levenshtein from 'fast-levenshtein'; // Distancia de strings (usado en validateAndCorrectResponse)
import path from 'path'; // Manejo de rutas de archivos (temp audio)
import fs from 'fs/promises'; // Operaciones asíncronas de archivos (audio temporal)

// Configuración y utilidades
import { AppConfig, loadAndValidateConfig, logEnvironmentConfig } from './config/environment.js';
import { getConfig } from './config/environment'; // Obsoleto, comentado

// Sistema de logging (~20 funciones)
import {
    logInfo, logSuccess, logError, logWarning, logDebug, logFatal, logAlert,
    // Obsoletos comentados pero importados:
    logMessageReceived, logOpenAIRequest, logOpenAIResponse,
    logFunctionCallingStart, logFunctionExecuting, logFunctionHandler,
    logThreadCreated, logServerStart, logOpenAIUsage, logOpenAILatency,
    logFallbackTriggered, logPerformanceMetrics,
    // Nuevas funciones de tracing:
    logRequestTracing, logToolOutputsSubmitted, logAssistantNoResponse,
    startRequestTracing, updateRequestStage, registerToolCall,
    updateToolCallStatus, endRequestTracing
} from './utils/logging/index.js';

// Persistencia y memoria
import { threadPersistence } from './utils/persistence/index.js';
import { guestMemory } from './utils/persistence/index.js'; // Obsoleto pero importado

// APIs y utilidades externas
import { whapiLabels } from './utils/whapi/index.js';
import type { UserState } from './utils/userStateManager.js';
import { botDashboard } from './utils/monitoring/dashboard.js';
import { validateAndCorrectResponse } from './utils/response-validator.js';

// Métricas y routing
import metricsRouter, { 
    incrementFallbacks, 
    setTokensUsed, 
    setLatency, 
    incrementMessages 
} from './routes/metrics.js';

// Context y caches
import { cleanupExpiredCaches, getCacheStats } from './utils/context/historyInjection.js';

// Sistema de locks
import { simpleLockManager } from './utils/simpleLockManager.js';

// Function registry (importado dinámicamente en processWithOpenAI)
// import { executeFunction } from './functions/registry/function-registry.js';

// VARIABLES GLOBALES (líneas ~150-400)
let appConfig: AppConfig; // Configuración cargada (entorno, secrets)
let openaiClient: OpenAI; // Cliente OpenAI inicializado
let server: http.Server; // Servidor HTTP
let isServerInitialized = false; // Flag de inicialización

// Sistema de logs limpios para terminal
const terminalLog = {
    message: (user: string, text: string) => {...}, // Log mensaje usuario
    typing: (user: string) => {...}, // Log typing
    processing: (user: string) => {...}, // Log procesando (eliminado)
    response: (user: string, text: string, duration: number) => {...}, // Log respuesta
    error: (message: string) => {...}, // Error general
    openaiError: (user: string, error: string) => {...}, // Error OpenAI
    imageError: (user: string, error: string) => {...}, // Error imagen
    voiceError: (user: string, error: string) => {...}, // Error voz
    functionError: (functionName: string, error: string) => {...}, // Error función
    whapiError: (operation: string, error: string) => {...}, // Error WHAPI
    functionStart: (name: string, args?: any) => {...}, // Inicio función
    functionProgress: (name: string, step: string, data?: any) => {...}, // Progreso
    functionCompleted: (name: string, result?: any, duration?: number) => {...}, // Completado
    startup: () => {...}, // Log inicio sistema
    newConversation: (user: string) => {...}, // Nueva conversación
    image: (user: string) => {...}, // Imagen recibida
    voice: (user: string) => {...}, // Voz recibida
    recording: (user: string) => {...}, // Grabando
    availabilityResult: (completas: number, splits: number, duration?: number) => {...}, // Resultados Beds24
    externalApi: (service: string, action: string, result?: string) => {...} // APIs externas
};

// Rate limiting y control
const webhookCounts = new Map<string, { lastLog: number; count: number }>(); // Rate limiting logs webhooks
const typingLogTimestamps = new Map<string, number>(); // Rate limiting typing logs (5s)

// Caches con TTL
const chatInfoCache = new Map<string, { data: any; timestamp: number }>(); // Cache info chats
const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const contextCache = new Map<string, { context: string, timestamp: number }>(); // Cache contexto temporal
const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Control de configuración
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false'; // Logs functions en terminal

// Estados y procesamiento
const activeProcessing = new Set<string>(); // Usuarios en procesamiento activo

// Buffer unificado de mensajes
const globalMessageBuffers = new Map<string, {
    messages: string[],
    chatId: string,
    userName: string,
    lastActivity: number,
    timer: NodeJS.Timeout | null,
    currentDelay?: number // Delay actual del timer para comparaciones
}>();
const BUFFER_WINDOW_MS = 5000; // 5 segundos para agrupar mensajes normales
const TYPING_EXTENDED_MS = 10000; // 10 segundos cuando usuario está escribiendo/grabando

// Media y mensajes
const pendingImages = new Map<string, string[]>(); // URLs imágenes pendientes por usuario
const botSentMessages = new Set<string>(); // IDs de mensajes enviados por bot (evitar self-loops)
const globalUserStates = new Map<string, UserState>(); // Estados de usuario completos

// Control de retries y validación
const userRetryState = new Map<string, { retryCount: number; lastRetryTime: number }>(); // Control retries (evitar loops)

// Constantes
const MAX_MESSAGE_LENGTH = 5000; // Límite longitud mensajes

// Tipos para WHAPI
interface WHAPIMediaLink {
    link?: string;
    id?: string;
    mime_type?: string;
    file_size?: number;
}

interface WHAPIMessage {
    id: string;
    type: string;
    audio?: WHAPIMediaLink;
    voice?: WHAPIMediaLink;
    ptt?: WHAPIMediaLink;
    image?: WHAPIMediaLink;
}

interface WHAPIError {
    error?: {
        code: number;
        message: string;
        details?: string;
    };
}

// FUNCIONES UTILITARIAS (líneas ~400-2500)

// Helpers básicos
function getTimestamp(): string {...} // Helper para timestamps ISO
function getShortUserId(jid: string): string {...} // Extrae ID corto de JID
function cleanContactName(rawName: any): string {...} // Limpia nombres de contactos

// Gestión de estados
function getOrCreateUserState(userId: string, chatId?: string, userName?: string): UserState {...}
async function getCachedChatInfo(userId: string): Promise<any> {...} // Con cache 5min
function invalidateUserCaches(userId: string): void {...} // Invalida caches al cambiar datos

// Transcripción y audio
async function transcribeAudio(
    audioUrl: string | undefined, 
    userId: string, 
    userName?: string, 
    messageId?: string
): Promise<string> {...} // Whisper con temp files y cleanup

// Sistema de locks
async function acquireThreadLock(userId: string): Promise<boolean> {...} // Via simpleLockManager
function releaseThreadLock(userId: string): void {...}

// Buffer y procesamiento
function addToGlobalBuffer(
    userId: string, 
    messageText: string, 
    chatId: string, 
    userName: string, 
    isVoice: boolean = false
): void {...} // Agrega con límite 50 msgs

function setIntelligentTimer(
    userId: string, 
    chatId: string, 
    userName: string, 
    triggerType: 'message' | 'voice' | 'typing' | 'recording'
): void {...} // Timer dinámico 5-10s

async function processGlobalBuffer(userId: string): Promise<void> {...} // Procesa con locks

// Indicadores y detección
async function sendRecordingIndicator(chatId: string): Promise<void> {...} // Presencia "recording"
async function sendTypingIndicator(chatId: string): Promise<void> {...} // Presencia "typing"
function isQuoteOrPriceMessage(message: string): boolean {...} // Detecta sensibles ($/COP/enlaces)

// Envío de mensajes
async function sendWhatsAppMessage(chatId: string, message: string): Promise<boolean> {...} 
// Incluye: voice response si lastInputVoice, fallback texto si sensible, división párrafos

// OpenAI utilities
async function cleanupOldRuns(threadId: string, userId: string): Promise<number> {...} // >10min
async function isRunActive(userId: string): Promise<boolean> {...} // Con cleanup previo
async function recoverOrphanedRuns(): Promise<void> {...} // Al boot, cancela todos

// Cache temporal
let precomputedContextBase: { date: string; time: string; timestamp: number } | null = null;
const CONTEXT_BASE_CACHE_TTL = 60 * 1000; // 1 minuto
function getPrecomputedContextBase(): { date: string; time: string } {...}
async function getRelevantContext(userId: string, requestId?: string): Promise<string> {...}

// Procesamiento principal
let processCombinedMessage: (
    userId: string, 
    combinedText: string, 
    chatId: string, 
    userName: string, 
    messageCount: number
) => Promise<void>; // Definida en setupWebhooks

// SETUP Y CONFIGURACIÓN (líneas ~2500-3000)
function setupEndpoints(): void {...} // Configura todas las rutas Express
function setupSignalHandlers(): void {
    // Manejo de shutdown graceful
    const shutdown = (signal: string) => {
        logInfo('SHUTDOWN', `Señal ${signal} recibida`);
        
        // 1. Limpiar todos los timers de buffers
        for (const [userId, buffer] of globalMessageBuffers) {
            if (buffer.timer) clearTimeout(buffer.timer);
        }
        
        // 2. Cerrar servidor HTTP
        if (server) {
            server.close(() => {
                logSuccess('SHUTDOWN', 'Servidor cerrado');
                process.exit(0);
            });
        }
        
        // 3. Timeout forzado después de 5s
        setTimeout(() => {
            logWarning('SHUTDOWN', 'Cierre forzado por timeout');
            process.exit(1);
        }, 5000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
function setupWebhooks(): void {...} // Lógica webhook y processCombinedMessage
function initializeBot(): void {...} // Intervals, cleanups, recovery

// Procesamiento OpenAI principal
async function processWithOpenAI(
    userMsg: string, 
    userJid: string, 
    chatId: string = null, 
    userName: string = null, 
    requestId?: string
): Promise<string> {...} // Thread management, functions, polling, validación

// Procesamiento webhook
async function processWebhook(body: any): Promise<void> {...} // Messages, presences, manuales

// SERVIDOR EXPRESS (líneas ~3000-3500)
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/metrics', metricsRouter); // Métricas Prometheus (incrementFallbacks, setTokensUsed, setLatency, incrementMessages)

// setupEndpoints() configura:
app.get('/health', (req, res) => {...}); // Health check con stats
app.post('/hook', async (req: Request, res: Response) => {...}); 
// Webhook principal:
// - Responde 200 inmediatamente (evita timeout Whapi)
// - Procesa async en background
// - Filtra webhooks válidos: messages, presences, statuses, chats, contacts, groups, labels, calls, channel, users
// - Rate limiting para webhooks inválidos (1 log/min)
app.get('/', (req, res) => {...}); // Root con info bot
app.get('/locks', (req, res) => {...}); // Monitoreo locks
app.post('/locks/clear', (req, res) => {...}); // Limpia locks (solo dev)
app.get('/audio/:filename', async (req, res) => {...}); // Sirve audio temporal
// botDashboard.setupRoutes(app) configura:
// - /dashboard: UI principal
// - /dashboard/logs: Logs en tiempo real
// - /dashboard/stats: Estadísticas del sistema
// - /dashboard/api/logs: API para logs (WebSocket)

// MANEJADORES GLOBALES (líneas ~3500-3700)
process.on('uncaughtException', (error, origin) => {...}); // Log crítico + exit(1)
process.on('unhandledRejection', (reason, promise) => {...}); // Log crítico + exit(1)

// FUNCIÓN PRINCIPAL (líneas ~3700-3779)
const main = async () => {
    // 1. Logs iniciales (versión Node, memoria, entorno)
    // 2. loadAndValidateConfig() → appConfig
    // 3. logEnvironmentConfig()
    // 4. new OpenAI({ apiKey, timeout, maxRetries })
    // 5. setupEndpoints() → todas las rutas
    // 6. setupWebhooks() → lógica procesamiento
    // 7. http.createServer(app) → server.listen()
    // 8. initializeBot() → cleanups, intervals, recovery
    // 9. setupSignalHandlers() → shutdown graceful
    // 10. Catch: servidor mínimo si falla (puerto 8080)
};

main();
```

---

## 🔄 **FLUJO DE PROCESAMIENTO ACTUAL**

### **1. Recepción de Webhook (processWebhook):**
```
WhatsApp → Whapi → POST /hook → Respuesta 200 inmediata → processWebhook(body) async
                                                    ↓
                                    Validar body (messages/presences/event)
                                                    ↓
                    ┌─────────────────────────────────────────────────────────┐
                    │ PRESENCES (typing/recording):                           │
                    │ - Actualizar userState.lastTyping = Date.now()         │
                    │ - setIntelligentTimer(10s extended)                    │
                    │ - terminalLog.typing/recording (rate limited 5s)       │
                    │ - Si status online/offline: limpiar isCurrentlyRecording│
                    └─────────────────────────────────────────────────────────┘
                                                    ↓
                    ┌─────────────────────────────────────────────────────────┐
                    │ MESSAGES:                                               │
                    │ 1. Filtrar from_me:                                     │
                    │    - Si botSentMessages.has(id): skip                  │
                    │    - Si manual real: buffer especial + sync thread     │
                    │ 2. Por tipo:                                           │
                    │    - Voice: transcribeAudio → 🎤 + texto               │
                    │    - Image: pendingImages.set → 📷 Imagen recibida     │
                    │    - Text: 📝 + texto                                  │
                    │ 3. addToGlobalBuffer() con metadata                    │
                    │ 4. setIntelligentTimer (5-10s según tipo)             │
                    └─────────────────────────────────────────────────────────┘
```

### **2. Procesamiento de Buffer (processGlobalBuffer):**
```
Timer expira (5-10s) → processGlobalBuffer(userId)
                              ↓
        Verificar typing reciente (<10s) y msgs.length === 1
                              ↓ Si sí
                    Retrasar remainingTime (hasta 10s desde lastTyping)
                              ↓ Si no
                    Verificar activeProcessing.has(userId)
                              ↓ Si no
                    Marcar activeProcessing.add(userId)
                              ↓
                    Copiar mensajes y limpiar buffer.messages = []
                              ↓
                    Combinar mensajes con '\n'
                              ↓
                    processCombinedMessage(userId, combinedText, ...)
                              ↓
                    activeProcessing.delete(userId) en finally
```

### **3. Lógica de OpenAI (processCombinedMessage + processWithOpenAI):**
```
processCombinedMessage(userId, combinedText, ...)
                    ↓
        isRunActive() con cleanupOldRuns previo
                    ↓ Si active
        Retry hasta 3 veces (1s delay) o cancelar requires_action
                    ↓
        simpleLockManager.addToQueue(userId, messageId, data, processFunction)
                    ↓
        processFunction():
            ↓
        startRequestTracing(userId) → updateRequestStage('init')
            ↓
        getRelevantContext() si necesario:
            - Condiciones: 3h desde último, cambio nombre/labels, primer mensaje
            - Si cambio detectado → invalidateUserCaches(userId)
            - Genera contexto temporal con fecha/hora/cliente/labels
            ↓
        processWithOpenAI(combinedText, userId, chatId, userName, requestId)
            ├─ sendTypingIndicator() o sendRecordingIndicator()
            ├─ Crear/obtener thread (threadPersistence)
            ├─ Agregar mensaje con contexto temporal
            ├─ Adjuntar pendingImages si existen
            ├─ openaiClient.beta.threads.runs.create()
            ├─ Polling (1s interval, max 30 attempts, backoff en race conditions)
            ├─ Si completed: obtener respuesta
            ├─ Si requires_action:
            │   ├─ Mensaje interino si check_availability complejo
            │   ├─ executeFunction() para cada tool call
            │   │   └─ registerToolCall() → updateToolCallStatus()
            │   ├─ submitToolOutputs
            │   └─ Polling post-tool (500ms-5s backoff, max 10)
            ├─ validateAndCorrectResponse()
            │   └─ Si needsRetry: correctiveMessage + retry run (userRetryState)
            └─ Si context_length_exceeded: crear thread nuevo
                    ↓
        sendWhatsAppMessage(chatId, response)
            ├─ Si lastInputVoice && !sensible: TTS nova → voice message
            ├─ Si sensible (precios/enlaces): forzar texto
            └─ División inteligente en párrafos con typing_time
                    ↓
        endRequestTracing() + métricas (tokens, latency)
```

### **4. Flujos Especiales:**

#### **Mensajes Manuales (from_me: true):**
```
Webhook detecta from_me: true → Verificar NO es botSentMessages.has(id)
    ↓ Si es manual real
Buffer separado en globalMessageBuffers con key=chatId
    ↓
Timer 5s (BUFFER_WINDOW_MS) → Agrupar múltiples mensajes
    ↓
Procesar buffer:
    1. Crear mensaje de contexto:
       await threads.messages.create(threadId, {
         role: 'user',
         content: '[Mensaje manual de {agentName}]'
       })
    2. Agregar contenido real como assistant:
       await threads.messages.create(threadId, {
         role: 'assistant', 
         content: combinedMessage
       })
    ↓
threadPersistence.setThread() actualiza metadata
Log: MANUAL_SYNC_SUCCESS con preview y stats
```

#### **Media Handling:**
```
Voice → transcribeAudio():
    - Verificar audioUrl o fetch desde WHAPI usando messageId
    - Descargar audio con fetch → arrayBuffer
    - Crear temp file: path.join('tmp', `audio_${Date.now()}.ogg`)
    - fs.writeFile(tempPath, Buffer.from(audioBuffer))
    - createReadStream para OpenAI Whisper
    - OpenAI transcription con model='whisper-1', language='es'
    - fs.unlink(tempPath).catch(() => {}) // Ignorar error si falla
    - Retornar transcripción o 'No se pudo transcribir el audio'
    - Si error: terminalLog.voiceError(displayName, error.message)

Image → pendingImages:
    - Extraer URL de message.image?.link
    - Si no hay URL, fetch desde WHAPI similar a voice
    - pendingImages.get(userId).push(imageUrl)
    - Al procesar con OpenAI:
      content: [
        { type: "text", text: messageWithContext },
        { type: "image_url", image_url: { url: imageUrl }}
      ]
    - Limpiar pendingImages.delete(userId) post-uso
```

#### **Voice Responses con Fallback Inteligente:**
```
Si lastInputVoice === true && ENABLE_VOICE_RESPONSES === 'true':
    ↓
Verificar contenido sensible con isQuoteOrPriceMessage():
    - Regex patterns:
      /\$\d+[.,]?\d*/g              // $840.000
      /\d+[.,]?\d*\s*(cop|pesos?)/gi // 840000 COP
      /\d+\s*noches?/gi             // 4 noches
      /https?:\/\/\S+/i             // URLs
      /wa\.me\/p/i                  // Enlaces WhatsApp
    ↓ Si match → Forzar texto (shouldUseVoice = false)
    
Si shouldUseVoice:
    - OpenAI TTS: model='tts-1', voice='nova', max 4000 chars
    - Convertir response a arrayBuffer → Buffer → base64
    - Crear data URL: `data:audio/mp3;base64,${base64Audio}`
    - POST a Whapi /messages/voice con media: dataUrl
    - Si OK: limpiar userState.lastInputVoice = false
    - Si error: fallback a texto normal
    
Envío de texto (normal o fallback):
    - División inteligente por párrafos (\n\n+)
    - O por listas con bullets (•, -, *)
    - typing_time: 3s primer msg, 2s siguientes
    - Guardar en botSentMessages.add(responseId)
    - Auto-delete después de 10 min
```

### **5. Cleanup y Recovery:**

```
AL BOOT:
    - threadPersistence.initializeCleanup()
    - recoverOrphanedRuns() en background (5s delay)
        └─ Cancelar TODOS los runs activos

INTERVALS:
    - cleanupExpiredCaches() cada 10 min
    - Memory logs cada 5 min (alert si >300MB o >95% heap)
    - User states cleanup cada 1h (>24h inactivo)
    - Global buffer cleanup cada 10 min (>15 min inactivo)
    
SHUTDOWN (SIGTERM/SIGINT):
    - Clear todos los timers
    - server.close() con timeout 5s
    - Logs de shutdown detallados
```

### **6. Sistema de Tracing:**
```
startRequestTracing(userId) → requestId
    ↓
updateRequestStage(requestId, 'init'|'processing'|'function_calling'|'completed')
    ↓
registerToolCall(requestId, toolCallId, functionName, 'executing')
    ↓
updateToolCallStatus(requestId, toolCallId, 'success'|'error')
    ↓
endRequestTracing(requestId) → summary con duración total
```

---

## 🗄️ **DATOS QUE MANEJA**

### **En Memoria (Volátil con TTLs):**

```typescript
// BUFFERS Y ESTADOS
globalMessageBuffers: Map<string, {
    messages: string[],        // Hasta 50 msgs
    chatId: string,
    userName: string,
    lastActivity: number,      // Para cleanup >15min
    timer: NodeJS.Timeout | null,
    currentDelay?: number      // 5000ms normal, 10000ms si typing/recording activo
}>

globalUserStates: Map<string, UserState> {
    userId: string,
    isTyping: boolean,
    lastTypingTimestamp: number,
    lastMessageTimestamp: number,
    messages: string[],
    chatId: string,
    userName: string,
    typingEventsCount: number,
    averageTypingDuration: number,
    lastInputVoice: boolean,   // Para voice responses
    lastTyping: number,        // Último typing detectado
    isCurrentlyRecording?: boolean
}

// CACHES CON TTL
contextCache: Map<string, {    // TTL: 1 hora
    context: string,           // Contexto temporal formateado
    timestamp: number
}>

chatInfoCache: Map<string, {   // TTL: 5 minutos
    data: any,                 // Info de Whapi (name, labels)
    timestamp: number
}>

// CONTROL Y RATE LIMITING
activeProcessing: Set<string>  // Durante procesamiento

botSentMessages: Set<string>   // TTL: 10 minutos auto-delete
                              // IDs para evitar self-loops

userRetryState: Map<string, {  // Control retries validación
    retryCount: number,        // Max 1 retry
    lastRetryTime: number      // Cooldown 5 minutos
}>

pendingImages: Map<string, string[]>  // URLs por usuario
// Se adjuntan a OpenAI como content multimodal:
// [{ type: "text", text: msg }, { type: "image_url", image_url: { url } }]

webhookCounts: Map<string, {   // Rate limiting logs
    lastLog: number,
    count: number
}>

typingLogTimestamps: Map<string, number>  // Rate limit 5s

// CACHE TEMPORAL
precomputedContextBase: {      // TTL: 1 minuto
    date: string,
    time: string,
    timestamp: number
} | null
```

### **En Archivos JSON (Persistente):**

```json
// threads-data.json (via threadPersistence)
{
  "573001234567": {
    "threadId": "thread_abc123",
    "chatId": "573001234567@s.whatsapp.net",
    "userName": "Juan Pérez",
    "createdAt": "2025-07-27T10:30:00Z",
    "lastActivity": "2025-07-27T15:45:00Z",
    "name": "Juan Pérez",         // Para detectar cambios
    "labels": ["Consulta", "VIP"]  // Para detectar cambios
  }
}

// guest-memory.json (obsoleto pero aún importado)
{
  "573001234567": {
    "name": "Juan Pérez",
    "whapiLabels": [
      {"id": "1", "name": "Potencial"},
      {"id": "2", "name": "Consulta"}
    ],
    "lastInteraction": "2025-07-27T15:45:00Z"
  }
}
```

### **Archivos Temporales:**
```
/tmp/
├── audio_1234567890.ogg    // Transcripción Whisper (deleted post-uso)
├── audio_1234567891.mp3    // TTS output (deleted post-envío)
└── ...

⚠️ Riesgo: Si fs.unlink() falla, archivos se acumulan
Mitigación actual: .catch(() => {}) ignora errores
Problema: No hay cleanup periódico de /tmp/
```

---

## 🏨 **FUNCIONALIDADES ESPECÍFICAS DE HOTELERÍA**

### **Check Availability Function:**
```typescript
// Registrada en function-registry.js
{
    name: "check_availability",
    description: "Verificar disponibilidad y precios en el sistema",
    parameters: {
        type: "object",
        properties: {
            startDate: { type: "string", description: "YYYY-MM-DD" },
            endDate: { type: "string", description: "YYYY-MM-DD" },
            guests: { type: "number", default: 2 }
        }
    }
}

// Ejecución:
executeFunction("check_availability", args) →
    - Calcular noches
    - Llamar Beds24 API (JSON endpoint)
    - Parsear respuesta XML
    - Aplicar timezone America/Bogota
    - Formatear: completas (disponibles) + splits (alternativas)
    - terminalLog.availabilityResult(completas, splits, duration)
```

### **Labels Hoteleros:**
```typescript
// Via whapiLabels y getCachedChatInfo
Etiquetas disponibles: [
    'Potencial',      // Cliente interesado
    'Consulta',       // En proceso de cotización
    'Reservado',      // Confirmó reserva
    'VIP',           // Cliente especial
    'Check-in',      // En hotel
    'Check-out',     // Salió del hotel
    'Cancelado',     // Canceló reserva
    'Repetidor'      // Cliente recurrente
]
```

### **Contexto Temporal:**
```typescript
// Inyectado automáticamente cada 3h o al cambiar datos
`Fecha: 27/07/2025 | Hora: 10:30 AM (Colombia)
Cliente: Juan Pérez | Contacto WhatsApp: Juan | Status: Consulta, VIP
---
Mensaje del cliente:`
```

### **Validación y Corrección:**
- **Detección sensible**: Regex para $, COP, precios, URLs (fallback voice→text)
- **Validación respuestas**: levenshtein distance para discrepancias
- **Corrección**: Manual o retry automático con correctiveMessage
- **Timezone**: Todas las fechas/horas en America/Bogota

---

## ⚡ **PERFORMANCE ACTUAL**

### **Métricas Típicas:**
- **Tiempo respuesta promedio**: 3-8s (OpenAI 1-5s + Beds24 2-5s)
- **Memoria RAM**: 150-400MB (alertas >300MB, crítico >95% heap)
- **CPU**: 10-40% en picos (TTS/Whisper intensive)
- **Usuarios concurrentes**: 50-200 típico, máx 500
- **Requests/min**: 200-1000 (webhooks + API calls)
- **Tokens/request**: 500-3000 (alertas >2000)

### **Bottlenecks Identificados:**
1. **OpenAI Polling**: 1-3s base + backoff (puede llegar a 30s timeout)
2. **Beds24 API**: 2-5s típico, ~20% timeouts
3. **Transcripciones Audio**: 3-10s (descarga + Whisper + temp file)
4. **TTS Generation**: 2-5s para respuestas largas
5. **Memory Growth**: Caches sin límite estricto (mitigado con intervals)

### **Memory Leaks Potenciales:**
- **globalMessageBuffers**: Timers no cancelados en race conditions
- **contextCache/chatInfoCache**: Crecimiento sin límite máximo
- **globalUserStates**: Cleanup cada hora pero puede acumular
- **pendingImages**: No tiene TTL explícito
- **Temp files**: Si fs.unlink falla, acumulación en /tmp

---

## 🔌 **INTEGRACIONES EXTERNAS**

### **OpenAI Assistant API:**
```yaml
Endpoint: https://api.openai.com/v1
Assistant ID: process.env.OPENAI_ASSISTANT_ID
Models:
  - whisper-1: Transcripción audio (español)
  - tts-1: Text-to-speech (voice: nova)
  - gpt-4: Assistant principal
Functions disponibles:
  - check_availability
  - get_conversation_context
  - view_image
  - search_knowledge
Rate limits: 
  - Timeout: configurable en appConfig
  - Retries: configurable en appConfig
Manejo errores:
  - context_length_exceeded → Nuevo thread automático
  - Runs huérfanos → Cleanup automático
  - Race conditions → Backoff progresivo
```

### **Whapi Cloud:**
```yaml
Endpoint: ${WHAPI_API_URL} (e.g., https://gate.whapi.cloud/)
Token: ${WHAPI_TOKEN}
Endpoints usados:
  - /messages/text: Enviar mensajes texto
  - /messages/voice: Enviar notas de voz
  - /presences/{id}: Suscribir/actualizar presencia
  - /messages/{id}: Obtener info mensaje (media URLs)
  - /chats/{id}: Obtener info chat
Funcionalidades:
  - Labels management
  - Presences (typing, recording, online)
  - Media handling (images, voice)
Rate limits: No documentado
Webhooks: POST /hook
```

### **Beds24 API:**
```yaml
Endpoint: https://beds24.com/api/json/
Auth: 
  - apiKey: En secrets
  - propKey: En secrets
Endpoints:
  - getAvailabilities: Disponibilidad y precios
Response: XML (parseado a JSON)
Timezone: UTC → America/Bogota
Rate limits: No documentado
Timeouts: ~20% de requests
Formato respuesta:
  - roomId, units available
  - prices por noche
  - min stay requirements
```

---

## 🛠️ **SISTEMAS AUXILIARES**

### **Sistema de Logging (terminalLog):**
```typescript
// Objeto con ~20 métodos para logs limpios
terminalLog = {
    // Mensajes básicos
    message(user, text): "👤 user: text..."
    typing(user): "✍️ user está escribiendo..."
    response(user, text, duration): "🤖 OpenAI → user (Xs)"
    
    // Errores específicos
    error(message): "❌ Error: message"
    openaiError(user, error): "❌ Error enviar a OpenAI → user"
    imageError(user, error): "❌ Error al procesar imagen → user"
    voiceError(user, error): "❌ Error al procesar audio → user"
    functionError(name, error): "❌ Error en función name"
    whapiError(operation, error): "❌ Error WHAPI (operation)"
    
    // Function calling
    functionStart(name, args): "⚙️ name(args)"
    functionCompleted(name, result, duration): Log según función
    availabilityResult(completas, splits, duration): "🏠 X completas + Y alternativas (Xs)"
    
    // Sistema
    startup(): Clear + banner inicial
    newConversation(user): "📨 Nueva conversación con user"
    image(user): "📷 user: [Imagen recibida]"
    voice(user): "🎤 user: [Nota de voz recibida]"
    recording(user): "🎙️ user está grabando..."
    externalApi(service, action, result): "🔗 [timestamp] service → action"
}
```

### **Sistema de Locks (simpleLockManager):**
```typescript
// Sistema híbrido con locks y colas por usuario
Configuración:
    - Tipo: user-based (un lock por userId)
    - Timeout: 15 segundos (auto-release si no se libera)
    - Queue: habilitada (procesa en orden FIFO)
    - Auto-release: sí (previene deadlocks)
    - Concurrencia: 1 proceso por usuario a la vez
    
Métodos principales:
    - acquireUserLock(userId): Promise<boolean>
      └─ Intenta adquirir lock, retorna true si éxito
    - releaseUserLock(userId): void
      └─ Libera lock y procesa siguiente en cola
    - addToQueue(userId, messageId, data, processFunction): void
      └─ Agrega a cola si lock ocupado
    - processQueue(userId): Promise<void>
      └─ Procesa items en cola secuencialmente
    - hasActiveLock(userId): boolean
      └─ Verifica si usuario tiene lock activo
    - getStats(): {activeLocks: number, activeQueues: number}
      └─ Estadísticas del sistema
    - clearAll(): void
      └─ Limpia todos los locks (solo desarrollo)

Uso en el flujo:
    1. processCombinedMessage intenta acquireThreadLock
    2. Si ocupado → addToQueue con processFunction
    3. Al terminar → releaseThreadLock
    4. Auto-procesa siguiente en cola
```

### **Sistema de Tracing:**
```typescript
// Request lifecycle tracking
Funciones:
    - startRequestTracing(userId): string (requestId)
    - updateRequestStage(requestId, stage): void
    - registerToolCall(requestId, toolCallId, name, status): void
    - updateToolCallStatus(requestId, toolCallId, status): void
    - endRequestTracing(requestId): TracingSummary
    
Stages: init → processing → function_calling → post_tools_completed → completed
Tool status: executing → success|error
```

---

## 🚨 **PROBLEMAS CONOCIDOS**

### **Críticos:**
1. **Memory leaks sin mitigación completa**
   - Caches crecen indefinidamente si cleanup intervals fallan
   - Causa crashes en Cloud Run tras ~24h de uptime
   - contextCache/chatInfoCache sin límite máximo de entradas
   - globalUserStates puede acumular miles de usuarios
   - Mitigación actual: Restart diario manual

2. **Persistencia no escalable**
   - JSON files para threads (I/O blocking)
   - Pérdida de memoria/estados al reiniciar
   - No soporta múltiples instancias

3. **Código monolítico inmantenible**
   - 3,779 líneas en un archivo
   - Funciones dispersas sin organización clara
   - Imports obsoletos comentados por todas partes

4. **Runs huérfanos facturación extra**
   - Si cleanup falla, runs activos indefinidos
   - Costo adicional OpenAI (~$0.03/run abandonado)

### **Altos:**
1. **Beds24 API inestable**
   - ~20% timeouts sin retry automático
   - Afecta UX en cotizaciones
   - Sin circuit breaker

2. **Voice handling frágil**
   - Transcripciones fallan si no hay URL
   - TTS limitado a 4000 caracteres
   - Temp files pueden acumular si cleanup falla

3. **Validación puede causar loops**
   - userRetryState mitiga pero no elimina
   - Errores complejos no siempre corregibles
   - Puede agotar tokens rápidamente

4. **Webhook processing sin deduplicación**
   - Mensajes duplicados procesados múltiples veces
   - Rate limiting solo en logs, no en procesamiento

### **Medios:**
1. **Sin tests automatizados**
   - Cambios rompen flujos sin detección
   - Regresiones frecuentes en buffers/timers

2. **Logs excesivamente verbosos**
   - ~100 logs por request en modo debug
   - Dificulta debugging real en producción

3. **Métricas incompletas**
   - No tracking de memory leaks específicos
   - No histogramas de latencia
   - No alertas automáticas configuradas

4. **Configuración mezclada local/cloud**
   - Riesgo de usar config incorrecta
   - Secrets en .env no rotados

5. **Dashboard básico**
   - Solo logs en tiempo real
   - No históricos ni analytics
   - No filtros avanzados

---

## 📊 **MÉTRICAS Y MONITOREO**

### **Endpoints de Monitoreo:**
- `/health`: Status general + thread stats
- `/metrics`: Métricas Prometheus (fallbacks, tokens, latency)
- `/locks`: Estado del sistema de locks
- `/dashboard`: UI web con logs en tiempo real
- `/`: Info general del bot

### **Métricas Trackeadas:**
- Messages procesados (incrementMessages)
- Fallbacks OpenAI (incrementFallbacks)
- Tokens usados (setTokensUsed)
- Latencia requests (setLatency)
- Memory usage (cada 5min)
- Active threads/buffers

---

*Documento generado el 27 de Julio 2025 - Versión 1.0.0-unified-secure*

## 📝 **NOTA IMPORTANTE PARA MIGRACIÓN**

Este documento es crítico para la migración modular. Cualquier funcionalidad no documentada aquí corre el riesgo de perderse durante la refactorización. Verificar contra el código fuente completo antes de iniciar la migración.

### **Checklist Pre-Migración:**
- [ ] Verificar que todos los Maps/Sets tengan estrategia de migración
- [ ] Confirmar que todos los timers se manejen correctamente en módulos
- [ ] Asegurar que userRetryState y botSentMessages se migren para evitar loops
- [ ] Validar que el cleanup de temp files funcione en nueva arquitectura
- [ ] Probar que invalidateUserCaches funcione entre módulos
- [ ] Verificar que el sistema de locks mantenga su integridad

AGREGAR:

(Sección Nueva para Agregar al Documento, después de "🔍 ARCHIVO PRINCIPAL")
📦 Dependencias Principales (de package.json)
express: ^4.18.2
openai: ^4.0.0 (Assistant API v2 beta)
fast-levenshtein: ^2.0.6
fs/promises: Node built-in (v20+)
dotenv: ^16.0.0
... (lista completa; usar npm list --depth=0 para generar).
Dev: vitest/jest para testing (sugerido, no implementado).
Vulnerabilities: Ejecutar npm audit regularmente; actual ~5 low-severity en deps como express.
(Sección Nueva para Agregar al Documento, después de "⚡ PERFORMANCE ACTUAL")
🚀 Despliegue e Infraestructura
Entornos: Local (node app-unified.ts) + Cloud Run (Dockerized, auto-scale 0-100 instancias).
Config: Env vars via Cloud Secrets; limits: 1CPU/512MB RAM (noted memory leaks >300MB causan crashes).
CI/CD: Manual (git push); sugerido: GitHub Actions con tests + deploy.
Healthchecks: /health endpoint (200 OK con stats); Cloud Run usa para readiness.
Logs: Console + Cloud Logging; no structured export.
(Expansión de la Sección Existente "🧪 Estrategia de Testing")
Ejemplos de Tests (Vitest/Jest):

Unit: test('getShortUserId', () => { expect(getShortUserId('123@s.whatsapp.net')).toBe('123'); });
Integration: test('transcribeAudio', async () => { mockOpenAI(); expect(await transcribeAudio('url')).toContain('transcripción'); });
Cobertura Actual: 0% (sin tests); Meta: 80% en migración.
(Adición a "🏨 FUNCIONALIDADES ESPECÍFICAS DE HOTELERÍA")
UX Flows: Agente manual: Envía msg → Sync en 5s → OpenAI actualizado. Usuario: Voz → Transcribe → Responde voz (si no sensible).
Analytics: No implementado; sugerido: Track bookings via Beds24 + GA4 para conversiones.