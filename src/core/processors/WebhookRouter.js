"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookRouter = void 0;
const MainWebhookProcessor_1 = require("./MainWebhookProcessor");
const OperationsWebhookProcessor_1 = require("./OperationsWebhookProcessor");
const logging_1 = require("../../utils/logging");
class WebhookRouter {
    constructor(bufferManager, userManager, mediaManager, mediaService, databaseService, delayedActivityService, openaiService, terminalLog, clientCache) {
        // Inicializar todos los processors con las dependencias compartidas
        this.processors = [
            new OperationsWebhookProcessor_1.OperationsWebhookProcessor(bufferManager, userManager, mediaManager, mediaService, databaseService, delayedActivityService, openaiService, terminalLog, clientCache),
            new MainWebhookProcessor_1.MainWebhookProcessor(bufferManager, userManager, mediaManager, mediaService, databaseService, delayedActivityService, openaiService, terminalLog, clientCache)
        ];
        // Log de inicialización
        (0, logging_1.logInfo)('WEBHOOK_ROUTER_INIT', 'WebhookRouter inicializado', {
            processors: this.processors.map(p => ({
                name: p.getProcessorName(),
                config: p.getConfig()
            }))
        }, 'webhook-router.ts');
    }
    /**
     * Enruta el webhook al processor apropiado
     */
    async route(payload) {
        try {
            // Buscar el primer processor que pueda manejar este payload
            const processor = this.processors.find(p => p.canHandle(payload));
            if (!processor) {
                (0, logging_1.logWarning)('WEBHOOK_ROUTER_NO_PROCESSOR', 'No se encontró processor para el webhook', {
                    payload_keys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 10) : [],
                    processors_checked: this.processors.map(p => p.getProcessorName())
                }, 'webhook-router.ts');
                return;
            }
            // Log del processor seleccionado
            (0, logging_1.logInfo)('WEBHOOK_ROUTER_ROUTE', 'Webhook enrutado', {
                processor: processor.getProcessorName(),
                processor_config: processor.getConfig()
            }, 'webhook-router.ts');
            // Procesar con el processor seleccionado
            await processor.process(payload);
        }
        catch (error) {
            (0, logging_1.logError)('WEBHOOK_ROUTER_ERROR', 'Error en el router de webhooks', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                payload_sample: payload && typeof payload === 'object' ?
                    JSON.stringify(payload).substring(0, 300) + '...' : String(payload)
            }, 'webhook-router.ts');
            // Re-lanzar el error para que sea manejado por el nivel superior
            throw error;
        }
    }
    /**
     * Obtiene información de todos los processors registrados
     */
    getProcessorsInfo() {
        return this.processors.map(processor => ({
            name: processor.getProcessorName(),
            config: processor.getConfig()
        }));
    }
    /**
     * Método de diagnóstico para verificar que processor manejaría un payload
     */
    diagnosePayload(payload) {
        const results = this.processors.map(processor => ({
            name: processor.getProcessorName(),
            canHandle: processor.canHandle(payload)
        }));
        const selectedProcessor = this.processors.find(p => p.canHandle(payload));
        return {
            processor: selectedProcessor?.getProcessorName(),
            canHandle: !!selectedProcessor,
            allProcessors: results
        };
    }
}
exports.WebhookRouter = WebhookRouter;
