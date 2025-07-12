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
    logBotReady
} from './utils/logging/index.js';
import { threadPersistence } from './utils/persistence/index.js';
import { getChatHistory } from './utils/whapi/index';
import { guestMemory } from './utils/persistence/index';
import { whapiLabels } from './utils/whapi/index';
import { getConfig } from './config/environment';

// Importar sistema de monitoreo
import { botDashboard } from './utils/monitoring/dashboard.js';
import metricsRouter from './routes/metrics.js';


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

// Configuración de timeouts por entorno
// 🔧 PAUSAR BUFFER: Usar DISABLE_MESSAGE_BUFFER=true para pruebas de velocidad
const MESSAGE_BUFFER_TIMEOUT = process.env.DISABLE_MESSAGE_BUFFER === 'true' ? 0 : 8000; // 8 segundos
const MANUAL_MESSAGE_TIMEOUT = process.env.DISABLE_MESSAGE_BUFFER === 'true' ? 0 : 8000;
const MAX_BUFFER_SIZE = 10; // Límite máximo de mensajes por buffer (anti-spam)
const BUFFER_DISABLED = process.env.DISABLE_MESSAGE_BUFFER === 'true';
const MAX_BOT_MESSAGES = 1000;
const MAX_MESSAGE_LENGTH = 5000;

// --- Patrones para Consultas Simples ---
const SIMPLE_PATTERNS = {
  greeting: /^(hola|buen(os)?\s(d[ií]as|tardes|noches))(\s*[\.,¡!¿\?])*\s*$/i,
  thanks: /^(gracias|muchas gracias|mil gracias|te agradezco)(\s*[\.,¡!])*$/i,
  availability: /disponibilidad|disponible|libre/i,
  price: /precio|costo|cu[áa]nto|valor/i
};

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
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error(JSON.stringify({
        level: 'CRITICAL',
        category: 'SYSTEM_CRASH',
        message: `⛔ Rechazo de promesa no manejado: ${error.message}`,
        details: { error: { message: error.message, stack: error.stack }, promise }
    }, null, 2));
    setTimeout(() => process.exit(1), 1000);
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

    // Función para procesar mensajes agrupados
    async function processUserMessages(userId: string) {
        const buffer = userMessageBuffers.get(userId);
        if (!buffer || buffer.messages.length === 0) {
            logWarning('MESSAGE_PROCESS', `Buffer vacío o inexistente para ${getShortUserId(userId)}`);
            return;
        }

        const shortUserId = getShortUserId(userId);
        
        // Asegurar agrupación efectiva
        let combinedMessage;
        if (buffer.messages.length > 1) {
            combinedMessage = buffer.messages.join('\n\n');
            logInfo('BUFFER_GROUPED', `Agrupados ${buffer.messages.length} msgs`, { userId: shortUserId });
        } else {
            combinedMessage = buffer.messages[0];
        }

        // Sincronizar labels/perfil antes de procesar
        await guestMemory.getOrCreateProfile(userId);

        logInfo('MESSAGE_PROCESS', `Procesando mensajes agrupados`, {
            userId,
            shortUserId,
            chatId: buffer.chatId,
            messageCount: buffer.messages.length,
            totalLength: combinedMessage.length,
            preview: combinedMessage.substring(0, 100) + '...',
            environment: appConfig.environment
        });

        // Log compacto - Inicio
        console.log(`🤖 [BOT] ${buffer.messages.length} msgs → OpenAI`);
        
        // Enviar a OpenAI con el userId original y la información completa del cliente
        const startTime = Date.now();
        const response = await processWithOpenAI(combinedMessage, userId, buffer.chatId, buffer.name);
        const aiDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Log compacto - Resultado
        const preview = response.length > 50 ? response.substring(0, 50) + '...' : response;
        console.log(`✅ [BOT] Completado (${aiDuration}s) → 💬 "${preview}"`);
        
        // Enviar respuesta a WhatsApp
        await sendWhatsAppMessage(buffer.chatId, response);

        // Limpiar buffer
        userMessageBuffers.delete(userId);
        userActivityTimers.delete(userId);
    }

    // Función para envío de mensajes a WhatsApp
    async function sendWhatsAppMessage(chatId: string, message: string) {
        const shortUserId = getShortUserId(chatId);
        
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
                    typing_time: 3
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

    // Función principal de procesamiento con OpenAI
    const processWithOpenAI = async (userMsg: string, userJid: string, chatId: string = null, userName: string = null): Promise<string> => {
        const shortUserId = getShortUserId(userJid);
        
        try {
                         logOpenAIRequest('starting_process', { shortUserId });
             
             // En processWithOpenAI, modificar la lógica de inyección:
             const config = getConfig();
             let historyInjection = '';
             let labelsStr = '';
             if (config.enableHistoryInject && threadPersistence.isThreadOld(shortUserId)) {
                 try {
                     await guestMemory.syncWhapiLabels(userJid);  // Usa userJid completo
                     const profile = guestMemory.getProfile(shortUserId);
                     labelsStr = profile?.whapiLabels ? JSON.stringify(profile.whapiLabels.map(l => l.name)) : '[]';
                     logInfo('LABELS_INJECT', `Etiquetas para inyección: ${labelsStr}`, { userId: shortUserId });
                 } catch (error) {
                     labelsStr = '';
                     logWarning('SYNC_FAIL', 'Fallback sin labels', { error: error.message, userId: shortUserId });
                 }
                 
                 // GET historial SOLO si thread es viejo (condición más estricta)
                 if (threadPersistence.isThreadOld(shortUserId)) {
                     try {
                         historyInjection = await getChatHistory(chatId, config.historyMsgCount);
                         if (historyInjection) {
                             logSuccess('HISTORY_INJECT', `Historial obtenido: ${historyInjection.split('\n').length} líneas`, { userId: shortUserId });
                         } else {
                             logWarning('HISTORY_INJECT', 'No historial disponible', { userId: shortUserId });
                         }
                     } catch (error) {
                         historyInjection = '';
                         logWarning('HISTORY_FAIL', 'Fallback sin historial', { error: error.message, userId: shortUserId });
                     }
                 }
             }
             
             // Obtener o crear thread
             let threadId = threadPersistence.getThread(shortUserId)?.threadId;
             
             if (!threadId) {
                 const thread = await openaiClient.beta.threads.create();
                 threadId = thread.id;
                 threadPersistence.setThread(shortUserId, threadId, chatId, userName);
                 
                 logThreadCreated('Thread creado', { 
                     shortUserId,
                     threadId,
                     chatId, 
                     userName,
                     environment: appConfig.environment
                 });
             }
             
             // Inyección SOLO si hay contenido y thread es viejo (evitar duplicados)
             if ((historyInjection || labelsStr) && threadPersistence.isThreadOld(shortUserId)) {
                 const injectContent = `${historyInjection ? historyInjection + '\n\n' : ''}Hora actual: ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}\nEtiquetas actuales: ${labelsStr}`;
                 await openaiClient.beta.threads.messages.create(threadId, { role: 'user', content: injectContent });
                 logSuccess('CONTEXT_INJECT', `Contexto inyectado (historial + hora + labels)`, { length: injectContent.length, userId: shortUserId });
             }
             
             // Agregar mensaje al thread
             await openaiClient.beta.threads.messages.create(threadId, {
                 role: 'user',
                 content: userMsg
             });
             
             logOpenAIRequest('message_added', { shortUserId });
             
             // Crear y ejecutar run
             logOpenAIRequest('creating_run', { shortUserId });
             let run = await openaiClient.beta.threads.runs.create(threadId, {
                 assistant_id: secrets.ASSISTANT_ID
             });
             
             logOpenAIRequest('run_started', { shortUserId });
            
            // Esperar respuesta
            let attempts = 0;
            const maxAttempts = 60;
            
            while (['queued', 'in_progress'].includes(run.status) && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
                attempts++;
                
                if (attempts % 20 === 0) {  // Cambiado de %10 a %20
                    logInfo('OPENAI_POLLING', `Esperando...`, { shortUserId, runId: run.id, status: run.status });
                }
            }
            
            if (run.status === 'completed') {
                logSuccess('OPENAI_RUN_COMPLETED', `Run completado para ${shortUserId}`, { threadId });
                
                // Forzar limit: 1 para obtener solo el último mensaje
                const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 1 });
                const assistantMessage = messages.data[0];
                
                // Validar que el mensaje tenga contenido válido
                if (!assistantMessage || !assistantMessage.content || assistantMessage.content.length === 0) {
                    logWarning('OPENAI_NO_CONTENT', 'No valid response, fallback', { runId: run.id, threadId });
                    return 'Lo siento, hubo un problema procesando tu solicitud. Por favor intenta de nuevo.';
                }
                
                // Corregir el type guard para content:
                const content = assistantMessage.content[0];
                if (content.type !== 'text' || !('text' in content) || !content.text.value || content.text.value.trim() === '') {
                    logWarning('OPENAI_INVALID_CONTENT', 'Invalid content type or empty value', { 
                        runId: run.id, 
                        threadId,
                        contentType: content.type,
                        hasValue: 'text' in content ? !!content.text?.value : false
                    });
                    return 'Lo siento, hubo un problema procesando tu solicitud. Por favor intenta de nuevo.';
                }
                
                const responseText = content.text.value;
                
                // Detectar posible loop en respuesta
                if (responseText.includes('Las funciones se ejecutaron correctamente')) {
                    logWarning('LOOP_DETECTED', 'Possible loop detected in response', { 
                        runId: run.id, 
                        threadId,
                        responsePreview: responseText.substring(0, 100)
                    });
                }
                
                logOpenAIResponse('response_received', {
                    shortUserId,
                    threadId,
                    responseLength: responseText.length,
                    environment: appConfig.environment
                });
                
                return responseText;
            } else if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
                // Manejar function calling
                const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                
                                 logFunctionCallingStart('function_calling_required', {
                     shortUserId,
                     threadId,
                     runId: run.id,
                     toolCallsCount: toolCalls.length,
                     environment: appConfig.environment
                 });
                
                const toolOutputs = [];
                
                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    
                                         logFunctionExecuting('function_executing', {
                         shortUserId,
                         functionName,
                         toolCallId: toolCall.id,
                         args: functionArgs,
                         environment: appConfig.environment
                     });
                    
                    try {
                        // Ejecutar la función usando el registry
                        const { executeFunction } = await import('./functions/registry/function-registry.js');
                        const result = await executeFunction(functionName, functionArgs);
                        
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
                        
                                                 logFunctionHandler('function_success', {
                             shortUserId,
                             functionName,
                             status: 'success',
                             toolCallId: toolCall.id,
                             resultLength: formattedResult.length,
                             environment: appConfig.environment
                         });
                        
                    } catch (error) {
                        const errorOutput = `Error ejecutando función: ${error.message}`;
                        toolOutputs.push({
                            tool_call_id: toolCall.id,
                            output: errorOutput
                        });
                        
                        logError('FUNCTION_ERROR', `Error ejecutando función ${functionName}`, {
                            shortUserId,
                            error: error.message,
                            environment: appConfig.environment
                        });
                    }
                }
                
                // Enviar resultados de las funciones
                await openaiClient.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: toolOutputs
                });
                
                // Esperar a que complete después del function calling
                attempts = 0;
                while (['queued', 'in_progress'].includes(run.status) && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    run = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
                    attempts++;
                }
                
                if (run.status === 'completed') {
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
                                toolCallsExecuted: toolCalls.length,
                                environment: appConfig.environment
                            });
                            
                            return responseText;
                        }
                    }
                }
                
                return 'Las funciones se ejecutaron correctamente, pero no pude generar una respuesta final.';
            } else {
                logError('OPENAI_RUN_ERROR', `Run falló o timeout`, {
                    shortUserId,
                    threadId,
                    runId: run.id,
                    status: run.status,
                    attempts,
                    environment: appConfig.environment
                });
                
                return 'Lo siento, hubo un problema procesando tu solicitud. Por favor intenta de nuevo.';
            }
            
        } catch (error) {
            logError('OPENAI_ERROR', `Error en procesamiento OpenAI para ${shortUserId}`, {
                error: error.message,
                stack: error.stack,
                environment: appConfig.environment
            });
            
            // Remove thread SOLO si error real (thread not found)
            if (error.message && error.message.includes('thread not found')) {
                threadPersistence.removeThread(shortUserId);
                logWarning('THREAD_REMOVED', `Thread removido por error real: ${error.message}`, { userId: shortUserId });
            }
            
            return 'Lo siento, hubo un error técnico. Por favor intenta de nuevo en unos momentos.';
        } finally {
            threadPersistence.removeThread(shortUserId);
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
            const { messages } = req.body;
            
            if (!messages || !Array.isArray(messages)) {
                logWarning('WEBHOOK', 'Webhook recibido sin mensajes válidos', { 
                    body: req.body,
                    environment: appConfig.environment
                });
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
                    
                    // Crear o actualizar buffer de mensajes
                    if (!userMessageBuffers.has(userJid)) {
                        userMessageBuffers.set(userJid, {
                            messages: [],
                            chatId: chatId,
                            name: userName,
                            lastActivity: Date.now()
                        });
                        
                        logDebug('BUFFER_CREATE', `Buffer creado para ${userName}`, {
                            userJid,
                            chatId,
                            timeout: MESSAGE_BUFFER_TIMEOUT,
                            environment: appConfig.environment
                        });
                    }

                    const buffer = userMessageBuffers.get(userJid)!;
                    
                    // Validación de límite de buffer (anti-spam)
                    if (buffer.messages.length >= MAX_BUFFER_SIZE) {
                        logWarning('BUFFER_OVERFLOW', `Buffer alcanzó límite máximo para ${userName}`, {
                            userJid,
                            bufferSize: buffer.messages.length,
                            maxSize: MAX_BUFFER_SIZE,
                            droppedMessage: messageText.substring(0, 50) + '...',
                            environment: appConfig.environment
                        });
                        
                        console.log(`🚫 [SPAM] Buffer lleno para ${userName} (${buffer.messages.length}/${MAX_BUFFER_SIZE})`);
                        continue; // Ignorar mensajes adicionales
                    }
                    
                    buffer.messages.push(messageText);
                    buffer.lastActivity = Date.now();

                    // Cancelar timer anterior si existe
                    if (userActivityTimers.has(userJid)) {
                        clearTimeout(userActivityTimers.get(userJid)!);
                        
                        logDebug('BUFFER_TIMER_RESET', `Timer reiniciado para ${userName}`, {
                            userJid,
                            previousMessages: buffer.messages.length - 1,
                            newMessage: messageText.substring(0, 50)
                        });
                    }

                    // Log en consola con indicador de espera
                    const timeoutSeconds = MESSAGE_BUFFER_TIMEOUT / 1000;
                    const messagePreview = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
                    if (process.env.DETAILED_LOGS === 'true') {
                        console.log(`Detalles extras: ${JSON.stringify({ userJid, chatId, userName, messageText, timeoutSeconds })}`);
                    } else {
                        console.log(`👤 ${userName}: "${messagePreview}" → ⏳ ${timeoutSeconds}s...`);
                    }

                    // Establecer nuevo timer para procesar mensajes agrupados
                    const timerId = setTimeout(async () => {
                        await processUserMessages(userJid);
                    }, MESSAGE_BUFFER_TIMEOUT);

                    userActivityTimers.set(userJid, timerId);

                    // Completar el log que se cortó:
                    logInfo('MESSAGE_BUFFERED', `Mensaje agregado al buffer`, {
                        userJid,
                        chatId,
                        userName,
                        bufferCount: buffer.messages.length,
                        messageLength: messageText.length,
                        timeoutMs: MESSAGE_BUFFER_TIMEOUT,
                        environment: appConfig.environment
                    });

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

} // Cierre de setupWebhooks()

// Función de inicialización del bot
async function initializeBot() {
    // ... lógica de inicialización
    isServerInitialized = true;
    console.log('✅ Bot completamente inicializado');
}

// --- Ejecución ---
main();

// Exportar para testing