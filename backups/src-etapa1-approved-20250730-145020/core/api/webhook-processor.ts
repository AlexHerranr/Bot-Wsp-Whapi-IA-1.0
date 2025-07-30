// src/core/api/webhook-processor.ts
import { BufferManager } from '../state/buffer-manager';
import { MediaManager } from '../state/media-manager';
import { UserManager } from '../state/user-state-manager';
import { MediaService } from '../services/media.service';
import { TerminalLog } from '../utils/terminal-log';
import { WebhookPayloadSchema } from '../../shared/validation';

export class WebhookProcessor {
    private lastTypingLog: Map<string, number> = new Map();
    
    constructor(
        private bufferManager: BufferManager,
        private userManager: UserManager,
        private mediaManager: MediaManager,
        private mediaService: MediaService,
        private terminalLog: TerminalLog
    ) {}

    public async process(payload: unknown): Promise<void> {
        // CRÍTICO: Validar el payload antes de hacer nada
        const validation = WebhookPayloadSchema.safeParse(payload);
        if (!validation.success) {
            this.terminalLog.error(`Webhook inválido: ${validation.error.message}`);
            return;
        }

        const { messages, presences } = validation.data;

        if (presences) {
            this.handlePresenceEvents(presences);
        }

        if (messages) {
            for (const message of messages) {
                await this.handleMessage(message);
            }
        }
    }

    private handlePresenceEvents(presences: any[]): void {
        presences.forEach(presence => {
            const userId = presence.contact_id;
            const status = presence.status.toLowerCase();
            const userState = this.userManager.getOrCreateState(userId);

            if (status === 'typing' || status === 'recording') {
                // Rate limiting para logs de typing: solo cada 5s
                const now = Date.now();
                const lastLog = this.lastTypingLog.get(userId) || 0;
                if (now - lastLog > 5000) {
                    this.terminalLog.typing(userState.userName || 'Usuario');
                    this.lastTypingLog.set(userId, now);
                }
                this.bufferManager.setIntelligentTimer(userId, status as 'typing' | 'recording');
            }
        });
    }

    private async handleMessage(message: any): Promise<void> {
        // Ignorar mensajes enviados por el bot para evitar loops
        if (message.from_me || this.mediaManager.isBotSentMessage(message.id)) {
            return;
        }

        const userId = message.from;
        const chatId = message.chat_id || message.from; // Fallback si no hay chat_id
        const userName = message.from_name || 'Usuario';

        // Actualizar estado del usuario
        this.userManager.updateState(userId, { userName, chatId });

        try {
            switch (message.type) {
                case 'text':
                    if (message.text && message.text.body) {
                        this.terminalLog.message(userName, message.text.body);
                        this.bufferManager.addMessage(userId, message.text.body, chatId, userName);
                    }
                    break;

                case 'voice':
                case 'audio':
                case 'ptt':
                    this.terminalLog.voice(userName);
                    // Configurar timer de 8s para voice
                    this.bufferManager.setIntelligentTimer(userId, 'voice');
                    const audioLink = message.voice?.link || message.audio?.link;
                    if (audioLink) {
                        const transcription = await this.mediaService.transcribeAudio(audioLink, userId, userName, message.id);
                        this.terminalLog.message(userName, `(Audio): ${transcription}`);
                        this.bufferManager.addMessage(userId, transcription, chatId, userName);
                    }
                    break;

                case 'image':
                    this.terminalLog.image(userName);
                    if (message.image && message.image.link) {
                        this.mediaManager.addPendingImage(userId, message.image.link);
                        // Añadimos un placeholder al buffer para que se procese
                        this.bufferManager.addMessage(userId, '📷 Imagen recibida', chatId, userName);
                    }
                    break;
            }
        } catch (error: any) {
            this.terminalLog.error(`Error procesando mensaje de ${userName}: ${error.message}`);
        }
    }
}