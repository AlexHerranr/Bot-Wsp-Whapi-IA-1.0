import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de logs
const LOG_DIR = path.join(__dirname, '../../../logs');
const LOG_FILE = path.join(LOG_DIR, `bot-${new Date().toISOString().split('T')[0]}.log`);
const MAX_LOG_SIZE = 50 * 1024 * 1024; // 50MB (aumentado para más detalle)

// Store de correlation IDs por usuario
const correlationStore = new Map<string, string>();

// Generar correlation ID único
export const generateCorrelationId = (): string => {
    return `req_${uuidv4().substring(0, 8)}`;
};

// Establecer correlation ID para un usuario
export const setCorrelationId = (userId: string, correlationId?: string): string => {
    const id = correlationId || generateCorrelationId();
    correlationStore.set(userId, id);
    return id;
};

// Obtener correlation ID de un usuario
export const getCorrelationId = (userId: string): string | undefined => {
    return correlationStore.get(userId);
};

// Limpiar correlation ID al finalizar request
export const clearCorrelationId = (userId: string): void => {
    correlationStore.delete(userId);
};

// Asegurar que existe el directorio de logs
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Stream de escritura para logs técnicos
let logStream: fs.WriteStream | null = null;

// Inicializar stream de logs
const initLogStream = () => {
    if (logStream) {
        logStream.end();
    }
    
    // Verificar tamaño del archivo
    if (fs.existsSync(LOG_FILE)) {
        const stats = fs.statSync(LOG_FILE);
        if (stats.size > MAX_LOG_SIZE) {
            // Rotar archivo
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            fs.renameSync(LOG_FILE, `${LOG_FILE}.${timestamp}.old`);
        }
    }
    
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
};

// Inicializar al cargar el módulo
initLogStream();

// Mapa de niveles de log para consola (simplificado)
const consoleLogLevels = {
    'info': '📝',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌',
    'debug': '🔍'
};

// Función para obtener el nombre del archivo que llamó enhancedLog
const getCallerFile = (): string => {
    try {
        const stack = new Error().stack;
        if (!stack) return 'unknown';
        
        const lines = stack.split('\n');
        // Buscar la línea que NO sea enhancedLogger.ts
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            if (line && !line.includes('enhancedLogger') && !line.includes('node_modules')) {
                // Extraer nombre del archivo
                const match = line.match(/([^/\\]+\.(?:ts|js)):/);
                if (match) {
                    return match[1];
                }
                // Fallback para otros formatos
                const pathMatch = line.match(/\(([^)]+)\)/);
                if (pathMatch) {
                    const fullPath = pathMatch[1];
                    const fileName = fullPath.split(/[/\\]/).pop();
                    if (fileName && (fileName.endsWith('.ts') || fileName.endsWith('.js'))) {
                        return fileName;
                    }
                }
            }
        }
        return 'unknown';
    } catch {
        return 'unknown';
    }
};

// Escribir en archivo de log (FORMATO ENTERPRISE con Correlation ID)
const writeToFile = (level: string, category: string, message: string, details?: any, sourceFile?: string, userId?: string) => {
    if (!logStream) initLogStream();
    
    const timestamp = new Date().toISOString();
    
    // Información enterprise
    const fileInfo = sourceFile ? ` [${sourceFile}]` : '';
    const correlationId = userId ? getCorrelationId(userId) : undefined;
    const corrInfo = correlationId ? ` {${correlationId}}` : '';
    
    // Formato enterprise: [timestamp] [level] category [file] {correlationId}: message
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${category}${fileInfo}${corrInfo}: ${message}`;
    
    // Escribir en archivo como texto legible
    logStream?.write(logLine + '\n');
    
    // Si hay detalles adicionales, también escribirlos
    if (details && Object.keys(details).length > 0) {
        const detailsLine = `[${timestamp}] [${level.toUpperCase()}] ${category}_DETAILS${fileInfo}${corrInfo}: ${JSON.stringify(details)}`;
        logStream?.write(detailsLine + '\n');
    }
};

// Función principal de logging mejorado
export const enhancedLog = (
    level: 'info' | 'success' | 'warning' | 'error' | 'debug',
    category: string,
    message: string,
    details?: any,
    userId?: string
) => {
    const timestamp = new Date().toISOString();
    const sourceFile = getCallerFile();
    
    // Escribir al archivo técnico (formato completo)
    writeToFile(level, category, message, details, sourceFile, userId);
    
    // Logs simplificados en consola - NUEVO FORMATO
    const time = new Date().toLocaleTimeString('es-CO', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3 
    });
    const correlationId = userId ? getCorrelationId(userId) : undefined;
    const corrId = correlationId ? correlationId.substring(4, 8) : '';
    
    // NUEVO FORMATO SIMPLIFICADO
    if (category === 'MESSAGE_RECEIVED') {
        const cleanMsg = message.replace('Mensaje de ', '').replace(/573003913251: "(.+)"/, '$1');
        console.log(`[${time}] Cliente: "${cleanMsg}"`);
    } else if (category === 'BUFFER_START') {
        console.log(`├─ Buffer: esperando más mensajes (6s)...`);
    } else if (category === 'THREAD_SEARCH') {
        const duration = details?.duration || '0.012';
        console.log(`├─ [${duration}s] Buscando thread local...`);
    } else if (category === 'THREAD_FOUND') {
        const duration = details?.duration || '0.015';
        const threadId = details?.threadId?.substring(7, 14) || 'unknown';
        const msgCount = details?.messageCount || 0;
        console.log(`├─ [${duration}s] ✓ Thread encontrado: ${threadId} (${msgCount} msgs)`);
        console.log(`└─ [0.016s] No necesita contexto WhatsApp`);
    } else if (category === 'THREAD_NOT_FOUND') {
        const duration = details?.duration || '0.009';
        console.log(`├─ [${duration}s] ✗ No encontrado`);
    } else if (category === 'WHAPI_CONTEXT') {
        const duration = details?.duration || '0.856';
        console.log(`└─ [${duration}s] Obteniendo contexto WhatsApp (últimos 20 msgs)`);
    } else if (category === 'BUFFER_RESET') {
        console.log(`└─ Buffer: reset timer (6s)...`);
    } else if (category === 'PROCESSING_START') {
        console.log(`\n[${time}] === TIMEOUT - PROCESANDO ===`);
    } else if (category === 'MESSAGE_GROUPED') {
        const preview = message.substring(0, 40).replace(/\n/g, '\\n');
        console.log(`\nMENSAJE AGRUPADO:\n"${preview}..."`);
    } else if (category === 'THREAD_CREATE') {
        const duration = details?.duration || '0.548';
        console.log(`[${time.substring(0,8)}] Creando thread nuevo...`);
        console.log(`[${duration}s] ✓ Thread creado: ${details?.threadId?.substring(7, 14)}`);
    } else if (category === 'OPENAI_REQUEST') {
        const threadId = details?.threadId?.substring(7, 14) || 'new';
        const context = details?.isNew ? 'nuevo' : `${details?.messageCount || 0} msgs`;
        console.log(`\n[${time.substring(0,8)}] Enviando a OpenAI:`);
        console.log(`Thread: ${threadId} (${context})`);
        if (details?.clientContext) {
            console.log(`Contexto: ${details.clientContext}`);
        }
        console.log(`Mensaje: [${details?.lineCount || 1} líneas agrupadas]`);
    } else if (category === 'OPENAI_COMPLETE') {
        const duration = details?.duration || '0.00';
        const preview = message.substring(0, 50).replace(/\n/g, ' ');
        console.log(`\n[${time.substring(0,8)}] Respuesta OpenAI: ${duration}s`);
        console.log(`"${preview}..."`);
    } else if (category === 'MESSAGE_SENT') {
        const duration = details?.duration || '0.34';
        console.log(`\n[${time.substring(0,8)}] ✓ Enviada WhatsApp: ${duration}s`);
    } else if (category === 'THREAD_SAVED') {
        console.log(`[${time.substring(0,8)}] ✓ Thread guardado en BD local`);
    } else if (category === 'TOTAL_TIME') {
        const totalTime = details?.totalTime || '0.0';
        console.log(`\nTOTAL: ${totalTime} segundos desde primer mensaje\n`);
    } else if (category === 'CONTEXT_OBTAINED') {
        console.log(`\nCONTEXTO WHATSAPP OBTENIDO:`);
        console.log(`- Nombre: ${details?.name || 'Cliente'}`);
        console.log(`- ${details?.isFirstTime ? 'Primera vez escribiendo' : 'Cliente conocido'}`);
        console.log(`- ${details?.historyCount || 'Sin'} mensajes de historial`);
    } else if (level === 'error') {
        console.log(`[${time}] ❌ ERROR: ${message}`);
    }
};

// Función para leer logs recientes
export const getRecentLogs = (lines: number = 100): string[] => {
    if (!fs.existsSync(LOG_FILE)) return [];
    
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const allLines = content.trim().split('\n');
    
    return allLines.slice(-lines);
};

// Función para buscar errores en logs
export const searchErrors = (minutes: number = 60): string[] => {
    const logs = getRecentLogs(1000);
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    return logs.filter(line => {
        if (line.includes('[ERROR]')) {
            try {
                const timestampMatch = line.match(/\[([^\]]+)\]/);
                if (timestampMatch) {
                    const logTime = new Date(timestampMatch[1]);
                    return logTime > cutoffTime;
                }
            } catch {
                return false;
            }
        }
        return false;
    });
};

// Cerrar stream al salir
process.on('exit', () => {
    if (logStream) {
        logStream.end();
    }
});

// Información sobre archivo de logs al iniciar
console.log(`📁 Logs técnicos detallados en: ${LOG_FILE}`);

export default enhancedLog;

// Emisor de eventos para dashboard
export const dashboardEvents = new EventEmitter();

// Colores y emojis para logs
const logConfig = {
    colors: {
        info: '\x1b[36m',
        success: '\x1b[32m',
        warning: '\x1b[33m',
        error: '\x1b[31m',
        debug: '\x1b[35m',
        metric: '\x1b[34m',
        reset: '\x1b[0m'
    },
    emojis: {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        debug: '🔍',
        metric: '📊',
        user: '👤',
        bot: '🤖',
        message: '💬',
        time: '⏱️',
        flow: '🔄'
    }
};

// Métricas del sistema
export const systemMetrics = {
    startTime: Date.now(),
    messagesProcessed: 0,
    activeConversations: new Set<string>(),
    responseTimes: [] as number[],
    errors: 0,
    successfulResponses: 0,
    // Métricas del sistema de buffer
    totalQueuedMessages: 0,
    activeQueues: 0,
    maxQueueSize: 0,
    averageQueueSize: 0,
    queueProcessingTimes: [] as number[],
    
    getAverageResponseTime(): number {
        if (this.responseTimes.length === 0) return 0;
        const sum = this.responseTimes.reduce((a, b) => a + b, 0);
        return sum / this.responseTimes.length;
    },
    
    getSuccessRate(): number {
        const total = this.messagesProcessed;
        if (total === 0) return 100;
        return Math.round((this.successfulResponses / total) * 100);
    },
    
    getAverageQueueProcessingTime(): number {
        if (this.queueProcessingTimes.length === 0) return 0;
        const sum = this.queueProcessingTimes.reduce((a, b) => a + b, 0);
        return sum / this.queueProcessingTimes.length;
    },
    
    updateQueueMetrics(queueSize: number, processingTime?: number) {
        this.totalQueuedMessages++;
        this.maxQueueSize = Math.max(this.maxQueueSize, queueSize);
        
        if (processingTime) {
            this.queueProcessingTimes.push(processingTime);
            // Mantener solo las últimas 50 mediciones
            if (this.queueProcessingTimes.length > 50) {
                this.queueProcessingTimes.shift();
            }
        }
    }
};

// Función para mostrar flujo de conversación
export const logConversationFlow = (userId: string, step: string, details: any) => {
    const flowSteps = {
        'received': { emoji: '📱', desc: 'Mensaje Recibido' },
        'queued': { emoji: '📋', desc: 'En Cola' },
        'processing': { emoji: '🤖', desc: 'Procesando con IA' },
        'responding': { emoji: '📤', desc: 'Enviando Respuesta' },
        'completed': { emoji: '✅', desc: 'Completado' },
        'error': { emoji: '❌', desc: 'Error en Proceso' }
    };
    
    const flowInfo = flowSteps[step] || { emoji: '🔄', desc: step };
    
    console.log(`\n${logConfig.colors.info}${flowInfo.emoji} ${flowInfo.desc} - Usuario: ${userId}${logConfig.colors.reset}`);
    
    // Mostrar barra de progreso visual
    const progress = ['received', 'queued', 'processing', 'responding', 'completed'];
    const currentIndex = progress.indexOf(step);
    
    let progressBar = '  ';
    progress.forEach((s, i) => {
        if (i <= currentIndex) {
            progressBar += `${logConfig.colors.success}●${logConfig.colors.reset}`;
        } else {
            progressBar += `${logConfig.colors.info}○${logConfig.colors.reset}`;
        }
        if (i < progress.length - 1) progressBar += '──';
    });
    
    console.log(progressBar);
    
    if (details) {
        if (details.message) {
            console.log(`  💬 Mensaje: "${details.message.substring(0, 50)}..."`);
        }
        if (details.responseTime) {
            console.log(`  ⏱️  Tiempo: ${(details.responseTime/1000).toFixed(1)}s`);
        }
    }
    
    // Emitir evento para dashboard
    dashboardEvents.emit('flow', {
        userId,
        step,
        details
    });
};

// Función para mostrar resumen de métricas
export const showMetricsSummary = () => {
    const uptime = Math.floor((Date.now() - systemMetrics.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESUMEN DE MÉTRICAS DEL SISTEMA');
    console.log('═'.repeat(60));
    
    const metrics = [
        { label: 'Tiempo activo', value: `${hours}h ${minutes}m ${seconds}s` },
        { label: 'Mensajes procesados', value: systemMetrics.messagesProcessed },
        { label: 'Conversaciones activas', value: systemMetrics.activeConversations.size },
        { label: 'Tiempo respuesta promedio', value: `${systemMetrics.getAverageResponseTime().toFixed(2)}s` },
        { label: 'Tasa de éxito', value: `${systemMetrics.getSuccessRate()}%` },
        { label: 'Errores totales', value: systemMetrics.errors }
    ];
    
    metrics.forEach(({ label, value }) => {
        console.log(`${logConfig.colors.metric}▸ ${label}:${logConfig.colors.reset} ${value}`);
    });
    
    // Métricas del sistema de buffer
    if (systemMetrics.totalQueuedMessages > 0) {
        console.log('\n' + '─'.repeat(40));
        console.log('📋 MÉTRICAS DEL SISTEMA DE BUFFER');
        console.log('─'.repeat(40));
        
        const bufferMetrics = [
            { label: 'Mensajes en cola', value: systemMetrics.totalQueuedMessages },
            { label: 'Colas activas', value: systemMetrics.activeQueues },
            { label: 'Tamaño máximo de cola', value: systemMetrics.maxQueueSize },
            { label: 'Tiempo promedio de procesamiento de cola', value: `${systemMetrics.getAverageQueueProcessingTime().toFixed(2)}s` }
        ];
        
        bufferMetrics.forEach(({ label, value }) => {
            console.log(`${logConfig.colors.debug}▸ ${label}:${logConfig.colors.reset} ${value}`);
        });
    }
    
    console.log('═'.repeat(60) + '\n');
};

// Función para logs de interacción usuario-bot
export const logUserInteraction = (
    userId: string,
    userName: string,
    action: 'message_received' | 'response_sent' | 'error',
    content: string,
    responseTime?: number
) => {
    const shortUserId = userId.split('@')[0];
    const timestamp = new Date().toLocaleTimeString('es-CO');
    
    // Actualizar métricas
    if (action === 'message_received') {
        systemMetrics.messagesProcessed++;
        systemMetrics.activeConversations.add(userId);
    } else if (action === 'response_sent' && responseTime) {
        systemMetrics.responseTimes.push(responseTime / 1000);
        systemMetrics.successfulResponses++;
        
        // Mantener solo las últimas 100 mediciones
        if (systemMetrics.responseTimes.length > 100) {
            systemMetrics.responseTimes.shift();
        }
    } else if (action === 'error') {
        systemMetrics.errors++;
    }
    
    // Log visual
    const actionEmojis = {
        'message_received': '📨',
        'response_sent': '📤',
        'error': '❌'
    };
    
    const emoji = actionEmojis[action];
    const color = action === 'error' ? logConfig.colors.error : logConfig.colors.success;
    
    console.log(`\n${color}┌─ ${emoji} INTERACCIÓN [${timestamp}]${logConfig.colors.reset}`);
    console.log(`${color}├─ 👤 Usuario:${logConfig.colors.reset} ${userName} (${shortUserId})`);
    console.log(`${color}├─ 💬 Contenido:${logConfig.colors.reset} "${content.substring(0, 80)}..."`);
    
    if (responseTime) {
        console.log(`${color}├─ ⏱️  Tiempo respuesta:${logConfig.colors.reset} ${(responseTime/1000).toFixed(1)}s`);
    }
    
    console.log(`${color}└─────────────────────────────────────${logConfig.colors.reset}`);
    
    // Emitir evento para dashboard
    dashboardEvents.emit('interaction', {
        userId,
        userName,
        action,
        content,
        responseTime
    });
};

// Integración con el bot existente
export const initializeEnhancedLogging = () => {
    // Mostrar métricas cada 5 minutos
    setInterval(() => {
        showMetricsSummary();
    }, 300000);
    
    // Limpiar conversaciones inactivas cada hora
    setInterval(() => {
        systemMetrics.activeConversations.clear();
    }, 3600000);
    
    enhancedLog('success', 'LOGGING', '✨ Sistema de logging mejorado inicializado');
}; 