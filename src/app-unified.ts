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
import express from 'express';
import OpenAI from 'openai';
import fs from 'fs';

// Importar sistema de configuración unificada
import { 
    config, 
    logEnvironmentConfig, 
    validateEnvironmentConfig 
} from './config/environment.js';

// Importar utilidades existentes
import { 
    detailedLog, 
    logInfo, 
    logSuccess, 
    logError, 
    logWarning,
    logDebug,
    logThreadPersist,
    logOpenAIRequest,
    logOpenAIResponse,
    logWhatsAppMessage,
    logBufferActivity
} from './utils/logger.js';
import { threadPersistence } from './utils/persistence/index.js';
import { isLikelyFinalMessage, getRecommendedTimeout, getBufferStats } from './utils/messageBuffering.js';
import { recordTypingEvent, recordMessage, hasTypingSupport, getTypingStats, getUserTypingInfo } from './utils/typingDetector.js';

// --- Configuración Unificada ---
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN ?? '';
const WHAPI_API_URL = process.env.WHAPI_API_URL ?? 'https://gate.whapi.cloud/';

// Variables de estado
let isServerInitialized = false;
let openaiClient: OpenAI;

// Estado global para buffers y tracking
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

// Configuración de timeouts por entorno
const MESSAGE_BUFFER_TIMEOUT = config.isLocal ? 8000 : 6000; // 8s local, 6s Cloud Run
const MANUAL_MESSAGE_TIMEOUT = 8000;

// --- Inicialización de Express ---
const app = express();
app.use(express.json());

// --- Logging de Configuración al Inicio ---
console.log('\n🚀 Iniciando TeAlquilamos Bot...');
logEnvironmentConfig();

// Validar configuración
const configValidation = validateEnvironmentConfig();
if (!configValidation.isValid) {
    console.error('❌ Configuración inválida:');
    configValidation.errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
}

// --- Endpoints de Salud ---
app.get('/health', (req, res) => {
    const stats = threadPersistence.getStats();
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.environment,
        port: config.port,
        initialized: isServerInitialized,
        version: '1.0.0-unified-buffers',
        // Métricas de buffers y sistema
        activeBuffers: userMessageBuffers.size,
        activeTimers: userActivityTimers.size,
        manualBuffers: manualMessageBuffers.size,
        trackedBotMessages: botSentMessages.size,
        threadStats: stats,
        bufferTimeout: MESSAGE_BUFFER_TIMEOUT,
        systemHealth: {
            userBuffers: userMessageBuffers.size,
            manualBuffers: manualMessageBuffers.size,
            activeTimers: userActivityTimers.size + manualTimers.size,
            totalThreads: stats.totalThreads
        }
    };
    
    if (config.enableDetailedLogs) {
        logInfo('HEALTH_CHECK', 'Health check solicitado', healthStatus);
    }
    
    res.status(200).json(healthStatus);
});

app.get('/', (req, res) => {
    res.json({
        service: 'TeAlquilamos Bot',
        version: '1.0.0-unified',
        environment: config.environment,
        status: isServerInitialized ? 'ready' : 'initializing',
        port: config.port,
        webhookUrl: config.webhookUrl,
        baseUrl: config.baseUrl
    });
});

app.get('/ready', (req, res) => {
    if (isServerInitialized) {
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
            message: 'Bot completamente inicializado y listo',
            environment: config.environment
        });
    } else {
        res.status(503).json({
            status: 'initializing',
            timestamp: new Date().toISOString(),
            message: 'Bot aún inicializándose',
            environment: config.environment
        });
    }
});

// --- Inicialización del Servidor ---
const server = app.listen(config.port, config.host, () => {
    console.log(`🚀 Servidor HTTP iniciado en ${config.host}:${config.port}`);
    console.log(`🔗 Webhook URL: ${config.webhookUrl}`);
    
    logSuccess('SERVER_START', 'Servidor HTTP iniciado', { 
        host: config.host,
        port: config.port,
        environment: config.environment,
        webhookUrl: config.webhookUrl
    });
    
    // Inicializar componentes de forma asíncrona
    initializeBot().catch(error => {
        console.error('❌ Error en inicialización asíncrona:', error);
        logError('INIT_ERROR', 'Error en inicialización asíncrona', { 
            error: error.message,
            environment: config.environment
        });
    });
});

// --- Manejo de Errores del Servidor ---
server.on('error', (error: any) => {
    console.error('❌ Error del servidor:', error);
    logError('SERVER_ERROR', 'Error del servidor', { 
        error: error.message, 
        code: error.code,
        environment: config.environment
    });
});

server.on('listening', () => {
    console.log(`✅ Servidor escuchando en ${config.environment} mode`);
    logSuccess('SERVER_LISTENING', 'Servidor escuchando correctamente', { 
        port: config.port,
        environment: config.environment
    });
});

// --- Inicialización Asíncrona del Bot ---
async function initializeBot() {
    try {
        console.log('⚡ Inicializando componentes del bot...');
        
        // Validación de variables de entorno
        if (!ASSISTANT_ID) {
            throw new Error('ASSISTANT_ID no configurado');
        }
        if (!WHAPI_TOKEN) {
            throw new Error('WHAPI_TOKEN no configurado');
        }
        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY no configurado');
        }
        
        // Inicializar OpenAI con configuración optimizada por entorno
        openaiClient = new OpenAI({ 
            apiKey: OPENAI_API_KEY,
            timeout: config.openaiTimeout,
            maxRetries: config.openaiRetries
        });
        
        console.log(`🤖 OpenAI configurado (timeout: ${config.openaiTimeout}ms, retries: ${config.openaiRetries})`);
        
        // Cargar threads de forma no bloqueante
        setTimeout(() => {
            try {
                const stats = threadPersistence.getStats();
                logSuccess('THREADS_LOADED', `Threads cargados desde archivo`, stats);
            } catch (error) {
                logError('THREADS_LOAD', `Error cargando threads`, { error: error.message });
            }
        }, 1000);
        
        // Marcar como inicializado
        isServerInitialized = true;
        console.log('✅ Bot completamente inicializado');
        logSuccess('BOT_READY', 'Bot completamente inicializado y listo', {
            environment: config.environment,
            port: config.port,
            webhookUrl: config.webhookUrl
        });
        
        // Configurar webhooks y lógica del bot
        setupWebhooks();
        
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        logError('INIT_ERROR', 'Error durante inicialización', { 
            error: error.message,
            environment: config.environment
        });
        // No salir del proceso - mantener el servidor HTTP activo
    }
}

// --- Configuración de Webhooks y Lógica del Bot ---
function setupWebhooks() {
    // Función para determinar si un log debe mostrarse
    const shouldLog = (level: string, context: string): boolean => {
        if (config.logLevel === 'production') {
            const criticalContexts = [
                'THREAD_PERSIST',     // Guardado de threads
                'CONTEXT_LABELS',     // Etiquetas críticas
                'NEW_THREAD_LABELS',  // Etiquetas nuevas
                'LABELS_24H',         // Actualización etiquetas
                'OPENAI_RUN_ERROR',   // Errores OpenAI
                'FUNCTION_EXECUTION', // Ejecución de funciones
                'WHATSAPP_SEND',      // Envío exitoso
                'AI_PROCESSING',      // Respuestas de IA
                'SERVER_START',       // Inicio del servidor
                'CONFIG',             // Configuración
                'SHUTDOWN'            // Cierre
            ];
            
            const criticalLevels = ['ERROR', 'SUCCESS', 'WARNING'];
            
            return criticalLevels.includes(level.toUpperCase()) || 
                   criticalContexts.some(ctx => context.includes(ctx));
        }
        
        return true; // En desarrollo, mostrar todo
    };

    // Colores para logs de consola
    const LOG_COLORS = {
        USER: '\x1b[36m',    // Cyan
        BOT: '\x1b[32m',     // Green
        AGENT: '\x1b[33m',   // Yellow
        TIMESTAMP: '\x1b[94m', // Light Blue
        RESET: '\x1b[0m'     // Reset
    };

    // Función para timestamp compacto
    const getCompactTimestamp = (): string => {
        const now = new Date();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const month = months[now.getMonth()];
        const day = now.getDate();
        let hour = now.getHours();
        const minute = now.getMinutes().toString().padStart(2, '0');
        const ampm = hour >= 12 ? 'p' : 'a';
        
        hour = hour % 12;
        if (hour === 0) hour = 12;
        
        return `${month}${day} [${hour}:${minute}${ampm}]`;
    };

    // Constantes de tiempo
    const DEFAULT_TIMEOUT_MS = config.isLocal ? 3000 : 2000;
    const MIN_TIMEOUT_MS = config.isLocal ? 800 : 500;

    // Cache para optimizar extracciones de User ID
    const userIdCache = new Map<string, string>();

    // Función para limpiar nombres de contacto
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
        
        if (config.enableDetailedLogs) {
            logDebug('NAME_EXTRACTION', 'Nombre limpiado', { 
                original: rawName, 
                cleaned: cleaned 
            });
        }
        
        return cleaned;
    };

    // --- Función para mostrar estadísticas en tiempo real ---
    const showLiveStats = () => {
        const stats = threadPersistence.getStats();
        
        console.log(`\n┌─────────────────────────────────────────────┐`);
        console.log(`│ 📊 Estado del Sistema - En Vivo            │`);
        console.log(`├─────────────────────────────────────────────┤`);
        console.log(`│ 👥 Buffers activos: ${userMessageBuffers.size.toString().padEnd(19)} │`);
        console.log(`│ ⏰ Timers activos: ${userActivityTimers.size.toString().padEnd(20)} │`);
        console.log(`│ 🧠 Threads OpenAI: ${stats.totalThreads.toString().padEnd(19)} │`);
        console.log(`│ 🛡️  Mensajes bot tracked: ${botSentMessages.size.toString().padEnd(11)} │`);
        console.log(`│ 🔧 Buffers manuales: ${manualMessageBuffers.size.toString().padEnd(17)} │`);
        console.log(`│ 🌐 Entorno: ${config.environment.padEnd(26)} │`);
        console.log(`└─────────────────────────────────────────────┘\n`);
    };

    // Función para obtener ID corto de usuario
    const getShortUserId = (jid: string): string => {
        if (typeof jid === 'string') {
            const cleaned = jid.split('@')[0] || jid;
            logDebug('USER_ID_EXTRACTION', `Extrayendo ID de usuario`, { 
                original: jid, 
                cleaned: cleaned 
            });
            return cleaned;
        }
        return 'unknown';
    };

    // Funciones de thread management
    const saveThreadId = (jid: string, threadId: string, chatId: string = null, userName: string = null): boolean => {
        if (!jid || !threadId) {
            logWarning('THREAD_SAVE', `Intento de guardar thread inválido`, { jid, threadId });
            return false;
        }
        const clientPhone = getShortUserId(jid);
        
        const fullChatId = chatId || `${clientPhone}@s.whatsapp.net`;
        const name = userName || 'Usuario';
        
        threadPersistence.setThread(clientPhone, threadId, fullChatId, name);
        logThreadPersist(clientPhone, threadId, 'saved');
        
        const stats = threadPersistence.getStats();
        logInfo('THREAD_STATE', 'Estado de threads actualizado', stats);
        
        return true;
    };

    const getThreadId = (jid: string): string | null => {
        if (!jid) {
            logWarning('THREAD_GET', 'Intento de obtener thread con jid nulo');
            return null;
        }
        const clientPhone = getShortUserId(jid);
        
        const threadInfo = threadPersistence.getThread(clientPhone);
        const threadId = threadInfo?.threadId || null;
        
        logDebug('THREAD_LOOKUP', `Búsqueda de thread`, {
            userJid: jid,
            cleanedId: clientPhone,
            found: !!threadId,
            threadId: threadId,
            threadInfo: threadInfo
        });
        
        if (threadId) {
            logInfo('THREAD_GET', `Thread encontrado para ${clientPhone} (${threadInfo.userName}): ${threadId}`, {
                chatId: threadInfo.chatId,
                userName: threadInfo.userName,
                lastActivity: new Date(threadInfo.lastActivity).toISOString()
            });
        } else {
            logInfo('THREAD_GET', `No existe thread para ${clientPhone}`, {
                searchedKey: clientPhone
            });
        }
        
        return threadId;
    };

    // Función para contexto temporal
    const getCurrentTimeContext = (): string => {
        const now = new Date();
        const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        
        const year = colombiaTime.getFullYear();
        const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
        const day = String(colombiaTime.getDate()).padStart(2, '0');
        const hours = String(colombiaTime.getHours()).padStart(2, '0');
        const minutes = String(colombiaTime.getMinutes()).padStart(2, '0');
        
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                           'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        
        const dayName = dayNames[colombiaTime.getDay()];
        const monthName = monthNames[colombiaTime.getMonth()];
        
        return `=== CONTEXTO TEMPORAL ACTUAL ===
FECHA: ${dayName}, ${day} de ${monthName} de ${year} (${year}-${month}-${day})
HORA: ${hours}:${minutes} - Zona horaria Colombia (UTC-5)
=== FIN CONTEXTO ===`;
    };

    const getConversationalContext = (threadInfo: any): string => {
        if (!threadInfo) {
            return '';
        }
        
        const { name, userName, labels } = threadInfo;
        let context = '=== CONTEXTO CONVERSACIONAL ===\n';
        
        if (name && userName) {
            context += `CLIENTE: ${name} (${userName})\n`;
        } else if (name) {
            context += `CLIENTE: ${name}\n`;
        } else if (userName) {
            context += `CLIENTE: ${userName}\n`;
        } else {
            context += `CLIENTE: Usuario\n`;
        }
        
        if (labels && labels.length > 0) {
            context += `ETIQUETAS: ${labels.join(', ')}\n`;
            
            logInfo('CONTEXT_LABELS', `Etiquetas incluidas en contexto conversacional`, {
                userId: threadInfo.userId || 'unknown',
                name: name,
                userName: userName,
                labels: labels,
                labelsCount: labels.length
            });
        } else {
            logDebug('CONTEXT_LABELS', `Sin etiquetas para incluir en contexto`, {
                userId: threadInfo.userId || 'unknown',
                name: name,
                userName: userName,
                labels: labels || []
            });
        }
        
        context += `=== FIN CONTEXTO ===`;
        
        return context;
    };

    // --- Función para procesar mensajes agrupados ---
    async function processUserMessages(userId: string) {
        const buffer = userMessageBuffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            logWarning('MESSAGE_PROCESS', `Buffer vacío o inexistente para ${getShortUserId(userId)}`);
            return;
        }

        const shortUserId = getShortUserId(userId);
        const combinedMessage = buffer.messages.join('\n\n');

        logInfo('MESSAGE_PROCESS', `Procesando mensajes agrupados`, {
            userId,
            shortUserId,
            chatId: buffer.chatId,
            messageCount: buffer.messages.length,
            totalLength: combinedMessage.length,
            preview: combinedMessage.substring(0, 100) + '...',
            environment: config.environment
        });

        // Log compacto en consola con información del buffer
        const timestamp = getCompactTimestamp();
        console.log(`${LOG_COLORS.TIMESTAMP}${timestamp}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}🤖 Bot:${LOG_COLORS.RESET} ${buffer.messages.length} msgs → OpenAI`);

        try {
            // Procesar con OpenAI usando el mensaje combinado
            const response = await processWithOpenAI(
                combinedMessage, 
                userId, 
                buffer.chatId, 
                buffer.name
            );

            if (response && response.trim()) {
                await sendWhatsAppMessage(buffer.chatId, response);
                
                // Log de respuesta exitosa
                const responsePreview = response.length > 50 ? response.substring(0, 50) + '...' : response;
                console.log(`${LOG_COLORS.TIMESTAMP}${getCompactTimestamp()}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}🤖 Bot:${LOG_COLORS.RESET} "${responsePreview}"`);
                
                logSuccess('BUFFER_PROCESSED', `Buffer procesado exitosamente para ${shortUserId}`, {
                    messageCount: buffer.messages.length,
                    responseLength: response.length,
                    environment: config.environment
                });
            } else {
                logWarning('EMPTY_RESPONSE', 'OpenAI devolvió respuesta vacía para buffer', {
                    userId,
                    chatId: buffer.chatId,
                    messageCount: buffer.messages.length
                });
            }
        } catch (error) {
            logError('MESSAGE_PROCESSING_ERROR', 'Error procesando mensajes agrupados', {
                error: error.message,
                userId,
                chatId: buffer.chatId,
                messageCount: buffer.messages.length,
                environment: config.environment
            });
            
            // Enviar mensaje de error al usuario
            try {
                await sendWhatsAppMessage(buffer.chatId, 'Lo siento, hubo un problema procesando tus mensajes. Por favor intenta de nuevo.');
            } catch (sendError) {
                logError('ERROR_MESSAGE_SEND_FAILED', 'No se pudo enviar mensaje de error', {
                    error: sendError.message,
                    chatId: buffer.chatId
                });
            }
        }

        // Limpiar buffer y timer
        userMessageBuffers.delete(userId);
        userActivityTimers.delete(userId);
        
        if (config.enableDetailedLogs) {
            logInfo('BUFFER_CLEANUP', `Buffer limpiado para ${shortUserId}`, {
                userId,
                environment: config.environment
            });
        }
    }

    // Función principal de procesamiento con OpenAI
    const processWithOpenAI = async (userMsg: string, userJid: string, chatId: string = null, userName: string = null): Promise<string> => {
        const shortUserId = getShortUserId(userJid);
        const startTime = Date.now();
        
        logInfo('USER_DEBUG', `UserJid para búsqueda: "${userJid}"`, { 
            originalFormat: userJid,
            cleanedFormat: shortUserId,
            chatId: chatId,
            userName: userName
        });
        
        try {
            // Verificar thread existente
            let threadId = getThreadId(userJid);
            
            const stats = threadPersistence.getStats();
            logInfo('THREAD_CHECK', 
                threadId ? `Thread encontrado: ${threadId}` : 'No se encontró thread existente',
                { userJid, shortUserId, threadId, totalThreads: stats.totalThreads }
            );
            
            let chatHistoryContext = '';
            
            if (!threadId) {
                logOpenAIRequest(shortUserId, 'creating_new_thread');
                const thread = await openaiClient.beta.threads.create();
                threadId = thread.id;
                
                saveThreadId(userJid, threadId, chatId, userName);
                
                logOpenAIRequest(shortUserId, 'thread_created');
                logSuccess('THREAD_NEW', `Nuevo thread creado para ${shortUserId} (${userName})`, { 
                    threadId,
                    userJid: userJid,
                    cleanedId: shortUserId,
                    chatId: chatId,
                    userName: userName
                });
            } else {
                logSuccess('THREAD_REUSE', `Reutilizando thread existente para ${shortUserId} (${userName || 'Usuario'})`, {
                    threadId,
                    userJid: userJid,
                    cleanedId: shortUserId
                });
            }
            
            // Agregar mensaje del usuario con contextos
            logOpenAIRequest(shortUserId, 'adding_message');
            
            const currentThreadInfo = threadPersistence.getThread(shortUserId);
            const timeContext = getCurrentTimeContext();
            const conversationalContext = getConversationalContext(currentThreadInfo);
            
            let messageWithContexts = timeContext + '\n\n' + conversationalContext;
            
            if (chatHistoryContext) {
                messageWithContexts += '\n\n' + chatHistoryContext;
            }
            
            messageWithContexts += '\n\n' + userMsg;
            
            await openaiClient.beta.threads.messages.create(threadId, {
                role: 'user',
                content: messageWithContexts
            });
            
            // Actualizar actividad del thread
            const threadInfo = threadPersistence.getThread(shortUserId);
            if (threadInfo) {
                threadPersistence.setThread(shortUserId, threadId, threadInfo.chatId, threadInfo.userName);
            }
            
            logOpenAIRequest(shortUserId, 'message_added');
            
            // Crear y ejecutar run
            logOpenAIRequest(shortUserId, 'creating_run');
            let run = await openaiClient.beta.threads.runs.create(threadId, {
                assistant_id: ASSISTANT_ID
            });
            
            logOpenAIRequest(shortUserId, 'run_started');
            
            // Esperar respuesta
            let attempts = 0;
            const maxAttempts = 60;
            
            while (['queued', 'in_progress'].includes(run.status) && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
                attempts++;
                
                if (attempts % 10 === 0) {
                    logInfo('OPENAI_POLLING', `Esperando respuesta para ${shortUserId}, intento ${attempts}/${maxAttempts}, estado: ${run.status}`);
                }
            }
            
            const duration = Date.now() - startTime;
            
            if (run.status === 'completed') {
                logSuccess('OPENAI_RUN_COMPLETED', `Run completado para ${shortUserId}`, { threadId, duration });
                
                const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 1 });
                const assistantMessage = messages.data[0];
                
                if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
                    const content = assistantMessage.content[0];
                    if (content.type === 'text') {
                        const responseText = content.text.value;
                        
                        logSuccess('OPENAI_RESPONSE', `Respuesta recibida para ${shortUserId}`, {
                            threadId,
                            responseLength: responseText.length,
                            duration,
                            environment: config.environment
                        });
                        
                        return responseText;
                    }
                }
                
                logWarning('OPENAI_NO_CONTENT', `Run completado pero sin contenido de texto`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    messageContent: assistantMessage?.content
                });
                
                return 'Lo siento, no pude generar una respuesta adecuada.';
                
            } else if (run.status === 'requires_action') {
                logWarning('FUNCTION_CALLING_NOT_IMPLEMENTED', `Run requiere function calling (no implementado aún)`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    status: run.status
                });
                
                return 'Lo siento, esta consulta requiere funciones avanzadas que aún no están implementadas en esta versión.';
                
            } else {
                logError('OPENAI_RUN_ERROR', `Run falló o expiró`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    status: run.status,
                    duration,
                    attempts
                });
                
                return 'Lo siento, hubo un problema procesando tu consulta. Por favor intenta de nuevo.';
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            logError('OPENAI_PROCESSING_ERROR', `Error en procesamiento OpenAI`, {
                shortUserId,
                error: error.message,
                duration,
                environment: config.environment
            });
            
            return 'Lo siento, hubo un error técnico. Por favor intenta de nuevo en unos momentos.';
        }
    };

    // --- Webhook Principal ---
    app.post('/hook', async (req, res) => {
        // Responder inmediatamente para evitar timeouts
        res.status(200).json({ 
            received: true, 
            timestamp: new Date().toISOString(),
            environment: config.environment
        });
        
        // Procesar de forma asíncrona
        if (!isServerInitialized) {
            logWarning('WEBHOOK_NOT_READY', 'Webhook recibido pero bot no inicializado', {
                environment: config.environment
            });
            return;
        }
        
        try {
            const { messages, presences } = req.body;
            
            if (!messages || !Array.isArray(messages)) {
                logWarning('WEBHOOK', 'Webhook recibido sin mensajes válidos', { 
                    body: req.body,
                    environment: config.environment
                });
                return;
            }
            
            logInfo('WEBHOOK', `Procesando ${messages.length} mensajes del webhook`, {
                environment: config.environment,
                messageCount: messages.length
            });
            
            // Procesar cada mensaje
            for (const message of messages) {
                if (config.enableDetailedLogs) {
                    logInfo('MESSAGE_RECEIVED', 'Mensaje recibido', {
                        from: message.from,
                        type: message.type,
                        timestamp: message.timestamp,
                        body: message.text?.body?.substring(0, 100) + '...'
                    });
                }
                
                // Solo procesar mensajes de texto que no sean del bot
                if (message.type === 'text' && !message.from_me && message.text?.body) {
                    const userJid = message.from;
                    const chatId = message.chat_id;
                    const userName = cleanContactName(message.from_name);
                    const messageText = message.text.body;
                    
                    // 📦 SISTEMA DE BUFFERS: Agrupar mensajes en lugar de procesar inmediatamente
                    
                    // Crear o actualizar buffer de mensajes
                    if (!userMessageBuffers.has(userJid)) {
                        userMessageBuffers.set(userJid, {
                            messages: [],
                            chatId: chatId,
                            name: userName,
                            lastActivity: Date.now()
                        });
                        
                        if (config.enableDetailedLogs) {
                            logInfo('BUFFER_CREATE', `Buffer creado para ${userName}`, {
                                userJid,
                                chatId,
                                timeout: MESSAGE_BUFFER_TIMEOUT,
                                environment: config.environment
                            });
                        }
                    }

                    const buffer = userMessageBuffers.get(userJid)!;
                    buffer.messages.push(messageText);
                    buffer.lastActivity = Date.now();

                    // Cancelar timer anterior si existe
                    if (userActivityTimers.has(userJid)) {
                        clearTimeout(userActivityTimers.get(userJid)!);
                        
                        if (config.enableDetailedLogs) {
                            logDebug('BUFFER_TIMER_RESET', `Timer reiniciado para ${userName}`, {
                                userJid,
                                previousMessages: buffer.messages.length - 1,
                                newMessage: messageText.substring(0, 50)
                            });
                        }
                    }

                    // Log en consola con indicador de espera
                    const timeoutSeconds = MESSAGE_BUFFER_TIMEOUT / 1000;
                    const messagePreview = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
                    console.log(`${LOG_COLORS.TIMESTAMP}${getCompactTimestamp()}${LOG_COLORS.RESET} ${LOG_COLORS.USER}👤 ${userName}:${LOG_COLORS.RESET} "${messagePreview}" → ⏳ ${timeoutSeconds}s...`);

                    // Establecer nuevo timer para procesar mensajes agrupados
                    const timerId = setTimeout(async () => {
                        await processUserMessages(userJid);
                    }, MESSAGE_BUFFER_TIMEOUT);

                    userActivityTimers.set(userJid, timerId);

                    // Log técnico del buffering
                    logInfo('MESSAGE_BUFFERED', `Mensaje agregado al buffer`, {
                        userJid,
                        chatId,
                        userName,
                        bufferCount: buffer.messages.length,
                        messageLength: messageText.length,
                        timeoutMs: MESSAGE_BUFFER_TIMEOUT,
                        environment: config.environment
                    });
                }
            }
            
        } catch (error) {
            logError('WEBHOOK_ERROR', 'Error procesando webhook', { 
                error: error.message, 
                stack: error.stack,
                environment: config.environment
            });
        }
    });

    // Función para enviar mensajes de WhatsApp
    async function sendWhatsAppMessage(chatId: string, message: string) {
        try {
            const response = await fetch(`${WHAPI_API_URL}/messages/text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${WHAPI_TOKEN}`
                },
                body: JSON.stringify({
                    to: chatId,
                    body: message
                })
            });
            
            if (response.ok) {
                const result = await response.json() as any;
                logSuccess('WHATSAPP_SEND', 'Mensaje enviado exitosamente', {
                    chatId,
                    messageLength: message.length,
                    messageId: result?.id || 'unknown',
                    environment: config.environment
                });
                return result;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            logError('WHATSAPP_SEND_ERROR', 'Error enviando mensaje de WhatsApp', {
                error: error.message,
                chatId,
                messageLength: message.length,
                environment: config.environment
            });
            throw error;
        }
    }

    // Endpoint para información de configuración (solo en desarrollo)
    if (config.isLocal) {
        app.get('/config', (req, res) => {
            res.json({
                environment: config.environment,
                port: config.port,
                webhookUrl: config.webhookUrl,
                baseUrl: config.baseUrl,
                logLevel: config.logLevel,
                enableDetailedLogs: config.enableDetailedLogs,
                openaiTimeout: config.openaiTimeout,
                openaiRetries: config.openaiRetries,
                bufferTimeout: MESSAGE_BUFFER_TIMEOUT
            });
        });

        // Endpoint para estadísticas en vivo
        app.get('/stats', (req, res) => {
            const stats = threadPersistence.getStats();
            const liveStats = {
                timestamp: new Date().toISOString(),
                environment: config.environment,
                buffers: {
                    active: userMessageBuffers.size,
                    manual: manualMessageBuffers.size,
                    timeout: MESSAGE_BUFFER_TIMEOUT
                },
                timers: {
                    user: userActivityTimers.size,
                    manual: manualTimers.size,
                    total: userActivityTimers.size + manualTimers.size
                },
                threads: stats,
                tracking: {
                    botMessages: botSentMessages.size,
                    typing: userTypingState.size
                }
            };
            
            // Mostrar stats en consola también
            showLiveStats();
            
            res.json(liveStats);
        });
    }
}

// --- Manejo de Errores y Cierre ---
process.on('unhandledRejection', (reason) => {
    console.log('⚠️  Error no manejado detectado');
    logError('SYSTEM', 'Unhandled Rejection detectado', { 
        reason: reason?.toString(),
        timestamp: new Date().toISOString(),
        environment: config.environment
    });
});

process.on('SIGTERM', () => {
    console.log('\n⏹️  Señal SIGTERM recibida, cerrando servidor...');
    logInfo('SHUTDOWN', 'Señal SIGTERM recibida', { environment: config.environment });
    
    server.close(() => {
        console.log('👋 Servidor cerrado correctamente');
        logSuccess('SHUTDOWN', 'Servidor cerrado exitosamente', { environment: config.environment });
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n⏹️  Cerrando TeAlquilamos Bot...');
    logInfo('SHUTDOWN', 'Cierre del bot iniciado por SIGINT', { environment: config.environment });
    
    server.close(() => {
        console.log('👋 Bot cerrado correctamente\n');
        logSuccess('SHUTDOWN', 'Bot cerrado exitosamente', { environment: config.environment });
        process.exit(0);
    });
});

// Exportar para testing
export { app, server, config }; 