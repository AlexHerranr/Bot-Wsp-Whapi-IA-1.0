// src/core/bot.ts
import express from 'express';
import http from 'http';
import OpenAI from 'openai';

// Importar todos nuestros módulos y servicios
import { BufferManager } from './state/buffer-manager';
import { UserManager } from './state/user-state-manager';
import { MediaManager } from './state/media-manager';
import { MediaService } from './services/media.service';
import { WhatsappService } from './services/whatsapp.service';
import { DatabaseService } from './services/database.service';
import { WebhookProcessor } from './api/webhook-processor';
import { TerminalLog } from './utils/terminal-log';
import { HotelPlugin } from '../plugins/hotel/hotel.plugin';

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

export class CoreBot {
    private app: express.Application;
    private server: http.Server;
    private config: AppConfig;
    private openai: OpenAI;

    // Módulos
    private terminalLog: TerminalLog;
    private userManager: UserManager;
    private mediaManager: MediaManager;
    private bufferManager: BufferManager;
    private databaseService: DatabaseService;
    private mediaService: MediaService;
    private whatsappService: WhatsappService;
    private webhookProcessor: WebhookProcessor;
    private hotelPlugin: HotelPlugin;

    constructor(config: AppConfig) {
        this.config = config;
        this.app = express();
        this.server = http.createServer(this.app);

        this.openai = new OpenAI({ apiKey: this.config.secrets.OPENAI_API_KEY });

        // Inicializar todos los módulos
        // @ts-ignore
        this.terminalLog = new TerminalLog({ addLog: () => {} }, { port: config.port, host: config.host });
        this.userManager = new UserManager();
        this.mediaManager = new MediaManager();
        this.databaseService = new DatabaseService();

        this.mediaService = new MediaService(this.openai, this.terminalLog, this.config);
        this.whatsappService = new WhatsappService(this.openai, this.terminalLog, this.config);

        this.hotelPlugin = new HotelPlugin();

        this.bufferManager = new BufferManager(this.processBufferCallback.bind(this));
        this.webhookProcessor = new WebhookProcessor(this.bufferManager, this.userManager, this.mediaManager, this.mediaService, this.terminalLog);

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(express.json({ limit: '50mb' }));
    }

    private setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'healthy', timestamp: new Date() });
        });

        this.app.post('/hook', async (req, res) => {
            res.status(200).json({ received: true });
            await this.webhookProcessor.process(req.body);
        });
    }

    private async processBufferCallback(userId: string, combinedText: string, chatId: string, userName: string): Promise<void> {
        this.terminalLog.message(userName, `Procesando buffer: "${combinedText.substring(0, 50)}..."`);

        try {
            // 1. Crear o actualizar usuario en la base de datos
            const user = await this.databaseService.getOrCreateUser(userId, userName);
            await this.userManager.getOrCreateUser(userId, userName);
            
            // 2. Obtener o crear thread
            let thread = await this.databaseService.getThread(userId);
            if (!thread) {
                // Crear un nuevo thread (simulando OpenAI thread ID)
                const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                thread = await this.databaseService.saveOrUpdateThread(userId, {
                    threadId: newThreadId,
                    chatId,
                    userName,
                    labels: []
                });
                this.terminalLog.message(userName, `Nuevo thread creado: ${newThreadId}`);
            }

            // 3. Guardar mensaje del usuario en la base de datos
            await this.databaseService.saveMessage(thread.threadId, 'user', combinedText);

            // 4. Procesar con OpenAI (simulado por ahora)
            const response = `✅ Respuesta de TeAlquilamos para "${combinedText.substring(0, 30)}..." - Datos guardados en BD`;

            // 5. Guardar respuesta del asistente en la base de datos
            await this.databaseService.saveMessage(thread.threadId, 'assistant', response);

            // 6. Enviar respuesta por WhatsApp
            const userState = this.userManager.getOrCreateState(userId);
            const isQuote = this.hotelPlugin.validation.isQuoteOrPriceMessage(response);

            await this.whatsappService.sendWhatsAppMessage(chatId, response, userState, isQuote);
            this.mediaManager.addBotSentMessage(`msg_${Date.now()}`);

            this.terminalLog.response(userName, response, 1000); // Simular 1s de duración

        } catch (error: any) {
            this.terminalLog.error(`Error en el callback del buffer para ${userName}: ${error.message}`);
        }
    }

    public async start() {
        await this.databaseService.connect();
        this.server.listen(this.config.port, this.config.host, () => {
            this.terminalLog.startup();
        });
    }
}