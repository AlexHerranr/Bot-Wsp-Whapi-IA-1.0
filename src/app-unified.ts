/**
 * TeAlquilamos Bot - Versión Unificada
 * Un código, múltiples entornos (Local + Cloud Run)
 * 
 * @docs: Sistema de configuración automática implementado
 * @change: "Configuración unificada para local y Cloud Run"
 * @date: 2025-01-XX
 * @author: Alexander - TeAlquilamos
 */

import "dotenv/config";
import express, { Request, Response } from 'express';
import http from 'http';
import OpenAI from 'openai';
import levenshtein from 'fast-levenshtein';

// Importar sistema de configuración unificada
import { 
    AppConfig,
    loadAndValidateConfig, 
    logEnvironmentConfig
} from './config/environment.js';

// Importar utilidades existentes
import {
    logInfo,
    logSuccess,
    logError,
    logWarning,
    logDebug,
    logMessageReceived,
    logMessageProcess,
    logWhatsAppSend,
    logWhatsAppChunksComplete,
    logOpenAIRequest,
    logOpenAIResponse,
    logFunctionCallingStart,
    logFunctionExecuting,
    logFunctionHandler,
    logBeds24Request,
    logBeds24ApiCall,
    logBeds24ResponseDetail,
    logBeds24Processing,
    logThreadCreated,
    logThreadPersist,
    logThreadCleanup,
    logServerStart,
    logBotReady,
    logContextTokens,
    logOpenAIUsage,
    logOpenAILatency,
    logFallbackTriggered,
    logPerformanceMetrics,
    // 🔧 ETAPA 3: Nuevas funciones de tracing
    logRequestTracing,
    logToolOutputsSubmitted,
    logAssistantNoResponse,
    logFlowStageUpdate,
    startRequestTracing,
    updateRequestStage,
    registerToolCall,
    updateToolCallStatus,
    endRequestTracing
} from './utils/logging/index.js';
import { threadPersistence } from './utils/persistence/index.js';
import { getChatHistory } from './utils/whapi/index';
import { guestMemory } from './utils/persistence/index';
import { whapiLabels } from './utils/whapi/index';
import { getConfig } from './config/environment';

// Importar sistema de monitoreo
import { botDashboard } from './utils/monitoring/dashboard.js';
import metricsRouter, { 
    incrementFallbacks, 
    setTokensUsed, 
    setLatency, 
    incrementMessages, 
    updateActiveThreads 
} from './routes/metrics.js';

// Importar nuevo módulo modularizado de inyección de historial/contexto
import { injectHistory, cleanupExpiredCaches, getCacheStats } from './utils/context/historyInjection.js';

// Importar nuevo sistema de locks simplificado
import { simpleLockManager } from './utils/simpleLockManager.js';

// --- Variables Globales ---
let appConfig: AppConfig;
let openaiClient: OpenAI;
let server: http.Server;
let isServerInitialized = false;

const activeRuns = new Map<string, { id: string; status: string; startTime: number; userId: string }>();
const userMessageBuffers = new Map<string, {
    messages: string[],
    chatId: string,
    name: string,
    lastActivity: number
}>();
const userActivityTimers = new Map<string, NodeJS.Timeout>();
const userTypingState = new Map();
const botSentMessages = new Set<string>();
const manualMessageBuffers = new Map<string, {
    messages: string[],
    agentName: string,
    timestamp: number
}>();
const manualTimers = new Map<string, NodeJS.Timeout>();

// 🔧 NUEVO: Sistema de buffering proactivo global
const globalMessageBuffers = new Map<string, {
    messages: string[],
    chatId: string,
    userName: string,
    lastActivity: number,
    timer: NodeJS.Timeout | null,
    isTyping: boolean,
    typingCount: number
}>();
const BUFFER_WINDOW_MS = 8000; // 8 segundos para agrupar mensajes (mejorado para párrafos largos)
const TYPING_EXTENSION_MS = 5000; // 5 segundos extra por typing (más generoso)
const MAX_TYPING_COUNT = 8; // Máximo 8 typings antes de forzar procesamiento (más humano)

    // 🔧 ETAPA 2: Cache de historial para optimizar fetches
    const historyCache = new Map<string, { history: string; timestamp: number }>();
    const HISTORY_CACHE_TTL = 60 * 60 * 1000; // 1 hora en ms
    const HISTORY_CACHE_MAX_SIZE = 50; // 🔧 MEJORADO: Límite de tamaño

    // 🔧 ETAPA 3: Cache de inyección de contexto relevante (TTL 1 min)
    const contextInjectionCache = new Map<string, { context: string; timestamp: number }>();
    const CONTEXT_INJECTION_TTL = 60 * 1000; // 1 minuto
    const CONTEXT_CACHE_MAX_SIZE = 30; // 🔧 MEJORADO: Límite de tamaño

// 🔧 NUEVO: Sistema de typing dinámico
// Configuración de timeouts optimizada para mejor UX
const FALLBACK_TIMEOUT = 2000; // 2 segundos si no hay typing detectable (más rápido)
const POST_TYPING_DELAY = 3000; // 3 segundos después de que deje de escribir (más natural)
const MAX_BUFFER_SIZE = 10; // Límite máximo de mensajes por buffer (anti-spam)
const MAX_BOT_MESSAGES = 1000;
const MAX_MESSAGE_LENGTH = 5000;



// 🔧 NUEVO: Sistema de locks simplificado con colas
async function acquireThreadLock(userId: string): Promise<boolean> {
    return await simpleLockManager.acquireUserLock(userId);
}

function releaseThreadLock(userId: string): void {
    simpleLockManager.releaseUserLock(userId);
}

// 🔧 ETAPA 2: Función para generar resumen automático de historial (del comentario externo)
async function generateHistorialSummary(threadId: string, userId: string): Promise<boolean> {
    try {
        logInfo('HISTORIAL_SUMMARY_START', 'Iniciando generación de resumen de historial', {
            threadId,
            userId
        });
        
        // Obtener mensajes del thread (últimos 50 para análisis)
        const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 50 });
        
        if (messages.data.length < 10) {
            logInfo('HISTORIAL_SUMMARY_SKIP', 'Thread muy corto, no necesita resumen', {
                threadId,
                userId,
                messageCount: messages.data.length
            });
            return false;
        }
        
        // Calcular tokens estimados
        const estimatedTokens = messages.data.reduce((acc, msg) => {
            const content = msg.content[0];
            if (content && content.type === 'text' && 'text' in content) {
                return acc + Math.ceil((content.text?.value?.length || 0) / 4);
            }
            return acc;
        }, 0);
        
        // 🔧 SIMPLIFICADO: Solo generar resumen si hay muchos mensajes (no por tokens)
        const MESSAGE_THRESHOLD = 50; // Generar resumen si hay más de 50 mensajes
        
        if (messages.data.length <= MESSAGE_THRESHOLD) {
            logInfo('HISTORIAL_SUMMARY_SKIP', 'Thread corto, no necesita resumen', {
                threadId,
                userId,
                messageCount: messages.data.length,
                threshold: MESSAGE_THRESHOLD
            });
            return false;
        }
        
        logWarning('HISTORIAL_SUMMARY_NEEDED', 'Thread largo, generando resumen', {
            threadId,
            userId,
            messageCount: messages.data.length,
            threshold: MESSAGE_THRESHOLD
        });
        
        // Crear texto de conversación para resumen
        const conversationText = messages.data
            .reverse() // Ordenar cronológicamente
            .map(msg => {
                const content = msg.content[0];
                if (content && content.type === 'text' && 'text' in content) {
                    const role = msg.role === 'user' ? 'Cliente' : 'Asistente';
                    return `${role}: ${content.text.value}`;
                }
                return null;
            })
            .filter(Boolean)
            .join('\n\n');
        
        // Generar resumen usando modelo global configurado
        const summaryResponse = await openaiClient.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4', // Usar modelo global (revertido)
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente especializado en crear resúmenes concisos de conversaciones de WhatsApp para un bot de reservas hoteleras.
                    
                    Tu tarea es crear un resumen que capture:
                    1. El propósito principal de la conversación
                    2. Información clave del cliente (preferencias, fechas, etc.)
                    3. Estado actual de la consulta/reserva
                    4. Cualquier información importante para continuar la conversación
                    
                    El resumen debe ser:
                    - Máximo 200 palabras
                    - En español
                    - Estructurado y fácil de leer
                    - Mantener solo información relevante para el negocio`
                },
                {
                    role: 'user',
                    content: `Genera un resumen de esta conversación:\n\n${conversationText}`
                }
            ],
            max_tokens: 200,
            temperature: 0.3
        });
        
        const summary = summaryResponse.choices[0]?.message?.content || 'Error generando resumen';
        
        // Agregar resumen como mensaje del sistema
        await openaiClient.beta.threads.messages.create(threadId, {
            role: 'user',
            content: `RESUMEN DE CONVERSACIÓN ANTERIOR:\n\n${summary}\n\n--- CONTINUAR CONVERSACIÓN ---`
        });
        
        // 🔧 ETAPA 2: Poda de mensajes antiguos (mantener últimos 20)
        const messagesToDelete = messages.data.slice(20);
        let deletedCount = 0;
        
        for (const msg of messagesToDelete) {
            try {
                await openaiClient.beta.threads.messages.del(threadId, msg.id);
                deletedCount++;
            } catch (deleteError) {
                logWarning('HISTORIAL_SUMMARY_DELETE_ERROR', 'Error eliminando mensaje antiguo', {
                    threadId,
                    userId,
                    messageId: msg.id,
                    error: deleteError.message
                });
            }
        }
        
        logSuccess('HISTORIAL_SUMMARY_COMPLETE', 'Resumen de historial generado y mensajes podados', {
            threadId,
            userId,
            originalTokens: estimatedTokens,
            summaryLength: summary.length,
            messagesDeleted: deletedCount,
            messagesKept: 20,
            reductionPercentage: Math.round(((estimatedTokens - (summary.length / 4)) / estimatedTokens) * 100)
        });
        
        return true;
        
    } catch (error) {
        logError('HISTORIAL_SUMMARY_ERROR', 'Error generando resumen de historial', {
            threadId,
            userId,
            error: error.message
        });
        return false;
    }
}

// --- Aplicación Express ---
const app = express();
app.use(express.json());
app.use('/metrics', metricsRouter);

// --- Función Principal Asíncrona ---
const main = async () => {
    try {
        console.log('\n🚀 Iniciando TeAlquilamos Bot...');
        appConfig = await loadAndValidateConfig();
        console.log('✅ Configuración y secretos cargados.');
        
        logEnvironmentConfig();
        
        // 🔧 ARREGLO: Inicializar cleanup de threads después de cargar configuración
        threadPersistence.initializeCleanup();
        
        const { secrets } = appConfig;

        openaiClient = new OpenAI({ 
            apiKey: secrets.OPENAI_API_KEY,
            timeout: appConfig.openaiTimeout,
            maxRetries: appConfig.openaiRetries
        });
        
        console.log(`🤖 OpenAI configurado (timeout: ${appConfig.openaiTimeout}ms, retries: ${appConfig.openaiRetries})`);

        // Configurar endpoints y lógica del bot
        setupEndpoints();
        setupWebhooks();

        // Crear e iniciar servidor
        server = http.createServer(app);
        server.listen(appConfig.port, appConfig.host, () => {
            console.log(`🚀 Servidor HTTP iniciado en ${appConfig.host}:${appConfig.port}`);
            console.log(`🔗 Webhook URL: ${appConfig.webhookUrl}`);
            
            logServerStart('Servidor HTTP iniciado', { 
                host: appConfig.host,
                port: appConfig.port,
                environment: appConfig.environment,
                webhookUrl: appConfig.webhookUrl
            });
            
            initializeBot();
        });

        setupSignalHandlers();

    } catch (error: any) {
        console.error('❌ Error fatal durante la inicialización:', error.message);
        process.exit(1);
    }
};

// --- Manejadores de Errores Globales ---
process.on('uncaughtException', (error, origin) => {
    console.error(JSON.stringify({
        level: 'CRITICAL',
        category: 'SYSTEM_CRASH',
        message: `⛔ Excepción no capturada: ${error.message}`,
        details: { error: { message: error.message, stack: error.stack }, origin }
    }, null, 2));
    
    // 🔧 ETAPA 1: Log detallado antes de salir
    try {
        logError('SYSTEM_CRASH', 'Excepción no capturada causando crash', {
            error: error.message,
            origin,
            stack: error.stack
        });
    } catch (logError) {
        // 🔧 ETAPA 1: Capturar errores en logging para evitar crash doble
        console.error('[ERROR] LOG_ERROR:', logError.message);
    }
    
    // 🔧 ETAPA 1: Delay más largo para permitir logs
    setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error(JSON.stringify({
        level: 'CRITICAL',
        category: 'SYSTEM_CRASH',
        message: `⛔ Rechazo de promesa no manejado: ${error.message}`,
        details: { error: { message: error.message, stack: error.stack }, promise }
    }, null, 2));
    
    // 🔧 ETAPA 1: Log detallado antes de salir
    try {
        logError('SYSTEM_CRASH', 'Rechazo de promesa no manejado causando crash', {
            error: error.message,
            promise: promise.toString(),
            stack: error.stack
        });
    } catch (logError) {
        // 🔧 ETAPA 1: Capturar errores en logging para evitar crash doble
        console.error('[ERROR] LOG_ERROR:', logError.message);
    }
    
    // 🔧 ETAPA 1: Delay más largo para permitir logs
    setTimeout(() => process.exit(1), 2000);
});

// --- Declaración de Funciones Auxiliares ---

function setupEndpoints() {
    app.get('/health', (req, res) => {
        const stats = threadPersistence.getStats();
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: appConfig.environment,
            port: appConfig.port,
            initialized: isServerInitialized,
            activeBuffers: userMessageBuffers.size,
            threadStats: stats,
            // 🔧 ETAPA 1: Información adicional de threads para debug
            threadInfo: {
                totalThreads: stats.totalThreads,
                activeThreads: stats.activeThreads,
                inactiveThreads: stats.totalThreads - stats.activeThreads,
                lastCleanup: new Date().toISOString()
            },
            // 🔧 ETAPA 2: Información del cache de historial
            historyCache: {
                size: historyCache.size,
                ttlMinutes: Math.round(HISTORY_CACHE_TTL / 1000 / 60),
                sampleEntries: Array.from(historyCache.entries()).slice(0, 3).map(([userId, entry]) => ({
                    userId: userId.substring(0, 8) + '...',
                    ageMinutes: Math.round((Date.now() - entry.timestamp) / 1000 / 60),
                    historyLines: entry.history.split('\n').length
                }))
            },

            // 🔧 ETAPA 2: Información de flujo híbrido
            hybridFlow: {
                enabled: true,
                features: [
                    "Detección de disponibilidad incompleta",
                    "Análisis de contexto condicional", 
                    "Inyección inteligente de contexto",
                    "Buffering inteligente para detalles"
                ],
                contextKeywords: [
                    'antes', 'dijiste', 'hablamos', 'recuerdas', 'mencionaste', 
                    'cotizaste', 'precio', 'fechas', 'disponibilidad', 'apartamento',
                    'habitación', 'reserva', 'booking', 'anterior', 'pasado'
                ],
                availabilityPatterns: [
                    "Detección de personas (\\d+ personas?)",
                    "Detección de fechas (DD/MM/YYYY, del X al Y)",
                    "Detección de propiedades (1722, 715, 1317)"
                ],
                description: "Flujo híbrido que combina respuestas fijas con OpenAI según complejidad"
            },

            // 🔧 NUEVO: Información del sistema de locks simplificado
            simpleLockSystem: {
                enabled: true,
                type: "user-based-locks-with-queues",
                timeoutSeconds: 15,
                features: [
                    "Locks por usuario (no por mensaje)",
                    "Sistema de colas para procesamiento ordenado",
                    "Timeout automático de 15 segundos",
                    "Liberación automática al terminar"
                ],
                stats: simpleLockManager.getStats(),
                description: "Sistema híbrido que combina simplicidad del proyecto antiguo con robustez del actual"
            }
        });
    });

    app.get('/', (req, res) => {
        const stats = threadPersistence.getStats();
        res.json({
            service: 'TeAlquilamos Bot',
            version: '1.0.0-unified-secure',
            environment: appConfig.environment,
            status: isServerInitialized ? 'ready' : 'initializing',
            webhookUrl: appConfig.webhookUrl,
            threads: stats
        });
    });

    // 🔧 NUEVO: Endpoint para monitorear el sistema de locks
    app.get('/locks', (req, res) => {
        const stats = simpleLockManager.getStats();
        res.json({
            system: 'SimpleLockManager',
            timestamp: new Date().toISOString(),
            environment: appConfig.environment,
            stats: {
                activeLocks: stats.activeLocks,
                activeQueues: stats.activeQueues,
                totalUsers: stats.activeLocks + stats.activeQueues
            },
            configuration: {
                timeoutSeconds: 15,
                lockType: 'user-based',
                queueEnabled: true,
                autoRelease: true
            },
            description: 'Sistema híbrido de locks con colas - combina simplicidad y robustez'
        });
    });

    // 🔧 NUEVO: Endpoint para limpiar locks (solo en desarrollo)
    app.post('/locks/clear', (req: Request, res: Response) => {
        if (appConfig.environment === 'cloud-run') {
            return res.status(403).json({
                error: 'No permitido en producción',
                message: 'Este endpoint solo está disponible en desarrollo'
            });
        }
        
        simpleLockManager.clearAll();
        res.json({
            message: 'Todos los locks y colas han sido limpiados',
            timestamp: new Date().toISOString()
        });
    });
    
    // Agrega más endpoints aquí si es necesario
}

function setupSignalHandlers() {
    const shutdown = (signal: string) => {
        console.log(`\n⏹️  Señal ${signal} recibida, cerrando servidor...`);
        if (appConfig) {
            logInfo('SHUTDOWN', `Señal ${signal} recibida`, { environment: appConfig.environment });
        }
        
        if (server) {
            server.close(() => {
                console.log('👋 Servidor cerrado correctamente');
                if (appConfig) {
                    logSuccess('SHUTDOWN', 'Servidor cerrado exitosamente', { environment: appConfig.environment });
                }
                process.exit(0);
            });
        } else {
            process.exit(0);
        }

        setTimeout(() => {
            logWarning('SHUTDOWN', 'Cierre forzado por timeout', { environment: appConfig ? appConfig.environment : 'unknown' });
            process.exit(1);
        }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

// ... (El resto de las funciones como initializeBot, setupWebhooks, processWithOpenAI, etc. se definen aquí)
// No es necesario moverlas todas, solo asegurarse de que no se llamen antes de que `main` inicialice `appConfig`.

// --- El resto del código de la aplicación (lógica de webhook, etc.) ---
// Esta es una versión abreviada, el código completo se aplicará.
// Por ejemplo, `setupWebhooks` y sus funciones anidadas:

function setupWebhooks() {
    // El código de setupWebhooks va aquí.
    // Puede acceder a 'appConfig' y 'openaiClient' porque son variables globales
    // y esta función se llama DESPUÉS de que se inicializan en 'main'.
    const { secrets } = appConfig;

    // Función para obtener ID corto de usuario
    const getShortUserId = (jid: string): string => {
        if (typeof jid === 'string') {
            const cleaned = jid.split('@')[0] || jid;
            return cleaned;
        }
        return 'unknown';
    };

    // Función para limpiar nombre de contacto
    const cleanContactName = (rawName: any): string => {
        if (!rawName || typeof rawName !== 'string') return 'Usuario';
        
        let cleaned = rawName
            .trim()
            .replace(/\s*-\s*$/, '')
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\u00C0-\u017F]/g, '')
            .trim();
        
        if (!cleaned) return 'Usuario';
        
        cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
        
        return cleaned;
    };
    
    // 🔧 NUEVO: Función para suscribirse a presencia de usuario
    const subscribedPresences = new Set<string>(); // Rastrea usuarios suscritos
    
    // 🔧 NUEVO: Funciones para buffering proactivo global
    function addToGlobalBuffer(userId: string, messageText: string, chatId: string, userName: string): void {
        let buffer = globalMessageBuffers.get(userId);
        
        if (!buffer) {
            buffer = {
                messages: [],
                chatId,
                userName,
                lastActivity: Date.now(),
                timer: null,
                isTyping: false,
                typingCount: 0
            };
            globalMessageBuffers.set(userId, buffer);
        }
        
        // Agregar mensaje al buffer
        buffer.messages.push(messageText);
        buffer.lastActivity = Date.now();
        
        // Limpiar timer existente
        if (buffer.timer) {
            clearTimeout(buffer.timer);
        }
        
        // Configurar nuevo timer
        const delay = buffer.isTyping ? TYPING_EXTENSION_MS : BUFFER_WINDOW_MS;
        buffer.timer = setTimeout(() => processGlobalBuffer(userId), delay);
        
        // Log mejorado con delay real
        console.log(`📥 [BUFFER] ${userName}: "${messageText.substring(0, 30)}..." → ⏳ ${delay / 1000}s...`);
        
        logInfo('GLOBAL_BUFFER_ADD', `Mensaje agregado al buffer global`, {
            userJid: getShortUserId(userId),
            userName,
            messageText: messageText.substring(0, 50) + '...',
            bufferSize: buffer.messages.length,
            delay,
            isTyping: buffer.isTyping,
            environment: appConfig.environment
        });
    }
    
    function updateTypingStatus(userId: string, isTyping: boolean): void {
        const buffer = globalMessageBuffers.get(userId);
        if (!buffer) return;
        
        buffer.isTyping = isTyping;
        
        if (isTyping) {
            buffer.typingCount++;
            
            // Limpiar timer existente
            if (buffer.timer) {
                clearTimeout(buffer.timer);
            }
            
            // 🔧 ETAPA 2: Chequeo de buffer largo por typing (>60s)
            if (buffer.typingCount > 12 && buffer.messages.length > 3) { // ~60s de typing (1 minuto máximo)
                logInfo('BUFFER_LONG_TYPING', `Buffer largo detectado durante typing, procesando parcialmente`, {
                    userJid: getShortUserId(userId),
                    userName: buffer.userName,
                    typingCount: buffer.typingCount,
                    messageCount: buffer.messages.length,
                    environment: appConfig.environment
                });
                
                // Procesar buffer parcial para evitar esperas largas
                processGlobalBuffer(userId);
                return;
            }
            
            // Acumular extensiones dinámicamente y forzar procesamiento si typingCount > MAX_TYPING_COUNT
            const extraDelay = buffer.typingCount * TYPING_EXTENSION_MS; // Acumular por typing
            const delay = BUFFER_WINDOW_MS + Math.min(extraDelay, TYPING_EXTENSION_MS * MAX_TYPING_COUNT); // Cap a 3 typings max
            
            buffer.timer = setTimeout(() => processGlobalBuffer(userId), delay);
            
            logInfo('GLOBAL_BUFFER_TYPING', `Timer extendido por typing`, {
                userJid: getShortUserId(userId),
                userName: buffer.userName,
                typingCount: buffer.typingCount,
                delay,
                environment: appConfig.environment
            });
        } else {
            // Reset typing count cuando deja de escribir
            buffer.typingCount = 0;
            
            // Reiniciar timer con delay base
            if (buffer.timer) {
                clearTimeout(buffer.timer);
            }
            buffer.timer = setTimeout(() => processGlobalBuffer(userId), BUFFER_WINDOW_MS);
        }
    }
    
    async function processGlobalBuffer(userId: string): Promise<void> {
        const buffer = globalMessageBuffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            globalMessageBuffers.delete(userId);
            return;
        }
        
        // 🔧 ETAPA 1: Filtrar mensajes cortos/incompletos antes de concatenar (relajado)
        const ALLOWED_SHORT = ['si', 'ok', 'vale', 'gracias', 'yes', 'no', 'bueno', 'claro'];
        
        const filteredMessages = buffer.messages.filter(msg => {
            const cleanMsg = msg.trim();
            
            // 🔧 ETAPA 1: Permitir confirmaciones cortas comunes
            if (cleanMsg.length < 3 && ALLOWED_SHORT.includes(cleanMsg.toLowerCase())) {
                logDebug('BUFFER_ALLOW_SHORT', `Confirmación corta permitida`, {
                    userJid: getShortUserId(userId),
                    message: cleanMsg,
                    length: cleanMsg.length
                });
                return true;
            }
            
            // Ignorar mensajes muy cortos (menos de 3 caracteres) que no son confirmaciones
            if (cleanMsg.length < 3) {
                logDebug('BUFFER_FILTER_SHORT', `Mensaje muy corto filtrado`, {
                    userJid: getShortUserId(userId),
                    message: cleanMsg,
                    length: cleanMsg.length
                });
                return false;
            }
            
            // Ignorar patrones de ruido como "m", "mm", "mmm"
            if (/^m+$/i.test(cleanMsg)) {
                logDebug('BUFFER_FILTER_NOISE', `Patrón de ruido filtrado`, {
                    userJid: getShortUserId(userId),
                    message: cleanMsg
                });
                return false;
            }
            
            // Ignorar mensajes que solo contienen puntos suspensivos
            if (/^\.{2,}$/.test(cleanMsg)) {
                logDebug('BUFFER_FILTER_ELLIPSIS', `Puntos suspensivos filtrados`, {
                    userJid: getShortUserId(userId),
                    message: cleanMsg
                });
                return false;
            }
            
            return true;
        });
        
        // Si no quedan mensajes válidos después del filtrado, limpiar buffer
        if (filteredMessages.length === 0) {
            logInfo('BUFFER_EMPTY_AFTER_FILTER', `Buffer vacío después de filtrado`, {
                userJid: getShortUserId(userId),
                userName: buffer.userName,
                originalCount: buffer.messages.length
            });
            globalMessageBuffers.delete(userId);
            return;
        }
        
        // 🔧 ETAPA 1: Mejorar concatenación con limpieza de espacios
        const combinedText = filteredMessages
            .join(' ')
            .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
            .trim();
        
        const messageCount = filteredMessages.length;
        const originalCount = buffer.messages.length;
        
        // 🔧 CRÍTICO: Validar mensajes cortos durante typing
        const hasShortMessages = filteredMessages.some(msg => msg.length <= 3);
        const isTypingActive = buffer.isTyping;
        
        if (hasShortMessages && isTypingActive && messageCount < 3) {
            logWarning('PREMATURE_PROCESSING_DETECTED', 'Procesamiento prematuro de mensajes cortos durante typing', {
                userJid: getShortUserId(userId),
                userName: buffer.userName,
                messageCount,
                hasShortMessages,
                isTypingActive,
                combinedText: combinedText.substring(0, 50) + '...',
                environment: appConfig.environment
            });
            
            console.log(`⏳ [BUFFER_WAIT] ${buffer.userName}: Mensajes cortos durante typing → Esperando 2s extra...`);
            
            // Esperar 2 segundos extra antes de procesar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verificar si llegaron más mensajes durante la espera
            const updatedBuffer = globalMessageBuffers.get(userId);
            if (updatedBuffer && updatedBuffer.messages.length > originalCount) {
                logInfo('BUFFER_UPDATED_DURING_WAIT', 'Buffer actualizado durante espera, procesando versión actualizada', {
                    userJid: getShortUserId(userId),
                    originalCount,
                    newCount: updatedBuffer.messages.length,
                    environment: appConfig.environment
                });
                
                // Continuar con el buffer actualizado
                return;
            }
        }
        
        // Log mejorado para procesamiento de buffer con información de filtrado
        console.log(`🔄 [BUFFER_PROCESS] ${buffer.userName}: ${messageCount}/${originalCount} mensajes → "${combinedText.substring(0, 40)}..."`);
        
        logInfo('GLOBAL_BUFFER_PROCESS', `Procesando buffer global con filtrado`, {
            userJid: getShortUserId(userId),
            userName: buffer.userName,
            originalCount,
            filteredCount: messageCount,
            filteredOut: originalCount - messageCount,
            combinedText: combinedText.substring(0, 100) + '...',
            hasShortMessages,
            isTypingActive,
            environment: appConfig.environment
        });
        
        // Limpiar buffer
        globalMessageBuffers.delete(userId);
        
        // Procesar mensaje combinado
        await processCombinedMessage(userId, combinedText, buffer.chatId, buffer.userName, messageCount);
    }
    
    // 🔧 ETAPA 1: Función para limpiar runs huérfanos automáticamente
    async function cleanupOldRuns(threadId: string, userId: string): Promise<number> {
        try {
            const runs = await openaiClient.beta.threads.runs.list(threadId, { limit: 10 });
            let cancelledCount = 0;
            
            for (const run of runs.data) {
                // Cancelar runs que están en estado activo por más de 5 minutos
                if (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                    const runAge = Date.now() - new Date(run.created_at).getTime();
                    const fiveMinutes = 5 * 60 * 1000;
                    
                    if (runAge > fiveMinutes) {
                        try {
                            await openaiClient.beta.threads.runs.cancel(threadId, run.id);
                            cancelledCount++;
                            
                            logWarning('OLD_RUN_CANCELLED', `Run huérfano cancelado automáticamente`, {
                                userId: getShortUserId(userId),
                                threadId,
                                runId: run.id,
                                status: run.status,
                                ageMinutes: Math.round(runAge / 1000 / 60)
                            });
                        } catch (cancelError) {
                            logError('OLD_RUN_CANCEL_ERROR', `Error cancelando run huérfano`, {
                                userId: getShortUserId(userId),
                                threadId,
                                runId: run.id,
                                error: cancelError.message
                            });
                        }
                    }
                }
            }
            
            if (cancelledCount > 0) {
                logInfo('OLD_RUNS_CLEANUP', `Cleanup automático completado`, {
                    userId: getShortUserId(userId),
                    threadId,
                    runsCancelled: cancelledCount
                });
            }
            
            return cancelledCount;
        } catch (error) {
            logError('OLD_RUNS_CLEANUP_ERROR', `Error en cleanup de runs huérfanos`, {
                userId: getShortUserId(userId),
                threadId,
                error: error.message
            });
            return 0;
        }
    }

    // 🔧 NUEVA FUNCIÓN: Verificar si hay runs activos para un usuario
    async function isRunActive(userId: string): Promise<boolean> {
        try {
            const shortUserId = getShortUserId(userId);
            const threadRecord = threadPersistence.getThread(shortUserId);
            
            if (!threadRecord) {
                return false; // No hay thread, no hay runs activos
            }
            
            // 🔧 ETAPA 1: Limpiar runs huérfanos antes de verificar
            await cleanupOldRuns(threadRecord.threadId, shortUserId);
            
            const runs = await openaiClient.beta.threads.runs.list(threadRecord.threadId, { limit: 5 });
            const activeRuns = runs.data.filter(r => 
                ['queued', 'in_progress', 'requires_action'].includes(r.status)
            );
            
            if (activeRuns.length > 0) {
                logWarning('ACTIVE_RUN_DETECTED', `Run activo detectado para ${shortUserId}`, {
                    shortUserId,
                    threadId: threadRecord.threadId,
                    activeRuns: activeRuns.map(r => ({ id: r.id, status: r.status })),
                    environment: appConfig.environment
                });
                return true;
            }
            
            return false;
        } catch (error) {
            logError('RUN_CHECK_ERROR', `Error verificando runs activos para ${userId}`, {
                userId: getShortUserId(userId),
                error: error.message,
                environment: appConfig.environment
            });
            return false; // En caso de error, asumir que no hay runs activos
        }
    }

    async function processCombinedMessage(userId: string, combinedText: string, chatId: string, userName: string, messageCount: number): Promise<void> {
        
        
        // 🔧 NUEVO: Usar sistema de colas en lugar de procesamiento directo
        const shortUserId = getShortUserId(userId);
        
        // Crear función de procesamiento para la cola
        const processFunction = async () => {
            // 🔧 NUEVO: Verificar y manejar runs activos de manera más inteligente
            const threadRecord = threadPersistence.getThread(shortUserId);
            if (threadRecord) {
                try {
                    const runs = await openaiClient.beta.threads.runs.list(threadRecord.threadId, { limit: 5 });
                    const activeRuns = runs.data.filter(r => 
                        ['queued', 'in_progress', 'requires_action'].includes(r.status)
                    );
                    
                    if (activeRuns.length > 0) {
                        // 🔧 NUEVO: Si hay un run en requires_action, intentar procesarlo
                        const requiresActionRun = activeRuns.find(r => r.status === 'requires_action');
                        if (requiresActionRun) {
                            logInfo('RUN_REQUIRES_ACTION', `Procesando run en requires_action para ${userName}`, {
                                userJid: shortUserId,
                                runId: requiresActionRun.id,
                                environment: appConfig.environment
                            });
                            
                            // Intentar procesar el run que requiere acción
                            try {
                                // Aquí podrías agregar lógica para procesar tool calls si es necesario
                                // Por ahora, cancelamos el run para permitir nuevo procesamiento
                                await openaiClient.beta.threads.runs.cancel(threadRecord.threadId, requiresActionRun.id);
                                logInfo('RUN_CANCELLED', `Run cancelado para permitir nuevo procesamiento`, {
                                    userJid: shortUserId,
                                    runId: requiresActionRun.id,
                                    environment: appConfig.environment
                                });
                            } catch (cancelError) {
                                logWarning('RUN_CANCEL_ERROR', `Error cancelando run`, {
                                    userJid: shortUserId,
                                    runId: requiresActionRun.id,
                                    error: cancelError.message,
                                    environment: appConfig.environment
                                });
                            }
                        } else {
                            // Run en progreso normal, saltar procesamiento
                            logWarning('BUFFER_PROCESS_SKIPPED', `Procesamiento de buffer saltado - run activo para ${userName}`, {
                                userJid: shortUserId,
                                messageCount,
                                combinedText: cleanText.substring(0, 50) + '...',
                                environment: appConfig.environment
                            });
                            console.log(`⏸️ [BUFFER_SKIP] ${userName}: Run activo → Saltando procesamiento`);
                            return;
                        }
                    }
                } catch (error) {
                    logError('RUN_CHECK_ERROR', `Error verificando runs para ${userName}`, {
                        userJid: shortUserId,
                        error: error.message,
                        environment: appConfig.environment
                    });
                }
            }

            // Todo mensaje relevante va directo a OpenAI
            const response = await processWithOpenAI(combinedText, userId, chatId, userName);
            await sendWhatsAppMessage(chatId, response);
        };
        
        // 🔧 NUEVO: Agregar a la cola del usuario
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        simpleLockManager.addToQueue(shortUserId, messageId, { combinedText, chatId, userName }, processFunction);
        
        // 🔧 NUEVO: Procesar la cola si no hay lock activo
        if (!simpleLockManager.hasActiveLock(shortUserId)) {
            await simpleLockManager.processQueue(shortUserId);
        }
    }
    
    async function subscribeToPresence(userId: string): Promise<void> {
        if (subscribedPresences.has(userId)) {
            logDebug('PRESENCE_ALREADY_SUBSCRIBED', `Ya suscrito a presencia de ${userId}`, {
                userId,
                environment: appConfig.environment
            });
            return; // Ya suscrito
        }
        
        try {
            // Suscribirse a presencia del usuario (sin body)
            const response = await fetch(`${appConfig.secrets.WHAPI_API_URL}/presences/${userId}`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`
                }
                // Sin body - solo suscripción
            });
            
            if (response.ok) {
                subscribedPresences.add(userId);
                logSuccess('PRESENCE_SUBSCRIBE', `Suscrito a presences para ${userId}`, {
                    userId,
                    environment: appConfig.environment
                });
            } else if (response.status === 409) {
                // Ya suscrito - agregar al set para evitar futuros intentos
                subscribedPresences.add(userId);
                logInfo('PRESENCE_ALREADY_SUBSCRIBED_API', `Usuario ${userId} ya suscrito (409)`, {
                    userId,
                    status: response.status,
                    environment: appConfig.environment
                });
            } else {
                const errorText = await response.text();
                logError('PRESENCE_SUBSCRIBE_ERROR', `Error suscribiendo a ${userId}`, { 
                    userId,
                    status: response.status,
                    error: errorText,
                    environment: appConfig.environment
                });
            }
        } catch (error: any) {
            logError('PRESENCE_SUBSCRIBE_FAIL', `Fallo de red suscribiendo a ${userId}`, { 
                userId,
                error: error.message,
                environment: appConfig.environment
            });
        }
    }

    // 🔧 ETAPA 2: Funciones para Flujo Híbrido
    
    // Función para detectar si una consulta de disponibilidad está completa
    function isAvailabilityComplete(messageText: string): boolean {
        const hasPeople = /\d+\s*(personas?|gente|huespedes?)/i.test(messageText);
        const hasDates = /\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|del\s+\d+|\d+\s+al\s+\d+/i.test(messageText);
        const hasSpecificProperty = /apartamento|habitación|propiedad|1722|715|1317/i.test(messageText);
        
        return hasPeople && hasDates;
    }

    // Función para analizar si necesita inyección de contexto
    function analyzeForContextInjection(messages: string[], requestId?: string): { needsInjection: boolean; matchPercentage: number; reason: string } {
        if (messages.length === 0) {
            return { needsInjection: false, matchPercentage: 0, reason: 'no_messages' };
        }
        
        const lastMessage = messages[messages.length - 1].toLowerCase();
        
        // 🔧 ETAPA 3: Keywords expandidas con fuzzy matching
        const expandedKeywords = [
            // Referencias temporales
            'antes', 'dijiste', 'hablamos', 'recuerdas', 'mencionaste', 'anterior', 'pasado', 'previo',
            // Referencias a conversación previa
            'reinicio', 'reiniciaste', 'error', 'problema', 'no respondiste', 'se cortó', 'se corto', 'no respondiste',
            // Referencias a servicios
            'cotizaste', 'precio', 'fechas', 'disponibilidad', 'apartamento', 'habitación', 'reserva', 'booking',
            // Referencias a propiedades
            '1722', '715', '1317', 'apartamento', 'casa', 'propiedad',
            // 🔧 ETAPA 3: Nuevas keywords del comentario externo
            'confirmación', 'confirmacion', 'cotización', 'cotizacion', 'historial', 'reserva', 'anterior'
        ];
        
        // 🔧 ETAPA 3: Análisis con fuzzy matching
        let foundKeywords = [];
        let totalScore = 0;
        let fuzzyMatches = 0;
        
        for (const keyword of expandedKeywords) {
            // Match exacto
            if (lastMessage.includes(keyword)) {
                foundKeywords.push(keyword);
                totalScore += 1;
            } else {
                // 🔧 ETAPA 3: Fuzzy matching con tolerance de 3 caracteres
                const distance = levenshtein.get(lastMessage, keyword);
                const tolerance = 3;
                
                if (distance <= tolerance) {
                    foundKeywords.push(`${keyword} (fuzzy:${distance})`);
                    totalScore += 0.8; // Score reducido para fuzzy matches
                    fuzzyMatches++;
                    
                    logInfo('FUZZY_CONTEXT_MATCH', `Fuzzy match encontrado para contexto`, {
                        keyword,
                        distance,
                        tolerance,
                        originalMessage: lastMessage.substring(0, 50) + '...',
                        requestId
                    });
                    
                    // 🔧 ETAPA 3: Incrementar métrica de fuzzy hits
                    try {
                        const { incrementFuzzyHits } = require('./routes/metrics');
                        incrementFuzzyHits();
                    } catch (e) { 
                        // Ignorar en test/local si no existe
                        logDebug('FUZZY_METRIC_ERROR', 'No se pudo incrementar métrica fuzzy', { error: e.message });
                    }
                }
            }
        }
        
        // 🔧 ETAPA 3: Dynamic threshold mejorado
        const messageLength = lastMessage.length;
        let dynamicThreshold = 5; // Base 5% (reducido de 10%)
        
        if (messageLength < 30) {
            dynamicThreshold = 8; // Mensajes cortos, threshold más alto (reducido de 15%)
        } else if (messageLength > 100) {
            dynamicThreshold = 3; // Mensajes largos, threshold más bajo (reducido de 8%)
        }
        
        // 🔧 ETAPA 3: Bonus por palabras clave específicas
        const highValueKeywords = ['reinicio', 'error', 'antes', 'dijiste', 'cotizaste', 'confirmación', 'historial'];
        const highValueMatches = foundKeywords.filter(kw => highValueKeywords.some(hvk => kw.includes(hvk)));
        totalScore += highValueMatches.length * 0.5; // Bonus extra
        
        const matchPercentage = (totalScore / expandedKeywords.length) * 100;
        const needsInjection = matchPercentage >= dynamicThreshold;
        
        const reason = needsInjection 
            ? `context_keywords_found_${foundKeywords.length}_fuzzy_${fuzzyMatches}_score_${totalScore.toFixed(1)}`
            : `insufficient_context_${matchPercentage.toFixed(1)}%_threshold_${dynamicThreshold}%`;
        
        // Log del análisis
        logInfo('CONTEXT_ANALYSIS', 'Análisis de inyección de contexto completado', {
            lastMessage: lastMessage.substring(0, 50) + '...',
            foundKeywords,
            highValueMatches,
            fuzzyMatches,
            totalScore: totalScore.toFixed(1),
            matchPercentage: matchPercentage.toFixed(1),
            dynamicThreshold: dynamicThreshold.toFixed(1),
            needsInjection,
            reason,
            requestId
        });
        
        return { needsInjection, matchPercentage, reason };
    }

    // Función para obtener contexto relevante del historial
    async function getRelevantContext(userId: string, requestId?: string): Promise<string> {
        // --- ETAPA 3: Revisar cache antes de calcular ---
        const cached = contextInjectionCache.get(userId);
        if (cached && (Date.now() - cached.timestamp < CONTEXT_INJECTION_TTL)) {
            logInfo('CONTEXT_CACHE_HIT', 'Usando contexto relevante cacheado', {
                userId: getShortUserId(userId),
                ageMs: Date.now() - cached.timestamp,
                requestId
            });
            return cached.context;
        }
        try {
            // Obtener perfil del usuario (incluye etiquetas)
            const profile = await guestMemory.getOrCreateProfile(userId);
            // Obtener información del chat desde Whapi
            const chatInfo = await whapiLabels.getChatInfo(userId);
            let context = '';
            if (profile.labels && profile.labels.length > 0) {
                context += `=== CONTEXTO DEL CLIENTE ===\n`;
                context += `Etiquetas: ${profile.labels.join(', ')}\n`;
                context += `Última actividad: ${new Date(profile.lastActivity).toLocaleString('es-ES')}\n`;
            }
            if (chatInfo && chatInfo.labels) {
                context += `Etiquetas actuales: ${chatInfo.labels.map((l: any) => l.name).join(', ')}\n`;
            }
            context += `=== FIN CONTEXTO ===\n\n`;
            // --- ETAPA 3: Guardar en cache ---
            contextInjectionCache.set(userId, { context, timestamp: Date.now() });
            logInfo('CONTEXT_CACHE_STORE', 'Contexto relevante guardado en cache', {
                userId: getShortUserId(userId),
                contextLength: context.length,
                requestId
            });
            logInfo('CONTEXT_INJECTION', 'Contexto relevante obtenido', {
                userId: getShortUserId(userId),
                contextLength: context.length,
                hasProfile: !!profile,
                hasChatInfo: !!chatInfo,
                requestId
            });
            return context;
        } catch (error) {
            logError('CONTEXT_INJECTION_ERROR', 'Error obteniendo contexto relevante', {
                userId: getShortUserId(userId),
                error: error.message,
                requestId
            });
            return '';
        }
    }

    // 🔧 NUEVO: Función para procesar mensajes agrupados con sistema de colas
    async function processUserMessages(userId: string) {
        const buffer = userMessageBuffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            logWarning('MESSAGE_PROCESS', `Buffer vacío o inexistente para ${getShortUserId(userId)}`);
            return;
        }

        const shortUserId = getShortUserId(userId);
        
        // 🔧 NUEVO: Crear función de procesamiento para la cola
        const processFunction = async () => {
            // 🔧 ETAPA 3: Iniciar tracing de request
            const requestId = startRequestTracing(shortUserId);
            
            // Asegurar agrupación efectiva
            let combinedMessage;
            if (buffer.messages.length > 1) {
                combinedMessage = buffer.messages.join('\n\n');
                logInfo('BUFFER_GROUPED', `Agrupados ${buffer.messages.length} msgs`, { 
                    userId: shortUserId,
                    requestId 
                });
            } else {
                combinedMessage = buffer.messages[0];
            }

            // 🔧 ETAPA 2: Análisis de Contexto y Disponibilidad
            const contextAnalysis = analyzeForContextInjection(buffer.messages, requestId);
            const isAvailabilityQuery = /disponibilidad|disponible|libre/i.test(combinedMessage);
            const hasCompleteAvailability = isAvailabilityQuery ? isAvailabilityComplete(combinedMessage) : true;
            
            // Log del análisis
            logInfo('HYBRID_ANALYSIS', 'Análisis híbrido completado', {
                userId: shortUserId,
                isAvailabilityQuery,
                hasCompleteAvailability,
                contextNeedsInjection: contextAnalysis.needsInjection,
                contextMatchPercentage: contextAnalysis.matchPercentage,
                requestId
            });

            // 🔧 ETAPA 2: Manejo de Disponibilidad Incompleta
            if (isAvailabilityQuery && !hasCompleteAvailability) {
                const availabilityResponse = "¡Claro! 😊 Para consultar disponibilidad necesito algunos detalles:\n\n" +
                    "• ¿Cuántas personas?\n" +
                    "• ¿Fechas de entrada y salida? (formato: DD/MM/YYYY)\n" +
                    "• ¿Algún apartamento específico? (1722-A, 715, 1317)\n\n" +
                    "Una vez me proporciones esta información, podré consultar la disponibilidad exacta para ti.";
                
                logInfo('AVAILABILITY_INCOMPLETE', 'Consulta de disponibilidad incompleta, solicitando detalles', {
                    userId: shortUserId,
                    messageLength: combinedMessage.length,
                    requestId
                });
                
                // Enviar respuesta y continuar buffering
                await sendWhatsAppMessage(buffer.chatId, availabilityResponse);
                
                // NO limpiar buffer - continuar esperando detalles
                return;
            }

            // --- ETAPA 3: Check temático para forzar syncIfNeeded ---
            const thematicKeywords = ["pasado", "reserva", "anterior", "previo", "historial", "cotización", "confirmación"];
            const thematicMatch = thematicKeywords.some(kw => combinedMessage.toLowerCase().includes(kw));
            const forceSync = thematicMatch;

            // Log de detección temática
            if (thematicMatch) {
                logInfo('THEMATIC_SYNC', 'Forzando syncIfNeeded por keyword temática', {
                    userId: shortUserId,
                    keywords: thematicKeywords.filter(kw => combinedMessage.toLowerCase().includes(kw)),
                    requestId
                });
                // Incrementar métrica de hits de patrones temáticos
                try {
                    const { patternHitsCounter } = require('./routes/metrics');
                    patternHitsCounter.inc();
                } catch (e) { /* ignorar en test/local */ }
            }

            // Sincronizar labels/perfil antes de procesar (forzar si match temático)
            await guestMemory.getOrCreateProfile(userId, forceSync);

            // 🔧 ETAPA 3: Actualizar etapa del flujo
            updateRequestStage(requestId, 'processing');

            logInfo('MESSAGE_PROCESS', `Procesando mensajes agrupados`, {
                userId,
                shortUserId,
                chatId: buffer.chatId,
                messageCount: buffer.messages.length,
                totalLength: combinedMessage.length,
                preview: combinedMessage.substring(0, 100) + '...',
                isAvailabilityQuery,
                contextNeedsInjection: contextAnalysis.needsInjection,
                environment: appConfig.environment,
                requestId
            });

            // Log compacto - Inicio
            console.log(`🤖 [BOT] ${buffer.messages.length} msgs → OpenAI`);
            
            // Enviar a OpenAI con el userId original y la información completa del cliente
            const startTime = Date.now();
            const response = await processWithOpenAI(combinedMessage, userId, buffer.chatId, buffer.name, requestId, contextAnalysis);
            const aiDuration = ((Date.now() - startTime) / 1000).toFixed(1);
            
            // Log mejorado con preview completo y duración real
            const preview = response.length > 50 ? response.substring(0, 50) + '...' : response;
            console.log(`✅ [BOT] Completado (${aiDuration}s) → 💬 "${preview}"`);
            
            // 🔧 ETAPA 2: Incrementar métrica de mensajes procesados
            incrementMessages();
            
            // Enviar respuesta a WhatsApp
            await sendWhatsAppMessage(buffer.chatId, response);

            // 🔧 ETAPA 3: Finalizar tracing y loggear resumen
            const tracingSummary = endRequestTracing(requestId);
            if (tracingSummary) {
                logRequestTracing('Request completado', {
                    ...tracingSummary,
                    responseLength: response.length,
                    aiDuration: parseFloat(aiDuration)
                });
            }

            // 🔧 ETAPA 2: Programar cleanup on-demand después de procesamiento exitoso
            scheduleCleanup();
            scheduleCacheCleanup();
            scheduleTokenCleanup();

            // Limpiar buffer, timer y estado de typing
            userMessageBuffers.delete(userId);
            if (userActivityTimers.has(userId)) {
                clearTimeout(userActivityTimers.get(userId)!);
                userActivityTimers.delete(userId);
            }
            userTypingState.delete(userId); // Limpiar estado de typing
        };
        
        // 🔧 NUEVO: Agregar a la cola del usuario
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        simpleLockManager.addToQueue(shortUserId, messageId, buffer, processFunction);
        
        // 🔧 NUEVO: Procesar la cola si no hay lock activo
        if (!simpleLockManager.hasActiveLock(shortUserId)) {
            await simpleLockManager.processQueue(shortUserId);
        }
    }

    // Función para envío de mensajes a WhatsApp
    async function sendWhatsAppMessage(chatId: string, message: string) {
        const shortUserId = getShortUserId(chatId);
        
        // 🔧 NUEVO: No enviar mensajes vacíos
        if (!message || message.trim() === '') {
            logInfo('WHATSAPP_SKIP_EMPTY', `Saltando envío de mensaje vacío para ${shortUserId}`, {
                chatId,
                messageLength: message?.length || 0,
                environment: appConfig.environment
            });
            return true; // Retornar true para no generar error
        }
        
        try {
            logInfo('WHATSAPP_SEND', `Enviando mensaje a ${shortUserId}`, { 
                chatId,
                messageLength: message.length,
                preview: message.substring(0, 100) + '...',
                environment: appConfig.environment
            });
            
            const response = await fetch(`${secrets.WHAPI_API_URL}/messages/text`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${secrets.WHAPI_TOKEN}`
                },
                body: JSON.stringify({
                    to: chatId,
                    body: message,
                    typing_time: message.includes('🔄') || message.includes('📊') ? 5 : 3 // Extender typing para tool responses
                })
            });
            
            if (response.ok) {
                const result = await response.json() as any;
                
                // Tracking del mensaje del bot
                if (result.sent && result.message?.id) {
                    botSentMessages.add(result.message.id);
                    
                    // Limpiar después de 10 minutos
                    setTimeout(() => {
                        botSentMessages.delete(result.message.id);
                    }, 10 * 60 * 1000);
                }
                
                logSuccess('WHATSAPP_SEND', `Mensaje enviado exitosamente`, {
                    shortUserId: shortUserId,
                    messageLength: message.length,
                    messageId: result.message?.id,
                    environment: appConfig.environment
                });
                return true;
            } else {
                const errorText = await response.text();
                logError('WHATSAPP_SEND', `Error enviando mensaje a ${shortUserId}`, { 
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                    environment: appConfig.environment
                });
                return false;
            }
        } catch (error) {
            logError('WHATSAPP_SEND', `Error de red enviando a ${shortUserId}`, { 
                error: error.message,
                environment: appConfig.environment
            });
            return false;
        }
    }

    // 🔧 NUEVO: Función principal de procesamiento con OpenAI (sin manejo de locks)
    const processWithOpenAI = async (userMsg: string, userJid: string, chatId: string = null, userName: string = null, requestId?: string, contextAnalysis?: { needsInjection: boolean; matchPercentage: number; reason: string }): Promise<string> => {
        const shortUserId = getShortUserId(userJid);
        
        // 🔧 ETAPA 1: Tracking de métricas de performance
        const startTime = Date.now();
        let contextTokens = 0;
        let totalTokens = 0;
        let historyInjection = '';
        let labelsStr = '';
        
        try {
            // 🔧 ETAPA 3: Actualizar etapa del flujo si hay requestId (solo en debug)
            if (requestId && process.env.DETAILED_LOGS === 'true') {
                updateRequestStage(requestId, 'openai_start');
            }
            
            logOpenAIRequest('starting_process', { 
                shortUserId,
                requestId 
            });
             
            const config = getConfig();
             
            // Obtener o crear thread PRIMERO
            let threadId = threadPersistence.getThread(shortUserId)?.threadId;
            const isNewThread = !threadId;
            if (isNewThread) {
                // Crear thread nuevo
                const thread = await openaiClient.beta.threads.create();
                threadId = thread.id;
                threadPersistence.setThread(shortUserId, threadId, chatId, userName);
                logThreadCreated('Thread creado', { 
                    shortUserId,
                    threadId,
                    chatId, 
                    userName,
                    environment: appConfig.environment,
                                requestId
                            });
                        } else {
                logInfo('THREAD_REUSE', `Thread reutilizado para ${shortUserId}`, {
                    shortUserId,
                    threadId,
                    chatId,
                    userName,
                    environment: appConfig.environment,
                    requestId
                });
                logInfo('HISTORY_SKIP', 'Skip fetch historial: Thread existe', { 
                    userId: shortUserId,
                    threadId,
                    reason: 'thread_already_exists',
                    requestId
                });
            }
            
            // 🔧 NUEVO: Usar función modularizada de inyección de historial
            if (config.enableHistoryInject) {
                try {
                    const injectionResult = await injectHistory(
                        threadId, 
                        userJid, 
                        chatId, 
                        isNewThread, 
                        contextAnalysis, 
                        requestId
                    );
                    
                    if (injectionResult.success) {
                        contextTokens += injectionResult.tokensUsed;
                        
                        logSuccess('HISTORY_INJECTION_COMPLETED', 'Inyección de historial completada', {
                            userId: shortUserId,
                            threadId,
                            tokensUsed: injectionResult.tokensUsed,
                            contextLength: injectionResult.contextLength,
                            historyLines: injectionResult.historyLines,
                            labelsCount: injectionResult.labelsCount,
                            reason: injectionResult.reason,
                            requestId
                        });
                    } else {
                        logWarning('HISTORY_INJECTION_FAILED', 'Inyección de historial falló', {
                            userId: shortUserId,
                            threadId,
                            reason: injectionResult.reason,
                            requestId
                        });
                    }
                } catch (error) {
                    logError('HISTORY_INJECTION_ERROR', 'Error en inyección de historial', {
                        userId: shortUserId,
                        threadId,
                        error: error.message,
                        requestId
                    });
                }
            }
             
             // 🔧 ETAPA 2: Summary automático de historial para threads con alto uso de tokens
             if (!isNewThread) {
                 try {
                     const summaryGenerated = await generateHistorialSummary(threadId, shortUserId);
                     if (summaryGenerated) {
                         logInfo('HISTORIAL_SUMMARY_INTEGRATED', 'Resumen de historial integrado antes de procesar mensaje', {
                             userId: shortUserId,
                             threadId,
                             requestId
                         });
                     }
                 } catch (summaryError) {
                     logWarning('HISTORIAL_SUMMARY_INTEGRATION_ERROR', 'Error integrando resumen de historial', {
                         userId: shortUserId,
                         threadId,
                         error: summaryError.message,
                         requestId
                     });
                     // Continuar sin resumen si falla
                 }
             }
             
             // 🔧 MEJORADO: Backoff progresivo para manejo de runs activos
             let addAttempts = 0;
             const maxAddAttempts = 15; // Aumentado de 10 a 15
             
             while (addAttempts < maxAddAttempts) {
                 try {
                     // Verificar runs activos
                     const existingRuns = await openaiClient.beta.threads.runs.list(threadId, { limit: 5 });
                     const activeRuns = existingRuns.data.filter(r => 
                         ['queued', 'in_progress', 'requires_action'].includes(r.status)
                     );
                     
                     if (activeRuns.length > 0) {
                         // 🔧 MEJORADO: Backoff progresivo (1s, 2s, 3s...)
                         const backoffDelay = Math.min((addAttempts + 1) * 1000, 5000); // Máximo 5s
                         
                         logWarning('ACTIVE_RUN_BEFORE_ADD', `Run activo detectado antes de agregar mensaje, esperando con backoff...`, {
                             shortUserId,
                             threadId,
                             activeRuns: activeRuns.map(r => ({ id: r.id, status: r.status })),
                             attempt: addAttempts + 1,
                             backoffDelay,
                             requestId
                         });
                         
                         // Esperar con backoff progresivo
                         await new Promise(resolve => setTimeout(resolve, backoffDelay));
                         addAttempts++;
                         continue;
                     }
                     
                     // No hay runs activos, agregar mensaje
                     await openaiClient.beta.threads.messages.create(threadId, {
                         role: 'user',
                         content: userMsg
                     });
                     
                     logOpenAIRequest('message_added', { 
                         shortUserId,
                         requestId 
                     });
                     
                     break; // Salir del loop
                     
                 } catch (addError) {
                     if (addError.message && addError.message.includes('while a run') && addError.message.includes('is active')) {
                         // 🔧 MEJORADO: Backoff progresivo para race conditions
                         const backoffDelay = Math.min((addAttempts + 1) * 1000, 5000);
                         
                         logWarning('RACE_CONDITION_RETRY', `Race condition detectada, reintentando con backoff...`, {
                             shortUserId,
                             threadId,
                             attempt: addAttempts + 1,
                             backoffDelay,
                             error: addError.message,
                             requestId
                         });
                         
                         await new Promise(resolve => setTimeout(resolve, backoffDelay));
                         addAttempts++;
                         
                         if (addAttempts >= maxAddAttempts) {
                             throw new Error(`Race condition persistente después de ${maxAddAttempts} intentos con backoff progresivo`);
                         }
                         continue;
                     } else {
                         throw addError; // Re-lanzar error si no es race condition
                     }
                 }
             }
             
             // Crear y ejecutar run
             logOpenAIRequest('creating_run', { 
                 shortUserId,
                 requestId 
             });
             let run = await openaiClient.beta.threads.runs.create(threadId, {
                 assistant_id: secrets.ASSISTANT_ID
             });
             
             logOpenAIRequest('run_started', { 
                 shortUserId,
                 requestId 
             });
            
            // Polling normal (sin cambios del plan original)
            let attempts = 0;
            const maxAttempts = 30;
            const pollingInterval = 1000;
            
            while (['queued', 'in_progress'].includes(run.status) && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, pollingInterval));
                run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
                attempts++;
                
                if (attempts % 10 === 0) {
                    logInfo('OPENAI_POLLING', `Esperando...`, { 
                        shortUserId, 
                        runId: run.id, 
                        status: run.status,
                        attempts,
                        requestId
                    });
                }
            }
            
            if (run.status === 'completed') {
                // 🔧 ETAPA 3: Actualizar etapa del flujo (solo en debug)
                if (requestId && process.env.DETAILED_LOGS === 'true') {
                    updateRequestStage(requestId, 'completed');
                }
                
                logSuccess('OPENAI_RUN_COMPLETED', `Run completado para ${shortUserId}`, { 
                    threadId,
                    requestId 
                });
                
                // 🔧 ETAPA 1: Loggear métricas de tokens y latencia
                const durationMs = Date.now() - startTime;
                totalTokens = run.usage?.total_tokens || 0;
                
                // 🔧 ETAPA 2: Actualizar métricas Prometheus
                setTokensUsed(totalTokens);
                setLatency(durationMs);
                
                // 🔧 SIMPLIFICADO: Solo log informativo de tokens (sin warnings innecesarios)
                if (totalTokens > 0) {
                    logInfo('TOKEN_USAGE', `Tokens utilizados`, {
                        shortUserId,
                        threadId,
                        totalTokens,
                        requestId
                    });
                }
                
                if (durationMs > 30000) {
                    logWarning('HIGH_LATENCY', `Latencia alta detectada`, {
                        shortUserId,
                        threadId,
                        durationMs,
                        threshold: 30000,
                        isHighLatency: true,
                        requestId
                    });
                }
                
                logOpenAIUsage('Run completado con métricas', {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    totalTokens,
                    promptTokens: run.usage?.prompt_tokens || 0,
                    completionTokens: run.usage?.completion_tokens || 0,
                    contextTokens,
                    durationMs,
                    tokensPerSecond: totalTokens > 0 ? Math.round(totalTokens / (durationMs / 1000)) : 0,
                    requestId
                });
                
                logOpenAILatency('Latencia del procesamiento', {
                    shortUserId,
                    threadId,
                    totalDurationMs: durationMs,
                    durationSeconds: (durationMs / 1000).toFixed(2),
                    isHighLatency: durationMs > 30000, // >30s es alta latencia
                    requestId
                });
                
                // Forzar limit: 1 para obtener solo el último mensaje
                const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 1 });
                const assistantMessage = messages.data[0];
                
                // Validar que el mensaje tenga contenido válido
                if (!assistantMessage || !assistantMessage.content || assistantMessage.content.length === 0) {
                    const durationMs = Date.now() - startTime;
                    
                    // 🔧 ETAPA 2: Incrementar métrica de fallbacks
                    incrementFallbacks();
                    
                    // 🔧 ETAPA 3: Log específico para assistant sin respuesta
                    logAssistantNoResponse('No message after run completion', {
                        shortUserId,
                        runId: run.id,
                        threadId,
                        requestId,
                        reason: 'no_assistant_message',
                        durationMs,
                        totalTokens,
                        contextTokens
                    });
                    
                    logFallbackTriggered('No valid response, fallback', { 
                        shortUserId,
                        runId: run.id, 
                        threadId,
                        reason: 'no_assistant_message',
                        durationMs,
                        totalTokens,
                        contextTokens,
                        requestId
                    });
                    
                    // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
                    // En lugar de enviar un mensaje automático, simplemente logear el error
                    // y permitir que el flujo continúe naturalmente
                    logWarning('NO_ASSISTANT_RESPONSE', 'OpenAI no generó respuesta, permitiendo flujo natural', {
                        shortUserId,
                        runId: run.id,
                        threadId,
                        requestId
                    });
                    
                    // Retornar string vacío para que el sistema maneje el flujo naturalmente
                    return '';
                }
                
                // Corregir el type guard para content:
                const content = assistantMessage.content[0];
                if (content.type !== 'text' || !('text' in content) || !content.text.value || content.text.value.trim() === '') {
                    const durationMs = Date.now() - startTime;
                    
                    // 🔧 ETAPA 2: Incrementar métrica de fallbacks
                    incrementFallbacks();
                    
                    logFallbackTriggered('Invalid content type or empty value', { 
                        shortUserId,
                        runId: run.id, 
                        threadId,
                        reason: 'invalid_content_type',
                        contentType: content.type,
                        hasValue: 'text' in content ? !!content.text?.value : false,
                        durationMs,
                        totalTokens,
                        contextTokens,
                        requestId
                    });
                    
                    // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
                    logWarning('INVALID_CONTENT_TYPE', 'Tipo de contenido inválido, permitiendo flujo natural', {
                        shortUserId,
                        runId: run.id,
                        threadId,
                        requestId
                    });
                    
                    return '';
                }
                
                const responseText = content.text.value;
                
                // Validación básica (sin cambios del plan original)
                if (responseText === userMsg || responseText === userMsg.trim()) {
                    logError('RESPONSE_ECHO_DETECTED', 'Bot enviando input del usuario como respuesta', {
                        shortUserId,
                        runId: run.id,
                        threadId,
                        userMsg: userMsg.substring(0, 50) + '...',
                        responseText: responseText.substring(0, 50) + '...',
                        userMsgLength: userMsg.length,
                        responseLength: responseText.length,
                        requestId
                    });
                    
                    incrementFallbacks();
                    return '';
                }
                

                
                // Detectar posible loop en respuesta
                if (responseText.includes('Las funciones se ejecutaron correctamente')) {
                    logWarning('LOOP_DETECTED', 'Possible loop detected in response', { 
                        runId: run.id, 
                        threadId,
                        responsePreview: responseText.substring(0, 100),
                        requestId
                    });
                }
                
                logOpenAIResponse('response_received', {
                    shortUserId,
                    threadId,
                    responseLength: responseText.length,
                    environment: appConfig.environment,
                    requestId
                });
                
                // 🔧 ETAPA 2: Loggear métricas finales de performance con memoria
                const finalDurationMs = Date.now() - startTime;
                const memUsage = process.memoryUsage();
                
                logPerformanceMetrics('Procesamiento completado exitosamente', {
                    shortUserId,
                    threadId,
                    totalDurationMs: finalDurationMs,
                    totalTokens,
                    contextTokens,
                    responseLength: responseText.length,
                    tokensPerSecond: totalTokens > 0 ? Math.round(totalTokens / (finalDurationMs / 1000)) : 0,
                    isEfficient: finalDurationMs < 10000 && totalTokens < 2000, // <10s y <2000 tokens es eficiente
                    memory: {
                        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                        rssMB: Math.round(memUsage.rss / 1024 / 1024)
                    },
                    requestId
                });
                
                return responseText;
            } else if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
                // Manejar function calling - SIMPLIFICADO
                const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                
                // 🔧 ETAPA 3: Actualizar etapa del flujo
                if (requestId) {
                    updateRequestStage(requestId, 'function_calling');
                }
                
                logFunctionCallingStart('function_calling_required', {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    toolCallsCount: toolCalls.length,
                    environment: appConfig.environment,
                    requestId
                });
                
                const toolOutputs = [];
                
                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    
                    // 🔧 ETAPA 3: Registrar tool call en tracing
                    if (requestId) {
                        registerToolCall(requestId, toolCall.id, functionName, 'executing');
                    }
                    
                    logFunctionExecuting('function_executing', {
                        shortUserId,
                        functionName,
                        toolCallId: toolCall.id,
                        args: functionArgs,
                        environment: appConfig.environment,
                        requestId
                    });
                    
                    try {
                        // Ejecutar la función usando el registry
                        const { executeFunction } = await import('./functions/registry/function-registry.js');
                        const result = await executeFunction(functionName, functionArgs, requestId);
                        
                        let formattedResult;
                        if (typeof result === 'string') {
                            formattedResult = result;
                        } else if (result && typeof result === 'object') {
                            formattedResult = JSON.stringify(result);
                        } else {
                            formattedResult = String(result || 'success');
                        }
                        
                        toolOutputs.push({
                            tool_call_id: toolCall.id,
                            output: formattedResult
                        });
                        
                        // 🔧 ETAPA 3: Actualizar status del tool call
                        if (requestId) {
                            updateToolCallStatus(requestId, toolCall.id, 'success');
                        }
                        
                        logFunctionHandler('function_success', {
                            shortUserId,
                            functionName,
                            status: 'success',
                            toolCallId: toolCall.id,
                            resultLength: formattedResult.length,
                            environment: appConfig.environment,
                            requestId
                        });
                        
                    } catch (error) {
                        const errorOutput = `Error ejecutando función: ${error.message}`;
                        toolOutputs.push({
                            tool_call_id: toolCall.id,
                            output: errorOutput
                        });
                        
                        // 🔧 ETAPA 3: Actualizar status del tool call
                        if (requestId) {
                            updateToolCallStatus(requestId, toolCall.id, 'error');
                        }
                        
                        logError('FUNCTION_ERROR', `Error ejecutando función ${functionName}`, {
                            shortUserId,
                            error: error.message,
                            environment: appConfig.environment,
                            requestId
                        });
                    }
                }
                
                // Enviar resultados de las funciones
                await openaiClient.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: toolOutputs
                });
                
                logToolOutputsSubmitted('Tool outputs enviados a OpenAI', {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    requestId,
                    outputs: toolOutputs.map(o => ({ 
                        id: o.tool_call_id, 
                        outputLength: o.output.length,
                        outputPreview: o.output.substring(0, 100) + '...'
                    })),
                    totalOutputs: toolOutputs.length
                });
                
                // 🔧 MEJORADO: Polling post-tool con delay inicial y reintentos fijos
                // Log inmediato después de submit para depuración
                logInfo('POST_SUBMIT_STATUS', 'Status después de submit tool outputs', { 
                    shortUserId,
                    runId: run.id,
                    runStatus: run.status,
                    requestId
                });
                
                // Delay inicial para dar tiempo a OpenAI de actualizar status
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2s simple
                
                let postAttempts = 0;
                const maxPostAttempts = 3; // Bajo para eficiencia, evita overhead
                
                while (postAttempts < maxPostAttempts) {
                    run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
                    
                    logInfo('POST_TOOL_POLLING', `Polling post-tool - Intento ${postAttempts + 1}/${maxPostAttempts}`, { 
                        shortUserId, 
                        runId: run.id, 
                        status: run.status,
                        attempt: postAttempts + 1,
                        requestId
                    });
                    
                    if (run.status === 'completed') {
                        break; // Éxito, salir del loop
                    }
                    
                    if (!['queued', 'in_progress'].includes(run.status)) {
                        // Status inesperado (failed, cancelled, etc.), salir
                        logWarning('POST_TOOL_UNEXPECTED_STATUS', `Status inesperado en polling post-tool`, {
                            shortUserId,
                            runId: run.id,
                            status: run.status,
                            attempt: postAttempts + 1,
                            requestId
                        });
                        break;
                    }
                    
                    // Esperar antes del siguiente intento
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Espera fija de 2s
                    postAttempts++;
                }
                
                // Log final del polling
                logInfo('POST_TOOL_POLLING_COMPLETE', 'Polling post-tool completado', { 
                    shortUserId,
                    runId: run.id,
                    attempts: postAttempts, 
                    finalStatus: run.status,
                    requestId
                });
                
                if (run.status === 'completed') {
                    // 🔧 ETAPA 3: Actualizar etapa del flujo
                    if (requestId) {
                        updateRequestStage(requestId, 'post_tools_completed');
                    }
                    
                    const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 1 });
                    const assistantMessage = messages.data[0];
                    
                    if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
                        const content = assistantMessage.content[0];
                        if (content.type === 'text' && content.text.value && content.text.value.trim() !== '') {
                            const responseText = content.text.value;
                            
                            logSuccess('FUNCTION_CALLING_RESPONSE', `Respuesta final recibida después de function calling`, {
                                shortUserId,
                                threadId,
                                responseLength: responseText.length,
                                toolCallsExecuted: toolCalls.length,
                                environment: appConfig.environment,
                                requestId
                            });
                            
                            // Log bonito para terminal
                            console.log(`✅ [TOOL_SUCCESS] Respuesta recibida después de ${toolCalls.length} tool calls`);
                            
                            return responseText;
                        }
                    }
                    
                    // SIMPLIFICADO: Fallback básico si no hay respuesta
                    logWarning('ASSISTANT_NO_RESPONSE_POST_TOOL', 'No mensaje de assistant después de tool outputs', { 
                        shortUserId,
                        runId: run.id, 
                        threadId,
                        toolCallsExecuted: toolCalls.length,
                        toolOutputsCount: toolOutputs.length,
                        requestId
                    });
                    
                    // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
                    logWarning('NO_RESPONSE_POST_TOOL', 'No respuesta después de tool outputs, permitiendo flujo natural', {
                        shortUserId,
                        runId: run.id,
                        threadId,
                        requestId
                    });
                    
                    return '';
                }
                
                // 🔧 MEJORADO: Fallback con información detallada del status
                logWarning('FUNCTION_CALLING_TIMEOUT', 'Run no completado después de tool outputs', {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    attempts: postAttempts,
                    finalStatus: run.status,
                    requestId
                });
                
                // Log bonito para terminal con información clara
                console.log(`⚠️ [TOOL_TIMEOUT] Run no completado (status: ${run.status}) después de tools - Intentos: ${postAttempts}`);
                
                // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
                logWarning('FUNCTION_CALLING_TIMEOUT', 'Run no completado después de tool outputs, permitiendo flujo natural', {
                    shortUserId,
                    runId: run.id,
                    threadId,
                    requestId
                });
                
                return '';
            } else {
                logError('OPENAI_RUN_ERROR', `Run falló o timeout`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    status: run.status,
                    attempts,
                    environment: appConfig.environment,
                    requestId
                });
                
                // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
                logWarning('OPENAI_RUN_ERROR', 'Run falló o timeout, permitiendo flujo natural', {
                    shortUserId,
                    runId: run.id,
                    threadId,
                    requestId
                });
                
                return '';
            }
            
        } catch (error) {
            // 🔧 NUEVO: Manejo específico para context length exceeded
            if (error?.code === 'context_length_exceeded' || 
                error?.message?.includes('maximum context length') ||
                error?.message?.includes('context_length_exceeded')) {
                
                logWarning('CONTEXT_LENGTH_EXCEEDED', 'Context length exceeded, creando nuevo thread con resumen', {
                    shortUserId,
                    threadId: threadPersistence.getThread(shortUserId)?.threadId,
                    error: error.message,
                    requestId
                });
                
                try {
                    // Crear nuevo thread
                    const newThread = await openaiClient.beta.threads.create();
                    const oldThreadId = threadPersistence.getThread(shortUserId)?.threadId;
                    
                    // Generar resumen mínimo del thread anterior
                    let summary = '';
                    if (oldThreadId) {
                        try {
                            summary = await generateThreadSummary(oldThreadId, shortUserId);
                        } catch (summaryError) {
                            logWarning('SUMMARY_GENERATION_FAILED', 'Error generando resumen para nuevo thread', {
                                shortUserId,
                                oldThreadId,
                                error: summaryError.message,
                                requestId
                            });
                        }
                    }
                    
                    // Agregar resumen como mensaje del usuario si existe
                    if (summary) {
                        await openaiClient.beta.threads.messages.create(newThread.id, {
                            role: 'user',
                            content: `[RESUMEN DE CONVERSACIÓN ANTERIOR]\n${summary}\n\n--- CONTINUAR CONVERSACIÓN ---`
                        });
                    }
                    
                    // Actualizar persistencia con nuevo thread
                    threadPersistence.setThread(shortUserId, newThread.id, chatId, userName);
                    
                    logSuccess('NEW_THREAD_CREATED', 'Nuevo thread creado para manejar context length exceeded', {
                        shortUserId,
                        oldThreadId,
                        newThreadId: newThread.id,
                        summaryLength: summary.length,
                        requestId
                    });
                    
                    // Reintentar con nuevo thread
                    releaseThreadLock(shortUserId);
                    return await processWithOpenAI(userMsg, userJid, chatId, userName, requestId, contextAnalysis);
                    
                } catch (recoveryError) {
                    logError('CONTEXT_LENGTH_RECOVERY_FAILED', 'Error en recuperación de context length exceeded', {
                        shortUserId,
                        error: recoveryError.message,
                        requestId
                    });
                }
            }
            
            // 🔧 ETAPA 1: Loggear error general
            const durationMs = Date.now() - startTime;
            
            logError('OPENAI_PROCESS_ERROR', `Error en procesamiento con OpenAI`, {
                shortUserId,
                threadId: threadPersistence.getThread(shortUserId)?.threadId,
                error: error.message,
                durationMs,
                totalTokens,
                contextTokens,
                environment: appConfig.environment,
                requestId
            });
            
            // 🔧 ETAPA 2: Incrementar métrica de fallbacks
            incrementFallbacks();
            
            // 🔧 ELIMINADO: Fallback automático - permitir que OpenAI maneje la respuesta
            logWarning('OPENAI_PROCESS_ERROR', 'Error en procesamiento con OpenAI, permitiendo flujo natural', {
                shortUserId,
                error: error.message,
                requestId
            });
            
            return '';
        }
    };

    // Webhook Principal
    app.post('/hook', async (req: Request, res: Response) => {
        // Responder inmediatamente para evitar timeouts
        res.status(200).json({ 
            received: true, 
            timestamp: new Date().toISOString(),
            environment: appConfig.environment
        });
        
        // Procesar de forma asíncrona
        if (!isServerInitialized) {
            logWarning('WEBHOOK_NOT_READY', 'Webhook recibido pero bot no inicializado', {
                environment: appConfig.environment
            });
            return;
        }
        
        try {
            const { messages, presences, event } = req.body;
            
            // 🔧 NUEVO: Procesar eventos de presencia (typing)
            if (presences && event?.type === 'presences' && event?.event === 'post') {
                logInfo('PRESENCE_EVENT', `Procesando ${presences.length} eventos de presencia`, {
                    environment: appConfig.environment,
                    presenceCount: presences.length
                });
                
                presences.forEach((presence: { contact_id: string, status: string }) => {
                    const userId = presence.contact_id;
                    const status = presence.status.toLowerCase();
                    const shortUserId = getShortUserId(userId);
                    
                    logInfo('PRESENCE_RECEIVED', `Presencia para ${shortUserId}: ${status}`, {
                        userId: shortUserId,
                        status,
                        environment: appConfig.environment
                    });

                    if (status === 'typing' || status === 'recording') {
                        // Usuario está escribiendo - actualizar estado global
                        userTypingState.set(userId, true);
                        updateTypingStatus(userId, true);
                        
                        console.log(`✍️ ${shortUserId} está escribiendo... (extendiendo buffer)`);
                        
                    } else if (status === 'online' || status === 'offline' || status === 'pending') {
                        // Usuario dejó de escribir - actualizar estado global
                        if (userTypingState.get(userId) === true) {
                            userTypingState.set(userId, false);
                            updateTypingStatus(userId, false);
                            
                            console.log(`⏸️ ${shortUserId} dejó de escribir`);
                        }
                    }
                });
                
                return; // Salir después de manejar presences
            }
            
            // Procesar mensajes normales
            
            if (!messages || !Array.isArray(messages)) {
                // 🔧 MEJORADO: Solo log warning si no es un webhook de status
                if (!req.body.statuses || !Array.isArray(req.body.statuses)) {
                    logWarning('WEBHOOK', 'Webhook recibido sin mensajes válidos', { 
                        body: req.body,
                        environment: appConfig.environment
                    });
                } else {
                    logDebug('WEBHOOK_STATUS', 'Webhook de status recibido (normal)', {
                        statusCount: req.body.statuses.length,
                        environment: appConfig.environment
                    });
                }
                return;
            }
            
            logInfo('WEBHOOK', `Procesando ${messages.length} mensajes del webhook`, {
                environment: appConfig.environment,
                messageCount: messages.length
            });
            
            // Procesar cada mensaje
            for (const message of messages) {
                // Skip mensajes del bot para evitar self-loops
                if (message.from_me) {
                    logDebug('MESSAGE_SKIP', `Skipped bot message`, { id: message.id, from: message.from });
                    continue;
                }
                
                logMessageReceived('Mensaje recibido', {
                    userId: message.from,
                    chatId: message.chat_id,
                    from: message.from,
                    type: message.type,
                    timestamp: message.timestamp,
                    body: message.text?.body?.substring(0, 100) + '...',
                    environment: appConfig.environment
                });
                
                                    // Solo procesar mensajes de texto que no sean del bot
                    if (message.type === 'text' && !message.from_me && message.text?.body) {
                        const userJid = message.from;
                        const chatId = message.chat_id;
                        const userName = cleanContactName(message.from_name);
                        let messageText = message.text.body;
                        
                        // Validación de tamaño de mensaje
                        if (messageText.length > MAX_MESSAGE_LENGTH) {
                            logWarning('MESSAGE_TOO_LONG', 'Mensaje excede límite, truncando', {
                                userJid: getShortUserId(userJid),
                                originalLength: messageText.length,
                                maxLength: MAX_MESSAGE_LENGTH,
                                environment: appConfig.environment
                            });
                            
                            messageText = messageText.substring(0, MAX_MESSAGE_LENGTH) + '... [mensaje truncado por límite de tamaño]';
                        }
                        
                        // 🔧 NUEVO: Usar buffering global proactivo para TODOS los mensajes
                        addToGlobalBuffer(userJid, messageText, chatId, userName);
                        
                        // 🔧 NUEVO: Suscribirse a presencia del usuario (solo una vez)
                        const shortUserId = getShortUserId(userJid);
                        await subscribeToPresence(shortUserId);
                        
                        console.log(`📥 [BUFFER] ${userName}: "${messageText.substring(0, 30)}..." → Buffer global`);
                    }
            }
            
        } catch (error) {
            logError('WEBHOOK_ERROR', 'Error procesando webhook', { 
                error: error.message, 
                stack: error.stack,
                environment: appConfig.environment
            });
        }
    });

}



// Función de inicialización del bot
async function initializeBot() {
    // ... lógica de inicialización
    isServerInitialized = true;
    console.log('✅ Bot completamente inicializado');
    
    // 🔧 ETAPA 1: Recuperación de runs huérfanos al inicio (del comentario externo)
    await recoverOrphanedRuns();
    

    
    // 🔧 ETAPA 2: Cleanup on-demand en lugar de automático fijo
    // Solo ejecutar cuando hay actividad real
    let cleanupScheduled = false;
    
    const scheduleCleanup = () => {
        if (!cleanupScheduled) {
            cleanupScheduled = true;
            setTimeout(() => {
                try {
                    const removedCount = threadPersistence.cleanupOldThreads(1); // 1 mes = threads muy viejos
                    if (removedCount > 0) {
                        logInfo('THREAD_CLEANUP', `Cleanup on-demand: ${removedCount} threads viejos removidos`);
                    }
                    
                    // Actualizar métrica de threads activos
                    const stats = threadPersistence.getStats();
                    updateActiveThreads(stats.activeThreads);
                    
                } catch (error) {
                    logError('THREAD_CLEANUP', 'Error en cleanup on-demand', { error: error.message });
                } finally {
                    cleanupScheduled = false;
                }
            }, 5 * 60 * 1000); // 5 minutos después de actividad
        }
    };
    
    // 🔧 ETAPA 2: Cleanup de cache on-demand en lugar de automático fijo
    let cacheCleanupScheduled = false;
    
    const scheduleCacheCleanup = () => {
        if (!cacheCleanupScheduled) {
            cacheCleanupScheduled = true;
            setTimeout(() => {
                try {
                    const now = Date.now();
                    let expiredCount = 0;
                    let sizeLimitCount = 0;
                    
                    // Limpiar entradas expiradas
                    for (const [userId, cacheEntry] of historyCache.entries()) {
                        if ((now - cacheEntry.timestamp) > HISTORY_CACHE_TTL) {
                            historyCache.delete(userId);
                            expiredCount++;
                        }
                    }
                    
                    // Limpiar por límite de tamaño (LRU eviction)
                    if (historyCache.size > HISTORY_CACHE_MAX_SIZE) {
                        const entriesToDelete = Array.from(historyCache.entries())
                            .sort((a, b) => a[1].timestamp - b[1].timestamp)
                            .slice(0, historyCache.size - HISTORY_CACHE_MAX_SIZE);
                        
                        for (const [userId] of entriesToDelete) {
                            historyCache.delete(userId);
                            sizeLimitCount++;
                        }
                    }
                    
                    if (expiredCount > 0 || sizeLimitCount > 0) {
                        logInfo('HISTORY_CACHE_CLEANUP', `Cache cleanup on-demand completado`, {
                            expiredCount,
                            sizeLimitCount,
                            remainingEntries: historyCache.size,
                            maxSize: HISTORY_CACHE_MAX_SIZE
                        });
                    }
                } catch (error) {
                    logError('HISTORY_CACHE_CLEANUP', 'Error en cleanup del cache', { error: error.message });
                } finally {
                    cacheCleanupScheduled = false;
                }
            }, 10 * 60 * 1000); // 10 minutos después de actividad
        }
    };
    
    // 🔧 NUEVO: Cleanup automático de caches de inyección
    // Ejecutar cada 10 minutos para mantener caches limpios
    setInterval(() => {
        try {
            cleanupExpiredCaches();
        } catch (error) {
            logError('INJECTION_CACHE_CLEANUP', 'Error en cleanup de caches de inyección', { error: error.message });
        }
    }, 10 * 60 * 1000); // Cada 10 minutos
    
    logInfo('BOT_INIT', 'Cleanup automático de threads y cache configurado');
    
    // 🔧 NUEVO: Log de estadísticas de cache al inicio
    try {
        const cacheStats = getCacheStats();
        logInfo('CACHE_INIT', 'Estadísticas de cache al inicio', {
            historyCache: cacheStats.historyCache,
            contextCache: cacheStats.contextCache,
            injectionCache: cacheStats.injectionCache
        });
        } catch (error) {
        logWarning('CACHE_STATS_ERROR', 'Error obteniendo estadísticas de cache', { error: error.message });
        }
    

    
    // 🔧 NUEVO: Cleanup automático del buffer global
    // Ejecutar cada 5 minutos para limpiar buffers viejos
    setInterval(() => {
        try {
            const now = Date.now();
            let expiredCount = 0;
            
            // Limpiar buffers globales después de 10 minutos de inactividad
            for (const [userId, buffer] of globalMessageBuffers.entries()) {
                if ((now - buffer.lastActivity) > 10 * 60 * 1000) { // 10 minutos
                    if (buffer.timer) {
                        clearTimeout(buffer.timer);
                    }
                    globalMessageBuffers.delete(userId);
                    expiredCount++;
                }
            }
            
            if (expiredCount > 0) {
                logInfo('GLOBAL_BUFFER_CLEANUP', `Global buffer cleanup: ${expiredCount} buffers expirados removidos`, {
                    remainingEntries: globalMessageBuffers.size
                });
            }
        } catch (error) {
            logError('GLOBAL_BUFFER_CLEANUP', 'Error en cleanup del buffer global', { error: error.message });
        }
    }, 5 * 60 * 1000); // Cada 5 minutos
    
    // 🔧 ETAPA 2: Cleanup de threads con alto uso de tokens on-demand
    let tokenCleanupScheduled = false;
    
    const scheduleTokenCleanup = () => {
        if (!tokenCleanupScheduled) {
            tokenCleanupScheduled = true;
            setTimeout(async () => {
                try {
                    await cleanupHighTokenThreads();
                } catch (error) {
                    logError('TOKEN_CLEANUP_ERROR', 'Error en cleanup de threads con alto uso de tokens', { error: error.message });
                } finally {
                    tokenCleanupScheduled = false;
                }
            }, 30 * 60 * 1000); // 30 minutos después de actividad
        }
    };
    
                // Memory logs originales (sin cambios del plan original)
            setInterval(() => {
                try {
                    const memUsage = process.memoryUsage();
                    const cpuUsage = process.cpuUsage();
                    
                    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
                    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
                    const rssMB = memUsage.rss / 1024 / 1024;
                    const externalMB = memUsage.external / 1024 / 1024;
                    
                    const heapUsagePercentage = (heapUsedMB / heapTotalMB) * 100;
                    const isHighMemory = heapUsedMB > 300;
                    const isMemoryLeak = heapUsagePercentage > 95;
                    
                    logInfo('MEMORY_USAGE', 'Métricas de memoria del sistema', {
                        memory: {
                            rss: Math.round(rssMB) + 'MB',
                            heapUsed: Math.round(heapUsedMB) + 'MB',
                            heapTotal: Math.round(heapTotalMB) + 'MB',
                            heapUsagePercent: Math.round(heapUsagePercentage) + '%',
                            external: Math.round(externalMB) + 'MB'
                        },
                        cpu: {
                            user: Math.round(cpuUsage.user / 1000) + 'ms',
                            system: Math.round(cpuUsage.system / 1000) + 'ms'
                        },
                        threads: {
                            active: threadPersistence.getStats().activeThreads,
                            total: threadPersistence.getStats().totalThreads
                        },
                        caches: {
                            historyCache: historyCache.size,
                            contextCache: contextInjectionCache.size,
                            globalBuffers: globalMessageBuffers.size
                        },
                        uptime: Math.round(process.uptime()) + 's'
                    });
                    
                    if (isHighMemory) {
                        logWarning('HIGH_MEMORY_USAGE', 'Uso alto de memoria detectado', {
                            heapUsedMB: Math.round(heapUsedMB),
                            threshold: 300,
                            heapUsagePercent: Math.round(heapUsagePercentage) + '%'
                        });
                    }
                    
                    if (isMemoryLeak) {
                        logError('MEMORY_LEAK_DETECTED', 'Posible memory leak detectado', {
                            heapUsedMB: Math.round(heapUsedMB),
                            heapUsagePercent: Math.round(heapUsagePercentage) + '%',
                            threshold: 95,
                            recommendation: 'Uso de memoria crítico - considerar optimización o restart'
                        });
                    }
                    
                } catch (error) {
                    logError('MEMORY_METRICS_ERROR', 'Error obteniendo métricas de memoria', { error: error.message });
                }
            }, 5 * 60 * 1000); // Cada 5 minutos (original)
}

// 🔧 ETAPA 3.1: Función para generar resumen automático de historial
async function generateThreadSummary(threadId: string, userId: string): Promise<string> {
    try {
        logInfo('THREAD_SUMMARY_START', 'Iniciando generación de resumen de thread', {
            threadId,
            userId
        });
        
        // Obtener mensajes del thread (últimos 50 para contexto)
        const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 50 });
        
        if (messages.data.length === 0) {
            return 'No hay mensajes en este thread para resumir.';
        }
        
        // Crear prompt para generar resumen
        const conversationText = messages.data
            .reverse() // Ordenar cronológicamente
            .map(msg => {
                const content = msg.content[0];
                if (content && content.type === 'text' && 'text' in content) {
                    const role = msg.role === 'user' ? 'Cliente' : 'Asistente';
                    return `${role}: ${content.text.value}`;
                }
                return null;
            })
            .filter(Boolean)
            .join('\n\n');
        
        // Generar resumen usando OpenAI (modelo global configurado)
        const summaryResponse = await openaiClient.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4', // Usar modelo global configurado
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente especializado en crear resúmenes concisos de conversaciones de WhatsApp para un bot de reservas hoteleras. 
                    
                    Tu tarea es crear un resumen que capture:
                    1. El propósito principal de la conversación
                    2. Información clave del cliente (preferencias, fechas, etc.)
                    3. Estado actual de la consulta/reserva
                    4. Cualquier información importante para continuar la conversación
                    
                    El resumen debe ser:
                    - Máximo 200 palabras
                    - En español
                    - Estructurado y fácil de leer
                    - Mantener solo información relevante para el negocio`
                },
                {
                    role: 'user',
                    content: `Genera un resumen de esta conversación:\n\n${conversationText}`
                }
            ],
            max_tokens: 300,
            temperature: 0.3
        });
        
        const summary = summaryResponse.choices[0]?.message?.content || 'Error generando resumen';
        
        logSuccess('THREAD_SUMMARY_GENERATED', 'Resumen de thread generado exitosamente', {
            threadId,
            userId,
            originalMessages: messages.data.length,
            summaryLength: summary.length,
            estimatedTokens: Math.ceil(summary.length / 4)
        });
        
        return summary;
        
    } catch (error) {
        logError('THREAD_SUMMARY_ERROR', 'Error generando resumen de thread', {
            threadId,
            userId,
            error: error.message
        });
        return 'Error generando resumen de la conversación.';
    }
}

// 🔧 ETAPA 3.2: Función para optimizar thread con resumen automático
async function optimizeThreadWithSummary(threadId: string, userId: string, chatId: string, userName: string): Promise<boolean> {
    try {
        logInfo('THREAD_OPTIMIZATION_START', 'Iniciando optimización de thread con resumen', {
            threadId,
            userId
        });
        
        // Generar resumen del thread actual
        const summary = await generateThreadSummary(threadId, userId);
        
        // Crear nuevo thread
        const newThread = await openaiClient.beta.threads.create();
        
        // Agregar resumen como contexto inicial
        await openaiClient.beta.threads.messages.create(newThread.id, {
            role: 'user',
            content: `RESUMEN DE CONVERSACIÓN ANTERIOR:\n\n${summary}\n\n--- CONTINUAR CONVERSACIÓN ---`
        });
        
        // Actualizar threadPersistence
        threadPersistence.setThread(userId, newThread.id, chatId, userName);
        
        // Eliminar thread viejo
        try {
            await openaiClient.beta.threads.del(threadId);
            logSuccess('OLD_THREAD_DELETED', 'Thread viejo eliminado después de optimización', {
                userId,
                oldThreadId: threadId,
                newThreadId: newThread.id
            });
        } catch (deleteError) {
            logWarning('THREAD_DELETE_ERROR', 'Error eliminando thread viejo', {
                userId,
                threadId,
                error: deleteError.message
            });
        }
        
        logSuccess('THREAD_OPTIMIZATION_COMPLETE', 'Thread optimizado con resumen exitosamente', {
            userId,
            oldThreadId: threadId,
            newThreadId: newThread.id,
            summaryLength: summary.length
        });
        
        return true;
        
    } catch (error) {
        logError('THREAD_OPTIMIZATION_ERROR', 'Error optimizando thread con resumen', {
            threadId,
            userId,
            error: error.message
        });
        return false;
    }
}

// 🔧 ETAPA 3.3: Función mejorada para limpiar threads con alto uso de tokens
async function cleanupHighTokenThreads() {
    try {
        const threads = threadPersistence.getAllThreadsInfo();
        let threadsChecked = 0;
        let threadsCleaned = 0;
        let threadsOptimized = 0;
        
        for (const [userId, threadInfo] of Object.entries(threads)) {
            try {
                // Verificar si el thread es reciente (últimas 24 horas)
                const lastActivity = new Date(threadInfo.lastActivity);
                const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
                
                if (hoursSinceActivity > 24) {
                    // Thread viejo, verificar uso de tokens
                    const messages = await openaiClient.beta.threads.messages.list(threadInfo.threadId, { limit: 50 });
                    // 🔧 ETAPA 4: Estimación mejorada de tokens con métricas
                    const totalTokens = messages.data.reduce((acc, msg) => {
                        // Estimación más precisa: 1 token ≈ 4 caracteres para texto, bonus para prompts largos
                        const content = msg.content[0];
                        if (content && content.type === 'text' && 'text' in content) {
                            const textLength = content.text?.value?.length || 0;
                            const baseTokens = Math.ceil(textLength / 4);
                            // Bonus para mensajes largos (más overhead de procesamiento)
                            const bonusTokens = textLength > 500 ? Math.ceil(textLength / 100) : 0;
                            return acc + baseTokens + bonusTokens;
                        }
                        return acc;
                    }, 0);
                    
                    threadsChecked++;
                    
                    // 🔧 ETAPA 3.1: Threshold de tokens por thread (configurable)
                    const TOKEN_THRESHOLD = parseInt(process.env.THREAD_TOKEN_THRESHOLD || '8000');
                    
                    if (totalTokens > TOKEN_THRESHOLD) {
                        logWarning('HIGH_TOKEN_THREAD_DETECTED', `Thread con alto uso de tokens detectado`, {
                            userId,
                            threadId: threadInfo.threadId,
                            estimatedTokens: totalTokens,
                            threshold: TOKEN_THRESHOLD,
                            hoursSinceActivity: Math.round(hoursSinceActivity)
                        });
                        
                        // 🔧 ETAPA 4: Actualizar métrica de threads con alto uso de tokens
                        try {
                            const { setHighTokenThreads } = require('./routes/metrics');
                            setHighTokenThreads(threadsChecked + 1);
                        } catch (e) { 
                            // Ignorar en test/local si no existe
                            logDebug('HIGH_TOKEN_METRIC_ERROR', 'No se pudo actualizar métrica de threads con alto uso', { error: e.message });
                        }
                        
                        // 🔧 ETAPA 3.2: Intentar optimización con resumen primero
                        const optimizationSuccess = await optimizeThreadWithSummary(
                            threadInfo.threadId, 
                            userId, 
                            threadInfo.chatId, 
                            threadInfo.userName
                        );
                        
                        if (optimizationSuccess) {
                            threadsOptimized++;
                        } else {
                            // Fallback: limpieza tradicional (migrar últimos 10 mensajes)
                            const newThread = await openaiClient.beta.threads.create();
                            
                            // Migrar solo los últimos 10 mensajes
                            const recentMessages = messages.data.slice(0, 10);
                            for (const msg of recentMessages.reverse()) {
                                const content = msg.content[0];
                                if (content && content.type === 'text' && 'text' in content && content.text?.value) {
                                    await openaiClient.beta.threads.messages.create(newThread.id, {
                                        role: msg.role,
                                        content: content.text.value
                                    });
                                }
                            }
                            
                            // Actualizar threadPersistence
                            threadPersistence.setThread(userId, newThread.id, threadInfo.chatId, threadInfo.userName);
                            
                            // Eliminar thread viejo
                            try {
                                await openaiClient.beta.threads.del(threadInfo.threadId);
                                logSuccess('OLD_THREAD_DELETED', `Thread viejo eliminado`, {
                                    userId,
                                    oldThreadId: threadInfo.threadId,
                                    newThreadId: newThread.id,
                                    estimatedTokens: totalTokens
                                });
                            } catch (deleteError) {
                                logWarning('THREAD_DELETE_ERROR', `Error eliminando thread viejo`, {
                                    userId,
                                    threadId: threadInfo.threadId,
                                    error: deleteError.message
                                });
                            }
                            
                            threadsCleaned++;
                        }
                    }
                }
                
                // Pequeña pausa para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (threadError) {
                logError('TOKEN_CLEANUP_THREAD_ERROR', `Error verificando thread ${userId}`, {
                    userId,
                    threadId: threadInfo.threadId,
                    error: threadError.message
                });
            }
        }
        
        if (threadsCleaned > 0 || threadsOptimized > 0) {
            logSuccess('TOKEN_CLEANUP_COMPLETE', `Cleanup de tokens completado`, {
                threadsChecked,
                threadsCleaned,
                threadsOptimized,
                totalThreads: Object.keys(threads).length
            });
            
            // 🔧 ETAPA 4: Incrementar métricas de cleanup
            try {
                const { incrementTokenCleanups } = require('./routes/metrics');
                incrementTokenCleanups();
            } catch (e) { 
                // Ignorar en test/local si no existe
                logDebug('TOKEN_CLEANUP_METRIC_ERROR', 'No se pudo incrementar métrica de cleanup', { error: e.message });
            }
        }
        
    } catch (error) {
        logError('TOKEN_CLEANUP_ERROR', 'Error en cleanup de threads con alto uso de tokens', { error: error.message });
    }
}

// 🔧 ETAPA 1: Recuperación mejorada de runs huérfanos al inicio del bot
async function recoverOrphanedRuns() {
    try {
        logInfo('ORPHANED_RUNS_RECOVERY_START', 'Iniciando recuperación de runs huérfanos');
        
        const threads = threadPersistence.getAllThreadsInfo();
        let runsChecked = 0;
        let runsCancelled = 0;
        
        for (const [userId, threadInfo] of Object.entries(threads)) {
            try {
                // Verificar si hay runs activos en el thread
                const runs = await openaiClient.beta.threads.runs.list(threadInfo.threadId, { limit: 10 });
                
                for (const run of runs.data) {
                    runsChecked++;
                    
                    // 🔧 ETAPA 1: Cancelar TODOS los runs activos al inicio (más agresivo)
                    if (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                        try {
                            await openaiClient.beta.threads.runs.cancel(threadInfo.threadId, run.id);
                            runsCancelled++;
                            
                            logWarning('ORPHANED_RUN_CANCELLED', `Run huérfano cancelado al inicio`, {
                                userId,
                                threadId: threadInfo.threadId,
                                runId: run.id,
                                status: run.status,
                                ageMinutes: Math.round((Date.now() - new Date(run.created_at).getTime()) / 1000 / 60)
                            });
                        } catch (cancelError) {
                            logError('ORPHANED_RUN_CANCEL_ERROR', `Error cancelando run huérfano`, {
                                userId,
                                threadId: threadInfo.threadId,
                                runId: run.id,
                                error: cancelError.message
                            });
                        }
                    }
                }
            } catch (threadError) {
                logError('ORPHANED_RUNS_THREAD_ERROR', `Error verificando thread para runs huérfanos`, {
                    userId,
                    threadId: threadInfo.threadId,
                    error: threadError.message
                });
            }
        }
        
        logSuccess('ORPHANED_RUNS_RECOVERY_COMPLETE', 'Recuperación de runs huérfanos completada', {
            runsChecked,
            runsCancelled
        });
        
    } catch (error) {
        logError('ORPHANED_RUNS_RECOVERY_ERROR', 'Error durante recuperación de runs huérfanos', {
            error: error.message
        });
    }
}

// --- Ejecución ---
main();

// Exportar para testing