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
import path from 'path';
import fs from 'fs/promises';

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
    logMessageReceived,
    logOpenAIRequest,
    logOpenAIResponse,
    logFunctionCallingStart,
    logFunctionExecuting,
    logFunctionHandler,
    logThreadCreated,
    logServerStart,
    logOpenAIUsage,
    logOpenAILatency,
    logFallbackTriggered,
    logPerformanceMetrics,
    // 🔧 ETAPA 3: Nuevas funciones de tracing
    logRequestTracing,
    logToolOutputsSubmitted,
    logAssistantNoResponse,
    startRequestTracing,
    updateRequestStage,
    registerToolCall,
    updateToolCallStatus,
    endRequestTracing
} from './utils/logging/index.js';
import { threadPersistence } from './utils/persistence/index.js';
// 🔧 IMPORTS OBSOLETOS COMENTADOS PARA REGISTRO
import { guestMemory } from './utils/persistence/index.js';
import { whapiLabels } from './utils/whapi/index.js';
import { getConfig } from './config/environment';

// NUEVO: Importar tipo UserState para funcionalidades media
import type { UserState } from './utils/userStateManager.js';

// Importar sistema de monitoreo
import { botDashboard } from './utils/monitoring/dashboard.js';

// Importar validador de respuestas
import { validateAndCorrectResponse } from './utils/response-validator.js';

// Estructura para manejar retry counts por usuario (evitar loops)
const userRetryState = new Map<string, { retryCount: number; lastRetryTime: number }>();
import metricsRouter, { 
    incrementFallbacks, 
    setTokensUsed, 
    setLatency, 
    incrementMessages
    // 🔧 IMPORTS OBSOLETOS COMENTADOS PARA REGISTRO
} from './routes/metrics.js';

// Importar nuevo módulo modularizado de inyección de historial/contexto
import { cleanupExpiredCaches, getCacheStats } from './utils/context/historyInjection.js';

// Importar nuevo sistema de locks simplificado
import { simpleLockManager } from './utils/simpleLockManager.js';

// Agregar al inicio del archivo (después de los imports)
// 🔧 NUEVO: Sistema de logs limpios para terminal
const terminalLog = {
    // Logs principales con formato limpio
    message: (user: string, text: string) => {
        const logMsg = `👤 ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}}"`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    typing: (user: string) => {
        console.log(`✍️ ${user} está escribiendo...`);
    },
    
    processing: (user: string) => {
        // 🔧 ELIMINADO: No mostrar en terminal
    },
    
    response: (user: string, text: string, duration: number) => {
        const logMsg = `🤖 OpenAI → ${user} (${(duration/1000).toFixed(1)}s)`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    error: (message: string) => {
        console.log(`❌ Error: ${message}`);
    },
    
    openaiError: (user: string, error: string) => {
        console.log(`❌ Error enviar a OpenAI → ${user}: ${error}`);
    },
    
    imageError: (user: string, error: string) => {
        console.log(`❌ Error al procesar imagen → ${user}: ${error}`);
    },
    
    voiceError: (user: string, error: string) => {
        console.log(`❌ Error al procesar audio → ${user}: ${error}`);
    },
    
    functionError: (functionName: string, error: string) => {
        console.log(`❌ Error en función ${functionName}: ${error}`);
    },
    
    whapiError: (operation: string, error: string) => {
        console.log(`❌ Error WHAPI (${operation}): ${error}`);
    },
    
    // 🔧 OPTIMIZADO: Logs de function calling más limpios
    functionStart: (name: string, args?: any) => {
        if (name === 'check_availability' && args) {
            const { startDate, endDate } = args;
            const start = startDate?.split('-').slice(1).join('/'); // MM/DD
            const end = endDate?.split('-').slice(1).join('/');     // MM/DD
            const nights = args.endDate && args.startDate ? 
                Math.round((new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / (1000 * 60 * 60 * 24)) : '?';
            console.log(`⚙️ check_availability(${start}-${end}, ${nights} noches)`);
        } else {
            console.log(`⚙️ ${name}()`);
        }
    },
    
    functionProgress: (name: string, step: string, data?: any) => {
        // Eliminado - logs redundantes
    },
    
    functionCompleted: (name: string, result?: any, duration?: number) => {
        // Eliminado - se maneja en availabilityResult
    },
    
    startup: () => {
        console.clear();
        console.log('\n=== Bot TeAlquilamos Iniciado ===');
        console.log(`🚀 Servidor: ${appConfig?.host || 'localhost'}:${appConfig?.port || 3008}`);
        console.log(`🔗 Webhook: ${appConfig?.webhookUrl || 'configurando...'}`);
        console.log('✅ Sistema listo\n');
    },
    
    newConversation: (user: string) => {
        console.log(`\n📨 Nueva conversación con ${user}`);
    },
    
    image: (user: string) => {
        console.log(`📷 ${user}: [Imagen recibida]`);
    },
    
    voice: (user: string) => {
        const logMsg = `🎤 ${user}: [Nota de voz recibida]`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    recording: (user: string) => {
        console.log(`🎙️ ${user} está grabando...`);
    },
    
    // 🆕 Log específico para resultados de disponibilidad
    availabilityResult: (completas: number, splits: number, duration?: number) => {
        const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
        const logMsg = `🏠 ${completas} completa${completas !== 1 ? 's' : ''} + ${splits} alternativa${splits !== 1 ? 's' : ''}${durationStr}`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    // 🆕 Log para APIs externas
    externalApi: (service: string, action: string, result?: string) => {
        const timestamp = new Date().toLocaleTimeString();
        if (result) {
            console.log(`🔗 [${timestamp}] ${service} → ${action} → ${result}`);
        } else {
            console.log(`🔗 [${timestamp}] ${service} → ${action}...`);
        }
    }
};

// 🔧 NUEVO: Rate limiting para logs spam
const webhookCounts = new Map<string, { lastLog: number; count: number }>();
// 🔧 NUEVO: Rate limiting para logs de typing (10 s)
const typingLogTimestamps = new Map<string, number>();
// 🔧 NUEVO: Cache para información de chat (evitar llamadas redundantes)
const chatInfoCache = new Map<string, { data: any; timestamp: number }>();
const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// 🔧 NUEVO: Cache para contexto temporal (evitar envío repetitivo)
const contextCache = new Map<string, { context: string, timestamp: number }>();
const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora

// 🔧 NUEVO: Control de logs de function calling en terminal
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false'; // true por defecto

// --- Variables Globales ---
let appConfig: AppConfig;
let openaiClient: OpenAI;
let server: http.Server;
let isServerInitialized = false;

// 🔧 NUEVO: Control de procesamiento activo para evitar duplicados
const activeProcessing = new Set<string>();

// 🔧 SIMPLIFICADO: UN SOLO BUFFER UNIFICADO - 5 SEGUNDOS PARA TODO
const globalMessageBuffers = new Map<string, {
    messages: string[],
    chatId: string,
    userName: string,
    lastActivity: number,
    timer: NodeJS.Timeout | null,
    currentDelay?: number  // 🔧 NUEVO: Delay actual del timer para comparaciones
}>();
const BUFFER_WINDOW_MS = 5000; // 5 segundos para agrupar mensajes normales
const TYPING_EXTENDED_MS = 10000; // 10 segundos cuando usuario está escribiendo/grabando

// 🔧 ELIMINADOS: Buffers obsoletos y redundantes
// const userMessageBuffers = new Map<string, { messages: string[], chatId: string, name: string, lastActivity: number }>();

// 🟡 OPTIMIZACIÓN: Buffer simple para imágenes pendientes
const pendingImages = new Map<string, string[]>(); // userId -> imageUrls[]
// const userActivityTimers = new Map<string, NodeJS.Timeout>();
// const userTypingState = new Map();
// const manualMessageBuffers = new Map<string, { messages: string[], agentName: string, timestamp: number }>();
// const manualTimers = new Map<string, NodeJS.Timeout>();

const botSentMessages = new Set<string>();

// NUEVO: Map global para estados de usuario (funcionalidades media)
const globalUserStates = new Map<string, UserState>();

// Map temporal para attachments de funciones
const globalAttachments = new Map<string, any>();

// 🔧 ELIMINADOS: Caches duplicados migrados a historyInjection.ts
// Los caches historyCache y contextInjectionCache ahora están centralizados
// en el módulo historyInjection.ts para evitar duplicación y optimizar memoria

const MAX_MESSAGE_LENGTH = 5000;

// NUEVO: Función helper para timestamps
const getTimestamp = () => new Date().toISOString();

// 🔧 NUEVO: Función helper para crear/obtener UserState
function getOrCreateUserState(userId: string, chatId?: string, userName?: string): UserState {
    let userState = globalUserStates.get(userId);
    if (!userState) {
        userState = {
            userId,
            isTyping: false,
            lastTypingTimestamp: 0,
            lastMessageTimestamp: 0,
            messages: [],
            chatId: chatId || `${userId}@s.whatsapp.net`,
            userName: userName || 'Usuario',
            typingEventsCount: 0,
            averageTypingDuration: 0,
            lastInputVoice: false,
            lastTyping: 0  // 🔧 NUEVO: Timestamp del último typing detectado
        };
        globalUserStates.set(userId, userState);
    }
    return userState;
}

// 🔧 NUEVO: Función helper para obtener información de chat con cache
export async function getCachedChatInfo(userId: string): Promise<any> {
    const now = Date.now();
    const cached = chatInfoCache.get(userId);
    
    if (cached && (now - cached.timestamp) < CHAT_INFO_CACHE_TTL) {
        logInfo('CACHE_HIT', 'Chat info desde cache', {
            userId: getShortUserId(userId),
            cacheAge: Math.round((now - cached.timestamp) / 1000)
        });
        return cached.data;
    }
    
    try {
        const chatInfo = await whapiLabels.getChatInfo(userId);
        chatInfoCache.set(userId, { data: chatInfo, timestamp: now });
        return chatInfo;
    } catch (error) {
        logWarning('CHAT_INFO_CACHE_ERROR', `Error obteniendo info de chat para ${userId}`, {
            error: error.message
        });
        return null;
    }
}

// 🟡 OPTIMIZACIÓN: Función para invalidar cachés de usuario cuando cambian datos
export function invalidateUserCaches(userId: string): void {
    const shortUserId = getShortUserId(userId);
    
    // Invalidar cache de chat info
    if (chatInfoCache.has(userId)) {
        chatInfoCache.delete(userId);
        logInfo('CACHE_INVALIDATED', 'Cache de chat info invalidado', { userId: shortUserId });
    }
    
    // Invalidar cache de contexto temporal
    if (contextCache.has(shortUserId)) {
        contextCache.delete(shortUserId);
        logInfo('CACHE_INVALIDATED', 'Cache de contexto temporal invalidado', { userId: shortUserId });
    }
}

// NUEVO: Tipos para respuestas de WHAPI
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

// 🔧 NUEVO: Sistema de typing dinámico
// Configuración de timeouts optimizada para mejor UX
// 🔧 CONSTANTES OBSOLETAS COMENTADAS PARA REGISTRO

// 🔧 FUNCIÓN GLOBAL: Transcribir audio - Movida aquí para acceso global
async function transcribeAudio(audioUrl: string | undefined, userId: string, userName?: string, messageId?: string): Promise<string> {
    try {
        // Verificar que appConfig esté cargado
        if (!appConfig) {
            throw new Error('Configuración no cargada');
        }

        let finalAudioUrl = audioUrl;
        
        // Si no hay URL, intentar obtenerla desde WHAPI
        if (!finalAudioUrl && messageId) {
            try {
                const messageResponse = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/${messageId}`, {
                    headers: {
                        'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`
                    }
                });
                
                if (messageResponse.ok) {
                    const messageData = await messageResponse.json() as WHAPIMessage;
                    // Buscar el link en audio, voice o ptt según el tipo
                    finalAudioUrl = messageData.audio?.link || 
                                   messageData.voice?.link || 
                                   messageData.ptt?.link;
                    
                    if (finalAudioUrl) {
                        logSuccess('AUDIO_URL_FETCHED', 'URL de audio obtenida desde WHAPI', {
                            userId: getShortUserId(userId),
                            messageId,
                            type: messageData.type
                        });
                    }
                }
            } catch (error) {
                logError('AUDIO_URL_FETCH_ERROR', 'Error obteniendo URL de audio', {
                    userId: getShortUserId(userId),
                    messageId,
                    error: error.message
                });
            }
        }
        
        if (!finalAudioUrl) {
            throw new Error('No se pudo obtener la URL del audio');
        }
        
        // Descargar el audio
        const audioResponse = await fetch(finalAudioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Error descargando audio: ${audioResponse.status}`);
        }
        
        const audioBuffer = await audioResponse.arrayBuffer();
        
        // Crear archivo temporal en Node.js (compatible con Railway)
        const tempAudioPath = path.join('tmp', `audio_${Date.now()}.ogg`);
        await fs.writeFile(tempAudioPath, Buffer.from(audioBuffer));
        
        // Crear ReadStream para OpenAI (método oficial para Node.js)
        const audioStream = (await import('fs')).createReadStream(tempAudioPath);
        
        // Transcribir con Whisper
        const openai = new OpenAI({ apiKey: appConfig.secrets.OPENAI_API_KEY });
        const transcription = await openai.audio.transcriptions.create({
            file: audioStream as any,
            model: 'whisper-1',
            language: 'es'
        });
        
        // Limpiar archivo temporal para evitar acumulación
        await fs.unlink(tempAudioPath).catch(() => {}); // Ignorar error si falla
        
        logSuccess('AUDIO_TRANSCRIBED', 'Audio transcrito exitosamente', {
            userId: getShortUserId(userId),
            transcriptionLength: transcription.text.length,
            preview: transcription.text.substring(0, 100)
        });
        
        return transcription.text || 'No se pudo transcribir el audio';
        
    } catch (error) {
        // 🔧 NUEVO: Log de error de audio en terminal
        const displayName = userName || getShortUserId(userId);
        terminalLog.voiceError(displayName, error.message);
        
        logError('TRANSCRIPTION_ERROR', 'Error en transcripción de audio', {
            userId: getShortUserId(userId),
            error: error.message
        });
        throw error;
    }
}

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
app.use(express.json({ limit: '50mb' }));
app.use('/metrics', metricsRouter);

// --- Función Principal Asíncrona ---
const main = async () => {
    try {
        // 🟢 LOGS INICIALES LIMPIOS
        console.log('\n🚀 TeAlquilamos Bot - Iniciando...');
        console.log('📅 Timestamp:', new Date().toISOString());
        console.log('🔧 Node.js:', process.version);
        console.log('💾 Memoria inicial:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB');
        console.log('🌍 Entorno:', process.env.NODE_ENV || 'development');
        console.log('─'.repeat(50));
        
        appConfig = await loadAndValidateConfig();
        
        logEnvironmentConfig();
        
        // 🔧 ARREGLO: Inicializar cleanup de threads después de cargar configuración
        threadPersistence.initializeCleanup();
        
        const { secrets } = appConfig;

        openaiClient = new OpenAI({ 
            apiKey: secrets.OPENAI_API_KEY,
            timeout: appConfig.openaiTimeout,
            maxRetries: appConfig.openaiRetries
        });

        // Configurar endpoints y lógica del bot
        setupEndpoints();
        setupWebhooks();

        // Crear e iniciar servidor
        server = http.createServer(app);
        server.listen(appConfig.port, appConfig.host, () => {
            logServerStart('Servidor HTTP iniciado', { 
                host: appConfig.host,
                port: appConfig.port,
                environment: appConfig.environment,
                webhookUrl: appConfig.webhookUrl
            });
            
            initializeBot();
        });

        setupSignalHandlers();
        
    } catch (error) {
        console.error('❌ Error durante inicialización:', error);
        // 🔧 ELIMINADO: Logs de error de configuración - no mostrar en terminal
        
        // Servidor mínimo para que Railway no falle el healthcheck
        const minimalApp = express();
        const port = parseInt(process.env.PORT || '8080');
        
        minimalApp.get('/health', (req, res) => {
            res.status(200).json({
                status: 'minimal',
                error: error.message,
                timestamp: new Date().toISOString(),
                port: port
            });
        });
        
        minimalApp.listen(port, '0.0.0.0', () => {
            // 🔧 ELIMINADO: Logs de servidor mínimo - no mostrar en terminal
        });
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
    
    // Endpoint de health simple que funciona incluso sin configuración completa
    app.get('/health', (req, res) => {
        try {
            const stats = threadPersistence.getStats();
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                environment: appConfig?.environment || 'unknown',
                port: appConfig?.port || process.env.PORT || 'unknown',
                initialized: isServerInitialized,
                activeBuffers: globalMessageBuffers.size,
                threadStats: stats,
                // 🔧 ETAPA 1: Información adicional de threads para debug
            });
        } catch (error) {
            // Respuesta mínima si hay error
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                error: 'Config not loaded',
                port: process.env.PORT || 'unknown'
            });
        }
    });
    
    // Webhook endpoint - siempre disponible
    app.post('/hook', async (req: Request, res: Response) => {
        // 🔧 NUEVO: Responder inmediatamente para evitar timeouts
        res.status(200).json({ 
            received: true, 
            timestamp: new Date().toISOString(),
            environment: appConfig?.environment || 'unknown'
        });
        
        try {
            // Si el servidor no está inicializado, no procesar
            if (!isServerInitialized || !appConfig) {
                logDebug('WEBHOOK_SKIP', 'Webhook recibido pero servidor no inicializado');
                return;
            }
            
            // 🔧 NUEVO: Log detallado del inicio de procesamiento
            logDebug('WEBHOOK_PROCESS_START', 'Iniciando procesamiento webhook', { 
                bodyPreview: JSON.stringify(req.body).substring(0, 200),
                environment: appConfig.environment,
                timestamp: new Date().toISOString()
            });
            
            // 🔧 NUEVO: Filtrado temprano de webhooks
            const { messages, presences, event } = req.body;
            
            // Solo procesar si hay mensajes o presencias relevantes
            if (messages && Array.isArray(messages) && messages.length > 0) {
                logDebug('WEBHOOK_MESSAGES_DETECTED', `Procesando ${messages.length} mensajes`);
            } else if (presences && event?.type === 'presences') {
                logDebug('WEBHOOK_PRESENCES_DETECTED', `Procesando ${presences.length} eventos de presencia`);
            } else {
                // Otros tipos de webhook - no procesar para reducir ruido
                logDebug('WEBHOOK_SKIP_NO_CONTENT', 'Webhook sin contenido relevante');
                return;
            }
            
            // Procesar webhook
            await processWebhook(req.body);
            
            // 🔧 NUEVO: Log de éxito
            logDebug('WEBHOOK_PROCESS_END', 'Webhook procesado exitosamente');
            
        } catch (error) {
            // 🔧 NUEVO: Log más detallado del error
            logError('WEBHOOK_ERROR', 'Error procesando webhook', { 
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                environment: appConfig?.environment,
                bodyPreview: JSON.stringify(req.body).substring(0, 100)
            });
            // 🔧 NUEVO: Evitar crash, solo log
        }
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
    
    // 🔊 NUEVO: Endpoint para servir archivos de audio temporales
    app.get('/audio/:filename', async (req: any, res: any) => {
        try {
            const { filename } = req.params;
            
            // Validar nombre de archivo (soportar .mp3 y .ogg)
            if (!filename || !filename.match(/^voice_\d+_\d+\.(mp3|ogg)$/)) {
                return res.status(400).json({ error: 'Invalid filename' });
            }
            
            const audioPath = path.join('tmp', 'audio', filename);
            
            // Verificar si el archivo existe
            try {
                await fs.access(audioPath);
            } catch {
                return res.status(404).json({ error: 'Audio file not found' });
            }
            
            // Configurar headers para audio según extensión
            const contentType = filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/ogg; codecs=opus';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            
            // Leer y enviar el archivo
            const audioBuffer = await fs.readFile(audioPath);
            res.send(audioBuffer);
            
            logDebug('AUDIO_SERVED', 'Archivo de audio servido', { filename });
            
        } catch (error) {
            logError('AUDIO_SERVE_ERROR', 'Error sirviendo archivo de audio', {
                filename: req.params.filename,
                error: error.message
            });
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    // Agrega más endpoints aquí si es necesario
}

function setupSignalHandlers() {
    const shutdown = (signal: string) => {
        // 🔧 ELIMINADO: Log de shutdown - no mostrar en terminal
        if (appConfig) {
            logInfo('SHUTDOWN', `Señal ${signal} recibida`, { environment: appConfig.environment });
        }
        
        // 🔧 ELIMINADO: Timer de verificación de typing - ya no necesario
        
        if (server) {
            server.close(() => {
                // 🔧 ELIMINADO: Log de servidor cerrado - no mostrar en terminal
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
// --- Funciones auxiliares globales ---

// Función removida: generateVoiceResponse - Simplificado a mensaje de texto únicamente

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
        .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    return cleaned.substring(0, 50) || 'Usuario';
};



// Declaración adelantada de processCombinedMessage
let processCombinedMessage: (userId: string, combinedText: string, chatId: string, userName: string, messageCount: number) => Promise<void>;

// 🔧 NUEVO: Función para verificar auto-timeout de typing periódicamente
// 🔧 ELIMINADO: Función checkTypingTimeouts() - ya no necesaria con el sistema simplificado

// Función para procesar el buffer global
async function processGlobalBuffer(userId: string): Promise<void> {
    const buffer = globalMessageBuffers.get(userId);
    if (!buffer || buffer.messages.length === 0) {
        return;
    }
    
    // 🔧 NUEVO: Verificar typing reciente (<10s desde último), pero procesar inmediatamente si múltiples mensajes
    const userState = globalUserStates.get(userId);
    if (userState?.lastTyping && (Date.now() - userState.lastTyping < TYPING_EXTENDED_MS) && buffer.messages.length === 1) {
        const remainingTime = TYPING_EXTENDED_MS - (Date.now() - userState.lastTyping);
        
        logInfo('BUFFER_PROCESS_DELAYED_BY_RECENT_TYPING', 'Retrasar por typing reciente <10s', {
            userJid: getShortUserId(userId),
            userName: buffer.userName,
            messageCount: buffer.messages.length,
            remainingTime: Math.round(remainingTime / 1000) + 's'
        });
        
        // Re-set timer para esperar full 10s desde último typing (aniquila si existe)
        if (buffer.timer) clearTimeout(buffer.timer);
        buffer.timer = setTimeout(() => {
            const currentBuffer = globalMessageBuffers.get(userId);
            if (currentBuffer) {
                currentBuffer.timer = null;
                processGlobalBuffer(userId);
            }
        }, remainingTime);
        return;
    }
    
    // 🔧 NUEVO: Verificar si hay typing activo (timer extendido)
    if (buffer.timer) {  // Si hay timer activo, significa typing en progreso -> retrasar
        logInfo('BUFFER_PROCESS_DELAYED', 'Procesamiento de buffer retrasado por typing activo', {
            userJid: getShortUserId(userId),
            userName: buffer.userName,
            messageCount: buffer.messages.length,
            remainingTime: TYPING_EXTENDED_MS / 1000 + 's'  // Para debug
        });
        return;  // No procesar ni agregar a cola todavía; el timer se encargará más tarde
    }
    
    // 🔧 SIMPLIFICADO: Verificar si ya hay un procesamiento activo para este usuario
    if (activeProcessing.has(userId)) {
        logWarning('BUFFER_PROCESS_SKIPPED', 'Procesamiento ya activo para usuario', {
            userJid: getShortUserId(userId),
            userName: buffer.userName,
            messageCount: buffer.messages.length
        });
        return;
    }
    
    // Marcar como procesamiento activo
    activeProcessing.add(userId);
    
    // 🔧 NUEVO: Log simple antes de procesar/enviar
    const displayUser = buffer.userName || getShortUserId(userId);
    const wasVoiceInput = userState?.lastInputVoice === true;
    console.log(`⏰ ${wasVoiceInput ? '🎙️' : '✍️'} ${displayUser} dejó de ${wasVoiceInput ? 'grabar' : 'escribir'}.`);
    
    // 🔧 NUEVO: Hacer copia de mensajes para evitar race condition
    const messagesToProcess = [...buffer.messages];
    const bufferInfo = {
        chatId: buffer.chatId,
        userName: buffer.userName
    };
    
    // 🔧 CRÍTICO: Limpiar mensajes del buffer ANTES de procesar
    buffer.messages = [];
    
    // 🚀 SIMPLIFICADO: Sin filtros - todos los mensajes van a OpenAI
    const combinedText = messagesToProcess
        .join('\n')
        .trim();
    
    const messageCount = messagesToProcess.length;
    
    // 🔧 SIMPLIFICADO: Un solo log de procesamiento
    logInfo('GLOBAL_BUFFER_PROCESS', `Procesando buffer global después de ${BUFFER_WINDOW_MS/1000} segundos`, {
        userJid: getShortUserId(userId),
        userName: bufferInfo.userName,
        messageCount,
        combinedText: combinedText.substring(0, 100) + '...',
        environment: appConfig?.environment
    });
    
    try {
        // Procesar mensaje combinado
        if (processCombinedMessage) {
            await processCombinedMessage(userId, combinedText, bufferInfo.chatId, bufferInfo.userName, messageCount);
        }
    } finally {
        // 🔧 NUEVO: Solo limpiar el flag, mantener buffer para nuevos mensajes
        activeProcessing.delete(userId);
        
        // 🔧 NUEVO: Solo eliminar buffer si está vacío
        const currentBuffer = globalMessageBuffers.get(userId);
        if (currentBuffer && currentBuffer.messages.length === 0) {
            globalMessageBuffers.delete(userId);
        }
    }
}

// 🔧 NUEVO: Sistema unificado de timers inteligentes
function setIntelligentTimer(userId: string, chatId: string, userName: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void {
    let buffer = globalMessageBuffers.get(userId);
    
    // Crear buffer si no existe
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
    
    // Determinar delay según prioridad
    const userState = getOrCreateUserState(userId, chatId, userName);
    let bufferDelay = BUFFER_WINDOW_MS; // 5s por defecto
    
    switch (triggerType) {
        case 'message':
            bufferDelay = BUFFER_WINDOW_MS; // 5s
            break;
        case 'voice':
            bufferDelay = 8000; // 8s para notas de voz
            if (userState.isCurrentlyRecording) {
                bufferDelay = 10000; // 10s si está grabando
            }
            break;
        case 'typing':
            bufferDelay = TYPING_EXTENDED_MS; // 10s para typing
            break;
        case 'recording':
            bufferDelay = 10000; // 10s para grabación
            userState.isCurrentlyRecording = true;
            break;
    }
    
    // Aplicar lógica de prioridad: solo reconfigurar si nuevo delay es mayor
    const shouldSetNewTimer = !buffer.timer || (buffer.currentDelay && bufferDelay > buffer.currentDelay);
    
    if (shouldSetNewTimer) {
        // Cancelar timer existente si existe
        if (buffer.timer) {
            clearTimeout(buffer.timer);
            logInfo('BUFFER_TIMER_CANCELLED', `Timer cancelado para reconfigurar con delay mayor`, {
                userJid: getShortUserId(userId),
                oldDelay: buffer.currentDelay,
                newDelay: bufferDelay,
                triggerType
            });
        }
        
        buffer.timer = setTimeout(() => {
            const currentBuffer = globalMessageBuffers.get(userId);
            if (currentBuffer) {
                currentBuffer.timer = null;
                currentBuffer.currentDelay = undefined;
                processGlobalBuffer(userId);
            }
        }, bufferDelay);
        
        buffer.currentDelay = bufferDelay;
        
        logInfo('BUFFER_TIMER_SET', `Timer inteligente configurado`, {
            userJid: getShortUserId(userId),
            userName,
            timerMs: bufferDelay,
            bufferSize: buffer.messages.length,
            triggerType,
            wasReconfigured: !!buffer.timer
        });
    } else {
        logInfo('BUFFER_TIMER_RESPECTED', `Timer existente respetado (delay actual es suficiente)`, {
            userJid: getShortUserId(userId),
            userName,
            bufferSize: buffer.messages.length,
            currentDelay: buffer.currentDelay,
            requestedDelay: bufferDelay,
            triggerType
        });
    }
}

// 🔧 NUEVO: Funciones para buffering proactivo global
function addToGlobalBuffer(userId: string, messageText: string, chatId: string, userName: string, isVoice: boolean = false): void {
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
    } else {
        // 🔧 NUEVO: Actualizar userName del buffer si el actual es mejor
        if (userName && userName !== 'Usuario' && userName !== getShortUserId(userId)) {
            buffer.userName = userName;
        }
    }
    
    // 🔧 NUEVO: Verificar límite de buffer antes de agregar mensaje
    if (buffer.messages.length >= 50) { // Máximo 50 mensajes
        logWarning('BUFFER_LIMIT_REACHED', 'Buffer alcanzó límite máximo', {
            userJid: getShortUserId(userId),
            userName,
            bufferSize: buffer.messages.length
        });
        // Procesar inmediatamente
        if (buffer.timer) clearTimeout(buffer.timer);
        processGlobalBuffer(userId);
        return;
    }
    
    // Agregar mensaje al buffer
    buffer.messages.push(messageText);
    buffer.lastActivity = Date.now();
    
    // 🔧 NUEVO: Marcar que el usuario envió voz
    if (isVoice) {
        const userState = getOrCreateUserState(userId, chatId, userName);
        userState.lastInputVoice = true;
    }
    
    // 🔧 NUEVO: Usar sistema unificado de timers inteligentes
    const triggerType = isVoice ? 'voice' : 'message';
    setIntelligentTimer(userId, chatId, userName, triggerType);
    
    logInfo('GLOBAL_BUFFER_ADD', `Mensaje agregado al buffer global`, {
        userJid: getShortUserId(userId),
        userName,
        messageText: messageText.substring(0, 50) + '...',
        bufferSize: buffer.messages.length,
        delay: BUFFER_WINDOW_MS,
        isMedia: isVoice,
        environment: appConfig?.environment
    });
}

// 🆕 NUEVO: Función helper para enviar recording indicator
async function sendRecordingIndicator(chatId: string): Promise<void> {
    if (!chatId) return;
    
    try {
        await fetch(`${appConfig.secrets.WHAPI_API_URL}/presences/${chatId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                presence: "recording",
                delay: 0
            })
        });
        
        logInfo('RECORDING_INDICATOR_SENT', 'Recording indicator enviado para procesamiento de audio', {
            chatId,
            environment: appConfig.environment
        });
    } catch (error: any) {
        logError('RECORDING_INDICATOR_ERROR', 'Error enviando recording indicator', {
            chatId,
            error: error.message,
            environment: appConfig.environment
        });
    }
}

// Función para detectar contenido sensible (precios, números, enlaces)
function isQuoteOrPriceMessage(message: string): boolean {
    const sensitivePatterns = [
        /\$\d+[.,]?\d*/g,           // $840.000, $210,000
        /\d+[.,]?\d*\s*(cop|pesos?)/gi,  // 840000 COP, 210 pesos
        /\d+\s*noches?/gi,         // 4 noches
        /https?:\/\/\S+/i,         // URLs (enlaces)
        /wa\.me\/p/i               // enlaces específicos de WhatsApp
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(message));
}

// Función para envío de mensajes a WhatsApp con división inteligente en párrafos
async function sendWhatsAppMessage(chatId: string, message: string) {
    const shortUserId = getShortUserId(chatId);
    
    // Verificar si debe responder con voz (si input fue voz)
    const userState = globalUserStates.get(getShortUserId(chatId));
    let shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && 
        userState?.lastInputVoice === true;

    // Forzar texto si es cotización/precio
    if (shouldUseVoice && isQuoteOrPriceMessage(message)) {
        shouldUseVoice = false;  // Responder en texto
        logInfo('VOICE_FORCED_TO_TEXT', 'Respuesta forzada a texto por contenido sensible (precios/números/enlaces)', {
            userId: getShortUserId(chatId),
            messagePreview: message.substring(0, 50)
        });
    }
    
    if (shouldUseVoice) {
        try {
            const voiceLogMsg = `🎤 Generando voz para ${shortUserId}: "${message.substring(0, 50)}..."`;
            console.log(voiceLogMsg);
            botDashboard.addLog(voiceLogMsg);
            
            // Generar audio con OpenAI TTS
            const ttsResponse = await openaiClient.audio.speech.create({
                model: 'tts-1',
                voice: 'nova',
                input: message.substring(0, 4000), // Límite TTS
                response_format: 'mp3'
            });
            
            const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
            const base64Audio = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;
            
            // Enviar como nota de voz
            const voiceResponse = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/voice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: chatId,
                    media: audioDataUrl
                })
            });
            
            if (voiceResponse.ok) {
                logSuccess('VOICE_RESPONSE_SENT', 'Respuesta de voz enviada exitosamente', {
                    userId: shortUserId,
                    messageLength: message.length
                });
                
                // Limpiar flag de voz
                if (userState) {
                    userState.lastInputVoice = false;
                    globalUserStates.set(getShortUserId(chatId), userState);
                }
                
                return true;
            } else {
                throw new Error(`WHAPI error ${voiceResponse.status}`);
            }
            
        } catch (voiceError: any) {
            logError('VOICE_SEND_ERROR', 'Error enviando voz, fallback a texto', {
                userId: shortUserId,
                error: voiceError.message
            });
            // Continuar con envío de texto
        }
    }
    
    // 🔧 NUEVO: No enviar mensajes vacíos
    if (!message || message.trim() === '') {
        logInfo('WHATSAPP_SKIP_EMPTY', `Saltando envío de mensaje vacío para ${shortUserId}`, {
            chatId,
            messageLength: message?.length || 0,
            environment: appConfig?.environment
        });
        return true;
    }
    
    try {
        // 🎯 NUEVO: División inteligente de mensajes en párrafos
        let chunks: string[] = [];
        
        // Primero intentar dividir por doble salto de línea
        const paragraphs = message.split(/\n\n+/).map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
        
        // Si hay párrafos claramente separados, usarlos
        if (paragraphs.length > 1) {
            chunks = paragraphs;
        } else {
            // Si no hay párrafos, buscar listas con bullets
            const lines = message.split('\n');
            let currentChunk = '';
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const nextLine = lines[i + 1];
                
                // Si la línea actual termina con ":" y la siguiente empieza con bullet
                if (line.endsWith(':') && nextLine && nextLine.trim().match(/^[•\-\*]/)) {
                    // Agregar la línea de título al chunk actual
                    if (currentChunk) {
                        chunks.push(currentChunk.trim());
                    }
                    currentChunk = line;
                } 
                // Si es una línea de bullet
                else if (line.trim().match(/^[•\-\*]/)) {
                    currentChunk += '\n' + line;
                    
                    // Si la siguiente línea NO es un bullet, cerrar el chunk
                    if (!nextLine || !nextLine.trim().match(/^[•\-\*]/)) {
                        chunks.push(currentChunk.trim());
                        currentChunk = '';
                    }
                }
                // Línea normal
                else {
                    if (currentChunk) {
                        currentChunk += '\n' + line;
                    } else {
                        currentChunk = line;
                    }
                }
            }
            
            // Agregar cualquier chunk restante
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
        }
        
        // Filtrar chunks vacíos
        chunks = chunks.filter(chunk => chunk.length > 0);
        
        // Si no se pudo dividir bien, usar el mensaje original
        if (chunks.length === 0) {
            chunks = [message];
        }
        
        // 🎯 IMPLEMENTACIÓN DE ENVÍO
        if (chunks.length === 1) {
            // Mensaje único - enviar normalmente
            logInfo('WHATSAPP_SEND', `Enviando mensaje a ${shortUserId}`, { 
                chatId,
                messageLength: message.length,
                preview: message.substring(0, 100) + '...',
                environment: appConfig?.environment
            });
            
            const response = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/text`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: chatId,
                    body: message,
                    typing_time: message.includes('🔄') || message.includes('📊') ? 5 : 3 // Tiempo de typing según contenido
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json() as WHAPIError;
                throw new Error(`WHAPI error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            }
            
            const responseData = await response.json() as any;
            
            // Guardar ID del mensaje enviado
            if (responseData.message?.id) {
                botSentMessages.add(responseData.message.id);
                setTimeout(() => {
                    botSentMessages.delete(responseData.message.id);
                }, 10 * 60 * 1000); // Limpiar después de 10 minutos
            }
            
            // 🔧 ELIMINADO: Log duplicado - ya se maneja con terminalLog.response()
            return true;
        } else {
            // Múltiples chunks - enviar con delays
            logInfo('WHATSAPP_SEND_CHUNKS', `Enviando mensaje en ${chunks.length} partes a ${shortUserId}`, {
                chatId,
                totalLength: message.length,
                chunks: chunks.length,
                environment: appConfig?.environment
            });
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                const response = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/text`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        to: chatId,
                        body: chunk,
                        typing_time: i === 0 ? 3 : 2 // 3s primer mensaje, 2s siguientes
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json() as WHAPIError;
                    throw new Error(`WHAPI error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
                }
                
                const responseData = await response.json() as any;
                
                // Guardar ID del mensaje enviado
                if (responseData.message?.id) {
                    botSentMessages.add(responseData.message.id);
                    setTimeout(() => {
                        botSentMessages.delete(responseData.message.id);
                    }, 10 * 60 * 1000);
                }
                
                // 🔧 ELIMINADO: Log duplicado - ya se maneja con terminalLog.response()
                
                // Delay entre chunks (excepto el último)
                if (i < chunks.length - 1) {
                    const delay = Math.min(1000, chunk.length * 2); // 2ms por carácter, máx 1s
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            return true;
        }
    } catch (error) {
        // 🔧 NUEVO: Log de error de WHAPI en terminal
        terminalLog.whapiError('enviar mensaje', error.message);
        
        logError('WHATSAPP_SEND_ERROR', `Error enviando mensaje a ${shortUserId}`, {
            chatId,
            error: error.message,
            environment: appConfig?.environment
        });
        return false;
    }
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
                environment: appConfig?.environment
            });
            return true;
        }
        
        return false;
    } catch (error) {
        logError('RUN_CHECK_ERROR', `Error verificando runs activos para ${userId}`, {
            userId: getShortUserId(userId),
            error: error.message,
            environment: appConfig?.environment
        });
        return false; // En caso de error, asumir que no hay runs activos
    }
}

// Por ejemplo, `setupWebhooks` y sus funciones anidadas:
function setupWebhooks() {
    // El código de setupWebhooks va aquí.
    // Puede acceder a 'appConfig' y 'openaiClient' porque son variables globales
    // y esta función se llama DESPUÉS de que se inicializan en 'main'.
    const { secrets } = appConfig;
    
    // 🔧 NUEVO: Función para suscribirse a presencia de usuario
    const subscribedPresences = new Set<string>();
    
    // Cache declarations moved to module level
    
    // Función para procesar mensajes combinados
    processCombinedMessage = async function(userId: string, combinedText: string, chatId: string, userName: string, messageCount: number): Promise<void> {
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
                                environment: appConfig?.environment
                            });
                            
                            // Intentar procesar el run que requiere acción
                            try {
                                // Aquí podrías agregar lógica para procesar tool calls si es necesario
                                // Por ahora, cancelamos el run para permitir nuevo procesamiento
                                await openaiClient.beta.threads.runs.cancel(threadRecord.threadId, requiresActionRun.id);
                                logInfo('RUN_CANCELLED', `Run cancelado para permitir nuevo procesamiento`, {
                                    userJid: shortUserId,
                                    runId: requiresActionRun.id,
                                    environment: appConfig?.environment
                                });
                            } catch (cancelError) {
                                logWarning('RUN_CANCEL_ERROR', `Error cancelando run`, {
                                    userJid: shortUserId,
                                    runId: requiresActionRun.id,
                                    error: cancelError.message,
                                    environment: appConfig?.environment
                                });
                            }
                        } else {
                            // Run en progreso normal, saltar procesamiento
                            logWarning('BUFFER_PROCESS_SKIPPED', `Procesamiento de buffer saltado - run activo para ${userName}`, {
                                userJid: shortUserId,
                                messageCount,
                                combinedText: combinedText.substring(0, 50) + '...',
                                environment: appConfig?.environment
                            });
                            // 🔧 ELIMINADO: Log duplicado - ya se maneja con logInfo
                            return;
                        }
                    }
                } catch (error) {
                    logError('RUN_CHECK_ERROR', `Error verificando runs para ${userName}`, {
                        userJid: shortUserId,
                        error: error.message,
                        environment: appConfig?.environment
                    });
                }
            }

            // Todo mensaje relevante va directo a OpenAI
            try {
                const response = await processWithOpenAI(combinedText, userId, chatId, userName);
                
                // Verificar si la respuesta incluye attachments
                if (typeof response === 'object' && response.attachment) {
                    // Enviar el mensaje de texto primero
                    if (response.message) {
                        await sendWhatsAppMessage(chatId, response.message);
                    }
                    // Luego enviar el attachment
                    await sendWhatsAppAttachment(chatId, response.attachment);
                } else {
                    // Respuesta normal de texto
                    await sendWhatsAppMessage(chatId, response);
                }
            } catch (error) {
                // 🔧 NUEVO: Manejar cancelación por typing
                if (error.message === 'PROCESSING_CANCELLED_TYPING_ACTIVE' || 
                    error.message === 'PROCESSING_CANCELLED_TYPING_MARKED') {
                    logInfo('PROCESSING_CANCELLED_BY_TYPING', 'Procesamiento cancelado por typing activo', {
                        userJid: shortUserId,
                        userName,
                        error: error.message,
                        environment: appConfig?.environment
                    });
                    return; // Salir sin error, el procesamiento se reintentará cuando termine el typing
                }
                // 🔧 NUEVO: NO re-lanzar errores para evitar crash del bot
                logError('PROCESSING_ERROR', 'Error en procesamiento, continuando sin crash', {
                    userJid: shortUserId,
                    userName,
                    error: error.message
                });
            }
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
                        environment: appConfig?.environment
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
                    environment: appConfig?.environment
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
    
    // NUEVO: Función auxiliar para analizar imágenes
    async function analyzeImage(imageUrl: string | undefined, userId: string, userName?: string, messageId?: string): Promise<string> {
        try {
            let finalImageUrl = imageUrl;
            
            // Si no hay URL, intentar obtenerla desde WHAPI
            if (!finalImageUrl && messageId) {
                try {
                    const messageResponse = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/${messageId}`, {
                        headers: {
                            'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`
                        }
                    });
                    
                    if (messageResponse.ok) {
                        const messageData = await messageResponse.json() as WHAPIMessage;
                        // Obtener el link de la imagen
                        finalImageUrl = messageData.image?.link;
                        
                        if (finalImageUrl) {
                            logSuccess('IMAGE_URL_FETCHED', 'URL de imagen obtenida desde WHAPI', {
                                userId: getShortUserId(userId),
                                messageId,
                                type: messageData.type
                            });
                        }
                    } else {
                        const errorData = await messageResponse.json() as WHAPIError;
                        logError('IMAGE_MESSAGE_FETCH_ERROR', 'Error obteniendo mensaje desde WHAPI', {
                            userId: getShortUserId(userId),
                            messageId,
                            status: messageResponse.status,
                            error: errorData.error?.message
                        });
                    }
                } catch (fetchError) {
                    logError('IMAGE_URL_FETCH_ERROR', 'Error obteniendo URL de imagen desde WHAPI', {
                        userId: getShortUserId(userId),
                        messageId,
                        error: fetchError.message
                    });
                }
            }
            
            // Validar URL
            if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
                throw new Error('URL de imagen inválida o no disponible');
            }
            
            // Analizar con OpenAI Vision
            const visionResponse = await openaiClient.chat.completions.create({
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
                                detail: 'low' // Optimización de costos
                            } 
                        }
                    ]
                }],
                max_tokens: 150,
                temperature: 0.3 // Respuestas más consistentes
            });
            
            return visionResponse.choices[0].message.content || 'Imagen recibida';
            
        } catch (error) {
            // 🔧 NUEVO: Log de error de imagen en terminal
            const displayName = userName || getShortUserId(userId);
            terminalLog.imageError(displayName, error.message);
            
            logError('IMAGE_ANALYSIS_ERROR', 'Error analizando imagen', {
                userId,
                error: error.message
            });
            // No retornar fallback, mejor throw para que el caller decida
            throw error;
        }
    }
    
    async function subscribeToPresence(userId: string): Promise<void> {
        if (subscribedPresences.has(userId)) {
            // 🔧 MEJORADO: Log informativo para debug
            logDebug('PRESENCE_ALREADY_SUBSCRIBED', `Ya suscrito a presencia de ${userId}`, {
                userId,
                environment: appConfig.environment
            });
            return; // Ya suscrito
        }
        
        try {
            // 🔧 MEJORADO: Log de intento de suscripción
            logInfo('PRESENCE_SUBSCRIBE_ATTEMPT', `Intentando suscribirse a presencia de ${userId}`, {
                userId,
                environment: appConfig.environment
            });
            
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
                // 🔧 MEJORADO: Log visual de confirmación
                // 🔧 ELIMINADO: Log duplicado - ya se maneja en processWebhook
            } else if (response.status === 409) {
                // Ya suscrito - agregar al set para evitar futuros intentos
                subscribedPresences.add(userId);
                logInfo('PRESENCE_ALREADY_SUBSCRIBED_API', `Usuario ${userId} ya suscrito (409)`, {
                    userId,
                    status: response.status,
                    environment: appConfig.environment
                });
                // 🔧 MEJORADO: Log visual de confirmación
                // 🔧 ELIMINADO: Log duplicado - ya se maneja en processWebhook
            } else {
                const errorText = await response.text();
                logError('PRESENCE_SUBSCRIBE_ERROR', `Error suscribiendo a ${userId}`, { 
                    userId,
                    status: response.status,
                    error: errorText,
                    environment: appConfig.environment
                });
                // 🔧 ELIMINADO: Log de presence - no mostrar en terminal
            }
        } catch (error: any) {
            logError('PRESENCE_SUBSCRIBE_FAIL', `Fallo de red suscribiendo a ${userId}`, { 
                userId,
                error: error.message,
                environment: appConfig.environment
            });
                            // 🔧 ELIMINADO: Log de presence - no mostrar en terminal
        }
    }

    // 🔧 ETAPA 2: Funciones para Flujo Híbrido
    
    // 🚀 ELIMINADO: Función de análisis de disponibilidad arbitrario
    // OpenAI ahora decide si necesita más información para consultas de disponibilidad

    // Función para analizar si necesita inyección de contexto
    // 🚀 ELIMINADO: Función de análisis de contexto arbitrario
    // OpenAI ahora decide cuándo necesita contexto usando get_conversation_context

    // 🟡 OPTIMIZACIÓN: Cache pre-computado para contexto base
    let precomputedContextBase: { date: string; time: string; timestamp: number } | null = null;
    const CONTEXT_BASE_CACHE_TTL = 60 * 1000; // 1 minuto

    function getPrecomputedContextBase(): { date: string; time: string } {
        const now = Date.now();
        
        // Si el cache es válido, usarlo
        if (precomputedContextBase && (now - precomputedContextBase.timestamp) < CONTEXT_BASE_CACHE_TTL) {
            logDebug('CACHE_HIT', 'Context base desde cache', {
                cacheAge: Math.round((now - precomputedContextBase.timestamp) / 1000)
            });
            return { date: precomputedContextBase.date, time: precomputedContextBase.time };
        }
        
        // Generar nuevo
        const currentDate = new Date().toLocaleDateString('es-ES', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
        const currentTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true });
        
        precomputedContextBase = { date: currentDate, time: currentTime, timestamp: now };
        return { date: currentDate, time: currentTime };
    }

    // Función para obtener contexto relevante del historial
    async function getRelevantContext(userId: string, requestId?: string): Promise<string> {
        try {
            const shortUserId = getShortUserId(userId);
            const now = Date.now();
            
            // 🔧 MEJORADO: Verificar si es el primer mensaje después del reinicio
            // Si el cache tiene más de 1 hora, es un reinicio del bot
            const cached = contextCache.get(shortUserId);
            const isFirstMessageAfterRestart = !cached || (now - cached.timestamp) > CONTEXT_CACHE_TTL;
            
            if (cached && !isFirstMessageAfterRestart && (now - cached.timestamp) < CONTEXT_CACHE_TTL) {
                logInfo('CONTEXT_CACHE_HIT', 'Contexto temporal desde cache', {
                    userId: shortUserId,
                    cacheAge: Math.round((now - cached.timestamp) / 1000),
                    requestId
                });
                return cached.context;
            }
            
            // 🔧 NUEVO: Log para primer mensaje después del reinicio
            if (isFirstMessageAfterRestart) {
                logInfo('CONTEXT_FRESH_RESTART', 'Generando contexto fresco después del reinicio', {
                    userId: shortUserId,
                    hadCachedContext: !!cached,
                    cacheAge: cached ? Math.round((now - cached.timestamp) / 1000) : 'none',
                    requestId
                });
            }
            
            // Obtener perfil del usuario (incluye etiquetas)
            const profile = await guestMemory.getOrCreateProfile(userId);
            // Obtener información del chat desde Whapi (con cache)
            const chatInfo = await getCachedChatInfo(userId);
            
            // 🔧 MEJORADO: Extracción de nombre más robusta
            const clientName = profile?.name || 'Cliente';
            const contactName = chatInfo?.name || clientName;
            
            // 🟡 OPTIMIZACIÓN: Usar fecha y hora pre-computadas desde cache
            const { date: currentDate, time: currentTime } = getPrecomputedContextBase();
            
            // Etiquetas del perfil y Whapi (solo las primeras 2)
            const profileLabels = profile?.whapiLabels?.map((l: any) => l.name) || [];
            const chatLabels = chatInfo?.labels?.map((l: any) => l.name) || [];
            const allLabels = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2);
            
            // 🔧 OPTIMIZADO: Construir contexto temporal SIN EMOJIS (menos tokens) y más claro para la IA
            let context = `Fecha: ${currentDate} | Hora: ${currentTime} (Colombia)\n`;
            context += `Cliente: ${clientName} | Contacto WhatsApp: ${contactName}`;
            if (allLabels.length > 0) {
                context += ` | Status: ${allLabels.join(', ')}`;
            }
            context += `\n---\nMensaje del cliente:\n`;
            
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
                isFirstMessageAfterRestart,
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


            
            // Enviar a OpenAI con el userId original y la información completa del cliente
            const startTime = Date.now();
            const response = await processWithOpenAI(combinedMessage, userId, buffer.chatId, buffer.userName, requestId);
            const aiDuration = ((Date.now() - startTime) / 1000).toFixed(1);
            
            // 🔧 NUEVO: Validar respuesta antes de loguear
            if (!response || !response.trim()) {
                terminalLog.error(`Sin respuesta (${aiDuration}s)`);
                logWarning('EMPTY_RESPONSE', 'OpenAI devolvió respuesta vacía', {
                    userId: shortUserId,
                    requestId,
                    duration: aiDuration
                });
                return; // 🔧 FIX: No continuar si no hay respuesta
            }
            
            // 🔧 ETAPA 2: Incrementar métrica de mensajes procesados
            incrementMessages();
            
            // 🔧 DEBUG: Log antes de enviar a WhatsApp
            logInfo('WHATSAPP_SEND_DEBUG', 'Mensaje enviándose a WhatsApp', {
                userId: userId,
                responseLength: response.length,
                hasDoubleAsterisks: response.includes('**'),
                responsePreview: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
                chatId: buffer.chatId
            });
            
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

    // 🔧 NUEVO: Función principal de procesamiento con OpenAI (sin manejo de locks)
    // 🔧 NUEVO: Función helper para enviar typing indicator
    async function sendTypingIndicator(chatId: string): Promise<void> {
        if (!chatId) return;
        
        try {
            await fetch(`${appConfig.secrets.WHAPI_API_URL}/presences/${chatId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    presence: "typing",
                    delay: 0
                })
            });
            
            logInfo('TYPING_INDICATOR_SENT', 'Typing indicator enviado inmediatamente', {
                chatId,
                environment: appConfig.environment
            });
        } catch (error: any) {
            logError('TYPING_INDICATOR_ERROR', 'Error enviando typing indicator', {
                chatId,
                error: error.message,
                environment: appConfig.environment
            });
        }
    }

    const processWithOpenAI = async (userMsg: string, userJid: string, chatId: string = null, userName: string = null, requestId?: string): Promise<string> => {
        const shortUserId = getShortUserId(userJid);
        
        // Send appropriate indicator based on response type
        if (chatId) {
            const userState = globalUserStates.get(shortUserId);
            const willRespondWithVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && 
                userState?.lastInputVoice === true;
            
            if (willRespondWithVoice) {
                await sendRecordingIndicator(chatId);
            } else {
                await sendTypingIndicator(chatId);
            }
        }
        
        // 🔧 ELIMINADO: Verificaciones de typing - ya no necesarias con el sistema simplificado
        
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
            
            // 🔧 ELIMINADO: Log de OpenAI - ya no se muestra en terminal
             
            const config = getConfig();
             
            // Obtener o crear thread PRIMERO
            let threadId = threadPersistence.getThread(shortUserId)?.threadId;
            const isNewThread = !threadId;
            if (isNewThread) {
                // Crear thread nuevo
                const thread = await openaiClient.beta.threads.create();
                threadId = thread.id;
                threadPersistence.setThread(shortUserId, threadId, chatId, userName);
                
                // 🔧 NUEVO: Log de nueva conversación
                terminalLog.newConversation(userName);
                
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
            
            // 🔧 MANTENIDO: Log solo en archivos JSON para debug
            logInfo('OPENAI_PROCESSING_START', `Procesando mensaje de ${userName}`, {
                shortUserId,
                userName,
                requestId
            });
            
            // 🔧 CORREGIDO: Suscribirse a presencia SIEMPRE, no solo en threads nuevos
            await subscribeToPresence(shortUserId);
            
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
            
            // 🔧 ELIMINADO: Inyección automática de historial
            // El sistema ahora usa get_conversation_context on-demand
            // OpenAI puede solicitar el contexto histórico cuando lo necesite
             
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
                    // 🔧 OPTIMIZADO: Contexto temporal solo cuando sea necesario
                    const needsTemporalContext = await (async () => {
                        const thread = threadPersistence.getThread(userJid);
                        if (!thread) return { needed: true, reason: 'primer_mensaje' }; // Primer mensaje
                        
                        // 1. Verificar tiempo (cada 3 horas)
                        const lastActivity = new Date(thread.lastActivity);
                        const now = new Date();
                        const hoursElapsed = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
                        
                        if (hoursElapsed >= 3) {
                            return { needed: true, reason: 'tiempo_3h' };
                        }
                        
                        // 2. Verificar cambios en perfil/labels
                        try {
                            const currentProfile = await guestMemory.getOrCreateProfile(userJid);
                            const currentChatInfo = await getCachedChatInfo(userJid);
                            
                            // Comparar nombres
                            const currentClientName = currentProfile?.name || 'Cliente';
                            const currentContactName = currentChatInfo?.name || currentClientName;
                            const storedName = thread.name || thread.userName;
                            
                            if (currentClientName !== storedName || currentContactName !== storedName) {
                                return { needed: true, reason: 'cambio_nombre' };
                            }
                            
                            // Comparar labels
                            const profileLabels = currentProfile?.whapiLabels?.map((l: any) => l.name) || [];
                            const chatLabels = currentChatInfo?.labels?.map((l: any) => l.name) || [];
                            const currentLabels = [...new Set([...profileLabels, ...chatLabels])].sort();
                            const storedLabels = (thread.labels || []).sort();
                            
                            if (JSON.stringify(currentLabels) !== JSON.stringify(storedLabels)) {
                                return { needed: true, reason: 'cambio_labels' };
                            }
                            
                            // 3. Verificar cambio de thread (esto ya lo detectaría el primer mensaje)
                            // No necesario verificar aquí
                            
                            return { needed: false, reason: 'no_cambios' };
                            
                        } catch (error) {
                            // En caso de error, incluir contexto por seguridad
                            return { needed: true, reason: 'error_verificacion' };
                        }
                    })();
                    
                    const temporalContext = needsTemporalContext.needed ? 
                        await getRelevantContext(userJid, requestId) : '';
                    
                    // 🔧 NUEVO: Solo usar contexto + mensaje (sin instrucciones adicionales)
                    let messageWithContext = temporalContext + userMsg;
                    
                    // 🔧 DEBUG: Log del contexto que se envía a OpenAI (optimizado)
                    const isVoiceMessage = userMsg.includes('🎤');
                    logInfo('CONTEXT_DEBUG', 'Contexto enviado a OpenAI', {
                        shortUserId,
                        needsTemporalContext: needsTemporalContext.needed,
                        contextReason: needsTemporalContext.reason,
                        contextPreview: temporalContext ? temporalContext.substring(0, 200) : 'NO_CONTEXT',
                        messagePreview: userMsg.substring(0, 100),
                        totalLength: messageWithContext.length,
                        isVoiceMessage,
                        contextTokensSaved: needsTemporalContext.needed ? 0 : ~150,
                        requestId
                    });
                    
                    // 🟡 OPTIMIZACIÓN: Crear contenido multimodal si hay imágenes pendientes
                    let messageContent: any = messageWithContext;
                    
                    // Obtener imágenes pendientes para este usuario
                    const userImages = pendingImages.get(userJid) || [];
                    
                    if (userImages.length > 0) {
                        // Crear array multimodal con texto e imágenes
                        messageContent = [
                            {
                                type: "text",
                                text: messageWithContext
                            }
                        ];
                        
                        // Agregar cada imagen al contenido
                        userImages.forEach(imageUrl => {
                            messageContent.push({
                                type: "image_url",
                                image_url: {
                                    url: imageUrl
                                }
                            });
                        });
                        
                        console.log(`🖼️ Enviando mensaje con ${userImages.length} imagen(es) al Assistant`);
                        
                        // Limpiar imágenes pendientes después de usar
                        pendingImages.delete(userJid);
                    }
                    
                    await openaiClient.beta.threads.messages.create(threadId, {
                        role: 'user',
                        content: messageContent
                    });
                    
                    // 🔧 NUEVO: Actualizar metadatos del thread cuando hay cambios
                    if (needsTemporalContext.needed && ['cambio_nombre', 'cambio_labels'].includes(needsTemporalContext.reason)) {
                        try {
                            const currentProfile = await guestMemory.getOrCreateProfile(userJid);
                            const currentChatInfo = await getCachedChatInfo(userJid);
                            
                            const updates: any = {};
                            
                            // Actualizar nombres si cambió
                            if (needsTemporalContext.reason === 'cambio_nombre') {
                                const currentClientName = currentProfile?.name || 'Cliente';
                                const currentContactName = currentChatInfo?.name || currentClientName;
                                updates.name = currentClientName;
                                updates.userName = currentContactName;
                            }
                            
                            // Actualizar labels si cambió
                            if (needsTemporalContext.reason === 'cambio_labels') {
                                const profileLabels = currentProfile?.whapiLabels?.map((l: any) => l.name) || [];
                                const chatLabels = currentChatInfo?.labels?.map((l: any) => l.name) || [];
                                updates.labels = [...new Set([...profileLabels, ...chatLabels])];
                            }
                            
                            if (Object.keys(updates).length > 0) {
                                threadPersistence.updateThreadMetadata(userJid, updates);
                                logInfo('THREAD_METADATA_UPDATED', 'Metadatos del thread actualizados', {
                                    shortUserId,
                                    reason: needsTemporalContext.reason,
                                    updates: Object.keys(updates),
                                    requestId
                                });
                            }
                        } catch (metadataError) {
                            logWarning('THREAD_METADATA_UPDATE_ERROR', 'Error actualizando metadatos del thread', {
                                shortUserId,
                                error: metadataError.message,
                                requestId
                            });
                        }
                    }
                     
                     // Log de mensaje agregado con contexto (eliminado para reducir ruido)
                     
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
             
             // Crear y ejecutar run (log eliminado para reducir ruido)
             let run = await openaiClient.beta.threads.runs.create(threadId, {
                 assistant_id: secrets.ASSISTANT_ID
             });
             
             // Run iniciado (log eliminado para reducir ruido)
             
             // 🔧 ELIMINADO: Mensaje interino duplicado - ya se envía específicamente en function calling
            
            // Polling normal (sin cambios del plan original)
            let attempts = 0;
            const maxAttempts = 30;
            const pollingInterval = 1000;
            
            while (['queued', 'in_progress'].includes(run.status) && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, pollingInterval));
                run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
                attempts++;
                
                if (attempts === 1) { // Solo log al inicio del polling para reducir ruido
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
                
                // 🔧 ELIMINADO: Log de terminal para OPENAI_RUN_COMPLETED
                // logSuccess('OPENAI_RUN_COMPLETED', `Run completado para ${shortUserId}`, { 
                //     threadId,
                //     requestId 
                // });
                
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
                
                // 🔧 ELIMINADO: Log de métricas de OpenAI para evitar spam
                // logOpenAIUsage('Run completado con métricas', {
                //     shortUserId,
                //     threadId,
                //     runId: run.id,
                //     totalTokens,
                //     promptTokens: run.usage?.prompt_tokens || 0,
                //     completionTokens: run.usage?.completion_tokens || 0,
                //     contextTokens,
                //     durationMs,
                //     tokensPerSecond: totalTokens > 0 ? Math.round(totalTokens / (durationMs / 1000)) : 0,
                //     requestId
                // });
                
                // 🔧 ELIMINADO: Log de latencia de OpenAI para evitar spam
                // logOpenAILatency('Latencia del procesamiento', {
                //     shortUserId,
                //     threadId,
                //     totalDurationMs: durationMs,
                //     durationSeconds: (durationMs / 1000).toFixed(2),
                //     isHighLatency: durationMs > 30000, // >30s es alta latencia
                //     requestId
                // });
                
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
                    logWarning('NO_ASSISTANT_RESPONSE', 'OpenAI no generó respuesta, enviando fallback', {
                        shortUserId,
                        runId: run.id,
                        threadId,
                        requestId
                    });
                    
                    // 🔧 NUEVO: Retornar mensaje fallback en lugar de string vacío
                    return 'Disculpa, estoy procesando tu mensaje. ¿Podrías repetirlo por favor?';
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
                
                // 🔧 DEBUG: Log exacto de la respuesta recibida de OpenAI
                logInfo('OPENAI_RESPONSE_RAW', 'Respuesta exacta recibida de OpenAI', {
                    shortUserId,
                    responseText: responseText,
                    responseLength: responseText.length,
                    hasDoubleAsterisks: responseText.includes('**'),
                    responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
                    threadId,
                    requestId
                });
                
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
                
                // 🔧 ELIMINADO: Log de terminal para response_received
                // logOpenAIResponse('response_received', {
                //     shortUserId,
                //     threadId,
                //     responseLength: responseText.length,
                //     environment: appConfig.environment,
                //     requestId
                // });
                
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
                
                // 🔧 NUEVO: Log de respuesta limpio
                const duration = (finalDurationMs / 1000).toFixed(1);
                terminalLog.response(userName, responseText, parseFloat(duration));
                
                return responseText;
            } else if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
                // Manejar function calling - SIMPLIFICADO
                const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                
                // 🔧 ETAPA 2: MENSAJE INTERINO INTELIGENTE SOLO PARA CONSULTAS COMPLEJAS
                const hasAvailabilityCheck = toolCalls.some(tc => 
                    tc.function.name === 'check_availability'
                );
                
                if (hasAvailabilityCheck && chatId && (toolCalls.length > 1 || JSON.parse(toolCalls[0].function.arguments).nights > 7)) {
                    // 🔧 SIMPLIFICADO: Mensaje simple antes de consultar disponibilidad compleja
                    await sendWhatsAppMessage(chatId, "Voy a consultar disponibilidad");
                    logInfo('AVAILABILITY_INTERIM_SENT', 'Mensaje interino enviado para consulta compleja', { 
                        userId: shortUserId,
                        chatId,
                        environment: appConfig.environment,
                        requestId,
                        toolCount: toolCalls.length
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
                
                // 🔧 ELIMINADO: Log general redundante - se muestra en cada función individual
                
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
                    
                    // 🔧 NUEVO: Log de función iniciando en terminal
                    if (SHOW_FUNCTION_LOGS) {
                        terminalLog.functionStart(functionName, functionArgs);
                    }
                    
                    try {
                        // Ejecutar la función usando el registry
                        const functionStartTime = Date.now();
                        const { executeFunction } = await import('./functions/registry/function-registry.js');
                        const result = await executeFunction(functionName, functionArgs, requestId);
                        const functionDuration = Date.now() - functionStartTime;
                        
                        let formattedResult;
                        if (typeof result === 'string') {
                            formattedResult = result;
                        } else if (result && typeof result === 'object') {
                            formattedResult = JSON.stringify(result);
                        } else {
                            formattedResult = String(result || 'success');
                        }
                        
                        // Detectar si hay attachment en el resultado
                        let attachment = null;
                        if (result && typeof result === 'object' && result.attachment) {
                            attachment = result.attachment;
                            // Guardar el attachment para enviarlo después
                            if (!globalAttachments) {
                                globalAttachments = new Map();
                            }
                            globalAttachments.set(threadId, attachment);
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
                        
                        // 🔧 NUEVO: Log de función completada en terminal
                        if (SHOW_FUNCTION_LOGS) {
                            terminalLog.functionCompleted(functionName, formattedResult, functionDuration);
                            
                            // Log específico para availability - usar información de contexto
                            if (functionName === 'check_availability') {
                                // Por ahora mostrar resultado genérico, hasta que implementemos mejor tracking
                                // La información correcta está en los logs detallados de BEDS24_RESPONSE_SUMMARY
                            }
                        }
                        
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
                        
                        // 🔧 NUEVO: Log de error de función en terminal
                        terminalLog.functionError(functionName, error.message);
                        
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
                const maxPostAttempts = 10; // Optimizado para respuestas rápidas
                
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
                    
                    // 🔧 ETAPA 3.3: Backoff progresivo optimizado (500ms inicial, max 5s)
                    const backoffDelay = Math.min((postAttempts + 1) * 500, 5000);
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
                            
                            // 🔧 DEBUG: Log exacto de la respuesta recibida de OpenAI (function calling)
                            logInfo('OPENAI_RESPONSE_RAW_FUNCTION', 'Respuesta exacta recibida de OpenAI después de function calling', {
                                shortUserId,
                                responseText: responseText,
                                responseLength: responseText.length,
                                hasDoubleAsterisks: responseText.includes('**'),
                                responsePreview: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
                                threadId,
                                requestId
                            });
                            
                            // 🔧 NUEVO: Validar y corregir respuesta post-generación
                            const originalOutputs = toolOutputs.map(output => output.output);
                            const validation = validateAndCorrectResponse(responseText, originalOutputs);
                            
                            let finalResponse = responseText;
                            
                            // Verificar si necesita retry por errores complejos
                            if (validation.hadErrors && validation.needsRetry) {
                                // Verificar si ya se hizo retry para este usuario recientemente (evitar loops)
                                const now = Date.now();
                                const retryState = userRetryState.get(shortUserId);
                                const canRetry = !retryState || 
                                                (retryState.retryCount === 0) || 
                                                (now - retryState.lastRetryTime > 300000); // 5 minutos
                                
                                if (canRetry) {
                                    logWarning('RESPONSE_RETRY_ATTEMPT', 'Iniciando retry con feedback interno por errores complejos', {
                                        shortUserId,
                                        threadId,
                                        discrepancies: validation.discrepancies,
                                        requestId
                                    });
                                    
                                    try {
                                        // Marcar que se está haciendo retry
                                        userRetryState.set(shortUserId, { 
                                            retryCount: 1, 
                                            lastRetryTime: now 
                                        });
                                        
                                        // Crear mensaje correctivo interno
                                        const correctiveMessage = `Nota interna: vuelve a responder, ya que el check availability arrojó:\n\n${originalOutputs.join('\n\n')}\n\nY tu respuesta fue: ${responseText}\n\nCorrige cualquier discrepancia en nombres de apartamentos, precios, fechas u otros detalles, manteniendo exactitud y naturalidad.`;
                                        
                                        // Agregar mensaje correctivo al thread
                                        await openaiClient.beta.threads.messages.create(threadId, {
                                            role: 'user',
                                            content: correctiveMessage
                                        });
                                        
                                        // Re-ejecutar run con instrucciones adicionales
                                        const retryRun = await openaiClient.beta.threads.runs.create(threadId, {
                                            assistant_id: process.env.OPENAI_ASSISTANT_ID || '',
                                            additional_instructions: 'Prioriza datos exactos de herramientas sin alteraciones. Revisa cuidadosamente precios, fechas y nombres de apartamentos.'
                                        });
                                        
                                        // Polling para retry (reutilizar lógica existente)
                                        let retryAttempts = 0;
                                        const maxRetryAttempts = 20;
                                        let retryRunStatus = await openaiClient.beta.threads.runs.retrieve(threadId, retryRun.id);
                                        
                                        while (['queued', 'in_progress'].includes(retryRunStatus.status) && retryAttempts < maxRetryAttempts) {
                                            await new Promise(resolve => setTimeout(resolve, 1000));
                                            retryRunStatus = await openaiClient.beta.threads.runs.retrieve(threadId, retryRun.id);
                                            retryAttempts++;
                                        }
                                        
                                        if (retryRunStatus.status === 'completed') {
                                            // Obtener nueva respuesta
                                            const retryMessages = await openaiClient.beta.threads.messages.list(threadId, { limit: 1 });
                                            const retryAssistantMessage = retryMessages.data.find(msg => msg.role === 'assistant');
                                            
                                            if (retryAssistantMessage && retryAssistantMessage.content[0] && 'text' in retryAssistantMessage.content[0]) {
                                                const retryResponseText = retryAssistantMessage.content[0].text.value;
                                                
                                                // Validar respuesta de retry
                                                const retryValidation = validateAndCorrectResponse(retryResponseText, originalOutputs);
                                                
                                                if (!retryValidation.needsRetry || retryValidation.discrepancies.length < validation.discrepancies.length) {
                                                    finalResponse = retryValidation.correctedResponse;
                                                    
                                                    logSuccess('RESPONSE_RETRY_SUCCESS', 'Retry completado con mejora', {
                                                        shortUserId,
                                                        threadId,
                                                        originalErrors: validation.discrepancies.length,
                                                        retryErrors: retryValidation.discrepancies.length,
                                                        retryDuration: retryAttempts,
                                                        requestId
                                                    });
                                                } else {
                                                    // Fallback a corrección manual
                                                    finalResponse = validation.correctedResponse;
                                                    logWarning('RESPONSE_RETRY_FALLBACK', 'Retry no mejoró suficiente, usando corrección manual', {
                                                        shortUserId,
                                                        threadId,
                                                        requestId
                                                    });
                                                }
                                            }
                                        } else {
                                            // Retry falló, usar corrección manual
                                            finalResponse = validation.correctedResponse;
                                            logWarning('RESPONSE_RETRY_FAILED', 'Retry falló, usando corrección manual', {
                                                shortUserId,
                                                threadId,
                                                retryStatus: retryRunStatus.status,
                                                requestId
                                            });
                                        }
                                        
                                    } catch (retryError) {
                                        logError('RESPONSE_RETRY_ERROR', 'Error durante retry', {
                                            shortUserId,
                                            threadId,
                                            error: retryError.message,
                                            requestId
                                        });
                                        finalResponse = validation.correctedResponse;
                                    }
                                } else {
                                    // Ya se hizo retry, usar corrección manual
                                    finalResponse = validation.correctedResponse;
                                    logWarning('RESPONSE_RETRY_SKIPPED', 'Retry omitido para evitar loop, usando corrección manual', {
                                        shortUserId,
                                        threadId,
                                        requestId
                                    });
                                }
                            } else if (validation.hadErrors) {
                                // Solo errores simples, usar corrección manual
                                finalResponse = validation.correctedResponse;
                                logWarning('RESPONSE_VALIDATION', 'Correcciones simples aplicadas a respuesta de OpenAI', {
                                    shortUserId,
                                    threadId,
                                    discrepancies: validation.discrepancies,
                                    originalLength: responseText.length,
                                    correctedLength: finalResponse.length,
                                    requestId
                                });
                            }
                            
                            logSuccess('FUNCTION_CALLING_RESPONSE', `Respuesta final recibida después de function calling`, {
                                shortUserId,
                                threadId,
                                responseLength: finalResponse.length,
                                toolCallsExecuted: toolCalls.length,
                                environment: appConfig.environment,
                                requestId,
                                hadValidationCorrections: validation.hadErrors
                            });
                            
                            // 🔧 NUEVO: Log de respuesta limpio después de tool calls
                            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                            terminalLog.response(userName, finalResponse, parseFloat(duration));
                            
                            // Verificar si hay attachment guardado para este thread
                            const attachment = globalAttachments.get(threadId);
                            if (attachment) {
                                // Limpiar el attachment del mapa
                                globalAttachments.delete(threadId);
                                // Retornar respuesta con attachment
                                return {
                                    message: finalResponse,
                                    attachment: attachment
                                };
                            }
                            
                            return finalResponse;
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
                
                // 🔧 ELIMINADO: Log duplicado - ya se maneja con logWarning
                
                // 🔧 MEJORADO: Fallback con mensaje informativo en lugar de cadena vacía
                logWarning('FUNCTION_CALLING_TIMEOUT', 'Run no completado después de tool outputs, enviando mensaje de espera', {
                    shortUserId,
                    runId: run.id,
                    threadId,
                    requestId
                });
                
                return 'Estoy verificando la disponibilidad, dame un momento más... 🔍';
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
            
            // 🔧 NUEVO: Log de error de OpenAI en terminal
            terminalLog.openaiError(userName, error.message);
            
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
}

// Función de inicialización del bot
async function initializeBot() {
    // ... lógica de inicialización
    isServerInitialized = true;
    
    // 🔧 NUEVO: Log de startup limpio
    terminalLog.startup();
    
    // 🔧 ETAPA 1: Recuperación de runs huérfanos al inicio (UNA SOLA VEZ)
    // Ejecutar en background para no bloquear el healthcheck
    setTimeout(async () => {
        try {
            logInfo('ORPHANED_RUNS_RECOVERY_START', 'Iniciando recuperación de runs huérfanos');
            
            // 🔧 NUEVO: Agregar timeout más corto para evitar bloqueos
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Recovery timeout after 10 seconds')), 10000)
            );
            
            await Promise.race([
                recoverOrphanedRuns(),
                timeoutPromise
            ]);
            
            logSuccess('ORPHANED_RUNS_RECOVERY_COMPLETE', 'Recuperación de runs huérfanos completada');
        } catch (error) {
            logError('ORPHANED_RUNS_RECOVERY_ERROR', 'Error recuperando runs huérfanos', {
                error: error.message,
                stack: error instanceof Error ? error.stack : undefined,
                type: error instanceof Error ? error.constructor.name : typeof error
            });
            // 🔧 NUEVO: NO permitir que el error cause crash
        }
    }, 5000); // Esperar 5 segundos antes de iniciar la recuperación
    

    
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
    
    // 🔧 NUEVO: Limpieza periódica de estados de usuario y caches para evitar memory leak
    setInterval(() => {
        try {
            const now = Date.now();
            let cleanedUserStates = 0;
            let cleanedChatInfo = 0;
            
            // Limpiar estados de usuario inactivos por más de 24 horas
            for (const [userId, state] of globalUserStates.entries()) {
                const lastActivity = Math.max(state.lastMessageTimestamp, state.lastTypingTimestamp);
                if ((now - lastActivity) > 24 * 60 * 60 * 1000) { // 24 horas
                    globalUserStates.delete(userId);
                    cleanedUserStates++;
                }
            }
            
            // Limpiar chatInfoCache expirado (más de 1 hora)
            for (const [userId, cached] of chatInfoCache.entries()) {
                if ((now - cached.timestamp) > 60 * 60 * 1000) { // 1 hora
                    chatInfoCache.delete(userId);
                    cleanedChatInfo++;
                }
            }
            
            if (cleanedUserStates > 0 || cleanedChatInfo > 0) {
                logInfo('CACHE_CLEANUP', `Limpieza de caches completada`, {
                    userStatesCleaned: cleanedUserStates,
                    chatInfoCleaned: cleanedChatInfo
                });
            }
        } catch (error) {
            logError('CACHE_CLEANUP', 'Error limpiando caches', { error: error.message });
        }
    }, 60 * 60 * 1000); // Cada hora
    
    // 🔧 ELIMINADO: Timer periódico de typing - ya no necesario con el sistema simplificado
    

    
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
    
                // 🔧 OPTIMIZADO: Memory logs inteligentes - solo cuando hay problemas o cada 30 minutos
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
                        const isModerateMemory = heapUsedMB > 200;
                        
                        // 🔧 NUEVO: Solo loggear cuando hay problemas o cada 30 minutos
                        const shouldLogMemory = isHighMemory || isMemoryLeak || isModerateMemory || 
                            (Date.now() % (30 * 60 * 1000) < 60000); // Cada 30 minutos
                        
                        if (shouldLogMemory) {
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
                                uptime: Math.round(process.uptime()) + 's',
                                logReason: isHighMemory ? 'high_memory' : 
                                          isMemoryLeak ? 'memory_leak' : 
                                          isModerateMemory ? 'moderate_memory' : 'scheduled_30min'
                            });
                        }
                        
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
                }, 5 * 60 * 1000); // Mantener intervalo de 5 minutos para detección rápida de problemas
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

// Función para procesar webhooks
async function processWebhook(body: any) {
    try {
        const { messages, presences, event } = body;
        
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
                    // 🔧 MEJORADO: Siempre actualizar timestamp de última actividad
                    const userState = getOrCreateUserState(userId, `${userId}@s.whatsapp.net`, getShortUserId(userId));
                    userState.lastTyping = Date.now();
                    
                    // 🔧 NUEVO: Usar sistema unificado de timers inteligentes
                    setIntelligentTimer(userId, `${userId}@s.whatsapp.net`, getShortUserId(userId), status as 'typing' | 'recording');
                    
                    // 🔧 NUEVO: Mostrar indicador inmediatamente con rate limiting simple
                    const buffer = globalMessageBuffers.get(userId);
                    const userName = buffer?.userName || getShortUserId(userId);
                    const now = Date.now();
                    const lastLog = typingLogTimestamps.get(userId) || 0;
                    
                    // Solo aplicar rate limiting si ya se mostró hace menos de 5 segundos
                    if (now - lastLog > 5000) {
                        if (status === 'typing') {
                            terminalLog.typing(userName);
                        } else if (status === 'recording') {
                            terminalLog.recording(userName);
                        }
                        typingLogTimestamps.set(userId, now);
                    }
                } else if (status === 'online' || status === 'offline' || status === 'pending') {
                    // 🔧 NUEVO: Limpiar estado de grabación cuando deje de grabar
                    const userState = globalUserStates.get(userId);
                    if (userState) {
                        userState.isCurrentlyRecording = false;
                    }
                    
                    // 🔧 CORREGIDO: Solo mostrar si hay mensajes pendientes
                    const buffer = globalMessageBuffers.get(userId);
                    if (buffer && buffer.messages.length > 0) {
                        const userName = buffer.userName || getShortUserId(userId);
                        const wasVoiceInput = userState?.lastInputVoice === true;
                        console.log(`⏰ ${wasVoiceInput ? '🎙️' : '✍️'} ${userName} dejó de ${wasVoiceInput ? 'grabar' : 'escribir'}.`);
                    }
                }
            });
            
            return; // Salir después de manejar presences
        }
        
        // Procesar mensajes normales
        
        if (!messages || !Array.isArray(messages)) {
            // 🔧 MEJORADO: Reconocer TODOS los tipos de webhooks válidos de WHAPI
            const hasValidWebhookData = 
                (body.statuses && Array.isArray(body.statuses)) ||
                (body.chats && Array.isArray(body.chats)) ||
                (body.contacts && Array.isArray(body.contacts)) ||
                (body.groups && Array.isArray(body.groups)) ||
                (body.presences && Array.isArray(body.presences)) ||
                (body.labels && Array.isArray(body.labels)) ||
                (body.calls && Array.isArray(body.calls)) ||
                (body.channel && typeof body.channel === 'object') ||
                (body.users && Array.isArray(body.users));
            
            if (!hasValidWebhookData) {
                // 🔧 NUEVO: Rate limiting para webhooks realmente inválidos
                const webhookKey = 'invalid_webhook';
                const now = Date.now();
                
                if (!webhookCounts.has(webhookKey) || (now - webhookCounts.get(webhookKey).lastLog) > 60000) {
                    // Solo loggear una vez por minuto máximo
                    logWarning('WEBHOOK', 'Webhook recibido sin datos válidos', { 
                        body: body,
                        environment: appConfig.environment,
                        note: 'Rate limited - solo se loggea una vez por minuto'
                    });
                    
                    webhookCounts.set(webhookKey, { lastLog: now, count: (webhookCounts.get(webhookKey)?.count || 0) + 1 });
                }
            } else {
                // 🔧 MEJORADO: Log DEBUG para webhooks válidos sin mensajes
                const webhookType = body.statuses ? 'statuses' :
                                   body.chats ? 'chats' :
                                   body.contacts ? 'contacts' :
                                   body.groups ? 'groups' :
                                   body.presences ? 'presences' :
                                   body.labels ? 'labels' :
                                   body.calls ? 'calls' :
                                   body.channel ? 'channel' :
                                   body.users ? 'users' : 'unknown';
                
                logDebug('WEBHOOK_VALID', `Webhook válido recibido (${webhookType})`, {
                    webhookType,
                    dataCount: body[webhookType]?.length || 0,
                    environment: appConfig.environment
                });
            }
            return;
        }
        

        
        // Procesar cada mensaje
        for (const message of messages) {
            try {
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
                        // 🔧 ELIMINADO: Log duplicado - ya se maneja con logWarning
                        logWarning('MANUAL_NO_THREAD', `No hay conversación activa`, { 
                            shortClientId: shortClientId,
                            agentName: fromName,
                            reason: 'cliente_debe_escribir_primero'
                        });
                        continue;
                    }
                    
                                // 🔧 ELIMINADO: Log duplicado - ya se maneja con logInfo
                    
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
                                    content: `[Mensaje manual de ${finalBuffer.userName}]`
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
                                // 🔧 ELIMINADO: Log duplicado - ya se maneja con logInfo
                                
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
                                // 🔧 ELIMINADO: Log duplicado - ya se maneja con logError
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
                
                // Log ya se hace arriba con el nombre del usuario
                
                // Procesar mensajes de texto y voz que no sean del bot
                if (!message.from_me) {
                    const userId = message.from;
                    const chatId = message.chat_id;
                    
                    // 🔧 NUEVO: Usar chat_name del webhook directamente
                    let userName = message.chat_name || cleanContactName(message.from_name);
                    
                    // 🔧 NUEVO: Si no hay chat_name, usar from_name limpio
                    if (!userName || userName === 'Usuario') {
                        userName = cleanContactName(message.from_name) || getShortUserId(userId);
                    }
                    
                    // 🔧 ELIMINADO: Log de debug - no mostrar en terminal
                    
                    // 🔧 ELIMINADO: Log duplicado - ya se maneja con terminalLog.message()
                    
                    // Procesar mensajes de imagen
                    if (message.type === 'image') {
                        // 🔧 NUEVO: Log de imagen limpio
                        terminalLog.image(userName);
                        
                        // 🟡 OPTIMIZACIÓN: Guardar imagen para envío directo al Assistant
                        const imageUrl = message.image?.link;
                        if (imageUrl) {
                            // Guardar URL de imagen para el usuario
                            if (!pendingImages.has(userId)) {
                                pendingImages.set(userId, []);
                            }
                            pendingImages.get(userId)!.push(imageUrl);
                            
                            console.log(`🖼️ Imagen guardada para envío al Assistant: ${imageUrl}`);
                            
                            // Agregar texto simple al buffer
                            addToGlobalBuffer(userId, '📷 Imagen recibida', chatId, userName);
                        } else {
                            addToGlobalBuffer(userId, '📷 Sin URL disponible', chatId, userName);
                        }
                    }
                    // Procesar mensajes de voz/audio
                    else if (message.type === 'voice' || message.type === 'audio' || message.type === 'ptt') {
                        
                        // 🔧 NUEVO: Log de nota de voz limpio
                        terminalLog.voice(userName);
                        
                        // Marcar que el usuario envió voz
                        const userState = getOrCreateUserState(userId, chatId, userName);
                        userState.lastInputVoice = true;
                        
                        // 🔧 FIX: Guardar también con chatId para consistencia
                        globalUserStates.set(chatId, userState);
                        
                        
                        // Verificar si la transcripción está habilitada
                        if (process.env.ENABLE_VOICE_TRANSCRIPTION === 'true') {
                                                            try {
                                    // Obtener URL del audio
                                    const audioUrl = message.voice?.link || message.audio?.link || message.ptt?.link;
                                
                                if (audioUrl) {
                                    // Transcribir el audio usando la función global
                                    const transcription = await transcribeAudio(audioUrl, userId, userName, message.id);
                                    const audioText = `🎤 ${transcription}`;
                                    
                                    // 🔧 NUEVO: Log de transcripción limpio
                                    terminalLog.message(userName, transcription);
                                    
                                    // Agregar transcripción al buffer con metadata especial
                                    addToGlobalBuffer(userId, audioText, chatId, userName, true); // true = es voz
                                } else {
                                    // Si no hay URL, usar mensaje por defecto
                                    addToGlobalBuffer(userId, '🎤 Sin transcripción disponible', chatId, userName, true);
                                }
                            } catch (error) {
                                console.error(`❌ Error transcribiendo audio:`, error);
                                logError('VOICE_TRANSCRIPTION_ERROR', 'Error transcribiendo audio', {
                                    userId: getShortUserId(userId),
                                    error: error.message
                                });
                                
                                // Fallback si falla la transcripción
                                addToGlobalBuffer(userId, '🎤 Error en transcripción', chatId, userName, true);
                            }
                        } else {
                            // Si la transcripción no está habilitada
                            addToGlobalBuffer(userId, '🎤 Transcripción deshabilitada', chatId, userName, true);
                        }
                    }
                    // Procesar mensajes de texto normales
                    else if (message.type === 'text' && message.text?.body) {
                        const text = message.text.body.trim();
                        
                        // 🔧 NUEVO: Log de mensaje limpio
                        terminalLog.message(userName, text);
                        
                        // 🔧 FIX: Marcar que el usuario envió texto (no voz)
                        const userState = getOrCreateUserState(userId, chatId, userName);
                        userState.lastInputVoice = false;
                        globalUserStates.set(chatId, userState);
                        
                        // Agregar al buffer global con emoji de texto
                        addToGlobalBuffer(userId, `📝 ${text}`, chatId, userName);
                    }
                }
            } catch (error) {
                console.error('❌ Error procesando mensaje individual:', error);
            }
        }
    } catch (error) {
        console.error('❌ Error en processWebhook:', error);
    }
}

// --- Ejecución ---
main();

// Exportar para testing