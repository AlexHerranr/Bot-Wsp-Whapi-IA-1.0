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
const MESSAGE_BUFFER_TIMEOUT = 10000; // 10s en TODOS lados (consistente local y Cloud Run)
const MANUAL_MESSAGE_TIMEOUT = 8000;
const MAX_BUFFER_SIZE = 10; // 🚨 Límite máximo de mensajes por buffer (anti-spam)
const MAX_BOT_MESSAGES = 1000; // 🛡️ Límite de seguridad para tracking de mensajes
const MAX_MESSAGE_LENGTH = 5000; // 📏 Límite de caracteres por mensaje

// 🛡️ FUNCIÓN SEGURA PARA TRACKING DE MENSAJES DEL BOT (previene memory leak)
const trackBotMessage = (messageId: string) => {
    botSentMessages.add(messageId);
    
    // Limpieza de seguridad si crece demasiado
    if (botSentMessages.size > MAX_BOT_MESSAGES) {
        const oldestMessages = Array.from(botSentMessages).slice(0, 100);
        oldestMessages.forEach(id => botSentMessages.delete(id));
        logWarning('BOT_MESSAGES_CLEANUP', 'Limpieza forzada de mensajes antiguos', {
            cleaned: 100,
            remaining: botSentMessages.size,
            environment: config.environment
        });
    }
    
    // Auto-limpiar después de 10 minutos
    setTimeout(() => {
        botSentMessages.delete(messageId);
    }, 10 * 60 * 1000);
};

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
                
                if (cleanedBuffers > 0 || cleanedTimers > 0) {
                    logInfo('MEMORY_CLEANUP', 'Limpieza periódica de memoria completada', {
                        cleanedBuffers,
                        cleanedTimers,
                        remainingBuffers: userMessageBuffers.size,
                        remainingTimers: userActivityTimers.size,
                        remainingManualBuffers: manualMessageBuffers.size,
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

    // --- Función de seguridad para prevenir filtrado de contexto interno ---
    const sanitizeResponseForClient = (response: string): string => {
        // Lista de patrones que NO deben enviarse al cliente
        const internalPatterns = [
            /=== CONTEXTO TEMPORAL ACTUAL ===/gi,
            /=== CONTEXTO CONVERSACIONAL ===/gi,
            /=== FIN CONTEXTO ===/gi,
            /--- DEBUG: Salida para OpenAI ---/gi,
            /\[NOTA DEL SISTEMA:/gi,
            /\[DEBUG\]/gi,
            /\[INTERNAL\]/gi,
            /CLIENTE:/gi,
            /ETIQUETAS:/gi,
            /FECHA:/gi,
            /HORA:/gi,
            /Zona horaria Colombia/gi
        ];

        let sanitized = response;
        
        // Remover patrones internos
        internalPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        // Remover bloques de contexto completos
        sanitized = sanitized.replace(/=== CONTEXTO.*?=== FIN CONTEXTO ===/gis, '');
        sanitized = sanitized.replace(/--- DEBUG:.*?-+/gis, '');
        
        // Limpiar espacios en blanco excesivos
        sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n');
        sanitized = sanitized.trim();

        // Log de seguridad si se detectó contenido interno
        if (sanitized !== response) {
            logWarning('RESPONSE_SANITIZED', 'Contenido interno removido de respuesta al cliente', {
                originalLength: response.length,
                sanitizedLength: sanitized.length,
                removedContent: response.length - sanitized.length,
                environment: config.environment
            });
        }

        return sanitized;
    };

    // 🚨 VALIDACIÓN CRÍTICA: Detectar mensajes del sistema que NO deben enviarse a clientes
    const isSystemMessage = (message: string): boolean => {
        // Patrones que NUNCA deben enviarse a clientes
        const systemPatterns = [
            /^===/,                          // Contextos con ===
            /^CONTEXTO/,                     // CONTEXTO TEMPORAL, etc
            /^\[NOTA DEL SISTEMA/,           // Notas internas
            /^\[DEBUG/,                      // Mensajes de debug
            /^--- DEBUG:/,                   // Debug logs
            /^\[MENSAJE DEL SISTEMA/,        // Otros mensajes del sistema
            /^CLIENTE:/,                     // Líneas de contexto
            /^ETIQUETAS:/,                   // Líneas de etiquetas
            /^FECHA:/,                       // Líneas de fecha
            /^HORA:/                         // Líneas de hora
        ];
        
        return systemPatterns.some(pattern => pattern.test(message.trim()));
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

    // --- Función para obtener timestamp compacto ---
    const getCompactTimestamp = (): string => {
        const now = new Date();
        const options = { 
            timeZone: 'America/Bogota',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        } as const;
        const timeStr = now.toLocaleTimeString('es-CO', options);
        const month = (now.getMonth() + 1).toString();
        const day = now.getDate().toString();
        return `${month}/${day} [${timeStr}]`;
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

    // 🚨 COLA DE RUNS DE OPENAI para evitar runs concurrentes
    class OpenAIRunQueue {
        private userQueues: Map<string, Promise<any>> = new Map();
        
        /**
         * Ejecuta una operación de OpenAI en cola para evitar runs concurrentes
         */
        async executeInQueue<T>(userId: string, operation: () => Promise<T>): Promise<T> {
            const shortUserId = getShortUserId(userId);
            
            // Obtener la promesa actual o crear una resuelta
            const currentQueue = this.userQueues.get(userId) || Promise.resolve();
            
            // Encadenar la nueva operación
            const newQueue = currentQueue
                .then(() => {
                    logDebug('RUN_QUEUE', `Ejecutando operación en cola para ${shortUserId}`, {
                        environment: config.environment
                    });
                    return operation();
                })
                .catch(error => {
                    logError('RUN_QUEUE_ERROR', `Error en cola de runs para ${shortUserId}`, {
                        error: error.message,
                        environment: config.environment
                    });
                    throw error;
                })
                .finally(() => {
                    // Limpiar la cola si es la última operación
                    if (this.userQueues.get(userId) === newQueue) {
                        this.userQueues.delete(userId);
                        logDebug('RUN_QUEUE', `Cola limpiada para ${shortUserId}`, {
                            environment: config.environment
                        });
                    }
                });
            
            // Actualizar la cola
            this.userQueues.set(userId, newQueue);
            
            return newQueue;
        }
        
        /**
         * Verifica si hay operaciones pendientes para un usuario
         */
        hasPendingOperations(userId: string): boolean {
            return this.userQueues.has(userId);
        }
        
        /**
         * Obtener estadísticas de la cola
         */
        getStats() {
            return {
                activeQueues: this.userQueues.size,
                users: Array.from(this.userQueues.keys()).map(getShortUserId)
            };
        }
    }

    // Crear instancia global de la cola
    const openAIQueue = new OpenAIRunQueue();

    // 🛡️ RATE LIMITER SIMPLE para prevenir spam por usuario
    class SimpleRateLimiter {
        private userRequests: Map<string, number[]> = new Map();
        private readonly maxRequests = 20; // 20 mensajes por ventana
        private readonly windowMs = 60000; // 1 minuto
        
        canProcess(userId: string): boolean {
            const now = Date.now();
            const requests = this.userRequests.get(userId) || [];
            
            // Filtrar requests antiguos (fuera de la ventana)
            const recentRequests = requests.filter(time => now - time < this.windowMs);
            
            if (recentRequests.length >= this.maxRequests) {
                return false;
            }
            
            recentRequests.push(now);
            this.userRequests.set(userId, recentRequests);
            
            // Limpieza periódica para evitar memory leak
            if (this.userRequests.size > 100) {
                this.cleanup();
            }
            
            return true;
        }
        
        private cleanup() {
            const now = Date.now();
            this.userRequests.forEach((requests, userId) => {
                const recent = requests.filter(time => now - time < this.windowMs);
                if (recent.length === 0) {
                    this.userRequests.delete(userId);
                } else {
                    this.userRequests.set(userId, recent);
                }
            });
        }
        
        getStats() {
            return {
                activeUsers: this.userRequests.size,
                totalRequests: Array.from(this.userRequests.values())
                    .reduce((sum, requests) => sum + requests.length, 0)
            };
        }
    }

    const rateLimiter = new SimpleRateLimiter();

    // --- 🎯 FUNCIÓN PARA ENVÍO INTELIGENTE DE MENSAJES CON DIVISIÓN ---
    async function sendWhatsAppMessage(chatId: string, message: string) {
        const shortUserId = getShortUserId(chatId);
        
        // 🚨 VALIDACIÓN CRÍTICA - NUNCA enviar mensajes del sistema
        if (isSystemMessage(message)) {
            logError('SYSTEM_MESSAGE_BLOCKED', `⚠️ BLOQUEADO: Intento de enviar mensaje del sistema a cliente`, {
                shortUserId,
                messagePreview: message.substring(0, 100) + '...',
                messageLength: message.length,
                firstLine: message.split('\n')[0],
                environment: config.environment
            });
            
            // Log compacto visible en consola
            const timestamp = getCompactTimestamp();
            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp}${LOG_COLORS.RESET} 🚫 [SECURITY] Mensaje del sistema bloqueado para ${shortUserId}`);
            
            return false; // NO ENVIAR
        }
        
        // 🛡️ SEGURIDAD: Sanitizar mensaje antes de enviar al cliente
        const sanitizedMessage = sanitizeResponseForClient(message);
        
        if (sanitizedMessage !== message) {
            logWarning('MESSAGE_SANITIZED', `Mensaje sanitizado antes de envío`, {
                shortUserId,
                originalLength: message.length,
                sanitizedLength: sanitizedMessage.length,
                environment: config.environment
            });
        }
        
        try {
            // 🔧 DIVISIÓN INTELIGENTE DE MENSAJES LARGOS
            let chunks: string[] = [];
            
            // Primero intentar dividir por doble salto de línea
            const paragraphs = sanitizedMessage.split(/\n\n+/).map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
            
            // Si hay párrafos claramente separados, usarlos
            if (paragraphs.length > 1) {
                chunks = paragraphs;
            } else {
                // Si no hay párrafos, buscar listas con bullets
                const lines = sanitizedMessage.split('\n');
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
            
            // Si no se pudo dividir bien, usar el mensaje sanitizado
            if (chunks.length === 0) {
                chunks = [sanitizedMessage];
            }
            
            // 🔧 ENVÍO ÚNICO O MÚLTIPLE SEGÚN DIVISIÓN
            if (chunks.length === 1) {
                // Mensaje simple
                logInfo('WHATSAPP_SEND', `Enviando mensaje a ${shortUserId}`, { 
                    chatId,
                    messageLength: sanitizedMessage.length,
                    preview: sanitizedMessage.substring(0, 100) + '...',
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
                        body: sanitizedMessage,
                        typing_time: 3
                    })
                });
                
                if (response.ok) {
                    const result = await response.json() as any;
                    
                    // 🔧 TRACKING: Registrar ID del mensaje enviado por el bot
                    if (result.sent && result.message?.id) {
                        trackBotMessage(result.message.id);
                        logDebug('BOT_MESSAGE_TRACKED', `Mensaje del bot registrado para tracking anti-duplicación`, {
                            shortUserId: shortUserId,
                            messageId: result.message.id,
                            messageLength: message.length,
                            timestamp: new Date().toISOString(),
                            environment: config.environment
                        });
                    }
                    
                    logSuccess('WHATSAPP_SEND', `Mensaje enviado exitosamente`, {
                        shortUserId: shortUserId,
                        messageLength: sanitizedMessage.length,
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
                    originalLength: sanitizedMessage.length,
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
                            trackBotMessage(result.message.id);
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
                    originalLength: sanitizedMessage.length,
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

    // --- Función principal de procesamiento con OpenAI
    const processWithOpenAI = async (userMsg: string, userJid: string, chatId: string | null = null, userName: string | null = null): Promise<string> => {
        const shortUserId = getShortUserId(userJid);
        
        // 🚨 USAR COLA para evitar runs concurrentes
        return openAIQueue.executeInQueue(userJid, async () => {
            const startTime = Date.now();
        
        logInfo('USER_DEBUG', `UserJid para búsqueda: "${userJid}"`, { 
            originalFormat: userJid,
            cleanedFormat: shortUserId,
            chatId: chatId,
            userName: userName,
            environment: config.environment
        });
        
        try {
            // Verificar thread existente
            let threadId = getThreadId(userJid);
            
            const stats = threadPersistence.getStats();
            logInfo('THREAD_CHECK', 
                threadId ? `Thread encontrado: ${threadId}` : 'No se encontró thread existente',
                { userJid, shortUserId, threadId, totalThreads: stats.totalThreads }
            );
            
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
                        
                        return sanitizeResponseForClient(responseText);
                    }
                }
                
                logWarning('OPENAI_NO_CONTENT', `Run completado pero sin contenido de texto`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    messageContent: assistantMessage?.content
                });
                
                return sanitizeResponseForClient('Lo siento, no pude generar una respuesta adecuada.');
                
            } else {
                logError('OPENAI_RUN_ERROR', `Run falló o expiró`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    status: run.status,
                    duration,
                    attempts
                });
                
                return sanitizeResponseForClient('Lo siento, hubo un problema procesando tu consulta. Por favor intenta de nuevo.');
            }
            
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            // 🔧 MANEJO ESPECÍFICO DE ERRORES DE OPENAI
            if (error.code === 'context_length_exceeded') {
                logError('OPENAI_CONTEXT_LENGTH', 'Contexto excede límite de OpenAI', {
                    shortUserId,
                    error: error.message,
                    duration,
                    environment: config.environment
                });
                return sanitizeResponseForClient('Tu consulta es demasiado larga. Por favor, intenta con un mensaje más corto.');
            }
            
            if (error.code === 'rate_limit_exceeded') {
                const retryAfter = extractRetryAfter(error.message) || 60;
                logError('OPENAI_RATE_LIMIT', 'Rate limit de OpenAI excedido', {
                    shortUserId,
                    retryAfter,
                    error: error.message,
                    duration,
                    environment: config.environment
                });
                return sanitizeResponseForClient(`Estamos experimentando alta demanda. Por favor intenta en ${retryAfter} segundos.`);
            }
            
            if (error.code === 'insufficient_quota') {
                logError('OPENAI_QUOTA_EXCEEDED', 'Cuota de OpenAI agotada', {
                    shortUserId,
                    error: error.message,
                    duration,
                    environment: config.environment
                });
                return sanitizeResponseForClient('Temporalmente no disponible por límite de uso. Por favor intenta más tarde.');
            }
            
            // Error genérico
            logError('OPENAI_PROCESSING_ERROR', `Error en procesamiento OpenAI`, {
                shortUserId,
                error: error.message,
                errorCode: error.code || 'unknown',
                duration,
                environment: config.environment
            });
            
            return sanitizeResponseForClient('Lo siento, hubo un error técnico. Por favor intenta de nuevo en unos momentos.');
        }
        }); // Cerrar executeInQueue
    };

    // Funciones de thread management
    const saveThreadId = (jid: string, threadId: string, chatId: string | null = null, userName: string | null = null): boolean => {
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

    // --- Función para procesar mensajes agrupados ---
    async function processUserMessages(userId: string) {
        const buffer = userMessageBuffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            logWarning('MESSAGE_PROCESS', `Buffer vacío o inexistente para ${getShortUserId(userId)}`);
            return;
        }

        const shortUserId = getShortUserId(userId);
        
        // 🛡️ VERIFICAR RATE LIMITING
        if (!rateLimiter.canProcess(userId)) {
            logWarning('RATE_LIMIT_EXCEEDED', `Usuario excedió límite de mensajes`, {
                userId: shortUserId,
                environment: config.environment
            });
            
            await sendWhatsAppMessage(buffer.chatId, 
                'Por favor espera un momento antes de enviar más mensajes 🙏');
            
            // Limpiar buffer y timer
            userMessageBuffers.delete(userId);
            userActivityTimers.delete(userId);
            return;
        }
        
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
                    
                    // 🚨 VALIDACIÓN DE LÍMITE DE BUFFER MANUAL (anti-spam)
                    if (buffer.messages.length >= MAX_BUFFER_SIZE) {
                        logWarning('MANUAL_BUFFER_OVERFLOW', `Buffer manual alcanzó límite máximo`, {
                            shortClientId: shortClientId,
                            bufferSize: buffer.messages.length,
                            maxSize: MAX_BUFFER_SIZE,
                            agentName: fromName,
                            droppedMessage: text.substring(0, 50) + '...',
                            environment: config.environment
                        });
                        
                        // Log compacto en consola
                        const timestamp = getCompactTimestamp();
                        console.log(`${LOG_COLORS.TIMESTAMP}${timestamp}${LOG_COLORS.RESET} 🚫 [SPAM] Buffer manual lleno para ${shortClientId} (${buffer.messages.length}/${MAX_BUFFER_SIZE})`);
                        
                        continue; // Ignorar mensajes adicionales
                    }
                    
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
                    let messageText = message.text.body;
                    
                    // 📏 VALIDACIÓN DE TAMAÑO DE MENSAJE
                    if (messageText.length > MAX_MESSAGE_LENGTH) {
                        logWarning('MESSAGE_TOO_LONG', 'Mensaje excede límite, truncando', {
                            userJid: getShortUserId(userJid),
                            originalLength: messageText.length,
                            maxLength: MAX_MESSAGE_LENGTH,
                            environment: config.environment
                        });
                        
                        messageText = messageText.substring(0, MAX_MESSAGE_LENGTH) + '... [mensaje truncado por límite de tamaño]';
                    }
                    
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
                    
                    // 🚨 VALIDACIÓN DE LÍMITE DE BUFFER (anti-spam)
                    if (buffer.messages.length >= MAX_BUFFER_SIZE) {
                        logWarning('BUFFER_OVERFLOW', `Buffer alcanzó límite máximo para ${userName}`, {
                            userJid,
                            bufferSize: buffer.messages.length,
                            maxSize: MAX_BUFFER_SIZE,
                            droppedMessage: messageText.substring(0, 50) + '...',
                            environment: config.environment
                        });
                        
                        // Log compacto en consola
                        const timestamp = getCompactTimestamp();
                        console.log(`${LOG_COLORS.TIMESTAMP}${timestamp}${LOG_COLORS.RESET} 🚫 [SPAM] Buffer lleno para ${userName} (${buffer.messages.length}/${MAX_BUFFER_SIZE})`);
                        
                        continue; // Ignorar mensajes adicionales
                    }
                    
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