// src/core/processors/WebhookRouter.ts
import { IWebhookProcessor } from './base/IWebhookProcessor.interface';
import { MainWebhookProcessor } from './MainWebhookProcessor';
import { OperationsWebhookProcessor } from './OperationsWebhookProcessor';
import { BufferManager } from '../state/buffer-manager';
import { MediaManager } from '../state/media-manager';
import { UserManager } from '../state/user-state-manager';
import { MediaService } from '../services/media.service';
import { DatabaseService } from '../services/database.service';
import { DelayedActivityService } from '../services/delayed-activity.service';
import { IOpenAIService } from '../../shared/interfaces';
import { TerminalLog } from '../utils/terminal-log';
import { ClientDataCache } from '../state/client-data-cache';
import { logInfo, logError, logWarning } from '../../utils/logging';

export class WebhookRouter {
    private processors: IWebhookProcessor[];

    constructor(
        bufferManager: BufferManager,
        userManager: UserManager,
        mediaManager: MediaManager,
        mediaService: MediaService,
        databaseService: DatabaseService,
        delayedActivityService: DelayedActivityService,
        openaiService: IOpenAIService,
        terminalLog: TerminalLog,
        clientCache: ClientDataCache
    ) {
        // Inicializar todos los processors con las dependencias compartidas
        this.processors = [
            new OperationsWebhookProcessor(
                bufferManager,
                userManager,
                mediaManager,
                mediaService,
                databaseService,
                delayedActivityService,
                openaiService,
                terminalLog,
                clientCache
            ),
            new MainWebhookProcessor(
                bufferManager,
                userManager,
                mediaManager,
                mediaService,
                databaseService,
                delayedActivityService,
                openaiService,
                terminalLog,
                clientCache
            )
        ];

        // Log de inicialización
        logInfo('WEBHOOK_ROUTER_INIT', 'WebhookRouter inicializado', {
            processors: this.processors.map(p => ({
                name: p.getProcessorName(),
                config: p.getConfig()
            }))
        }, 'webhook-router.ts');
    }

    /**
     * Enruta el webhook al processor apropiado
     */
    public async route(payload: unknown): Promise<void> {
        try {
            // Buscar el primer processor que pueda manejar este payload
            const processor = this.processors.find(p => p.canHandle(payload));

            if (!processor) {
                logWarning('WEBHOOK_ROUTER_NO_PROCESSOR', 'No se encontró processor para el webhook', {
                    payload_keys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 10) : [],
                    processors_checked: this.processors.map(p => p.getProcessorName())
                }, 'webhook-router.ts');
                return;
            }

            // Log del processor seleccionado
            logInfo('WEBHOOK_ROUTER_ROUTE', 'Webhook enrutado', {
                processor: processor.getProcessorName(),
                processor_config: processor.getConfig()
            }, 'webhook-router.ts');

            // Procesar con el processor seleccionado
            await processor.process(payload);

        } catch (error) {
            logError('WEBHOOK_ROUTER_ERROR', 'Error en el router de webhooks', {
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
    public getProcessorsInfo(): Array<{
        name: string;
        config: any;
        canHandleExample?: boolean;
    }> {
        return this.processors.map(processor => ({
            name: processor.getProcessorName(),
            config: processor.getConfig()
        }));
    }

    /**
     * Método de diagnóstico para verificar que processor manejaría un payload
     */
    public diagnosePayload(payload: unknown): {
        processor?: string;
        canHandle: boolean;
        allProcessors: Array<{
            name: string;
            canHandle: boolean;
        }>;
    } {
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