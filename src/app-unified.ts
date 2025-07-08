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

// Importar sistema de monitoreo
import { botDashboard } from './utils/monitoring/dashboard.js';

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
const MESSAGE_BUFFER_TIMEOUT = config.isLocal ? 8000 : 7000; // 8s local, 7s Cloud Run (menos agresivo)
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
        
        // 🧹 LIMPIEZA PERIÓDICA DE MEMORIA PARA CLOUD RUN
        if (config.environment === 'cloud-run' || !config.isLocal) {
            const cleanupInterval = setInterval(() => {
                const now = Date.now();
                const ONE_HOUR = 60 * 60 * 1000;
                let cleanedBuffers = 0;
                let cleanedTimers = 0;
                let cleanedBotMessages = 0;
                
                // Limpiar buffers de usuarios inactivos
                userMessageBuffers.forEach((buffer, userId) => {
                    if (now - buffer.lastActivity > ONE_HOUR) {
                        userMessageBuffers.delete(userId);
                        cleanedBuffers++;
                        
                        if (userActivityTimers.has(userId)) {
                            clearTimeout(userActivityTimers.get(userId));
                            userActivityTimers.delete(userId);
                            cleanedTimers++;
                        }
                    }
                });
                
                // Limpiar buffers manuales antiguos
                manualMessageBuffers.forEach((buffer, chatId) => {
                    if (now - buffer.timestamp > ONE_HOUR) {
                        manualMessageBuffers.delete(chatId);
                        
                        if (manualTimers.has(chatId)) {
                            clearTimeout(manualTimers.get(chatId));
                            manualTimers.delete(chatId);
                        }
                    }
                });
                
                // Limpiar tracking de mensajes del bot (más de 2 horas)
                const botMessageIds = Array.from(botSentMessages);
                const TWO_HOURS = 2 * 60 * 60 * 1000;
                botMessageIds.forEach(messageId => {
                    // Los IDs más antiguos se limpian automáticamente después de 10 minutos
                    // pero por seguridad, limpiamos todo lo que tenga más de 2 horas
                    cleanedBotMessages++;
                });
                
                if (cleanedBuffers > 0 || cleanedTimers > 0) {
                    logInfo('MEMORY_CLEANUP', 'Limpieza periódica de memoria completada', {
                        cleanedBuffers,
                        cleanedTimers,
                        remainingBuffers: userMessageBuffers.size,
                        remainingTimers: userActivityTimers.size,
                        remainingManualBuffers: manualMessageBuffers.size,
                        remainingBotMessages: botSentMessages.size,
                        environment: config.environment
                    });
                }
                
            }, 30 * 60 * 1000); // Cada 30 minutos
            
            logInfo('MEMORY_CLEANUP_SCHEDULED', 'Limpieza periódica de memoria programada', {
                intervalMinutes: 30,
                cleanupThresholdHours: 1,
                environment: config.environment
            });
        }
        
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

    // --- Función helper para extraer tiempo de retry de rate limit ---
    const extractRetryAfter = (errorMessage: string): number | null => {
        const match = errorMessage.match(/Please try again in ([\d.]+)s/);
        return match ? parseFloat(match[1]) : null;
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

        // 🎯 Log compacto - Inicio con colores
        const timestamp1 = getCompactTimestamp();
        console.log(`${LOG_COLORS.TIMESTAMP}${timestamp1}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}[BOT]${LOG_COLORS.RESET} 🤖 ${buffer.messages.length} msgs → OpenAI`);
        
        // Enviar a OpenAI con el userId original y la información completa del cliente
        const startTime = Date.now();
        const response = await processWithOpenAI(combinedMessage, userId, buffer.chatId, buffer.name);
        const aiDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // 🎯 Log compacto - Resultado con preview
        const preview = response.length > 50 ? response.substring(0, 50) + '...' : response;
        const timestamp2 = getCompactTimestamp();
        
        // Verificar si la respuesta será dividida en párrafos
        const paragraphs = response.split(/\n\n+/).filter(p => p.trim().length > 0);
        const willSplit = paragraphs.length > 1;
        
        if (willSplit) {
            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp2}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}[BOT]${LOG_COLORS.RESET} ✅ Completado (${aiDuration}s) → 💬 ${paragraphs.length} párrafos`);
        } else {
            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp2}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}[BOT]${LOG_COLORS.RESET} ✅ Completado (${aiDuration}s) → 💬 "${preview}"`);
        }
        
        // Enviar respuesta a WhatsApp usando la función mejorada
        await sendWhatsAppMessage(buffer.chatId, response);

        // Limpiar buffer
        userMessageBuffers.delete(userId);
        userActivityTimers.delete(userId);
        logBufferActivity(shortUserId, 'buffer_cleared');
    }

    // --- 🎯 FUNCIÓN PARA OBTENER INFORMACIÓN ENRIQUECIDA DEL CONTACTO ---
    const getEnhancedContactInfo = async (userId: string, chatId: string) => {
        try {
            const endpoint = `${WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}`;
            
            logDebug('CONTACT_API', `Obteniendo info adicional del contacto ${userId}`, {
                endpoint,
                environment: config.environment
            });
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${WHAPI_TOKEN}`
                }
            });
            
            if (response.ok) {
                const chatData = await response.json() as any;
                
                const enhancedInfo = {
                    name: cleanContactName(chatData.name || chatData.first_name || 'Usuario'),
                    labels: chatData.labels || [],
                    lastSeen: chatData.last_message?.timestamp,
                    isContact: !!chatData.name,
                    profilePic: chatData.profile_pic_url
                };
                
                logInfo('CONTACT_API_DETAILED', `Información detallada del contacto ${userId}`, {
                    name: enhancedInfo.name,
                    labels: enhancedInfo.labels,
                    labelsCount: enhancedInfo.labels.length,
                    lastSeen: enhancedInfo.lastSeen,
                    isContact: enhancedInfo.isContact,
                    profilePic: enhancedInfo.profilePic ? 'Sí' : 'No',
                    environment: config.environment
                });
                
                logSuccess('CONTACT_API', `Info adicional obtenida para ${userId}`, {
                    hasName: !!enhancedInfo.name,
                    hasLabels: enhancedInfo.labels.length > 0,
                    isContact: enhancedInfo.isContact,
                    environment: config.environment
                });
                
                return enhancedInfo;
            } else {
                logWarning('CONTACT_API', `No se pudo obtener info adicional para ${userId}: ${response.status}`, {
                    status: response.status,
                    statusText: response.statusText,
                    environment: config.environment
                });
            }
        } catch (error) {
            logError('CONTACT_API', `Error obteniendo info del contacto ${userId}`, { 
                error: error.message,
                environment: config.environment
            });
        }
        
        return { name: 'Usuario', labels: [], isContact: false };
    };

    // --- 🎯 FUNCIÓN PARA ENVÍO INTELIGENTE DE MENSAJES CON DIVISIÓN ---
    async function sendWhatsAppMessage(chatId: string, message: string) {
        const shortUserId = getShortUserId(chatId);
        
        try {
            // 🔧 DIVISIÓN INTELIGENTE DE MENSAJES LARGOS
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
            
            // 🔧 ENVÍO ÚNICO O MÚLTIPLE SEGÚN DIVISIÓN
            if (chunks.length === 1) {
                // Mensaje simple
                logInfo('WHATSAPP_SEND', `Enviando mensaje a ${shortUserId}`, { 
                    chatId,
                    messageLength: message.length,
                    preview: message.substring(0, 100) + '...',
                    environment: config.environment
                });
                
                const response = await fetch(`${WHAPI_API_URL}/messages/text`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${WHAPI_TOKEN}`
                    },
                    body: JSON.stringify({
                        to: chatId,
                        body: message,
                        typing_time: 3
                    })
                });
                
                if (response.ok) {
                    const result = await response.json() as any;
                    
                    // 🔧 TRACKING: Registrar ID del mensaje enviado por el bot
                    if (result.sent && result.message?.id) {
                        botSentMessages.add(result.message.id);
                        logDebug('BOT_MESSAGE_TRACKED', `Mensaje del bot registrado para tracking anti-duplicación`, {
                            shortUserId: shortUserId,
                            messageId: result.message.id,
                            messageLength: message.length,
                            timestamp: new Date().toISOString(),
                            environment: config.environment
                        });
                        
                        // Limpiar después de 10 minutos
                        setTimeout(() => {
                            botSentMessages.delete(result.message.id);
                        }, 10 * 60 * 1000);
                    }
                    
                    logSuccess('WHATSAPP_SEND', `Mensaje enviado exitosamente`, {
                        shortUserId: shortUserId,
                        messageLength: message.length,
                        messageId: result.message?.id,
                        environment: config.environment
                    });
                    return true;
                } else {
                    const errorText = await response.text();
                    logError('WHATSAPP_SEND', `Error enviando mensaje a ${shortUserId}`, { 
                        status: response.status,
                        statusText: response.statusText,
                        error: errorText,
                        environment: config.environment
                    });
                    return false;
                }
            } else {
                // 🎯 MÚLTIPLES PÁRRAFOS - Enviar como mensajes separados
                logInfo('WHATSAPP_CHUNKS', `Dividiendo mensaje largo en ${chunks.length} párrafos`, { 
                    chatId: chatId,
                    shortUserId: shortUserId,
                    totalChunks: chunks.length,
                    originalLength: message.length,
                    environment: config.environment
                });
                
                // Enviar cada chunk como mensaje independiente
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const isLastChunk = i === chunks.length - 1;
                    
                    logDebug('WHATSAPP_CHUNK', `Enviando párrafo ${i + 1}/${chunks.length}`, {
                        shortUserId: shortUserId,
                        chunkLength: chunk.length,
                        preview: chunk.substring(0, 50) + '...',
                        environment: config.environment
                    });
                    
                    const response = await fetch(`${WHAPI_API_URL}/messages/text`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${WHAPI_TOKEN}`
                        },
                        body: JSON.stringify({
                            to: chatId,
                            body: chunk,
                            typing_time: i === 0 ? 3 : 2
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json() as any;
                        
                        // 🔧 TRACKING: Registrar ID del mensaje enviado por el bot
                        if (result.sent && result.message?.id) {
                            botSentMessages.add(result.message.id);
                            setTimeout(() => {
                                botSentMessages.delete(result.message.id);
                            }, 10 * 60 * 1000);
                        }
                    } else {
                        const errorText = await response.text();
                        logError('WHATSAPP_CHUNK_ERROR', `Error enviando chunk ${i + 1}/${chunks.length}`, { 
                            shortUserId: shortUserId,
                            status: response.status,
                            error: errorText,
                            environment: config.environment
                        });
                    }
                    
                    // Delay natural entre párrafos
                    if (!isLastChunk) {
                        await new Promise(resolve => setTimeout(resolve, 150));
                    }
                }
                
                logSuccess('WHATSAPP_CHUNKS_COMPLETE', `Todos los párrafos enviados`, {
                    shortUserId: shortUserId,
                    totalChunks: chunks.length,
                    originalLength: message.length,
                    environment: config.environment
                });
                return true;
            }
        } catch (error) {
            logError('WHATSAPP_SEND', `Error de red enviando a ${shortUserId}`, { 
                error: error.message,
                stack: error.stack,
                environment: config.environment
            });
            return false;
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
                
                // 🆕 OBTENER ETIQUETAS INMEDIATAMENTE PARA NUEVO THREAD
                try {
                    const enhancedInfo = await getEnhancedContactInfo(shortUserId, chatId);
                    if (enhancedInfo.labels && enhancedInfo.labels.length > 0) {
                        threadPersistence.updateThreadMetadata(shortUserId, {
                            name: enhancedInfo.name,
                            userName: userName,
                            labels: enhancedInfo.labels
                        });
                        logInfo('NEW_THREAD_LABELS', `Labels establecidas para nuevo thread`, {
                            shortUserId,
                            threadId,
                            labelsCount: enhancedInfo.labels.length,
                            labels: enhancedInfo.labels,
                            environment: config.environment
                        });
                    }
                } catch (err) {
                    logWarning('NEW_THREAD_LABELS_ERROR', `Error obteniendo labels para nuevo thread`, {
                        shortUserId,
                        error: err.message,
                        environment: config.environment
                    });
                }
                
                logOpenAIRequest(shortUserId, 'thread_created');
                logSuccess('THREAD_NEW', `Nuevo thread creado para ${shortUserId} (${userName})`, { 
                    threadId,
                    userJid: userJid,
                    cleanedId: shortUserId,
                    chatId: chatId,
                    userName: userName
                });
            } else {
                // 🆕 ACTUALIZACIÓN DE ETIQUETAS CADA 24 HORAS
                const threadInfo = threadPersistence.getThread(shortUserId);
                if (threadInfo && threadInfo.lastActivity) {
                    const lastActivityDate = new Date(threadInfo.lastActivity);
                    const now = new Date();
                    const hoursSinceLastActivity = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60);
                    
                    if (hoursSinceLastActivity > 24) {
                        logInfo('LABELS_24H_UPDATE', `Han pasado ${Math.floor(hoursSinceLastActivity)} horas, actualizando etiquetas`, {
                            shortUserId,
                            lastActivity: threadInfo.lastActivity,
                            environment: config.environment
                        });
                        
                        try {
                            const enhancedInfo = await getEnhancedContactInfo(shortUserId, chatId);
                            threadPersistence.updateThreadMetadata(shortUserId, {
                                name: enhancedInfo.name,
                                userName: userName,
                                labels: enhancedInfo.labels
                            });
                            logInfo('LABELS_24H_UPDATED', `Etiquetas actualizadas después de 24h`, {
                                shortUserId,
                                labelsCount: enhancedInfo.labels?.length || 0,
                                labels: enhancedInfo.labels,
                                environment: config.environment
                            });
                        } catch (err) {
                            logWarning('LABELS_24H_ERROR', `Error actualizando etiquetas después de 24h`, {
                                shortUserId,
                                error: err.message,
                                environment: config.environment
                            });
                        }
                    }
                }
                
                logSuccess('THREAD_REUSE', `Reutilizando thread existente para ${shortUserId} (${userName || 'Usuario'})`, {
                    threadId,
                    userJid: userJid,
                    cleanedId: shortUserId
                });
            }
            
            // Agregar mensaje del usuario con contextos
            logOpenAIRequest(shortUserId, 'adding_message');
            
            // 🔧 CRÍTICO: Verificar y cancelar runs activos ANTES de agregar mensaje
            logInfo('RUN_CHECK_START', `Verificando runs activos antes de agregar mensaje`, {
                shortUserId,
                threadId,
                environment: config.environment
            });
            
            let retryCount = 0;
            const maxRetries = 3;
            let activeRunHandled = false;
            
            while (!activeRunHandled && retryCount < maxRetries) {
                try {
                    const existingRuns = await openaiClient.beta.threads.runs.list(threadId, { limit: 5 });
                    const activeRuns = existingRuns.data.filter(r => 
                        ['queued', 'in_progress', 'requires_action'].includes(r.status)
                    );
                    
                    if (activeRuns.length > 0) {
                        logWarning('ACTIVE_RUNS_DETECTED', `${activeRuns.length} run(s) activo(s) detectado(s), cancelando`, {
                            shortUserId,
                            activeRuns: activeRuns.map(r => ({
                                id: r.id,
                                status: r.status,
                                created_at: r.created_at,
                                expires_at: r.expires_at
                            })),
                            threadId,
                            retryAttempt: retryCount + 1,
                            environment: config.environment
                        });
                        
                        // Cancelar todos los runs activos en paralelo
                        const cancelPromises = activeRuns.map(async (activeRun) => {
                            try {
                                await openaiClient.beta.threads.runs.cancel(threadId, activeRun.id);
                                logSuccess('ACTIVE_RUN_CANCELLED', `Run cancelado: ${activeRun.id}`, {
                                    shortUserId,
                                    runId: activeRun.id,
                                    previousStatus: activeRun.status,
                                    threadId,
                                    environment: config.environment
                                });
                                return { success: true, runId: activeRun.id };
                            } catch (cancelError) {
                                logError('RUN_CANCEL_ERROR', `Error cancelando run ${activeRun.id}`, {
                                    shortUserId,
                                    runId: activeRun.id,
                                    error: cancelError.message,
                                    errorCode: cancelError.status,
                                    threadId,
                                    environment: config.environment
                                });
                                return { success: false, runId: activeRun.id, error: cancelError.message };
                            }
                        });
                        
                        const cancelResults = await Promise.all(cancelPromises);
                        const successfulCancellations = cancelResults.filter(r => r.success).length;
                        
                        logInfo('RUN_CANCELLATION_SUMMARY', `Cancelación completada: ${successfulCancellations}/${activeRuns.length} exitosas`, {
                            shortUserId,
                            totalRuns: activeRuns.length,
                            successful: successfulCancellations,
                            threadId,
                            retryAttempt: retryCount + 1,
                            environment: config.environment
                        });
                        
                        // Esperar para que las cancelaciones tomen efecto
                        const waitTime = Math.min(2000 + (retryCount * 1000), 5000); // 2s, 3s, 4s max
                        logInfo('RUN_CANCEL_WAIT', `Esperando ${waitTime}ms para que las cancelaciones tomen efecto`, {
                            shortUserId,
                            waitTime,
                            retryAttempt: retryCount + 1,
                            environment: config.environment
                        });
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        // Verificar si realmente se cancelaron
                        const verificationRuns = await openaiClient.beta.threads.runs.list(threadId, { limit: 5 });
                        const stillActiveRuns = verificationRuns.data.filter(r => 
                            ['queued', 'in_progress', 'requires_action'].includes(r.status)
                        );
                        
                        if (stillActiveRuns.length > 0) {
                            logWarning('RUNS_STILL_ACTIVE', `${stillActiveRuns.length} run(s) siguen activos después de cancelación`, {
                                shortUserId,
                                stillActiveRuns: stillActiveRuns.map(r => ({
                                    id: r.id,
                                    status: r.status,
                                    created_at: r.created_at
                                })),
                                threadId,
                                retryAttempt: retryCount + 1,
                                environment: config.environment
                            });
                            retryCount++;
                            continue; // Reintentar
                        }
                    }
                    
                    activeRunHandled = true;
                    logSuccess('RUN_CHECK_COMPLETE', `Verificación de runs activos completada`, {
                        shortUserId,
                        threadId,
                        activeRunsFound: activeRuns.length,
                        retryAttempt: retryCount + 1,
                        environment: config.environment
                    });
                    
                } catch (listError) {
                    logError('RUN_LIST_ERROR', `Error listando runs existentes`, {
                        shortUserId,
                        error: listError.message,
                        errorCode: listError.status,
                        threadId,
                        retryAttempt: retryCount + 1,
                        environment: config.environment
                    });
                    retryCount++;
                    
                    if (retryCount >= maxRetries) {
                        logError('RUN_CLEANUP_FAILED', `Falló limpieza de runs después de ${maxRetries} intentos`, {
                            shortUserId,
                            threadId,
                            finalError: listError.message,
                            environment: config.environment
                        });
                        return 'Lo siento, hay un problema técnico con la conversación. Por favor intenta de nuevo en unos momentos.';
                    }
                    
                    // Esperar antes de reintentar
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                }
            }
            
            if (!activeRunHandled) {
                logError('RUN_CLEANUP_TIMEOUT', `No se pudo limpiar runs activos después de ${maxRetries} intentos`, {
                    shortUserId,
                    threadId,
                    maxRetries,
                    environment: config.environment
                });
                return 'Lo siento, hay un problema técnico con la conversación. Por favor intenta de nuevo en unos momentos.';
            }
            
            // 🎯 AHORA SÍ: Agregar mensaje del usuario con contextos
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
                // 🎯 FUNCTION CALLING COMPLETO con manejo avanzado
                const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls;
                
                if (!toolCalls || toolCalls.length === 0) {
                    logError('FUNCTION_CALLING_NO_TOOLS', `Run requires_action pero sin tool_calls`, {
                        shortUserId,
                        threadId,
                        runId: run.id,
                        required_action: run.required_action
                    });
                    return 'Lo siento, hubo un problema procesando la consulta. Por favor intenta de nuevo.';
                }
                
                logInfo('FUNCTION_CALLING_START', `OpenAI requiere ejecutar ${toolCalls.length} función(es)`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    toolCallsCount: toolCalls.length,
                    functions: toolCalls.map(tc => ({
                        id: tc.id,
                        name: tc.function.name,
                        argsLength: tc.function.arguments.length
                    })),
                    expires_at: run.expires_at,
                    environment: config.environment
                });
                
                try {
                    // 🔧 PROCESAMIENTO PARALELO de tool calls con error handling
                    const toolOutputPromises = toolCalls.map(async (toolCall, index) => {
                        const startTime = Date.now();
                        
                        if (toolCall.type !== 'function') {
                            logWarning('FUNCTION_CALL_SKIP', `Tool call tipo '${toolCall.type}' no soportado`, {
                                shortUserId,
                                toolCallId: toolCall.id,
                                type: toolCall.type,
                                index
                            });
                            return {
                                tool_call_id: toolCall.id,
                                output: JSON.stringify({ 
                                    error: `Tool call tipo '${toolCall.type}' no soportado`,
                                    success: false 
                                })
                            };
                        }
                        
                        const functionName = toolCall.function.name;
                        let functionArgs;
                        
                        try {
                            functionArgs = JSON.parse(toolCall.function.arguments);
                        } catch (parseError) {
                            logError('FUNCTION_ARGS_PARSE_ERROR', `Error parseando argumentos para ${functionName}`, {
                                shortUserId,
                                functionName,
                                toolCallId: toolCall.id,
                                rawArgs: toolCall.function.arguments,
                                parseError: parseError.message
                            });
                            return {
                                tool_call_id: toolCall.id,
                                output: JSON.stringify({ 
                                    error: 'Error parseando argumentos de la función',
                                    success: false 
                                })
                            };
                        }
                        
                        logInfo('FUNCTION_EXECUTION_START', `Ejecutando función ${functionName} [${index + 1}/${toolCalls.length}]`, {
                            shortUserId,
                            functionName,
                            args: functionArgs,
                            toolCallId: toolCall.id,
                            index: index + 1,
                            total: toolCalls.length,
                            environment: config.environment
                        });
                        
                        try {
                            // Ejecutar la función usando FunctionHandler
                            const { FunctionHandler } = await import('./handlers/function-handler.js');
                            const functionHandler = new FunctionHandler();
                            const result = await functionHandler.handleFunction(functionName, functionArgs);
                            
                            const executionTime = Date.now() - startTime;
                            
                            // 🔧 FORMATEO ROBUSTO del resultado
                            let formattedResult;
                            if (typeof result === 'string') {
                                formattedResult = result;
                            } else if (result && typeof result === 'object') {
                                formattedResult = JSON.stringify(result);
                            } else {
                                formattedResult = String(result || 'success');
                            }
                            
                            logSuccess('FUNCTION_EXECUTION_COMPLETE', `Función ${functionName} ejecutada exitosamente`, {
                                shortUserId,
                                functionName,
                                toolCallId: toolCall.id,
                                executionTime,
                                resultLength: formattedResult.length,
                                resultPreview: formattedResult.substring(0, 200) + (formattedResult.length > 200 ? '...' : ''),
                                index: index + 1,
                                total: toolCalls.length,
                                environment: config.environment
                            });
                            
                            return {
                                tool_call_id: toolCall.id,
                                output: formattedResult
                            };
                            
                        } catch (functionError) {
                            const executionTime = Date.now() - startTime;
                            
                            logError('FUNCTION_EXECUTION_ERROR', `Error ejecutando función ${functionName}`, {
                                shortUserId,
                                functionName,
                                toolCallId: toolCall.id,
                                error: functionError.message,
                                stack: functionError.stack,
                                executionTime,
                                args: functionArgs,
                                index: index + 1,
                                total: toolCalls.length,
                                environment: config.environment
                            });
                            
                            return {
                                tool_call_id: toolCall.id,
                                output: JSON.stringify({ 
                                    error: 'Error ejecutando la función',
                                    details: functionError.message,
                                    success: false 
                                })
                            };
                        }
                    });
                    
                    // Esperar a que todas las funciones terminen
                    const toolOutputs = await Promise.all(toolOutputPromises);
                    
                    // Log detallado del contenido enviado a OpenAI
                    logInfo('OPENAI_TOOL_OUTPUTS_DETAIL', `Contenido exacto enviado a OpenAI en tool_outputs`, {
                        shortUserId,
                        threadId,
                        runId: run.id,
                        toolOutputsCount: toolOutputs.length,
                        toolOutputsDetail: toolOutputs.map((output, i) => ({
                            tool_call_id: output.tool_call_id,
                            outputLength: output.output.length,
                            isError: output.output.includes('"error"') || output.output.includes('"success":false'),
                            fullContent: output.output,
                            contentType: typeof output.output
                        })),
                        timestamp: new Date().toISOString(),
                        environment: config.environment
                    });
                    
                    logInfo('FUNCTION_CALLING_OUTPUTS_READY', `Todas las funciones completadas, enviando resultados`, {
                        shortUserId,
                        threadId,
                        runId: run.id,
                        toolOutputsCount: toolOutputs.length,
                        outputSummary: toolOutputs.map((output, i) => ({
                            tool_call_id: output.tool_call_id,
                            outputLength: output.output.length,
                            isError: output.output.includes('"error"') || output.output.includes('"success":false')
                        })),
                        environment: config.environment
                    });
                    
                    // 🔧 ENVÍO CON TIMEOUT Y RETRY
                    let submitAttempts = 0;
                    const maxSubmitAttempts = 3;
                    let submitSuccess = false;
                    
                    while (!submitSuccess && submitAttempts < maxSubmitAttempts) {
                        try {
                            submitAttempts++;
                            
                            logInfo('FUNCTION_SUBMIT_ATTEMPT', `Enviando tool outputs [intento ${submitAttempts}/${maxSubmitAttempts}]`, {
                                shortUserId,
                                threadId,
                                runId: run.id,
                                attempt: submitAttempts,
                                environment: config.environment
                            });
                            
                            run = await openaiClient.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                                tool_outputs: toolOutputs
                            });
                            
                            submitSuccess = true;
                            
                            logSuccess('FUNCTION_SUBMIT_SUCCESS', `Tool outputs enviados exitosamente`, {
                                shortUserId,
                                threadId,
                                runId: run.id,
                                toolOutputsCount: toolOutputs.length,
                                newRunStatus: run.status,
                                attempt: submitAttempts,
                                environment: config.environment
                            });
                            
                        } catch (submitError) {
                            logError('FUNCTION_SUBMIT_ERROR', `Error enviando tool outputs [intento ${submitAttempts}]`, {
                                shortUserId,
                                threadId,
                                runId: run.id,
                                error: submitError.message,
                                errorCode: submitError.status,
                                attempt: submitAttempts,
                                maxAttempts: maxSubmitAttempts,
                                environment: config.environment
                            });
                            
                            if (submitAttempts >= maxSubmitAttempts) {
                                return 'Lo siento, hubo un problema enviando los resultados de la consulta. Por favor intenta de nuevo.';
                            }
                            
                            // Esperar antes de reintentar
                            await new Promise(resolve => setTimeout(resolve, 1000 * submitAttempts));
                        }
                    }
                    
                    // 🔧 CONTINUAR ESPERANDO HASTA COMPLETION con timeout de 10 minutos
                    const submitTime = Date.now();
                    const maxWaitTime = 10 * 60 * 1000; // 10 minutos (límite de OpenAI)
                    attempts = 0;
                    const maxWaitAttempts = Math.floor(maxWaitTime / 500); // 500ms por intento
                    
                    logInfo('FUNCTION_WAITING_COMPLETION', `Esperando completion después de function calling`, {
                        shortUserId,
                        threadId,
                        runId: run.id,
                        currentStatus: run.status,
                        maxWaitMinutes: 10,
                        environment: config.environment
                    });
                    
                    while (['queued', 'in_progress'].includes(run.status) && attempts < maxWaitAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        try {
                            run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
                        } catch (retrieveError: any) {
                            // Manejar rate limit en retrieve
                            if (retrieveError?.code === 'rate_limit_exceeded') {
                                const retryAfter = 2; // Default 2 segundos
                                logWarning('RATE_LIMIT_RETRIEVE', `Rate limit en retrieve, esperando ${retryAfter}s`, {
                                    shortUserId,
                                    retryAfter,
                                    error: retrieveError.message,
                                    environment: config.environment
                                });
                                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                                continue;
                            }
                            throw retrieveError;
                        }
                        
                        attempts++;
                        
                        // Log periódico cada 30 segundos
                        if (attempts % 60 === 0) {
                            const waitedMinutes = Math.floor((Date.now() - submitTime) / 60000);
                            logInfo('FUNCTION_WAITING_UPDATE', `Esperando completion: ${waitedMinutes} min transcurridos`, {
                                shortUserId,
                                threadId,
                                runId: run.id,
                                currentStatus: run.status,
                                waitedMinutes,
                                attempts: attempts,
                                maxWaitMinutes: 10,
                                environment: config.environment
                            });
                        }
                    }
                    
                    const functionDuration = Date.now() - startTime;
                    
                    logInfo('FUNCTION_CALLING_FINAL_STATUS', `Function calling completado`, {
                        shortUserId,
                        threadId,
                        runId: run.id,
                        finalStatus: run.status,
                        totalDuration: functionDuration,
                        toolCallsCount: toolCalls.length,
                        waitAttempts: attempts,
                        environment: config.environment
                    });
                    
                    // Continuar con el procesamiento normal después del function calling
                    
                    // Verificar el estado final del run después del function calling
                    if (run.status === 'completed') {
                        logSuccess('FUNCTION_CALLING_COMPLETED', `Function calling completado exitosamente`, {
                            shortUserId,
                            threadId,
                            runId: run.id,
                            finalStatus: run.status,
                            totalDuration: functionDuration,
                            toolCallsCount: toolCalls.length,
                            environment: config.environment
                        });
                        
                        // Obtener la respuesta final del asistente
                        const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 1 });
                        const assistantMessage = messages.data[0];
                        
                        if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
                            const content = assistantMessage.content[0];
                            if (content.type === 'text') {
                                const responseText = content.text.value;
                                
                                logSuccess('FUNCTION_CALLING_RESPONSE', `Respuesta final recibida después de function calling`, {
                                    shortUserId,
                                    threadId,
                                    responseLength: responseText.length,
                                    totalDuration: functionDuration,
                                    toolCallsExecuted: toolCalls.length,
                                    environment: config.environment
                                });
                                
                                return responseText;
                            }
                        }
                        
                        logWarning('FUNCTION_CALLING_NO_RESPONSE', `Function calling completado pero sin respuesta de texto`, {
                            shortUserId,
                            threadId,
                            runId: run.id,
                            messageContent: assistantMessage?.content
                        });
                        
                        return 'Las funciones se ejecutaron correctamente, pero no pude generar una respuesta final.';
                        
                    } else if (run.status === 'failed') {
                        logError('FUNCTION_CALLING_FAILED', `Function calling falló`, {
                            shortUserId,
                            threadId,
                            runId: run.id,
                            finalStatus: run.status,
                            lastError: run.last_error,
                            totalDuration: functionDuration,
                            toolCallsCount: toolCalls.length,
                            environment: config.environment
                        });
                        
                        return 'Lo siento, hubo un problema ejecutando las funciones requeridas. Por favor intenta de nuevo.';
                        
                    } else if (run.status === 'expired') {
                        logError('FUNCTION_CALLING_EXPIRED', `Function calling expiró`, {
                            shortUserId,
                            threadId,
                            runId: run.id,
                            finalStatus: run.status,
                            totalDuration: functionDuration,
                            toolCallsCount: toolCalls.length,
                            maxWaitMinutes: 10,
                            environment: config.environment
                        });
                        
                        return 'Lo siento, la consulta tardó demasiado en procesarse. Por favor intenta de nuevo con una consulta más específica.';
                        
                    } else {
                        logWarning('FUNCTION_CALLING_UNEXPECTED_STATUS', `Function calling terminó con estado inesperado`, {
                            shortUserId,
                            threadId,
                            runId: run.id,
                            finalStatus: run.status,
                            totalDuration: functionDuration,
                            toolCallsCount: toolCalls.length,
                            environment: config.environment
                        });
                        
                        return 'Lo siento, hubo un problema procesando la consulta. Por favor intenta de nuevo.';
                    }
                    
                } catch (functionError) {
                    const functionDuration = Date.now() - startTime;
                    
                    logError('FUNCTION_CALLING_CRITICAL_ERROR', `Error crítico en function calling`, {
                        shortUserId,
                        error: functionError.message,
                        stack: functionError.stack,
                        threadId,
                        runId: run.id,
                        duration: functionDuration,
                        toolCallsCount: toolCalls?.length || 0,
                        environment: config.environment
                    });
                    
                    return 'Lo siento, hubo un problema ejecutando la consulta. Por favor intenta de nuevo.';
                }
                
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
                
                // 🔧 PROCESAR MENSAJES MANUALES DEL AGENTE (from_me: true)
                if (message.from_me && message.type === 'text' && message.text?.body) {
                    
                    // 🚫 FILTRAR: Verificar si es un mensaje del bot (no manual)
                    if (botSentMessages.has(message.id)) {
                        logDebug('BOT_MESSAGE_FILTERED', `Mensaje del bot ignorado: ${message.id}`, {
                            environment: config.environment
                        });
                        continue; // Saltar, no es un mensaje manual real
                    }
                    
                    // ✅ Es un mensaje manual real del agente
                    const chatId = message.chat_id;
                    const text = message.text.body.trim();
                    const fromName = message.from_name || 'Agente';
                    const shortClientId = getShortUserId(chatId);
                    
                    // Verificar si hay thread activo
                    const threadId = getThreadId(chatId);
                    if (!threadId) {
                        const timestamp3 = getCompactTimestamp();
                        console.log(`${LOG_COLORS.TIMESTAMP}${timestamp3}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} ⚠️  Sin conversación activa con ${shortClientId}`);
                        logWarning('MANUAL_NO_THREAD', `No hay conversación activa`, { 
                            shortClientId: shortClientId,
                            agentName: fromName,
                            reason: 'cliente_debe_escribir_primero',
                            environment: config.environment
                        });
                        continue;
                    }
                    
                    // 🎯 Log compacto - Solo primer mensaje del grupo
                    if (!manualMessageBuffers.has(chatId)) {
                        // Obtener nombre del cliente en lugar del número
                        const threadInfo = threadPersistence.getThread(shortClientId);
                        const clientName = threadInfo?.userName || 'Cliente';
                        const timestamp4 = getCompactTimestamp();
                        console.log(`${LOG_COLORS.TIMESTAMP}${timestamp4}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} 🔧 ${fromName} → ${clientName}: "${text.substring(0, 25)}${text.length > 25 ? '...' : ''}"`);
                    }
                    
                    logInfo('MANUAL_DETECTED', `Mensaje manual del agente detectado`, {
                        shortClientId: shortClientId,
                        agentName: fromName,
                        messageText: text.substring(0, 100),
                        messageLength: text.length,
                        timestamp: new Date().toISOString(),
                        chatId: chatId,
                        environment: config.environment
                    });
                    
                    // 📦 AGRUPAR MENSAJES MANUALES
                    if (!manualMessageBuffers.has(chatId)) {
                        manualMessageBuffers.set(chatId, {
                            messages: [],
                            agentName: fromName,
                            timestamp: Date.now()
                        });
                        logInfo('MANUAL_BUFFER_CREATE', `Buffer manual creado`, { 
                            shortClientId: shortClientId, 
                            agentName: fromName,
                            environment: config.environment
                        });
                    }
                    
                    const buffer = manualMessageBuffers.get(chatId)!;
                    buffer.messages.push(text);
                    
                    logInfo('MANUAL_BUFFERING', `Mensaje manual agregado al buffer`, {
                        shortClientId: shortClientId,
                        bufferCount: buffer.messages.length,
                        agentName: fromName,
                        timeoutSeconds: MANUAL_MESSAGE_TIMEOUT / 1000,
                        environment: config.environment
                    });
                    
                    // Cancelar timer anterior si existe
                    if (manualTimers.has(chatId)) {
                        clearTimeout(manualTimers.get(chatId)!);
                    }
                    
                    // Establecer nuevo timer
                    const timerId = setTimeout(async () => {
                        const finalBuffer = manualMessageBuffers.get(chatId);
                        if (finalBuffer && finalBuffer.messages.length > 0) {
                            const combinedMessage = finalBuffer.messages.join(' ');
                            
                            try {
                                logInfo('MANUAL_PROCESSING', `Procesando mensajes manuales agrupados`, {
                                    shortClientId: shortClientId,
                                    messageCount: finalBuffer.messages.length,
                                    agentName: finalBuffer.agentName,
                                    combinedLength: combinedMessage.length,
                                    preview: combinedMessage.substring(0, 100),
                                    threadId: threadId,
                                    environment: config.environment
                                });
                                
                                // 1. Agregar contexto del sistema
                                await openaiClient.beta.threads.messages.create(threadId, {
                                    role: 'user',
                                    content: `[NOTA DEL SISTEMA: Un agente humano (${finalBuffer.agentName}) ha respondido directamente al cliente]`
                                });
                                
                                // 2. Agregar el mensaje manual agrupado
                                await openaiClient.beta.threads.messages.create(threadId, {
                                    role: 'assistant',
                                    content: combinedMessage
                                });
                                
                                // 3. Actualizar thread
                                const threadInfo = threadPersistence.getThread(shortClientId);
                                if (threadInfo) {
                                    threadPersistence.setThread(shortClientId, threadId, chatId, finalBuffer.agentName);
                                }
                                
                                // 🎯 Log compacto final
                                const msgCount = finalBuffer.messages.length > 1 ? `${finalBuffer.messages.length} msgs` : '1 msg';
                                const timestamp5 = getCompactTimestamp();
                                console.log(`${LOG_COLORS.TIMESTAMP}${timestamp5}${LOG_COLORS.RESET} ${LOG_COLORS.BOT}[BOT]${LOG_COLORS.RESET} ✅ Enviado a 🤖 OpenAI → Contexto actualizado (${msgCount})`);
                                
                                logSuccess('MANUAL_SYNC_SUCCESS', `Mensajes manuales sincronizados exitosamente`, {
                                    shortClientId: shortClientId,
                                    agentName: finalBuffer.agentName,
                                    messageCount: finalBuffer.messages.length,
                                    totalLength: combinedMessage.length,
                                    preview: combinedMessage.substring(0, 100),
                                    threadId: threadId,
                                    timestamp: new Date().toISOString(),
                                    environment: config.environment
                                });
                                
                            } catch (error) {
                                const timestamp6 = getCompactTimestamp();
                                console.log(`${LOG_COLORS.TIMESTAMP}${timestamp6}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} ❌ Error sincronizando con OpenAI: ${error.message}`);
                                logError('MANUAL_SYNC_ERROR', `Error sincronizando mensajes manuales`, {
                                    error: error.message,
                                    threadId: threadId,
                                    chatId: shortClientId,
                                    messageCount: finalBuffer.messages.length,
                                    environment: config.environment
                                });
                            }
                        }
                        
                        // Limpiar buffers
                        manualMessageBuffers.delete(chatId);
                        manualTimers.delete(chatId);
                    }, MANUAL_MESSAGE_TIMEOUT);
                    
                    manualTimers.set(chatId, timerId);
                    continue; // Procesar siguiente mensaje
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
                        
                        // 🆕 SISTEMA DE ETIQUETAS: Obtener info adicional para usuarios nuevos
                        const existingThread = threadPersistence.getThread(getShortUserId(userJid));
                        if (!existingThread) {
                            logDebug('NEW_USER', `Usuario nuevo detectado: ${getShortUserId(userJid)}, obteniendo info adicional`, {
                                environment: config.environment
                            });
                            
                            // Obtener etiquetas de forma asíncrona (no bloquear el procesamiento)
                            setTimeout(async () => {
                                try {
                                    const enhancedInfo = await getEnhancedContactInfo(getShortUserId(userJid), chatId);
                                    if (enhancedInfo.labels && enhancedInfo.labels.length > 0) {
                                        logInfo('NEW_USER_LABELS', `Etiquetas obtenidas para usuario nuevo`, {
                                            shortUserId: getShortUserId(userJid),
                                            labelsCount: enhancedInfo.labels.length,
                                            labels: enhancedInfo.labels,
                                            environment: config.environment
                                        });
                                    }
                                } catch (error) {
                                    logWarning('NEW_USER_LABELS_ERROR', `Error obteniendo etiquetas para usuario nuevo`, {
                                        shortUserId: getShortUserId(userJid),
                                        error: error.message,
                                        environment: config.environment
                                    });
                                }
                            }, 1000);
                        }
                        
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