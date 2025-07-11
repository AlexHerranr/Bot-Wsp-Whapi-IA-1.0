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
const MESSAGE_BUFFER_TIMEOUT = process.env.DISABLE_MESSAGE_BUFFER === 'true' ? 0 : 2000; // Reducido a 2 segundos
const MANUAL_MESSAGE_TIMEOUT = process.env.DISABLE_MESSAGE_BUFFER === 'true' ? 0 : 8000;
const MAX_BUFFER_SIZE = 10; // 🚨 Límite máximo de mensajes por buffer (anti-spam)
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

    app.post('/hook', async (req: Request, res: Response) => {
        res.status(200).json({ received: true });

        // ... lógica del webhook
    });
}

async function initializeBot() {
    // ... lógica de inicialización
    isServerInitialized = true;
    console.log('✅ Bot completamente inicializado');
}

// --- Ejecución ---
main();

// Exportar para testing 