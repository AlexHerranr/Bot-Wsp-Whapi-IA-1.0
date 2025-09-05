"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreBot = void 0;
// src/core/bot.ts
// Bot principal con OpenAI Responses API
require("reflect-metadata");
const express_1 = require("express");
const http_1 = require("http");
const openai_1 = require("openai");
const tsyringe_1 = require("tsyringe");
// Importar todos nuestros módulos y servicios
const buffer_manager_1 = require("./state/buffer-manager");
const user_state_manager_1 = require("./state/user-state-manager");
const media_manager_1 = require("./state/media-manager");
const client_data_cache_1 = require("./state/client-data-cache");
const media_service_1 = require("./services/media.service");
const whatsapp_service_1 = require("./services/whatsapp.service");
const database_service_1 = require("./services/database.service");
const delayed_activity_service_1 = require("./services/delayed-activity.service");
const function_registry_service_1 = require("./services/function-registry.service");
const openai_responses_service_1 = require("./services/openai-responses.service"); // NUEVO
const WebhookRouter_1 = require("./processors/WebhookRouter");
const terminal_log_1 = require("./utils/terminal-log");
const logging_1 = require("../utils/logging");
const collectors_1 = require("../utils/logging/collectors");
const validation_1 = require("../plugins/hotel/logic/validation");
let CoreBot = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var CoreBot = _classThis = class {
        constructor(config, functionRegistry) {
            this.cleanupIntervals = [];
            this.lastError = {};
            this.config = config;
            this.app = (0, express_1.default)();
            this.server = http_1.default.createServer(this.app);
            this.openai = new openai_1.default({ apiKey: this.config.secrets.OPENAI_API_KEY });
            // Inicializar todos los módulos
            this.terminalLog = new terminal_log_1.TerminalLog({
                addLog: (log) => console.log(log)
            }, {
                port: config.port,
                host: config.host,
                showFunctionLogs: true
            });
            this.userManager = new user_state_manager_1.UserManager();
            this.mediaManager = new media_manager_1.MediaManager();
            this.clientDataCache = new client_data_cache_1.ClientDataCache();
            this.databaseService = new database_service_1.DatabaseService();
            this.delayedActivityService = new delayed_activity_service_1.DelayedActivityService(this.databaseService);
            // Inyectar cache en database service para actualizaciones BD->Cache
            this.databaseService.setClientCache(this.clientDataCache);
            console.info('Cache unificado inyectado en DB service - MemoryStore eliminado');
            this.mediaService = new media_service_1.MediaService(this.terminalLog, {
                openaiApiKey: this.config.secrets.OPENAI_API_KEY,
                whapiApiUrl: this.config.secrets.WHAPI_API_URL,
                whapiToken: this.config.secrets.WHAPI_TOKEN
            });
            this.whatsappService = new whatsapp_service_1.WhatsappService(this.openai, this.terminalLog, this.config, this.databaseService, this.mediaManager);
            // Function registry passed from main.ts (with plugins already registered)
            this.functionRegistry = functionRegistry || tsyringe_1.container.resolve(function_registry_service_1.FunctionRegistryService);
            // NUEVO: Usar OpenAIResponsesService en lugar de OpenAIService
            this.openaiService = new openai_responses_service_1.OpenAIResponsesService({
                apiKey: this.config.secrets.OPENAI_API_KEY,
                assistantId: process.env.OPENAI_ASSISTANT_ID || '', // Por compatibilidad
                model: 'gpt-5-mini-2025-08-07', // Hardcoded - el modelo real lo define el prompt
                maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '4096'),
                temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
            }, this.terminalLog, undefined, this.functionRegistry, this.whatsappService, this.databaseService, this.userManager, this.mediaService);
            this.bufferManager = new buffer_manager_1.BufferManager(this.processBufferCallback.bind(this), (userId) => this.userManager.getState(userId));
            this.webhookRouter = new WebhookRouter_1.WebhookRouter(this.bufferManager, this.userManager, this.mediaManager, this.mediaService, this.databaseService, this.delayedActivityService, this.openaiService, this.terminalLog, this.clientDataCache);
            this.hotelValidation = new validation_1.HotelValidation();
            this.setupMiddleware();
            this.setupRoutes();
        }
        setupMiddleware() {
            this.app.use(express_1.default.json({ limit: '50mb' }));
        }
        setupRoutes() {
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
                }
                catch (error) {
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
                }
                else {
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
            return new Promise((resolve, reject) => {
                this.server.listen(this.config.port, this.config.host, () => {
                    console.log(`✅ Server is running on http://${this.config.host}:${this.config.port}`);
                    console.log(`🔄 Using Responses API (no threads)`);
                    (0, logging_1.logServerStart)('Server started successfully', { port: this.config.port });
                    (0, logging_1.logBotReady)('Bot is ready to receive messages', {});
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
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('✅ Server stopped successfully');
                    resolve();
                });
            });
        }
        setupCleanupJobs() {
            // Cleanup inactive conversations every 6 hours
            const conversationCleanup = setInterval(async () => {
                try {
                    await this.openaiService.cleanupInactiveConversations();
                    (0, logging_1.logInfo)('CONVERSATION_CLEANUP', 'Limpieza de conversaciones inactivas completada');
                }
                catch (error) {
                    (0, logging_1.logError)('CONVERSATION_CLEANUP_ERROR', 'Error en limpieza de conversaciones', {
                        error: error instanceof Error ? error.message : 'Unknown'
                    });
                }
            }, 6 * 60 * 60 * 1000); // 6 horas
            this.cleanupIntervals.push(conversationCleanup);
            // Cache stats logging every 30 minutes
            const cacheStatsInterval = setInterval(() => {
                const stats = this.clientDataCache.getStats();
                (0, logging_1.logInfo)('CACHE_STATS', 'Estadísticas de cache', stats);
                (0, collectors_1.setCacheSize)(stats.size);
            }, 30 * 60 * 1000); // 30 minutos
            this.cleanupIntervals.push(cacheStatsInterval);
        }
        async processBufferCallback(userId, combinedText, chatId, userName, imageMessage, duringRunMsgId) {
            try {
                if (!combinedText.trim()) {
                    (0, logging_1.logInfo)('BUFFER_SKIP', 'No hay texto para procesar', { userId });
                    return;
                }
                (0, logging_1.logInfo)('BUFFER_TO_AI', 'Enviando buffer a OpenAI', {
                    userId,
                    chatId,
                    textLength: combinedText.length
                });
                // Procesar con Responses API
                // NOTA: processMessage envía directamente la respuesta a WhatsApp
                await this.openaiService.processMessage(userId, combinedText, chatId, userName, null, // existingThreadId (no usado)
                0, // existingTokenCount
                imageMessage, // imageMessage si existe
                duringRunMsgId // para citación
                );
                (0, logging_1.logInfo)('BUFFER_PROCESSED', 'Buffer procesado exitosamente', {
                    userId,
                    chatId
                });
            }
            catch (error) {
                console.error(`Error processing buffer for ${userId}:`, error);
                // Enviar mensaje de error al usuario
                if (chatId) {
                    await this.whatsappService.sendWhatsAppMessage(chatId, 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta nuevamente.', { lastInputVoice: false }, // Estado básico del usuario
                    false // isQuoteOrPrice
                    );
                }
            }
            finally {
                // Limpiar buffer
                this.bufferManager.clearBuffer(userId);
            }
        }
        getStats() {
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
    };
    __setFunctionName(_classThis, "CoreBot");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CoreBot = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CoreBot = _classThis;
})();
exports.CoreBot = CoreBot;
