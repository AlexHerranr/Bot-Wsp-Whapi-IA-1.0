// src/core/bot-responses.ts
// Versión del bot actualizada para usar Responses API

import 'reflect-metadata';
import express from 'express';
import http from 'http';
import OpenAI from 'openai';
import { injectable, container } from 'tsyringe';

// Importar todos nuestros módulos y servicios
import { BufferManager } from './state/buffer-manager';
import { UserManager } from './state/user-state-manager';
import { MediaManager } from './state/media-manager';
import { ClientDataCache } from './state/client-data-cache';
import { MediaService } from './services/media.service';
import { WhatsappService } from './services/whatsapp.service';
import { DatabaseService } from './services/database.service';
import { DelayedActivityService } from './services/delayed-activity.service';
import { FunctionRegistryService } from './services/function-registry.service';
import { OpenAIResponsesService } from './services/openai-responses.service'; // NUEVO
import { ThreadPersistenceService } from './services/thread-persistence.service';
import { WebhookRouter } from './processors/WebhookRouter';
import { TerminalLog } from './utils/terminal-log';
import { IFunctionRegistry } from '../shared/interfaces';
import { logBotReady, logServerStart, logInfo, logSuccess, logError, logWarning } from '../utils/logging';
import { trackCache, setCacheSize } from '../utils/logging/collectors';
import { HotelValidation } from '../plugins/hotel/logic/validation';

// Simulación de la configuración
interface AppConfig {
    port: number;
    host: string;
    secrets: {
        OPENAI_API_KEY: string;
        WHAPI_API_URL: string;
        WHAPI_TOKEN: string;
    }
}

@injectable()
export class CoreBotResponses {
    private app: express.Application;
    private server: http.Server;
    private config: AppConfig;
    private openai: OpenAI;

    // Módulos
    private terminalLog: TerminalLog;
    private userManager: UserManager;
    private mediaManager: MediaManager;
    private bufferManager: BufferManager;
    private clientDataCache: ClientDataCache;
    private databaseService: DatabaseService;
    private delayedActivityService: DelayedActivityService;
    private mediaService: MediaService;
    private whatsappService: WhatsappService;
    private openaiService: OpenAIResponsesService; // ACTUALIZADO
    private threadPersistence: ThreadPersistenceService;
    private webhookRouter: WebhookRouter;
    private functionRegistry: IFunctionRegistry;
    private cleanupIntervals: NodeJS.Timeout[] = [];
    private lastError: Record<string, { time: number }> = {};
    private hotelValidation: HotelValidation;

    constructor(
        config: AppConfig,
        functionRegistry?: IFunctionRegistry
    ) {
        this.config = config;
        this.app = express();
        this.server = http.createServer(this.app);

        this.openai = new OpenAI({ apiKey: this.config.secrets.OPENAI_API_KEY });

        // Inicializar todos los módulos
        this.terminalLog = new TerminalLog({ 
            addLog: (log: string) => console.log(log) 
        }, { 
            port: config.port, 
            host: config.host,
            showFunctionLogs: true 
        });
        this.userManager = new UserManager();
        this.mediaManager = new MediaManager();
        this.clientDataCache = new ClientDataCache();
        this.databaseService = new DatabaseService();
        this.delayedActivityService = new DelayedActivityService(this.databaseService);

        // Inyectar cache en database service para actualizaciones BD->Cache
        this.databaseService.setClientCache(this.clientDataCache);
        console.info('Cache unificado inyectado en DB service - MemoryStore eliminado');

        this.mediaService = new MediaService(this.terminalLog, {
            openaiApiKey: this.config.secrets.OPENAI_API_KEY,
            whapiApiUrl: this.config.secrets.WHAPI_API_URL,
            whapiToken: this.config.secrets.WHAPI_TOKEN
        });
        this.whatsappService = new WhatsappService(this.openai, this.terminalLog, this.config, this.databaseService, this.mediaManager);
        
        // Function registry passed from main.ts (with plugins already registered)
        this.functionRegistry = functionRegistry || new FunctionRegistryService();
        
        // NUEVO: Usar OpenAIResponsesService en lugar de OpenAIService
        this.openaiService = new OpenAIResponsesService(
            {
                apiKey: this.config.secrets.OPENAI_API_KEY,
                assistantId: process.env.OPENAI_ASSISTANT_ID || '', // Por compatibilidad
                model: process.env.OPENAI_MODEL || 'gpt-4o',
                maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '4096'),
                temperature: parseFloat(process.env.TEMPERATURE || '0.7')
            },
            this.terminalLog,
            undefined, // CacheManager ya no es necesario
            this.functionRegistry,
            this.whatsappService,
            this.databaseService,
            this.userManager
        );
        
        // Cargar instrucciones del sistema si están disponibles
        if (process.env.SYSTEM_INSTRUCTIONS) {
            this.openaiService.updateSystemInstructions(process.env.SYSTEM_INSTRUCTIONS);
        }

        this.threadPersistence = new ThreadPersistenceService(
            this.openaiService,
            this.databaseService,
            this.delayedActivityService,
            this.userManager,
            this.clientDataCache
        );
        this.bufferManager = new BufferManager(
            this.userManager, 
            this.threadPersistence,
            this.clientDataCache
        );

        // Crear instancia del Router
        this.webhookRouter = new WebhookRouter(
            this.bufferManager,
            this.userManager,
            this.mediaManager,
            this.mediaService,
            this.databaseService,
            this.delayedActivityService,
            this.openaiService,
            this.terminalLog,
            this.clientDataCache
        );
        
        // Validation
        this.hotelValidation = new HotelValidation();

        // Register container dependencies
        container.register('DatabaseService', { useValue: this.databaseService });
        container.register('HotelValidation', { useValue: this.hotelValidation });

        this.setupRoutes();
        this.setupCacheMetrics();
        this.setupCleanupJobs();
    }

    private setupRoutes(): void {
        this.app.use(express.json());

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                version: 'responses-api-v1' // NUEVO: Indicar versión
            });
        });

        // Webhook endpoint
        this.app.post('/webhook', async (req, res) => {
            try {
                // Responder inmediatamente a WhatsApp
                res.status(200).send('OK');
                
                // Procesar webhook asíncronamente
                await this.webhookRouter.handleWebhook(req.body);
            } catch (error) {
                this.handleError(error, 'webhook');
            }
        });

        // Stats endpoint
        this.app.get('/stats', (req, res) => {
            res.json({
                users: this.userManager.getActiveUserCount(),
                cache: this.clientDataCache.getStats(),
                buffers: this.bufferManager.getStats(),
                functions: this.functionRegistry.list(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: 'responses-api-v1'
            });
        });
    }

    private setupCacheMetrics(): void {
        // Actualizar métricas cada 5 segundos
        const metricsInterval = setInterval(() => {
            const stats = this.clientDataCache.getStats();
            setCacheSize(stats.size);
        }, 5000);
        
        this.cleanupIntervals.push(metricsInterval);
    }

    private setupCleanupJobs(): void {
        // Limpiar conversaciones inactivas cada hora
        const conversationCleanupInterval = setInterval(async () => {
            try {
                await this.openaiService.cleanupInactiveConversations();
                logInfo('CLEANUP_SUCCESS', 'Conversaciones inactivas limpiadas');
            } catch (error) {
                logError('CLEANUP_ERROR', 'Error limpiando conversaciones', {
                    error: error instanceof Error ? error.message : 'Unknown'
                });
            }
        }, 60 * 60 * 1000); // Cada hora
        
        this.cleanupIntervals.push(conversationCleanupInterval);
        
        // Mantener los otros trabajos de limpieza existentes
        const bufferCleanupInterval = setInterval(() => {
            const stats = this.bufferManager.cleanupInactiveBuffers();
            if (stats.removed > 0) {
                logInfo('BUFFER_CLEANUP', 'Buffers inactivos limpiados', stats);
            }
        }, 60000); // Cada minuto
        
        this.cleanupIntervals.push(bufferCleanupInterval);
    }

    private handleError(error: unknown, context: string): void {
        const now = Date.now();
        const errorKey = `${context}:${error instanceof Error ? error.message : 'unknown'}`;
        
        // Evitar spam de logs para el mismo error
        if (!this.lastError[errorKey] || now - this.lastError[errorKey].time > 60000) {
            logError('BOT_ERROR', `Error en ${context}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            this.lastError[errorKey] = { time: now };
        }
    }

    async start(): Promise<void> {
        try {
            // Conectar a la base de datos
            await this.databaseService.connect();
            logSuccess('DATABASE_CONNECTED', 'Base de datos conectada');

            // Iniciar servidor
            return new Promise((resolve) => {
                this.server.listen(this.config.port, this.config.host, () => {
                    logServerStart({
                        port: this.config.port,
                        host: this.config.host,
                        environment: process.env.NODE_ENV || 'development',
                        apiVersion: 'responses-api-v1'
                    });
                    
                    logBotReady({
                        functionsLoaded: this.functionRegistry.list().length,
                        cacheEnabled: true,
                        databaseConnected: this.databaseService.connected
                    });
                    
                    resolve();
                });
            });
        } catch (error) {
            logError('STARTUP_ERROR', 'Error iniciando el bot', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    async stop(): Promise<void> {
        // Limpiar intervalos
        for (const interval of this.cleanupIntervals) {
            clearInterval(interval);
        }
        
        // Cerrar conexiones
        await this.databaseService.disconnect();
        
        // Cerrar servidor
        return new Promise((resolve) => {
            this.server.close(() => {
                logInfo('BOT_STOPPED', 'Bot detenido correctamente');
                resolve();
            });
        });
    }
}