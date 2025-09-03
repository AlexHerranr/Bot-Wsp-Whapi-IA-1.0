// src/core/bot-responses.ts
// Versión actualizada del bot usando Responses API sin threads
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
import { ProcessingResult } from '../shared/interfaces';
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
        this.functionRegistry = functionRegistry || container.resolve(FunctionRegistryService);
        
        // NUEVO: Usar OpenAIResponsesService en lugar de OpenAIService
        this.openaiService = new OpenAIResponsesService(
            {
                apiKey: this.config.secrets.OPENAI_API_KEY,
                assistantId: process.env.OPENAI_ASSISTANT_ID || '', // Por compatibilidad
                model: 'gpt-5-mini-2025-08-07', // Hardcoded - el modelo real lo define el prompt
                maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '4096'),
                temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
            }, 
            this.terminalLog, 
            undefined, 
            this.functionRegistry, 
            this.whatsappService, 
            this.databaseService, 
            this.userManager,
            this.mediaService
        );

        // Initialize Thread Persistence Service (aunque ya no se usen threads reales)
        this.threadPersistence = new ThreadPersistenceService(this.databaseService);

        this.bufferManager = new BufferManager(
            this.processBufferCallback.bind(this),
            (userId: string) => this.userManager.getState(userId)
        );
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
        this.hotelValidation = new HotelValidation();

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(express.json({ limit: '50mb' }));
    }

    private setupRoutes() {
        // Health check endpoint with detailed status
        this.app.get('/health', (req, res) => {
            const stats = this.getStats();
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date(),
                version: process.env.npm_package_version || '1.0.0',
                uptime: process.uptime(),
                apiVersion: 'responses', // Indicar que usa Responses API
                ...stats
            });
        });

        // Main webhook endpoint
        this.app.post('/hook', async (req, res) => {
            try {
                // Respond immediately to acknowledge receipt
                res.status(200).json({ 
                    received: true, 
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                });
                
                // Process webhook asynchronously through router
                this.webhookRouter.route(req.body).catch(error => {
                    console.error('Error processing webhook:', error);
                });
            } catch (error) {
                console.error('Error in webhook handler:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Cache clearing endpoint
        this.app.post('/admin/clear-cache', (req, res) => {
            const { userId } = req.body;
            
            if (userId) {
                this.clientDataCache.delete(userId);
                this.bufferManager.clearBuffer(userId);
                res.json({ success: true, message: `Cache cleared for user ${userId}` });
            } else {
                res.status(400).json({ error: 'userId required' });
            }
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ 
                error: 'Not found',
                path: req.path,
                method: req.method
            });
        });
    }

    async start() {
        return new Promise<void>((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host, () => {
                console.log(`✅ Server is running on http://${this.config.host}:${this.config.port}`);
                console.log(`🔄 Using Responses API (no threads)`);
                
                logServerStart('Server started successfully', { port: this.config.port });
                logBotReady('Bot is ready to receive messages', {});
                
                // Setup periodic cleanup
                this.setupCleanupJobs();
                
                resolve();
            });

            this.server.on('error', (error) => {
                console.error('❌ Server failed to start:', error);
                reject(error);
            });
        });
    }

    async stop() {
        console.log('🛑 Shutting down server...');
        
        // Clear all intervals
        this.cleanupIntervals.forEach(interval => clearInterval(interval));
        
        // Close server
        return new Promise<void>((resolve) => {
            this.server.close(() => {
                console.log('✅ Server stopped successfully');
                resolve();
            });
        });
    }

    private setupCleanupJobs() {
        // Cleanup inactive conversations every 6 hours
        const conversationCleanup = setInterval(async () => {
            try {
                await this.openaiService.cleanupInactiveConversations();
                logInfo('CONVERSATION_CLEANUP', 'Limpieza de conversaciones inactivas completada');
            } catch (error) {
                logError('CONVERSATION_CLEANUP_ERROR', 'Error en limpieza de conversaciones', {
                    error: error instanceof Error ? error.message : 'Unknown'
                });
            }
        }, 6 * 60 * 60 * 1000); // 6 horas

        this.cleanupIntervals.push(conversationCleanup);

        // Cache stats logging every 30 minutes
        const cacheStatsInterval = setInterval(() => {
            const stats = this.clientDataCache.getStats();
            logInfo('CACHE_STATS', 'Estadísticas de cache', stats);
            setCacheSize(stats.size);
        }, 30 * 60 * 1000); // 30 minutos

        this.cleanupIntervals.push(cacheStatsInterval);
    }

    private async processBufferCallback(
        userId: string, 
        combinedText: string, 
        chatId: string, 
        userName: string, 
        imageMessage?: { type: 'image', imageUrl: string, caption: string }, 
        duringRunMsgId?: string
    ): Promise<void> {
        try {

            if (!combinedText.trim()) {
                logInfo('BUFFER_SKIP', 'No hay texto para procesar', { userId });
                return;
            }

            logInfo('BUFFER_TO_AI', 'Enviando buffer a OpenAI', {
                userId,
                chatId,
                textLength: combinedText.length
            });

            // Procesar con Responses API
            const result = await this.openaiService.processMessage(
                userId, 
                combinedText, 
                chatId, 
                userName,
                null, // existingThreadId (no usado)
                0,    // existingTokenCount
                imageMessage, // imageMessage si existe
                duringRunMsgId // para citación
            );

            if (!result.success) {
                logError('OPENAI_PROCESS_FAILED', 'Error procesando mensaje con OpenAI', {
                    userId,
                    error: result.error
                });
                throw new Error(result.error || 'Error desconocido en OpenAI');
            }

            logInfo('BUFFER_PROCESSED', 'Buffer procesado exitosamente', {
                userId,
                responseLength: result.response?.length || 0,
                tokensUsed: result.tokensUsed,
                processingTime: result.processingTime
            });

        } catch (error) {
            console.error(`Error processing buffer for ${userId}:`, error);
            
            // Enviar mensaje de error al usuario
            if (chatId) {
                await this.whatsappService.sendWhatsAppMessage(
                    chatId,
                    'Lo siento, hubo un error procesando tu mensaje. Por favor intenta nuevamente.',
                    { lastInputVoice: false }, // Estado básico del usuario
                    false // isQuoteOrPrice
                );
            }
        } finally {
            // Limpiar buffer
            this.bufferManager.clearBuffer(userId);
        }
    }

    private getStats() {
        const cacheStats = this.clientDataCache.getStats();
        const bufferStats = this.bufferManager.getStats();
        
        return {
            cache: cacheStats,
            activeBuffers: bufferStats.active,
            totalBuffers: bufferStats.total,
            memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
                external: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB'
            }
        };
    }
}