// @docs: progress/PROGRESO-BOT.md
// @change: "Sistema de contexto histórico implementado"
// @date: 2025-07-04
import "dotenv/config";
import express from 'express';
import OpenAI from 'openai';
import fs from 'fs';
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

// --- Configuración Inicial ---
const PORT = process.env.PORT ?? 3008;
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN ?? '';
const WHAPI_API_URL = process.env.WHAPI_API_URL ?? 'https://gate.whapi.cloud/';

const DEBUG_LOG_PATH = './whatsapp-sync-debug.log';
const DEBUG_MODE = true;

// --- Colores para logs de consola ---
const LOG_COLORS = {
    USER: '\x1b[36m',    // Cyan
    BOT: '\x1b[32m',     // Green
    AGENT: '\x1b[33m',   // Yellow
    TIMESTAMP: '\x1b[94m', // Light Blue
    RESET: '\x1b[0m'     // Reset
};

// --- Función para timestamp compacto ---
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

// --- Constantes de Tiempo ---
const DEFAULT_TIMEOUT_MS = 3000; // Timeout máximo por defecto
const MIN_TIMEOUT_MS = 800;      // Timeout mínimo para mensajes finales

// --- Inicialización ---
const app = express();
app.use(express.json());

let openai;
if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    logSuccess('OPENAI_INIT', 'SDK de OpenAI inicializado correctamente');
} else {
    logError('OPENAI_INIT', 'OPENAI_API_KEY no está configurada en el archivo .env');
    process.exit(1);
}

// --- Funciones de Extracción de Información del Contacto ---
const cleanContactName = (rawName) => {
    if (!rawName || typeof rawName !== 'string') return 'Usuario';
    
    // Limpiar caracteres especiales y espacios extra
    let cleaned = rawName
        .trim()
        .replace(/\s*-\s*$/, '')  // Remover guión al final
        .replace(/\s+/g, ' ')     // Espacios múltiples a uno solo
        .replace(/[^\w\s\u00C0-\u017F]/g, '') // Solo letras, números y acentos
        .trim();
    
    // Si queda vacío después de limpiar, usar default
    if (!cleaned) return 'Usuario';
    
    // Capitalizar primera letra de cada palabra
    cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
    
    logDebug('NAME_EXTRACTION', 'Nombre limpiado', { 
        original: rawName, 
        cleaned: cleaned 
    });
    
    return cleaned;
};

// Función opcional para obtener información adicional del contacto desde Whapi
const getEnhancedContactInfo = async (userId, chatId) => {
    try {
        const endpoint = `${WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}?token=${WHAPI_TOKEN}`;
        
        logDebug('CONTACT_API', `Obteniendo info adicional del contacto ${userId}`);
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const chatData = await response.json();
            
            const enhancedInfo = {
                name: cleanContactName(chatData.name || chatData.first_name || 'Usuario'),
                labels: chatData.labels || [],
                lastSeen: chatData.last_message?.timestamp,
                isContact: !!chatData.name, // Si tiene nombre, está en contactos
                profilePic: chatData.profile_pic_url
            };
            
            // 🔍 LOG DETALLADO: Información completa de etiquetas
            logInfo('CONTACT_API_DETAILED', `Información detallada del contacto ${userId}`, {
                name: enhancedInfo.name,
                labels: enhancedInfo.labels,
                labelsCount: enhancedInfo.labels.length,
                lastSeen: enhancedInfo.lastSeen,
                isContact: enhancedInfo.isContact,
                profilePic: enhancedInfo.profilePic ? 'Sí' : 'No'
            });
            
            logSuccess('CONTACT_API', `Info adicional obtenida para ${userId}`, {
                hasName: !!enhancedInfo.name,
                hasLabels: enhancedInfo.labels.length > 0,
                isContact: enhancedInfo.isContact
            });
            
            return enhancedInfo;
        } else {
            logWarning('CONTACT_API', `No se pudo obtener info adicional para ${userId}: ${response.status}`);
        }
    } catch (error) {
        logError('CONTACT_API', `Error obteniendo info del contacto ${userId}`, { 
            error: error.message 
        });
    }
    
    return { name: 'Usuario', labels: [], isContact: false };
};

// --- Funciones de Logging (Mantenidas para compatibilidad) ---
const getFormattedTimestamp = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${time},${ms}`;
};

const log = (context, level, message) => {
    // Mapear al nuevo sistema de logging
    const logLevel = level === 'ERROR' ? 'ERROR' : level === 'WARN' ? 'WARNING' : 'INFO';
    detailedLog(logLevel, context, message);
    
    // Mantener el archivo de debug original si está habilitado (solo archivos, no consola)
    if (DEBUG_MODE) {
        const timestamp = getFormattedTimestamp();
        const logLine = `[${timestamp}] [${context}] ${message}`;
        try {
            fs.appendFileSync(DEBUG_LOG_PATH, logLine + '\n');
        } catch (e) {
            logError('DEBUG_FILE', `Error escribiendo al log: ${e.message}`);
        }
    }
};

// --- Función para mostrar estadísticas en tiempo real ---
const showLiveStats = () => {
    const stats = threadPersistence.getStats();
    
    console.log(`\n┌─────────────────────────────────────────────┐`);
    console.log(`│ 📊 Estado del Sistema - En Vivo            │`);
    console.log(`├─────────────────────────────────────────────┤`);
    console.log(`│ 👥 Clientes activos: ${userMessageBuffers.size.toString().padEnd(17)} │`);
    console.log(`│ 🔧 Buffers manuales: ${manualMessageBuffers.size.toString().padEnd(17)} │`);
    console.log(`│ 🧠 Threads OpenAI: ${stats.totalThreads.toString().padEnd(19)} │`);
    console.log(`│ 🛡️  Mensajes bot tracked: ${botSentMessages.size.toString().padEnd(11)} │`);
    console.log(`└─────────────────────────────────────────────┘\n`);
};

// --- Utilidades ---
const getShortUserId = (jid) => {
    if (typeof jid === 'string') {
        // Extraer solo el número, sin @s.whatsapp.net o cualquier otro sufijo
        const cleaned = jid.split('@')[0] || jid;
        // Solo log técnico (sin spam en consola)
        logDebug('USER_ID_EXTRACTION', `Extrayendo ID de usuario`, { 
            original: jid, 
            cleaned: cleaned 
        });
        return cleaned;
    }
    return 'unknown';
};

// --- Estado Global ---
const userMessageBuffers = new Map();
const userActivityTimers = new Map();
const userTypingState = new Map(); // Nuevo: estado simple de typing

// --- Sistema de Tracking de Mensajes del Bot ---
const botSentMessages = new Set<string>(); // Trackear IDs de mensajes enviados por el bot

// --- Sistema de Agrupación de Mensajes Manuales ---
const manualMessageBuffers = new Map<string, {
    messages: string[],
    agentName: string,
    timestamp: number
}>();
const manualTimers = new Map<string, NodeJS.Timeout>();
const MANUAL_MESSAGE_TIMEOUT = 8000; // 8 segundos, igual que los clientes

// --- Funciones de Thread usando threadPersistence ---
const saveThreadId = (jid, threadId, chatId = null, userName = null) => {
    if (!jid || !threadId) {
        logWarning('THREAD_SAVE', `Intento de guardar thread inválido`, { jid, threadId });
        return false;
    }
    const clientPhone = getShortUserId(jid);
    
    // Usar threadPersistence con información completa
    const fullChatId = chatId || `${clientPhone}@s.whatsapp.net`;
    const name = userName || 'Usuario';
    
    threadPersistence.setThread(clientPhone, threadId, fullChatId, name);
    logThreadPersist(clientPhone, threadId, 'saved');
    
    // Log del estado actualizado
    const stats = threadPersistence.getStats();
    logInfo('THREAD_STATE', 'Estado de threads actualizado', stats);
    
    return true;
};

const getThreadId = (jid) => {
    if (!jid) {
        logWarning('THREAD_GET', 'Intento de obtener thread con jid nulo');
        return null;
    }
    const clientPhone = getShortUserId(jid);
    
    // Usar threadPersistence en lugar de clientThreadMap
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

// --- Función para obtener contexto temporal actual ---
const getCurrentTimeContext = (): string => {
    const now = new Date();
    
    // Ajustar a zona horaria de Colombia (UTC-5)
    const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    
    // Calcular mañana correctamente
    const tomorrow = new Date(colombiaTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const year = colombiaTime.getFullYear();
    const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
    const day = String(colombiaTime.getDate()).padStart(2, '0');
    const hours = String(colombiaTime.getHours()).padStart(2, '0');
    const minutes = String(colombiaTime.getMinutes()).padStart(2, '0');
    
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
    
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

const getConversationalContext = (threadInfo): string => {
    if (!threadInfo) {
        return '';
    }
    
    const { name, userName, labels } = threadInfo;
    let context = '=== CONTEXTO CONVERSACIONAL ===\n';
    
    // Información del cliente
    if (name && userName) {
        context += `CLIENTE: ${name} (${userName})\n`;
    } else if (name) {
        context += `CLIENTE: ${name}\n`;
    } else if (userName) {
        context += `CLIENTE: ${userName}\n`;
    } else {
        context += `CLIENTE: Usuario\n`;
    }
    
    // Etiquetas/metadatos si existen
    if (labels && labels.length > 0) {
        context += `ETIQUETAS: ${labels.join(', ')}\n`;
        
        // 🔍 LOG DETALLADO: Etiquetas incluidas en contexto
        logInfo('CONTEXT_LABELS', `Etiquetas incluidas en contexto conversacional`, {
            userId: threadInfo.userId || 'unknown',
            name: name,
            userName: userName,
            labels: labels,
            labelsCount: labels.length
        });
    } else {
        // 🔍 LOG DETALLADO: Sin etiquetas
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

// --- Procesamiento OpenAI (Simple) ---
const processWithOpenAI = async (userMsg, userJid, chatId = null, userName = null) => {
    const shortUserId = getShortUserId(userJid);
    const startTime = Date.now();
    
    logInfo('USER_DEBUG', `UserJid para búsqueda: "${userJid}"`, { 
        originalFormat: userJid,
        cleanedFormat: shortUserId,
        chatId: chatId,
        userName: userName
    });
    
    try {
        // Verificar thread existente ANTES de crear
        let threadId = getThreadId(userJid);
        
        const stats = threadPersistence.getStats();
        logInfo('THREAD_CHECK', 
            threadId ? `Thread encontrado: ${threadId}` : 'No se encontró thread existente',
            { userJid, shortUserId, threadId, totalThreads: stats.totalThreads }
        );
        
        // Variable para guardar el historial si es un thread nuevo
        let chatHistoryContext = '';
        
        if (!threadId) {
            logOpenAIRequest(shortUserId, 'creating_new_thread');
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            
            // Guardar con información completa del cliente
            saveThreadId(userJid, threadId, chatId, userName);
            
            // 🆕 Obtener historial de conversación para thread nuevo
            try {
                const { getChatHistory } = await import('./utils/whapi/index.js');
                chatHistoryContext = await getChatHistory(chatId || userJid, 200) || '';
                
                if (chatHistoryContext) {
                    logInfo('CHAT_HISTORY_OBTAINED', `Historial de conversación obtenido para nuevo thread`, {
                        shortUserId,
                        threadId,
                        historyLength: chatHistoryContext.length,
                        chatId: chatId || userJid
                    });
                }
            } catch (historyError) {
                logWarning('CHAT_HISTORY_ERROR', `Error obteniendo historial de conversación`, {
                    shortUserId,
                    error: historyError.message
                });
            }
            
            // 🆕 Obtener y guardar labels inmediatamente para nuevo thread
            try {
                const enhancedInfo = await getEnhancedContactInfo(shortUserId, chatId);
                if (enhancedInfo.labels && enhancedInfo.labels.length > 0) {
                    threadPersistence.updateThreadMetadata(shortUserId, {
                        name: enhancedInfo.name,
                        userName: userName, // Actualizar también userName
                        labels: enhancedInfo.labels
                    });
                    logInfo('NEW_THREAD_LABELS', `Labels establecidas para nuevo thread`, {
                        shortUserId,
                        threadId,
                        labelsCount: enhancedInfo.labels.length,
                        labels: enhancedInfo.labels
                    });
                }
            } catch (err) {
                logWarning('NEW_THREAD_LABELS_ERROR', `Error obteniendo labels para nuevo thread`, {
                    shortUserId,
                    error: err.message
                });
            }
            
            logOpenAIRequest(shortUserId, 'thread_created', threadId);
            logSuccess('THREAD_NEW', `Nuevo thread creado para ${shortUserId} (${userName})`, { 
                threadId,
                userJid: userJid,
                cleanedId: shortUserId,
                chatId: chatId,
                userName: userName
            });
        } else {
            // 🆕 Si han pasado más de 24 horas, actualizar etiquetas (por si cambiaron manualmente)
            const threadInfo = threadPersistence.getThread(shortUserId);
            if (threadInfo && threadInfo.lastActivity) {
                const lastActivityDate = new Date(threadInfo.lastActivity);
                const now = new Date();
                const hoursSinceLastActivity = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60);
                
                if (hoursSinceLastActivity > 24) {
                    logInfo('LABELS_24H_UPDATE', `Han pasado ${Math.floor(hoursSinceLastActivity)} horas, actualizando etiquetas`, {
                        shortUserId,
                        lastActivity: threadInfo.lastActivity
                    });
                    
                    try {
                        const enhancedInfo = await getEnhancedContactInfo(shortUserId, chatId);
                        threadPersistence.updateThreadMetadata(shortUserId, {
                            name: enhancedInfo.name,
                            userName: userName, // Actualizar también userName cada 24h
                            labels: enhancedInfo.labels
                        });
                        logInfo('LABELS_24H_UPDATED', `Etiquetas actualizadas después de 24h`, {
                            shortUserId,
                            labelsCount: enhancedInfo.labels?.length || 0,
                            labels: enhancedInfo.labels
                        });
                    } catch (err) {
                        logWarning('LABELS_24H_ERROR', `Error actualizando etiquetas después de 24h`, {
                            shortUserId,
                            error: err.message
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
        
        // 🔧 CRÍTICO: Verificar y cancelar runs activos ANTES de agregar mensaje
        logInfo('RUN_CHECK_START', `Verificando runs activos antes de agregar mensaje`, {
            shortUserId,
            threadId
        });
        
        // 🔧 MEJORADO: Verificar y cancelar runs activos con mejor error handling
        let retryCount = 0;
        const maxRetries = 3;
        let activeRunHandled = false;
        
        while (!activeRunHandled && retryCount < maxRetries) {
            try {
                const existingRuns = await openai.beta.threads.runs.list(threadId, { limit: 5 });
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
                        retryAttempt: retryCount + 1
                    });
                    
                    // Cancelar todos los runs activos en paralelo
                    const cancelPromises = activeRuns.map(async (activeRun) => {
                        try {
                            await openai.beta.threads.runs.cancel(threadId, activeRun.id);
                            logSuccess('ACTIVE_RUN_CANCELLED', `Run cancelado: ${activeRun.id}`, {
                                shortUserId,
                                runId: activeRun.id,
                                previousStatus: activeRun.status,
                                threadId
                            });
                            return { success: true, runId: activeRun.id };
                        } catch (cancelError) {
                            logError('RUN_CANCEL_ERROR', `Error cancelando run ${activeRun.id}`, {
                                shortUserId,
                                runId: activeRun.id,
                                error: cancelError.message,
                                errorCode: cancelError.status,
                                threadId
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
                        retryAttempt: retryCount + 1
                    });
                    
                    // Esperar más tiempo para que las cancelaciones tomen efecto
                    const waitTime = Math.min(2000 + (retryCount * 1000), 5000); // 2s, 3s, 4s max
                    logInfo('RUN_CANCEL_WAIT', `Esperando ${waitTime}ms para que las cancelaciones tomen efecto`, {
                        shortUserId,
                        waitTime,
                        retryAttempt: retryCount + 1
                    });
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    
                    // Verificar si realmente se cancelaron
                    const verificationRuns = await openai.beta.threads.runs.list(threadId, { limit: 5 });
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
                            retryAttempt: retryCount + 1
                        });
                        retryCount++;
                        continue; // Reintentar
                    }
                }
                
                activeRunHandled = true;
                
            } catch (listError) {
                logError('RUN_LIST_ERROR', `Error listando runs existentes`, {
                    shortUserId,
                    error: listError.message,
                    errorCode: listError.status,
                    threadId,
                    retryAttempt: retryCount + 1
                });
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    logError('RUN_CLEANUP_FAILED', `Falló limpieza de runs después de ${maxRetries} intentos`, {
                        shortUserId,
                        threadId,
                        finalError: listError.message
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
                maxRetries
            });
            return 'Lo siento, hay un problema técnico con la conversación. Por favor intenta de nuevo en unos momentos.';
        }
        
        // ✅ AHORA SÍ: Agregar mensaje del usuario con contextos temporal y conversacional
        logOpenAIRequest(shortUserId, 'adding_message', threadId);
        
        // Obtener información del thread para el contexto conversacional
        const currentThreadInfo = threadPersistence.getThread(shortUserId);
        const timeContext = getCurrentTimeContext();
        const conversationalContext = getConversationalContext(currentThreadInfo);
        
        // Construir el mensaje con todos los contextos
        let messageWithContexts = timeContext + '\n\n' + conversationalContext;
        
        // Si hay historial de chat (thread nuevo), agregarlo
        if (chatHistoryContext) {
            messageWithContexts += '\n\n' + chatHistoryContext;
            logInfo('CONTEXT_WITH_HISTORY', `Incluyendo historial de chat en el contexto`, {
                shortUserId,
                historyLength: chatHistoryContext.length
            });
        }
        
        messageWithContexts += '\n\n' + userMsg;
        
        // 🔍 DEBUG: Log del contenido completo enviado a OpenAI
        logInfo('OPENAI_CONTEXT_DEBUG', `Contenido completo enviado a OpenAI`, {
            shortUserId,
            threadId,
            timeContextLength: timeContext.length,
            conversationalContextLength: conversationalContext.length,
            chatHistoryLength: chatHistoryContext.length,
            userMessageLength: userMsg.length,
            totalLength: messageWithContexts.length,
            timeContextPreview: timeContext.substring(0, 150) + '...',
            conversationalContextPreview: conversationalContext.substring(0, 150) + '...',
            chatHistoryPreview: chatHistoryContext ? chatHistoryContext.substring(0, 150) + '...' : 'No hay historial',
            userMessagePreview: userMsg.substring(0, 100),
            fullContent: messageWithContexts
        });
        
        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: messageWithContexts
        });
        
        // Actualizar actividad del thread
        const threadInfo = threadPersistence.getThread(shortUserId);
        if (threadInfo) {
            threadPersistence.setThread(shortUserId, threadId, threadInfo.chatId, threadInfo.userName);
        }
        
        logOpenAIRequest(shortUserId, 'message_added', threadId);
        logDebug('MESSAGE_DETAIL', `Mensaje agregado al thread`, {
            threadId,
            messageLength: userMsg.length,
            messagePreview: userMsg.substring(0, 100)
        });
        
        // Crear y ejecutar run
        logOpenAIRequest(shortUserId, 'creating_run', threadId);
        let run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: ASSISTANT_ID
        });
        
        logOpenAIRequest(shortUserId, 'run_started', run.id);
        
        // Esperar respuesta
        let attempts = 0;
        const maxAttempts = 60;
        
        while (['queued', 'in_progress'].includes(run.status) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            run = await openai.beta.threads.runs.retrieve(threadId, run.id);
            attempts++;
            
            if (attempts % 10 === 0) {
                logInfo('OPENAI_POLLING', `Esperando respuesta para ${shortUserId}, intento ${attempts}/${maxAttempts}, estado: ${run.status}`);
            }
        }
        
        let duration = Date.now() - startTime;
        
        // 🎯 MEJORADO: Manejo de Function Calling con mejores prácticas OpenAI
        if (run.status === 'requires_action') {
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
                expires_at: run.expires_at
            });
            
            try {
                // 🔧 MEJORADO: Procesamiento paralelo de tool calls con mejor error handling
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
                        total: toolCalls.length
                    });
                    
                    try {
                        // Ejecutar la función usando FunctionHandler
                        const { FunctionHandler } = await import('./handlers/function-handler.js');
                        const functionHandler = new FunctionHandler();
                        const result = await functionHandler.handleFunction(functionName, functionArgs);
                        
                        const executionTime = Date.now() - startTime;
                        
                        // 🔧 MEJORADO: Formateo robusto del resultado
                        let formattedResult;
                        if (typeof result === 'string') {
                            formattedResult = result;
                        } else if (result && typeof result === 'object') {
                            // Si el resultado ya tiene estructura de error/success, mantenerla
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
                            total: toolCalls.length
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
                            total: toolCalls.length
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
                
                // Log detallado del contenido exacto enviado a OpenAI
                logInfo('OPENAI_TOOL_OUTPUTS_DETAIL', `Contenido exacto enviado a OpenAI en tool_outputs`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    toolOutputsCount: toolOutputs.length,
                    toolOutputsDetail: toolOutputs.map((output, i) => ({
                        tool_call_id: output.tool_call_id,
                        outputLength: output.output.length,
                        isError: output.output.includes('"error"') || output.output.includes('"success":false'),
                        fullContent: output.output, // Contenido completo que recibe OpenAI
                        contentType: typeof output.output
                    })),
                    timestamp: new Date().toISOString()
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
                    }))
                });
                
                // 🔧 MEJORADO: Envío con timeout y retry
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
                            attempt: submitAttempts
                        });
                        
                        run = await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                            tool_outputs: toolOutputs
                        });
                        
                        submitSuccess = true;
                        
                        logSuccess('FUNCTION_SUBMIT_SUCCESS', `Tool outputs enviados exitosamente`, {
                            shortUserId,
                            threadId,
                            runId: run.id,
                            toolOutputsCount: toolOutputs.length,
                            newRunStatus: run.status,
                            attempt: submitAttempts
                        });
                        
                    } catch (submitError) {
                        logError('FUNCTION_SUBMIT_ERROR', `Error enviando tool outputs [intento ${submitAttempts}]`, {
                            shortUserId,
                            threadId,
                            runId: run.id,
                            error: submitError.message,
                            errorCode: submitError.status,
                            attempt: submitAttempts,
                            maxAttempts: maxSubmitAttempts
                        });
                        
                        if (submitAttempts >= maxSubmitAttempts) {
                            return 'Lo siento, hubo un problema enviando los resultados de la consulta. Por favor intenta de nuevo.';
                        }
                        
                        // Esperar antes de reintentar
                        await new Promise(resolve => setTimeout(resolve, 1000 * submitAttempts));
                    }
                }
                
                // 🔧 MEJORADO: Continuar esperando hasta completion con timeout de 10 minutos
                const submitTime = Date.now();
                const maxWaitTime = 10 * 60 * 1000; // 10 minutos (límite de OpenAI)
                attempts = 0;
                const maxWaitAttempts = Math.floor(maxWaitTime / 500); // 500ms por intento
                
                logInfo('FUNCTION_WAITING_COMPLETION', `Esperando completion después de function calling`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    currentStatus: run.status,
                    maxWaitMinutes: 10
                });
                
                while (['queued', 'in_progress'].includes(run.status) && attempts < maxWaitAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    try {
                        run = await openai.beta.threads.runs.retrieve(threadId, run.id);
                    } catch (retrieveError: any) {
                        // Manejar rate limit en retrieve
                        if (retrieveError?.code === 'rate_limit_exceeded') {
                            const retryAfter = extractRetryAfter(retrieveError.message) || 2;
                            logWarning('RATE_LIMIT_RETRIEVE', `Rate limit en retrieve, esperando ${retryAfter}s`, {
                                shortUserId,
                                retryAfter,
                                error: retrieveError.message
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
                            maxWaitMinutes: 10
                        });
                    }
                }
                
                duration = Date.now() - startTime;
                
                logInfo('FUNCTION_CALLING_FINAL_STATUS', `Function calling completado`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    finalStatus: run.status,
                    totalDuration: duration,
                    toolCallsCount: toolCalls.length,
                    waitAttempts: attempts
                });
                
            } catch (functionError) {
                duration = Date.now() - startTime;
                
                logError('FUNCTION_CALLING_CRITICAL_ERROR', `Error crítico en function calling`, {
                    shortUserId,
                    error: functionError.message,
                    stack: functionError.stack,
                    threadId,
                    runId: run.id,
                    duration,
                    toolCallsCount: toolCalls?.length || 0
                });
                
                return 'Lo siento, hubo un problema ejecutando la consulta. Por favor intenta de nuevo.';
            }
        }
        
        if (run.status !== 'completed') {
            // 🔍 LOGGING DETALLADO: Capturar TODA la información del error
            const errorDetails = {
                runId: run.id,
                threadId,
                attempts,
                duration,
                status: run.status,
                // 🎯 NUEVOS CAMPOS DETALLADOS
                created_at: run.created_at,
                started_at: run.started_at,
                failed_at: run.failed_at,
                cancelled_at: run.cancelled_at,
                expires_at: run.expires_at,
                last_error: run.last_error,
                incomplete_details: run.incomplete_details,
                required_action: run.required_action,
                usage: run.usage,
                // 🔧 OBJETO COMPLETO DEL RUN PARA ANÁLISIS
                full_run_object: JSON.stringify(run, null, 2)
            };
            
            logError('OPENAI_RUN', `OpenAI no completó para ${shortUserId}. Estado: ${run.status}`, errorDetails);
            
            // 🚨 Log específico del tipo de error si existe
            if (run.last_error) {
                logError('OPENAI_RUN_ERROR_DETAIL', `Detalles específicos del error OpenAI`, {
                    shortUserId,
                    error_code: run.last_error.code,
                    error_message: run.last_error.message,
                    failed_at: run.failed_at,
                    threadId,
                    runId: run.id
                });
            }
            
            // 🔧 Log adicional para incomplete_details si existe
            if (run.incomplete_details) {
                logError('OPENAI_RUN_INCOMPLETE', `Run incompleto - detalles adicionales`, {
                    shortUserId,
                    incomplete_reason: run.incomplete_details.reason,
                    threadId,
                    runId: run.id
                });
            }
            
            logOpenAIResponse(shortUserId, duration, false, userName);
            return 'Lo siento, hubo un problema procesando tu mensaje. Por favor intenta de nuevo.';
        }
        
        // Obtener respuesta
        logOpenAIRequest(shortUserId, 'retrieving_messages', threadId);
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data.find(m => m.role === 'assistant');
        
        if (!assistantMessage?.content[0]) {
            logError('OPENAI_RESPONSE', `No se encontró respuesta del asistente para ${shortUserId}`, { threadId });
            logOpenAIResponse(shortUserId, duration, false, userName);
            return 'No pude generar una respuesta. Por favor intenta de nuevo.';
        }
        
        const response = assistantMessage.content[0].text.value;
        logOpenAIResponse(shortUserId, duration, true, userName);
        
        // Log simple del contenido completo de OpenAI
        logInfo('OPENAI_OUTPUT', `Respuesta completa: ${response}`);
        
        logInfo('OPENAI_RESPONSE', `Respuesta obtenida para ${shortUserId}`, { 
            responseLength: response.length,
            preview: response.substring(0, 100) + '...',
            threadId,
            messageCount: messages.data.length,
            userName: userName
        });
        
        // No necesitamos actualizar metadatos después de cada procesamiento
        // Solo cuando se crea el thread por primera vez o cuando OpenAI lo solicita
        
        return response;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        logError('OPENAI_ERROR', `Error procesando mensaje para ${shortUserId}`, { 
            error: error.message, 
            stack: error.stack,
            duration,
            userJid,
            shortUserId
        });
        logOpenAIResponse(shortUserId, duration, false, userName);
        return 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
    }
};

// --- Envío de mensaje a WhatsApp ---
const sendToWhatsApp = async (chatId, message) => {
    const shortUserId = getShortUserId(chatId);
    
    try {
        // 🎯 MEJORADO: División inteligente de mensajes
        // Dividir por doble salto de línea O por bullets/listas
        let chunks = [];
        
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
        
        // Filtrar chunks vacíos y combinar chunks muy pequeños
        chunks = chunks.filter(chunk => chunk.length > 0);
        
        // Si no se pudo dividir bien, usar el mensaje original
        if (chunks.length === 0) {
            chunks = [message];
        }
        
        // Si es un mensaje corto sin párrafos, enviarlo como está
        if (chunks.length === 1) {
            logInfo('WHATSAPP_SEND', `Enviando mensaje a ${shortUserId}`, { 
                chatId,
                messageLength: message.length,
                preview: message.substring(0, 100) + '...'
            });
            
            const response = await fetch(`${WHAPI_API_URL}/messages/text?token=${WHAPI_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: chatId,
                    body: message,
                    typing_time: 3
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // 🔧 TRACKING: Registrar ID del mensaje enviado por el bot
                if (result.sent && result.message?.id) {
                    botSentMessages.add(result.message.id);
                    logDebug('BOT_MESSAGE_TRACKED', `Mensaje del bot registrado para tracking anti-duplicación`, {
                        shortUserId: shortUserId,
                        messageId: result.message.id,
                        messageLength: message.length,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Limpiar después de 10 minutos para evitar que crezca infinitamente
                    setTimeout(() => {
                        botSentMessages.delete(result.message.id);
                        logDebug('BOT_MESSAGE_CLEANUP', `ID limpiado del tracking`, {
                            messageId: result.message.id,
                            cleanupAfterMinutes: 10
                        });
                    }, 10 * 60 * 1000);
                }
                
                // Solo logs técnicos (sin log en consola, ya se muestra en processUserMessage)
                logWhatsAppMessage(shortUserId, 'OUT', message.substring(0, 50) + '...', 'Usuario');
                logSuccess('WHATSAPP_SEND', `Mensaje enviado exitosamente`, {
                    shortUserId: shortUserId,
                    messageLength: message.length,
                    messageId: result.message?.id,
                    responseTime: Date.now() - Date.now() // Esto se puede mejorar con un timestamp inicial
                });
                return true;
            } else {
                const errorText = await response.text();
                logError('WHATSAPP_SEND', `Error enviando mensaje a ${shortUserId}`, { 
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                return false;
            }
        } else {
            // 🎯 NUEVO: Enviar múltiples párrafos como mensajes separados
            logInfo('WHATSAPP_CHUNKS', `Dividiendo mensaje largo en ${chunks.length} párrafos`, { 
                chatId: chatId,
                shortUserId: shortUserId,
                totalChunks: chunks.length,
                originalLength: message.length
            });
            
            // Enviar cada chunk como mensaje independiente
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const isLastChunk = i === chunks.length - 1;
                
                logDebug('WHATSAPP_CHUNK', `Enviando párrafo ${i + 1}/${chunks.length}`, {
                    shortUserId: shortUserId,
                    chunkLength: chunk.length,
                    preview: chunk.substring(0, 50) + '...'
                });
                
                const response = await fetch(`${WHAPI_API_URL}/messages/text?token=${WHAPI_TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: chatId,
                        body: chunk,
                        typing_time: i === 0 ? 3 : 2 // 3s para el primer mensaje, 2s para los siguientes
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
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
                        error: errorText
                    });
                    // Continuar con el siguiente chunk aunque falle uno
                }
                
                // Delay natural entre párrafos (solo si no es el último)
                if (!isLastChunk) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }
            
            logSuccess('WHATSAPP_CHUNKS_COMPLETE', `Todos los párrafos enviados`, {
                shortUserId: shortUserId,
                totalChunks: chunks.length,
                originalLength: message.length
            });
            return true;
        }
    } catch (error) {
        logError('WHATSAPP_SEND', `Error de red enviando a ${shortUserId}`, { 
            error: error.message,
            stack: error.stack
        });
        return false;
    }
};

// --- Procesamiento de mensajes del usuario (como Baileys) ---
const processUserMessage = async (userId) => {
    const buffer = userMessageBuffers.get(userId);
    if (!buffer || buffer.messages.length === 0) {
        logWarning('MESSAGE_PROCESS', `Buffer vacío o inexistente para ${getShortUserId(userId)}`);
        return;
    }
    
    const shortUserId = getShortUserId(userId);
    const combinedMessage = buffer.messages.join('\n\n');
    
    // Solo logs técnicos
    logBufferActivity(shortUserId, 'processing_combined_messages', buffer.messages.length);
    logInfo('MESSAGE_PROCESS', `Procesando mensajes agrupados`, {
        userId,
        shortUserId: shortUserId,
        chatId: buffer.chatId,
        messageCount: buffer.messages.length,
        totalLength: combinedMessage.length,
        preview: combinedMessage.substring(0, 100) + '...'
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
    
    // Enviar respuesta a WhatsApp
    await sendToWhatsApp(buffer.chatId, response);
    
    // Limpiar buffer
    userMessageBuffers.delete(userId);
    userActivityTimers.delete(userId);
    logBufferActivity(shortUserId, 'buffer_cleared');
};

// --- Health Check ---
app.get('/', (req, res) => {
    const stats = threadPersistence.getStats();
    const typingStats = getTypingStats();
    const status = { 
        status: 'Bot funcionando', 
        timestamp: new Date().toISOString(),
        version: 'bot-with-manual-sync-v2',
        activeThreads: stats.totalThreads,
        activeBuffers: userMessageBuffers.size,
        activeManualBuffers: manualMessageBuffers.size,
        activeTyping: userTypingState.size,
        botTrackedMessages: botSentMessages.size,
        threadStats: stats,
        typingSystem: typingStats,
        systemHealth: {
            clientBuffers: userMessageBuffers.size,
            manualBuffers: manualMessageBuffers.size,
            trackedBotMessages: botSentMessages.size,
            activeTimers: userActivityTimers.size + manualTimers.size
        }
    };
    
    logInfo('HEALTH_CHECK', 'Health check solicitado', status);
    res.json(status);
});

// --- Webhook de Whapi ---
app.post('/hook', async (req, res) => {
    try {
        const { messages, presences } = req.body;
        
        // Log de eventos de typing (si llegaran)
        if (presences && Array.isArray(presences)) {
            presences.forEach(presence => {
                const userId = presence.participant;
                const presenceType = presence.type;
                const shortUserId = getShortUserId(userId);
                
                logInfo('PRESENCE', `🔤 ${shortUserId}: ${presenceType}`);
                
                // Registrar evento de typing (aunque no lleguen con el mismo número)
                if (presenceType === 'composing') {
                    recordTypingEvent(userId);
                    userTypingState.set(userId, { isTyping: true, timestamp: Date.now() });
                    logSuccess('TYPING_ACTIVE', `✍️ Cliente escribiendo...`);
                } else if (presenceType === 'paused') {
                    userTypingState.delete(userId);
                    logInfo('TYPING_PAUSED', `⏸️ Cliente pausó escritura`);
                }
            });
        }
        
        if (!messages || !Array.isArray(messages)) {
            logWarning('WEBHOOK', 'Webhook recibido sin mensajes válidos', { body: req.body });
            res.status(200).send('OK');
            return;
        }
        
        logInfo('WEBHOOK', `Procesando ${messages.length} mensajes del webhook`);
        
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
                const threadId = getThreadId(chatId);
                if (!threadId) {
                    const timestamp3 = getCompactTimestamp();
                    console.log(`${LOG_COLORS.TIMESTAMP}${timestamp3}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} ⚠️  Sin conversación activa con ${shortClientId}`);
                    // Solo log técnico
                    logWarning('MANUAL_NO_THREAD', `No hay conversación activa`, { 
                        shortClientId: shortClientId,
                        agentName: fromName,
                        reason: 'cliente_debe_escribir_primero'
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
                
                // Solo log técnico detallado
                logInfo('MANUAL_DETECTED', `Mensaje manual del agente detectado`, {
                    shortClientId: shortClientId,
                    agentName: fromName,
                    messageText: text.substring(0, 100),
                    messageLength: text.length,
                    timestamp: new Date().toISOString(),
                    chatId: chatId
                });
                
                // 📦 AGRUPAR MENSAJES MANUALES (igual que clientes)
                if (!manualMessageBuffers.has(chatId)) {
                    manualMessageBuffers.set(chatId, {
                        messages: [],
                        agentName: fromName,
                        timestamp: Date.now()
                    });
                    logInfo('MANUAL_BUFFER_CREATE', `Buffer manual creado`, { 
                        shortClientId: shortClientId, 
                        agentName: fromName 
                    });
                }
                
                const buffer = manualMessageBuffers.get(chatId)!;
                buffer.messages.push(text);
                
                // Solo log técnico
                logInfo('MANUAL_BUFFERING', `Mensaje manual agregado al buffer`, {
                    shortClientId: shortClientId,
                    bufferCount: buffer.messages.length,
                    agentName: fromName,
                    timeoutSeconds: 8
                });
                
                // Cancelar timer anterior si existe
                if (manualTimers.has(chatId)) {
                    clearTimeout(manualTimers.get(chatId)!);
                }
                
                // Establecer nuevo timer de 8 segundos
                const timerId = setTimeout(async () => {
                    const finalBuffer = manualMessageBuffers.get(chatId);
                    if (finalBuffer && finalBuffer.messages.length > 0) {
                        const combinedMessage = finalBuffer.messages.join(' ');
                        
                        try {
                            // Solo logs técnicos
                            logInfo('MANUAL_PROCESSING', `Procesando mensajes manuales agrupados`, {
                                shortClientId: shortClientId,
                                messageCount: finalBuffer.messages.length,
                                agentName: finalBuffer.agentName,
                                combinedLength: combinedMessage.length,
                                preview: combinedMessage.substring(0, 100),
                                threadId: threadId
                            });
                            
                            logInfo('MANUAL_SYNC_START', `Iniciando sincronización con OpenAI`, {
                                shortClientId: shortClientId,
                                threadId: threadId,
                                messagePreview: combinedMessage.substring(0, 50),
                                agentName: finalBuffer.agentName
                            });
                            
                            // 1. Agregar contexto del sistema
                            await openai.beta.threads.messages.create(threadId, {
                                role: 'user',
                                content: `[NOTA DEL SISTEMA: Un agente humano (${finalBuffer.agentName}) ha respondido directamente al cliente]`
                            });
                            
                            // 2. Agregar el mensaje manual agrupado
                            await openai.beta.threads.messages.create(threadId, {
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
                            
                            // Solo log técnico
                            logSuccess('MANUAL_SYNC_SUCCESS', `Mensajes manuales sincronizados exitosamente`, {
                                shortClientId: shortClientId,
                                agentName: finalBuffer.agentName,
                                messageCount: finalBuffer.messages.length,
                                totalLength: combinedMessage.length,
                                preview: combinedMessage.substring(0, 100),
                                threadId: threadId,
                                timestamp: new Date().toISOString()
                            });
                            
                        } catch (error) {
                            const timestamp6 = getCompactTimestamp();
                            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp6}${LOG_COLORS.RESET} ${LOG_COLORS.AGENT}[AGENT]${LOG_COLORS.RESET} ❌ Error sincronizando con OpenAI: ${error.message}`);
                            logError('MANUAL_SYNC_ERROR', `Error sincronizando mensajes manuales`, {
                                error: error.message,
                                threadId: threadId,
                                chatId: shortClientId,
                                messageCount: finalBuffer.messages.length
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
            
            // Solo procesar mensajes de texto entrantes del cliente
            if (message.from_me || message.type !== 'text' || !message.text?.body) {
                logInfo('WEBHOOK_SKIP', 'Mensaje omitido', { 
                    from_me: message.from_me, 
                    type: message.type, 
                    hasText: !!message.text?.body 
                });
                continue;
            }
            
            const userId = message.from;
            const chatId = message.chat_id;
            const text = message.text.body.trim();
            
            // Mejorar extracción del nombre
            const rawName = message.from_name || message.contact_name || 'Usuario';
            const cleanName = cleanContactName(rawName);
            
            // Asegurar formato consistente de userId
            const shortUserId = getShortUserId(userId);
            
            logInfo('WEBHOOK_USER', `Usuario detectado: ${userId}`, { 
                originalChatId: chatId,
                userId: userId,
                shortUserId: shortUserId,
                rawName: rawName,
                cleanName: cleanName
            });
            
            // Solo log técnico (evitar spam en consola)
            logWhatsAppMessage(shortUserId, 'IN', text.length > 50 ? text.substring(0, 50) + '...' : text, cleanName);
            
            // Registrar mensaje en el detector de typing
            recordMessage(userId);
            
            // Gestionar buffer de mensajes (igual que Baileys)
            if (!userMessageBuffers.has(userId)) {
                userMessageBuffers.set(userId, {
                    messages: [],
                    chatId: chatId,
                    name: cleanName,
                    lastActivity: Date.now()
                });
                logBufferActivity(shortUserId, 'buffer_created');
                
                            // Solo obtener info adicional si es usuario nuevo (sin thread)
            const existingThread = threadPersistence.getThread(shortUserId);
            if (!existingThread) {
                logDebug('NEW_USER', `Usuario nuevo detectado: ${shortUserId}, obteniendo info adicional`);
            }
            }
            
            const buffer = userMessageBuffers.get(userId);
            buffer.messages.push(text);
            buffer.lastActivity = Date.now();
            
            logBufferActivity(shortUserId, 'message_added', buffer.messages.length);
            
            // Sistema simple
            if (userActivityTimers.has(userId)) {
                clearTimeout(userActivityTimers.get(userId));
            }
            
            // 🎯 SOLO Log de consola SIMPLE con timestamp y colores
            const timestamp = getCompactTimestamp();
            console.log(`${LOG_COLORS.TIMESTAMP}${timestamp}${LOG_COLORS.RESET} ${LOG_COLORS.USER}[USER]${LOG_COLORS.RESET} 👤 ${cleanName}: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}" → ⏳ 8 seg..`);
            
            // 📋 Solo log técnico sin spam en consola
            logInfo('CONVERSATION_FLOW', `Cliente escribiendo`, {
                shortUserId: shortUserId,
                clientMessage: text.substring(0, 50),
                bufferCount: buffer.messages.length,
                timeoutSeconds: 8,
                hasActiveThread: !!getThreadId(userId),
                chatId: chatId,
                userName: cleanName,
                timestamp: new Date().toISOString()
            });
            
            const timerId = setTimeout(async () => {
                // Solo log técnico
                logInfo('TIMER', `Timeout completado, procesando mensajes`, {
                    shortUserId: shortUserId,
                    messageCount: buffer.messages.length,
                    timeoutCompletedAt: new Date().toISOString()
                });
                
                await processUserMessage(userId);
            }, 8000);
            
            userActivityTimers.set(userId, timerId);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        logError('WEBHOOK_ERROR', 'Error procesando webhook', { 
            error: error.message, 
            stack: error.stack,
            body: req.body
        });
        // IMPORTANTE: Siempre devolver 200 a Whapi para evitar reintentos infinitos
        res.status(200).send('OK');
    }
});

// --- Función helper para extraer tiempo de retry de rate limit ---
const extractRetryAfter = (errorMessage: string): number | null => {
    const match = errorMessage.match(/Please try again in ([\d.]+)s/);
    return match ? parseFloat(match[1]) : null;
};

// --- Inicialización ---
const main = async () => {
    try {
        // Solo logs técnicos detallados (sin spam en consola)
        logInfo('APP_INIT', 'Iniciando servidor bot TeAlquilamos', {
            port: PORT,
            timestamp: new Date().toISOString()
        });
        
        // Cargar threads persistidos
        try {
            const stats = threadPersistence.getStats();
            logSuccess('THREADS_LOADED', `Threads cargados desde archivo`, {
                ...stats,
                timestamp: new Date().toISOString()
            });
            
            // Debug: mostrar información de threads cargados (solo archivos técnicos)
            if (stats.totalThreads > 0) {
                logInfo('THREADS_INFO', `${stats.totalThreads} threads activos en el sistema`, {
                    activeThreads: stats.activeThreads,
                    totalThreads: stats.totalThreads
                });
                
                // Mostrar todos los threads cargados (solo en logs técnicos)
                const allThreads = threadPersistence.getAllThreadsInfo();
                logDebug('THREADS_DETAIL', 'Threads cargados detalladamente', { threads: allThreads });
            }
        } catch (error) {
            logError('THREADS_LOAD', `Error cargando threads`, { 
                error: error.message, 
                stack: error.stack 
            });
        }
        
        // Inicializar archivo de log (mantener compatibilidad)
        if (DEBUG_MODE) {
            fs.writeFileSync(DEBUG_LOG_PATH, `--- Bot iniciado ${new Date().toISOString()} ---\n`);
            logInfo('DEBUG_FILE', `Archivo de debug legacy inicializado`, { 
                path: DEBUG_LOG_PATH,
                debugMode: DEBUG_MODE 
            });
        }
        
        // Validación de configuración
        if (!ASSISTANT_ID) {
            console.log('❌ ERROR: Variable ASSISTANT_ID no configurada');
            logError('CONFIG', 'Variable ASSISTANT_ID no configurada');
            process.exit(1);
        }
        
        if (!WHAPI_TOKEN) {
            console.log('❌ ERROR: Variable WHAPI_TOKEN no configurada');
            logError('CONFIG', 'Variable WHAPI_TOKEN no configurada');
            process.exit(1);
        }
        
        logSuccess('CONFIG', 'Configuración validada correctamente', {
            port: PORT,
            hasAssistantId: !!ASSISTANT_ID,
            hasWhapiToken: !!WHAPI_TOKEN,
            whapiUrl: WHAPI_API_URL,
            debugMode: DEBUG_MODE
        });
        
        // Iniciar servidor
        app.listen(PORT, () => {
            const stats = threadPersistence.getStats();
            
            // 🎯 DASHBOARD SIMPLE Y LIMPIO (sin prefijos [BOT])
            console.clear();
            console.log('\n┌──────────────────────────────────────────────────────────┐');
            console.log('│ 🚀 TeAlquilamos Bot - Dashboard en Tiempo Real          │');
            console.log('├──────────────────────────────────────────────────────────┤');
            console.log(`│ 🌐 Puerto: ${PORT.toString().padEnd(46)} │`);
            console.log(`│ 👥 Threads activos: ${stats.totalThreads.toString().padEnd(38)} │`);
            console.log(`│ ⏱️  Timeout: 8s (clientes y agentes)${''.padEnd(18)} │`);
            console.log(`│ 🛡️  Anti-duplicación: Activo${''.padEnd(26)} │`);
            console.log(`│ 📋 Logs detallados: /logs/${''.padEnd(27)} │`);
            console.log('└──────────────────────────────────────────────────────────┘');
            console.log('\n📱 Esperando mensajes...');
            console.log('💡 Presiona Ctrl+C para cerrar el bot\n');
            
            logSuccess('SERVER_START', 'Bot con sincronización manual iniciado exitosamente', {
                port: PORT,
                clientTimeout: '8000ms',
                manualTimeout: '8000ms',
                features: ['client_grouping', 'manual_sync', 'bot_message_filtering'],
                debugMode: DEBUG_MODE,
                loadedThreads: stats,
                botTracking: true,
                manualBuffering: true
            });
        });
        
    } catch (error) {
        logError('STARTUP_ERROR', 'Error fatal al iniciar', { 
            error: error.message, 
            stack: error.stack 
        });
        process.exit(1);
    }
};

// --- Estadísticas en tiempo real cada 30 segundos (opcional) ---
// Descomenta las siguientes líneas si quieres ver estadísticas automáticas
// setInterval(() => {
//     if (userMessageBuffers.size > 0 || manualMessageBuffers.size > 0) {
//         showLiveStats();
//     }
// }, 30000);

// --- Manejo de errores y cierre ---
process.on('unhandledRejection', (reason) => {
    console.log('⚠️  Error no manejado detectado');
    logError('SYSTEM', 'Unhandled Rejection detectado', { 
        reason: reason.toString(),
        timestamp: new Date().toISOString() 
    });
});

process.on('SIGINT', () => {
    console.log('\n⏹️  Cerrando TeAlquilamos Bot...');
    const stats = threadPersistence.getStats();
    
    // Log técnico detallado
    logInfo('SHUTDOWN', 'Cierre del bot iniciado por SIGINT', {
        activeThreads: stats.totalThreads,
        activeBuffers: userMessageBuffers.size,
        activeManualBuffers: manualMessageBuffers.size,
        trackedBotMessages: botSentMessages.size,
        shutdownTime: new Date().toISOString(),
        threadStats: stats
    });
    
    console.log('👋 Bot cerrado correctamente\n');
    logSuccess('SHUTDOWN', 'Bot cerrado exitosamente', { 
        finalStats: stats,
        shutdownTime: new Date().toISOString() 
    });
    process.exit(0);
});

// Iniciar el bot
main();