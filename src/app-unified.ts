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
    logFatal,
    logAlert,
    // 🔧 IMPORTS OBSOLETOS COMENTADOS PARA REGISTRO
    // logTrace,                    // ❌ No se usa - comentado para registro
    logMessageReceived,
    // logMessageProcess,           // ❌ No se usa - comentado para registro
    // logWhatsAppSend,            // ❌ No se usa - comentado para registro
    // logWhatsAppChunksComplete,  // ❌ No se usa - comentado para registro
    logOpenAIRequest,
    logOpenAIResponse,
    logFunctionCallingStart,
    logFunctionExecuting,
    logFunctionHandler,
    // logBeds24Request,           // ❌ No se usa - comentado para registro
    // logBeds24ApiCall,           // ❌ No se usa - comentado para registro
    // logBeds24ResponseDetail,    // ❌ No se usa - comentado para registro
    // logBeds24Processing,        // ❌ No se usa - comentado para registro
    logThreadCreated,
    // logThreadPersist,           // ❌ No se usa - comentado para registro
    // logThreadCleanup,           // ❌ No se usa - comentado para registro
    logServerStart,
    // logBotReady,                // ❌ No se usa - comentado para registro
    // logContextTokens,           // ❌ No se usa - comentado para registro
    logOpenAIUsage,
    logOpenAILatency,
    logFallbackTriggered,
    logPerformanceMetrics,
    // 🔧 ETAPA 3: Nuevas funciones de tracing
    logRequestTracing,
    logToolOutputsSubmitted,
    logAssistantNoResponse,
    // logFlowStageUpdate,         // ❌ No se usa - comentado para registro
    startRequestTracing,
    updateRequestStage,
    registerToolCall,
    updateToolCallStatus,
    endRequestTracing
} from './utils/logging/index.js';
import { threadPersistence } from './utils/persistence/index.js';
// 🔧 IMPORTS OBSOLETOS COMENTADOS PARA REGISTRO
// import { getChatHistory } from './utils/whapi/index';  // ❌ No se usa - comentado para registro
import { guestMemory } from './utils/persistence/index';
import { whapiLabels } from './utils/whapi/index';
import { getConfig } from './config/environment';

// Importar sistema de monitoreo
import { botDashboard } from './utils/monitoring/dashboard.js';
import metricsRouter, { 
    incrementFallbacks, 
    setTokensUsed, 
    setLatency, 
    incrementMessages
    // 🔧 IMPORTS OBSOLETOS COMENTADOS PARA REGISTRO
    // updateActiveThreads  // ❌ No se usa - comentado para registro
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

// 🔧 SIMPLIFICADO: UN SOLO BUFFER UNIFICADO - 5 SEGUNDOS PARA TODO
const globalMessageBuffers = new Map<string, {
    messages: string[],
    chatId: string,
    userName: string,
    lastActivity: number,
    timer: NodeJS.Timeout | null
}>();
const BUFFER_WINDOW_MS = 5000; // 5 segundos fijos para mensajes, typing, hooks, entrada manual

// 🔧 ELIMINADOS: Buffers obsoletos y redundantes
// const userMessageBuffers = new Map<string, { messages: string[], chatId: string, name: string, lastActivity: number }>();
// const userActivityTimers = new Map<string, NodeJS.Timeout>();
// const userTypingState = new Map();
// const manualMessageBuffers = new Map<string, { messages: string[], agentName: string, timestamp: number }>();
// const manualTimers = new Map<string, NodeJS.Timeout>();

const botSentMessages = new Set<string>();

// 🔧 ELIMINADOS: Caches duplicados migrados a historyInjection.ts
// Los caches historyCache y contextInjectionCache ahora están centralizados
// en el módulo historyInjection.ts para evitar duplicación y optimizar memoria

const MAX_MESSAGE_LENGTH = 5000;

// 🔧 NUEVO: Sistema de typing dinámico
// Configuración de timeouts optimizada para mejor UX
// 🔧 CONSTANTES OBSOLETAS COMENTADAS PARA REGISTRO
// const FALLBACK_TIMEOUT = 2000; // 2 segundos si no hay typing detectable (más rápido)  // ❌ No se usa - comentado para registro
// const POST_TYPING_DELAY = 3000; // 3 segundos después de que deje de escribir (más natural)  // ❌ No se usa - comentado para registro
// const MAX_BUFFER_SIZE = 10; // Límite máximo de mensajes por buffer (anti-spam)  // ❌ No se usa - comentado para registro
// const MAX_BOT_MESSAGES = 1000;  // ❌ No se usa - comentado para registro

// 🔧 NUEVO: Sistema de locks simplificado con colas
async function acquireThreadLock(userId: string): Promise<boolean> {
    return await simpleLockManager.acquireUserLock(userId);
}

function releaseThreadLock(userId: string): void {
    simpleLockManager.releaseUserLock(userId);
}

// 🔧 ELIMINADO: Función generateHistorialSummary obsoleta
// El sistema ahora usa get_conversation_context para contexto histórico
// OpenAI puede solicitar el contexto que necesite usando la función registrada

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
        logFatal('SYSTEM_CRASH', 'Excepción no capturada causando crash del sistema', {
            error: error.message,
            origin,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            processUptime: process.uptime(),
            memoryUsage: process.memoryUsage()
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
        logFatal('PROMISE_REJECTION', 'Rechazo de promesa no manejado causando crash del sistema', {
            error: error.message,
            promise: promise.toString(),
            stack: error.stack,
            timestamp: new Date().toISOString(),
            processUptime: process.uptime(),
            memoryUsage: process.memoryUsage()
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
    // 🔧 NUEVO: Inicializar dashboard web
    botDashboard.setupRoutes(app);
    
    app.get('/health', (req, res) => {
        const stats = threadPersistence.getStats();
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: appConfig.environment,
            port: appConfig.port,
            initialized: isServerInitialized,
            activeBuffers: globalMessageBuffers.size,
            threadStats: stats,
            // 🔧 ETAPA 1: Información adicional de threads para debug
            threadInfo: {
                totalThreads: stats.totalThreads,
                activeThreads: stats.activeThreads,
                inactiveThreads: stats.totalThreads - stats.activeThreads,
                lastCleanup: new Date().toISOString()
            },
            // 🔧 ETAPA 2: Información del cache centralizado en historyInjection.ts
            centralizedCache: {
                description: "Caches centralizados en historyInjection.ts para optimizar memoria",
                modules: ["historyCache", "contextInjectionCache", "injectionCache"],
                cleanupInterval: "10 minutos"
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
    app.post('/locks/clear', (req: any, res: any) => {
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
    const subscribedPresences = new Set<string>();
    
    // 🔧 NUEVO: Cache para contexto temporal (evitar envío repetitivo)
    const contextCache = new Map<string, { context: string, timestamp: number }>();
    const CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos // Rastrea usuarios suscritos
    
    // 🔧 NUEVO: Funciones para buffering proactivo global
    function addToGlobalBuffer(userId: string, messageText: string, chatId: string, userName: string): void {
        let buffer = globalMessageBuffers.get(userId);
        
        if (!buffer) {
            buffer = {
                messages: [],
                chatId,
                userName,
                lastActivity: Date.now(),
                timer: null
            };
            globalMessageBuffers.set(userId, buffer);
        }
        
        // Agregar mensaje al buffer
        buffer.messages.push(messageText);
        buffer.lastActivity = Date.now();
        
        // 🔧 UNIFICADO: Reiniciar timer de 5 segundos (igual que typing)
        if (buffer.timer) {
            clearTimeout(buffer.timer);
        }
        buffer.timer = setTimeout(() => processGlobalBuffer(userId), BUFFER_WINDOW_MS);
        
        console.log(`📥 [BUFFER] ${userName}: "${messageText.substring(0, 30)}..." → ⏳ 5s...`);
        
        logInfo('GLOBAL_BUFFER_ADD', `Mensaje agregado al buffer global`, {
            userJid: getShortUserId(userId),
            userName,
            messageText: messageText.substring(0, 50) + '...',
            bufferSize: buffer.messages.length,
            delay: BUFFER_WINDOW_MS,
            environment: appConfig.environment
        });
    }
    
    // 🔧 NUEVO: Función unificada para typing (mismo timer que mensajes)
    function updateTypingStatus(userId: string, isTyping: boolean): void {
        const buffer = globalMessageBuffers.get(userId);
        if (!buffer) return;
        
        // 🔧 UNIFICADO: Reiniciar timer de 5 segundos cuando llega typing
        if (buffer.timer) {
            clearTimeout(buffer.timer);
        }
        
        // CRÍTICO: Mismo timer de 5 segundos que para mensajes
        buffer.timer = setTimeout(() => processGlobalBuffer(userId), BUFFER_WINDOW_MS);
        
        console.log(`✍️ [TYPING] ${buffer.userName}: Escribiendo... → ⏳ 5s...`);
        
        logInfo('GLOBAL_BUFFER_TYPING', `Timer reiniciado por typing`, {
            userJid: getShortUserId(userId),
            userName: buffer.userName,
            delay: BUFFER_WINDOW_MS,
            environment: appConfig.environment
        });
    }
    
    async function processGlobalBuffer(userId: string): Promise<void> {
        const buffer = globalMessageBuffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            globalMessageBuffers.delete(userId);
            return;
        }
        
        // 🚀 SIMPLIFICADO: Sin filtros - todos los mensajes van a OpenAI
        const combinedText = buffer.messages
            .join(' ')
            .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
            .trim();
        
        const messageCount = buffer.messages.length;
        
        // 🔧 SIMPLIFICADO: Procesar inmediatamente después de 5 segundos
        console.log(`🔄 [BUFFER_PROCESS] ${buffer.userName}: ${messageCount} mensajes → "${combinedText.substring(0, 40)}..."`);
        
        logInfo('GLOBAL_BUFFER_PROCESS', `Procesando buffer global después de 5 segundos`, {
            userJid: getShortUserId(userId),
            userName: buffer.userName,
            messageCount,
            combinedText: combinedText.substring(0, 100) + '...',
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
                // Cancelar runs que están en estado activo por más de 10 minutos
                if (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                    // 🔧 ETAPA 3: Corregir timestamp - OpenAI usa Unix timestamp en segundos
                    const runCreatedAt = typeof run.created_at === 'number' 
                        ? run.created_at * 1000  // OpenAI usa Unix timestamp en segundos
                        : new Date(run.created_at).getTime();
                    
                    const runAge = Date.now() - runCreatedAt;
                    const ageMinutes = Math.floor(runAge / 60000);
                    
                    // Solo cancelar si realmente es viejo (más de 10 minutos)
                    if (ageMinutes > 10) {
                        try {
                            await openaiClient.beta.threads.runs.cancel(threadId, run.id);
                            cancelledCount++;
                            
                            logWarning('OLD_RUN_CANCELLED', `Run huérfano cancelado automáticamente`, {
                                userId: getShortUserId(userId),
                                threadId,
                                runId: run.id,
                                status: run.status,
                                ageMinutes
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
                                combinedText: combinedText.substring(0, 50) + '...',
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
        
        // 🔧 ETAPA 2.2: Chequeo de run activo antes de agregar a cola
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                const isActive = await isRunActive(shortUserId);
                if (isActive) {
                    logWarning('RUN_ACTIVE_BEFORE_QUEUE', `Run activo detectado antes de agregar a cola`, {
                        userJid: shortUserId,
                        userName,
                        attempt: retryCount + 1,
                        environment: appConfig.environment
                    });
                    
                    // Esperar 1s y retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retryCount++;
                    continue;
                }
                
                // No hay run activo, proceder normalmente
                break;
            } catch (error) {
                logError('RUN_CHECK_ERROR', `Error verificando runs para ${userName}`, {
                    userJid: shortUserId,
                    error: error.message,
                    environment: appConfig.environment
                });
                break; // Continuar sin verificación si falla
            }
        }
        
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
    
    // 🚀 ELIMINADO: Función de análisis de disponibilidad arbitrario
    // OpenAI ahora decide si necesita más información para consultas de disponibilidad

    // Función para analizar si necesita inyección de contexto
    // 🚀 ELIMINADO: Función de análisis de contexto arbitrario
    // OpenAI ahora decide cuándo necesita contexto usando get_conversation_context

    // Función para obtener contexto relevante del historial
    async function getRelevantContext(userId: string, requestId?: string): Promise<string> {
        try {
            const shortUserId = getShortUserId(userId);
            const now = Date.now();
            
            // Verificar cache
            const cached = contextCache.get(shortUserId);
            if (cached && (now - cached.timestamp) < CONTEXT_CACHE_TTL) {
                logInfo('CONTEXT_CACHE_HIT', 'Contexto temporal desde cache', {
                    userId: shortUserId,
                    cacheAge: Math.round((now - cached.timestamp) / 1000),
                    requestId
                });
                return cached.context;
            }
            
            // Obtener perfil del usuario (incluye etiquetas)
            const profile = await guestMemory.getOrCreateProfile(userId);
            // Obtener información del chat desde Whapi
            const chatInfo = await whapiLabels.getChatInfo(userId);
            
            // 🔧 NUEVO: Contexto temporal MUY corto
            const clientName = profile?.name || 'Cliente';
            const contactName = chatInfo?.name || clientName;
            const currentTime = new Date().toLocaleTimeString('es-ES', { 
                timeZone: 'America/Bogota',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Etiquetas del perfil y Whapi (solo las primeras 2)
            const profileLabels = profile?.whapiLabels?.map((l: any) => l.name) || [];
            const chatLabels = chatInfo?.labels?.map((l: any) => l.name) || [];
            const allLabels = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2); // Solo 2 etiquetas
            
            // Construir contexto temporal MUY corto
            let context = `[${clientName} | ${currentTime}`;
            if (allLabels.length > 0) {
                context += ` | ${allLabels.join(', ')}`;
            }
            context += `]\n\n`;
            
            // Guardar en cache
            contextCache.set(shortUserId, { context, timestamp: now });
            
            logInfo('CONTEXT_INJECTION', 'Contexto temporal generado', {
                userId: shortUserId,
                contextLength: context.length,
                clientName,
                contactName,
                labelsCount: allLabels.length,
                hasProfile: !!profile,
                hasChatInfo: !!chatInfo,
                requestId
            });
            return context;
        } catch (error) {
            logError('CONTEXT_INJECTION_ERROR', 'Error obteniendo contexto temporal', {
                userId: getShortUserId(userId),
                error: error.message,
                requestId
            });
            return '';
        }
    }

    // 🔧 NUEVO: Función para procesar mensajes agrupados con sistema de colas
    async function processUserMessages(userId: string) {
        const buffer = globalMessageBuffers.get(userId);
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

            // 🚀 SIMPLIFICADO: OpenAI decide todo - sin análisis arbitrario
            logInfo('MESSAGE_PROCESS', `Procesando mensajes agrupados`, {
                userId,
                shortUserId,
                chatId: buffer.chatId,
                messageCount: buffer.messages.length,
                totalLength: combinedMessage.length,
                preview: combinedMessage.substring(0, 100) + '...',
                environment: appConfig.environment,
                requestId
            });

            // Sincronizar labels/perfil antes de procesar
            await guestMemory.getOrCreateProfile(userId, false);

            // 🔧 ETAPA 3: Actualizar etapa del flujo
            updateRequestStage(requestId, 'processing');

            // Log compacto - Inicio
            console.log(`🤖 [BOT] ${buffer.messages.length} msgs → OpenAI`);
            
            // Enviar a OpenAI con el userId original y la información completa del cliente
            const startTime = Date.now();
            const response = await processWithOpenAI(combinedMessage, userId, buffer.chatId, buffer.userName, requestId);
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
            // 🔧 ETAPA 3.2: Cleanup unificado se maneja automáticamente

            // Limpiar buffer, timer y estado de typing
            globalMessageBuffers.delete(userId);
            if (globalMessageBuffers.has(userId)) {
                clearTimeout(globalMessageBuffers.get(userId)!.timer);
                globalMessageBuffers.delete(userId);
            }
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
    const processWithOpenAI = async (userMsg: string, userJid: string, chatId: string = null, userName: string = null, requestId?: string): Promise<string> => {
        const shortUserId = getShortUserId(userJid);
        
        // 🔧 ETAPA 1: Tracking de métricas de performance
        const startTime = Date.now();
        let contextTokens = 0;
        let totalTokens = 0;
        // Variables eliminadas - funcionalidad movida a historyInjection.ts
        
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
            
            // 🔧 ETAPA 4: Cleanup simplificado - solo si es thread nuevo
            if (threadId && isNewThread) {
                try {
                    const cleanedRuns = await cleanupOldRuns(threadId, shortUserId);
                    if (cleanedRuns > 0) {
                        logInfo('CLEANUP_RUNS_INTEGRATED', `Runs huérfanos limpiados al inicio`, {
                            shortUserId,
                            threadId,
                            cleanedRuns,
                            requestId
                        });
                    }
                } catch (cleanupError) {
                    logWarning('CLEANUP_RUNS_ERROR', 'Error en cleanup de runs al inicio', {
                        shortUserId,
                        threadId,
                        error: cleanupError.message,
                        requestId
                    });
                    // Continuar sin cleanup si falla
                }
            }
            
            // 🔧 NUEVO: Usar función modularizada de inyección de historial
            if (config.enableHistoryInject) {
                try {
                    const injectionResult = await injectHistory(
                        threadId, 
                        userJid, 
                        chatId, 
                        isNewThread, 
                        undefined, // contextAnalysis - ya no se usa
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
             
             // 🔧 ELIMINADO: Lógica de resumen automático obsoleta
             // El sistema ahora usa get_conversation_context para contexto histórico
             // OpenAI puede solicitar el contexto que necesite usando la función registrada
             
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
                     
                     // No hay runs activos, agregar mensaje con contexto temporal
                     // 🔧 NUEVO: Obtener contexto temporal para cada mensaje
                     const temporalContext = await getRelevantContext(userJid, requestId);
                     const messageWithContext = temporalContext + userMsg;
                     
                     await openaiClient.beta.threads.messages.create(threadId, {
                         role: 'user',
                         content: messageWithContext
                     });
                     
                     logOpenAIRequest('message_added_with_context', { 
                         shortUserId,
                         originalLength: userMsg.length,
                         contextLength: temporalContext.length,
                         totalLength: messageWithContext.length,
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
             
             // 🔧 ELIMINADO: Mensaje interino duplicado - ya se envía específicamente en function calling
            
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
                
                // 🔧 ELIMINADO: Timer interino duplicado
                
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
                
                // 🔧 ETAPA 2: MENSAJE INTERINO INTELIGENTE
                const hasAvailabilityCheck = toolCalls.some(tc => 
                    tc.function.name === 'check_availability'
                );
                
                if (hasAvailabilityCheck && chatId) {
                    // Enviar mensaje INMEDIATAMENTE
                    await sendWhatsAppMessage(chatId, "Permítame consultar disponibilidad en mi sistema... 🔍");
                    logInfo('AVAILABILITY_INTERIM_SENT', 'Mensaje interino enviado', { 
                        userId: shortUserId,
                        chatId,
                        environment: appConfig.environment,
                        requestId
                    });
                }
                
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
                
                // 🔧 ETAPA 3.3: Polling post-tool mejorado con backoff progresivo
                // Log inmediato después de submit para depuración
                logInfo('POST_SUBMIT_STATUS', 'Status después de submit tool outputs', { 
                    shortUserId,
                    runId: run.id,
                    runStatus: run.status,
                    requestId
                });
                
                // Delay inicial para dar tiempo a OpenAI de actualizar status
                await new Promise(resolve => setTimeout(resolve, 1000)); // Reducido de 2s a 1s
                
                let postAttempts = 0;
                const maxPostAttempts = 5; // Aumentado de 3 a 5 para más robustez
                
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
                    
                    // 🔧 ETAPA 3.3: Backoff progresivo (1s, 2s, 3s, 4s, 5s)
                    const backoffDelay = Math.min((postAttempts + 1) * 1000, 5000);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
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
            // 🔧 SIMPLIFICADO: Manejo de context length exceeded - solo crear nuevo thread
            if (error?.code === 'context_length_exceeded' || 
                error?.message?.includes('maximum context length') ||
                error?.message?.includes('context_length_exceeded')) {
                
                logWarning('CONTEXT_LENGTH_EXCEEDED', 'Context length exceeded, creando nuevo thread limpio', {
                    shortUserId,
                    threadId: threadPersistence.getThread(shortUserId)?.threadId,
                    error: error.message,
                    requestId
                });
                
                try {
                    // Crear nuevo thread limpio (sin resumen automático)
                    const newThread = await openaiClient.beta.threads.create();
                    const oldThreadId = threadPersistence.getThread(shortUserId)?.threadId;
                    
                    // Actualizar persistencia con nuevo thread
                    threadPersistence.setThread(shortUserId, newThread.id, chatId, userName);
                    
                    logSuccess('NEW_THREAD_CREATED', 'Nuevo thread creado para manejar context length exceeded', {
                        shortUserId,
                        oldThreadId,
                        newThreadId: newThread.id,
                        requestId
                    });
                    
                    // Reintentar con nuevo thread
                    releaseThreadLock(shortUserId);
                    return await processWithOpenAI(userMsg, userJid, chatId, userName, requestId);
                    
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
                        updateTypingStatus(userId, true);
                        
                        console.log(`✍️ ${shortUserId} está escribiendo... (extendiendo buffer)`);
                        
                    } else if (status === 'online' || status === 'offline' || status === 'pending') {
                        // Usuario dejó de escribir - actualizar estado global
                        if (globalMessageBuffers.has(userId)) {
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
                // 🔧 PROCESAR MENSAJES MANUALES DEL AGENTE (from_me: true)
                if (message.from_me && message.type === 'text' && message.text?.body) {
                    
                    // 🚫 FILTRAR: Verificar si es un mensaje del bot (no manual)
                    if (botSentMessages.has(message.id)) {
                        logDebug('BOT_MESSAGE_FILTERED', `Mensaje del bot ignorado: ${message.id}`);
                        continue; // Saltar, no es un mensaje manual real
                    }
                    
                    // ✅ Es un mensaje manual real del agente
                    const chatId = message.chat_id;
                    const text = message.text.body.trim();
                    const fromName = message.from_name || 'Agente';
                    const shortClientId = getShortUserId(chatId);
                    
                    // Verificar si hay thread activo
                    const threadRecord = threadPersistence.getThread(shortClientId);
                    if (!threadRecord) {
                        console.log(`⚠️  [AGENT] Sin conversación activa con ${shortClientId}`);
                        logWarning('MANUAL_NO_THREAD', `No hay conversación activa`, { 
                            shortClientId: shortClientId,
                            agentName: fromName,
                            reason: 'cliente_debe_escribir_primero'
                        });
                        continue;
                    }
                    
                    // 🎯 Log compacto - Solo primer mensaje del grupo
                    if (!globalMessageBuffers.has(chatId)) {
                        const clientName = threadRecord.userName || 'Cliente';
                        console.log(`🔧 [AGENT] ${fromName} → ${clientName}: "${text.substring(0, 25)}${text.length > 25 ? '...' : ''}"`);
                    }
                    
                    // Solo log técnico detallado
                    logInfo('MANUAL_DETECTED', `Mensaje manual del agente detectado`, {
                        shortClientId: shortClientId,
                        agentName: fromName,
                        messageText: text.substring(0, 100),
                        messageLength: text.length,
                        timestamp: new Date().toISOString(),
                        chatId: chatId
                    });
                    
                    // 📦 AGRUPAR MENSAJES MANUALES (usando buffer global)
                    if (!globalMessageBuffers.has(chatId)) {
                        globalMessageBuffers.set(chatId, {
                            messages: [],
                            chatId: chatId,
                            userName: fromName,
                            lastActivity: Date.now(),
                            timer: null
                        });
                        logInfo('MANUAL_BUFFER_CREATE', `Buffer manual creado`, { 
                            shortClientId: shortClientId, 
                            agentName: fromName 
                        });
                    }
                    
                    const buffer = globalMessageBuffers.get(chatId)!;
                    buffer.messages.push(text);
                    buffer.lastActivity = Date.now();
                    
                    // Solo log técnico
                    logInfo('MANUAL_BUFFERING', `Mensaje manual agregado al buffer`, {
                        shortClientId: shortClientId,
                        bufferCount: buffer.messages.length,
                        agentName: fromName,
                        timeoutSeconds: BUFFER_WINDOW_MS / 1000
                    });
                    
                    // Cancelar timer anterior si existe
                    if (buffer.timer) {
                        clearTimeout(buffer.timer);
                    }
                    
                    // Establecer nuevo timer de 5 segundos (igual que mensajes normales)
                    buffer.timer = setTimeout(async () => {
                        const finalBuffer = globalMessageBuffers.get(chatId);
                        if (finalBuffer && finalBuffer.messages.length > 0) {
                            const combinedMessage = finalBuffer.messages.join(' ');
                            
                            try {
                                // Solo logs técnicos
                                logInfo('MANUAL_PROCESSING', `Procesando mensajes manuales agrupados`, {
                                    shortClientId: shortClientId,
                                    messageCount: finalBuffer.messages.length,
                                    agentName: finalBuffer.userName,
                                    combinedLength: combinedMessage.length,
                                    preview: combinedMessage.substring(0, 100),
                                    threadId: threadRecord.threadId
                                });
                                
                                logInfo('MANUAL_SYNC_START', `Iniciando sincronización con OpenAI`, {
                                    shortClientId: shortClientId,
                                    threadId: threadRecord.threadId,
                                    messagePreview: combinedMessage.substring(0, 50),
                                    agentName: finalBuffer.userName
                                });
                                
                                // 1. Agregar contexto del sistema - INSTRUCCIÓN SIMPLE
                                await openaiClient.beta.threads.messages.create(threadRecord.threadId, {
                                    role: 'user',
                                    content: `[Mensaje manual escrito por agente ${finalBuffer.userName} - NO RESPONDER]`
                                });
                                
                                // 2. Agregar el mensaje manual agrupado
                                await openaiClient.beta.threads.messages.create(threadRecord.threadId, {
                                    role: 'assistant',
                                    content: combinedMessage
                                });
                                
                                // 3. Actualizar thread
                                threadPersistence.setThread(shortClientId, threadRecord.threadId, chatId, finalBuffer.userName);
                                
                                // 🎯 Log compacto final
                                const msgCount = finalBuffer.messages.length > 1 ? `${finalBuffer.messages.length} msgs` : '1 msg';
                                console.log(`✅ [BOT] Enviado a 🤖 OpenAI → Contexto actualizado (${msgCount})`);
                                
                                // Solo log técnico
                                logSuccess('MANUAL_SYNC_SUCCESS', `Mensajes manuales sincronizados exitosamente`, {
                                    shortClientId: shortClientId,
                                    agentName: finalBuffer.userName,
                                    messageCount: finalBuffer.messages.length,
                                    totalLength: combinedMessage.length,
                                    preview: combinedMessage.substring(0, 100),
                                    threadId: threadRecord.threadId,
                                    timestamp: new Date().toISOString()
                                });
                                
                            } catch (error) {
                                console.log(`❌ [AGENT] Error sincronizando con OpenAI: ${error.message}`);
                                logError('MANUAL_SYNC_ERROR', `Error sincronizando mensajes manuales`, {
                                    error: error.message,
                                    threadId: threadRecord.threadId,
                                    chatId: shortClientId,
                                    messageCount: finalBuffer.messages.length
                                });
                            }
                        }
                        
                        // Limpiar buffer
                        globalMessageBuffers.delete(chatId);
                    }, BUFFER_WINDOW_MS);
                    
                    continue; // Procesar siguiente mensaje
                }
                
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
    logInfo('ORPHANED_RUNS_RECOVERY_START', 'Iniciando recuperación de runs huérfanos');
    await recoverOrphanedRuns();
    logSuccess('ORPHANED_RUNS_RECOVERY_COMPLETE', 'Recuperación de runs huérfanos completada');
    

    
    // 🔧 ETAPA 3.2: Cleanup automático ya configurado (ver setInterval más abajo)
    
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
    

    
    // 🔧 ETAPA 4: Cleanup optimizado del buffer global
    // Ejecutar cada 10 minutos para limpiar buffers viejos (reducido de 5 a 10)
    setInterval(() => {
        try {
            const now = Date.now();
            let expiredCount = 0;
            
            // Limpiar buffers globales después de 15 minutos de inactividad (aumentado de 10 a 15)
            for (const [userId, buffer] of globalMessageBuffers.entries()) {
                if ((now - buffer.lastActivity) > 15 * 60 * 1000) { // 15 minutos
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
    }, 10 * 60 * 1000); // Cada 10 minutos (reducido de 5 a 10)
    
    // 🔧 ETAPA 3.2: Eliminada función scheduleTokenCleanup (unificada)
    
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
                            centralizedCache: "Caches centralizados en historyInjection.ts",
                            globalBuffers: globalMessageBuffers.size
                        },
                        uptime: Math.round(process.uptime()) + 's'
                    });
                    
                    if (isHighMemory) {
                        logAlert('HIGH_MEMORY_USAGE', 'Uso alto de memoria detectado', {
                            heapUsedMB: Math.round(heapUsedMB),
                            threshold: 300,
                            heapUsagePercent: Math.round(heapUsagePercentage) + '%',
                            recommendation: 'Monitorear uso de memoria'
                        });
                    }
                    
                    if (isMemoryLeak) {
                        logFatal('MEMORY_LEAK_DETECTED', 'Posible memory leak crítico detectado', {
                            heapUsedMB: Math.round(heapUsedMB),
                            heapUsagePercent: Math.round(heapUsagePercentage) + '%',
                            threshold: 95,
                            recommendation: 'Uso de memoria crítico - considerar optimización o restart inmediato'
                        });
                    }
                    
                } catch (error) {
                    logError('MEMORY_METRICS_ERROR', 'Error obteniendo métricas de memoria', { error: error.message });
                }
            }, 5 * 60 * 1000); // Cada 5 minutos (original)
}

// 🔧 ELIMINADO: Funciones de resumen automático obsoletas
// El sistema ahora usa get_conversation_context para contexto histórico
// OpenAI puede solicitar el contexto que necesite usando la función registrada

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