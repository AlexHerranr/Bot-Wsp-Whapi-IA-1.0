import axios from 'axios';
import { EventEmitter } from 'events';
import { logInfo, logError, logSuccess } from '../utils/logging/index.js';

export interface WhapiMessage {
    id: string;
    from: string;
    chat_id: string;
    from_name?: string;
    text?: {
        body: string;
    };
    type: string;
    from_me: boolean;
}

export interface ParsedMessage {
    from: string;
    name: string;
    body: string;
    message_id: string;
}

export class WhapiProvider extends EventEmitter {
    private apiUrl: string;
    private token: string;
    
    constructor() {
        super();
        this.apiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
        this.token = process.env.WHAPI_TOKEN || '';
        
        if (!this.token) {
            throw new Error('WHAPI_TOKEN no está definido en las variables de entorno');
        }
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    async setupWebhook(webhookUrl: string): Promise<void> {
        logInfo('WHAPI_WEBHOOK', `Configurando Webhook con URL: ${webhookUrl}`);
        
        try {
            const response = await axios.patch(`${this.apiUrl}/settings`, {
                webhooks: [{ 
                    url: webhookUrl, 
                    events: [
                        { type: "message", method: "post" },
                        { type: "presences", method: "post" }
                    ], 
                    mode: "method" 
                }]
            }, { headers: this.getHeaders() });
            
            logSuccess('WHAPI_WEBHOOK', 'Webhook configurado exitosamente', {
                url: webhookUrl,
                events: ['message', 'presences']
            });
        } catch (error: any) {
            const errorMsg = error.response?.data || error.message;
            logError('WHAPI_WEBHOOK', 'Error al configurar webhook', { 
                error: errorMsg,
                url: webhookUrl 
            });
            throw error;
        }
    }

    parseMessage(msg: WhapiMessage): ParsedMessage | null {
        if (msg.from_me) return null;
        
        return {
            from: msg.chat_id,
            name: msg.from_name || msg.chat_id.replace(/@s\.whatsapp\.net$/, ''),
            body: msg.text?.body || '',
            message_id: msg.id,
        };
    }

    async sendMessage(to: string, message: string): Promise<any> {
        try {
            const cleanTo = to.replace(/@s\.whatsapp\.net$/, '');
            
            const response = await axios.post(`${this.apiUrl}/messages/text`, {
                to: cleanTo,
                body: message
            }, { headers: this.getHeaders() });
            
            logSuccess('WHAPI_SEND', 'Mensaje enviado exitosamente', {
                to: cleanTo,
                messageLength: message.length
            });
            
            return response.data;
        } catch (error: any) {
            logError('WHAPI_SEND', 'Error enviando mensaje', {
                to: to,
                error: error.response?.data || error.message
            });
            throw error;
        }
    }

    async sendPresenceUpdate(to: string, type: 'composing' | 'paused'): Promise<void> {
        try {
            const cleanTo = to.replace(/@s\.whatsapp\.net$/, '');
            
            await axios.post(`${this.apiUrl}/messages/presence`, {
                to: cleanTo,
                type: type
            }, { headers: this.getHeaders() });
            
            logInfo('WHAPI_PRESENCE', `Presencia ${type} enviada`, { to: cleanTo });
        } catch (error: any) {
            logError('WHAPI_PRESENCE', 'Error enviando presencia', {
                to: to,
                type: type,
                error: error.response?.data || error.message
            });
        }
    }

    async getAccountInfo(): Promise<any> {
        try {
            const response = await axios.get(`${this.apiUrl}/account`, {
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            logError('WHAPI_ACCOUNT', 'Error obteniendo info de cuenta', {
                error: error.response?.data || error.message
            });
            throw error;
        }
    }
}
