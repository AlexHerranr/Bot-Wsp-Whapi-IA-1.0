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
const PORT = process.env.PORT || 8080;  // Cloud Run usa PORT, no PORT ?? 3008
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN ?? '';
const WHAPI_API_URL = process.env.WHAPI_API_URL ?? 'https://gate.whapi.cloud/';

const DEBUG_LOG_PATH = './whatsapp-sync-debug.log';
const DEBUG_MODE = true;

// 🔧 NUEVO: Control de niveles de log para reducir spam
const LOG_LEVEL = process.env.LOG_LEVEL || 'development'; // 'production' | 'development'
const isProduction = LOG_LEVEL === 'production';

// 🚀 NUEVO: Variable de estado de inicialización
let isServerInitialized = false;

// --- Inicialización ---
const app = express();
app.use(express.json());

// 🚀 CRÍTICO: Health Check INMEDIATO para Cloud Run
app.get('/health', (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        port: PORT,
        initialized: isServerInitialized
    };
    
    logInfo('HEALTH_CHECK', 'Cloud Run health check', healthStatus);
    res.status(200).json(healthStatus);
});

// 🚀 CRÍTICO: Endpoint raíz
app.get('/', (req, res) => {
    res.json({
        service: 'TeAlquilamos Bot',
        version: '1.0.0',
        status: isServerInitialized ? 'ready' : 'initializing',
        port: PORT
    });
});

// 🚀 INICIAR SERVIDOR INMEDIATAMENTE
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor HTTP iniciado en puerto ${PORT}`);
    logSuccess('SERVER_START', 'Servidor HTTP iniciado', { port: PORT });
    
    // Inicializar componentes de forma asíncrona
    initializeBot();
});

// 🚀 INICIALIZACIÓN ASÍNCRONA DEL BOT
async function initializeBot() {
    try {
        console.log('⚡ Inicializando componentes del bot...');
        
        // Validación rápida
        if (!ASSISTANT_ID) {
            throw new Error('ASSISTANT_ID no configurado');
        }
        if (!WHAPI_TOKEN) {
            throw new Error('WHAPI_TOKEN no configurado');
        }
        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY no configurado');
        }
        
        // Inicializar OpenAI
        const openai = new OpenAI({ 
            apiKey: OPENAI_API_KEY,
            timeout: 30000,
            maxRetries: 2
        });
        
        // Cargar threads de forma no bloqueante
        setTimeout(() => {
            try {
                const stats = threadPersistence.getStats();
                logSuccess('THREADS_LOADED', `Threads cargados desde archivo`, stats);
            } catch (error) {
                logError('THREADS_LOAD', `Error cargando threads`, { error: error.message });
            }
        }, 1000);
        
        isServerInitialized = true;
        console.log('✅ Bot completamente inicializado');
        logSuccess('BOT_READY', 'Bot completamente inicializado y listo');
        
        // Continuar con el resto de la inicialización...
        setupWebhooks(openai);
        
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        logError('INIT_ERROR', 'Error durante inicialización', { error: error.message });
        // No salir del proceso - mantener el servidor HTTP activo
    }
}

// 🚀 CONFIGURAR WEBHOOKS Y LÓGICA DEL BOT
function setupWebhooks(openai: OpenAI) {
    // Resto del código del bot aquí...
    
    // 🔧 NUEVO: Función para determinar si un log debe mostrarse
    const shouldLog = (level: string, context: string): boolean => {
        // En producción, solo mostrar logs críticos
        if (isProduction) {
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
        
        // En desarrollo, mostrar todo
        return true;
    };

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

    // --- Cache para optimizar extracciones de User ID ---
    const userIdCache = new Map<string, string>();

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

    // ... resto del código continúa igual ...
    
    // --- Webhook de Whapi ---
    app.post('/hook', async (req, res) => {
        // Responder inmediatamente para evitar timeouts
        res.status(200).json({ received: true, timestamp: new Date().toISOString() });
        
        // Procesar de forma asíncrona
        if (!isServerInitialized) {
            logWarning('WEBHOOK_NOT_READY', 'Webhook recibido pero bot no inicializado');
            return;
        }
        
        try {
            const { messages, presences } = req.body;
            
            if (!messages || !Array.isArray(messages)) {
                logWarning('WEBHOOK', 'Webhook recibido sin mensajes válidos', { body: req.body });
                return;
            }
            
            logInfo('WEBHOOK', `Procesando ${messages.length} mensajes del webhook`);
            
            // Procesar mensajes aquí...
            // (resto de la lógica del webhook)
            
        } catch (error) {
            logError('WEBHOOK_ERROR', 'Error procesando webhook', { 
                error: error.message, 
                stack: error.stack
            });
        }
    });
}

// --- Manejo de errores y cierre ---
process.on('unhandledRejection', (reason) => {
    console.log('⚠️  Error no manejado detectado');
    logError('SYSTEM', 'Unhandled Rejection detectado', { 
        reason: reason.toString(),
        timestamp: new Date().toISOString() 
    });
});

process.on('SIGTERM', () => {
    console.log('\n⏹️  Señal SIGTERM recibida, cerrando servidor...');
    logInfo('SHUTDOWN', 'Señal SIGTERM recibida');
    
    server.close(() => {
        console.log('👋 Servidor cerrado correctamente');
        logSuccess('SHUTDOWN', 'Servidor cerrado exitosamente');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n⏹️  Cerrando TeAlquilamos Bot...');
    logInfo('SHUTDOWN', 'Cierre del bot iniciado por SIGINT');
    
    server.close(() => {
        console.log('👋 Bot cerrado correctamente\n');
        logSuccess('SHUTDOWN', 'Bot cerrado exitosamente');
        process.exit(0);
    });
});