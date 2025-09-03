// src/core/processors/base/BaseWebhookProcessor.ts
import { BufferManager } from '../../state/buffer-manager';
import { MediaManager } from '../../state/media-manager';
import { UserManager } from '../../state/user-state-manager';
import { MediaService } from '../../services/media.service';
import { DatabaseService } from '../../services/database.service';
import { DelayedActivityService } from '../../services/delayed-activity.service';
import { IOpenAIService } from '../../../shared/interfaces';
import { TerminalLog } from '../../utils/terminal-log';
import { ClientDataCache } from '../../state/client-data-cache';
import { IWebhookProcessor, ProcessorConfig } from './IWebhookProcessor.interface';

export abstract class BaseWebhookProcessor implements IWebhookProcessor {
    
    constructor(
        protected bufferManager: BufferManager,
        protected userManager: UserManager,
        protected mediaManager: MediaManager,
        protected mediaService: MediaService,
        protected databaseService: DatabaseService,
        protected delayedActivityService: DelayedActivityService,
        protected openaiService: IOpenAIService,
        protected terminalLog: TerminalLog,
        protected clientCache: ClientDataCache
    ) {}

    abstract canHandle(payload: any): boolean;
    abstract process(payload: any): Promise<void>;
    abstract getProcessorName(): string;
    abstract getConfig(): ProcessorConfig;

    /**
     * Método helper para validar que el payload es un grupo específico
     */
    protected isSpecificGroup(payload: any, targetChatId: string): boolean {
        if (!payload || !targetChatId) return false;
        
        const { messages } = payload;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return false;
        }

        // Verificar si algún mensaje viene del grupo específico
        return messages.some(message => {
            const chatId = message.chat_id || message.from;
            return chatId === targetChatId;
        });
    }

    /**
     * Método helper para extraer información básica del webhook
     */
    protected extractWebhookInfo(payload: any): {
        hasMessages: boolean;
        hasPresences: boolean;
        messageCount: number;
        presenceCount: number;
        firstMessageType?: string;
        firstMessageChatId?: string;
    } {
        return {
            hasMessages: !!(payload.messages && Array.isArray(payload.messages)),
            hasPresences: !!(payload.presences && Array.isArray(payload.presences)),
            messageCount: payload.messages?.length || 0,
            presenceCount: payload.presences?.length || 0,
            firstMessageType: payload.messages?.[0]?.type,
            firstMessageChatId: payload.messages?.[0]?.chat_id || payload.messages?.[0]?.from
        };
    }
}