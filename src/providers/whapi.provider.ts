import { ProviderClass, utils } from '@builderbot/bot';
import axios from 'axios';
import { EventEmitter } from 'events';
import { Request, Response } from 'express';

export class WhapiProvider extends ProviderClass {
    private apiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
    private token = process.env.WHAPI_TOKEN;
    
    constructor() {
        super();
        this.vendor = new EventEmitter();
    }

    async initVendor() {
        return this.vendor;
    }

    private getHeaders() {
        if (!this.token) throw new Error('WHAPI_TOKEN no está definido en .env');
        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    protected async setupWebhook() {
        const webhookUrl = this.getWebhookEndpoint();
        console.log(`[WhapiProvider] Configurando Webhook con URL: ${webhookUrl}`);
        try {
            await axios.patch(`${this.apiUrl}/settings`, {
                webhooks: [{ 
                    url: webhookUrl, 
                    events: [
                        { type: "message", method: "post" },
                        { type: "presences", method: "post" }
                    ], 
                    mode: "method" 
                }]
            }, { headers: this.getHeaders() });
            console.log('[WhapiProvider] Webhook configurado exitosamente con eventos: message, presences');
        } catch (error) {
            const errorMsg = error.response?.data || error.message;
            console.error('[WhapiProvider] Error al configurar webhook:', errorMsg);
        }
    }

    protected parseMessage(msg: any) {
        if (msg.from_me) return null;
        return {
            from: msg.chat_id,
            name: msg.from_name || msg.chat_id.replace(/@s\.whatsapp\.net$/, ''),
            body: msg.text?.body || '',
            message_id: msg.id,
        };
    }

    protected async handleIncomingMessage(req: Request, res: Response) {
        const { messages } = req.body;
        if (!messages) return res.status(200).send('No messages to process');

        for (const message of messages) {
            const parsed = this.parseMessage(message);
            if (parsed) {
                this.emit('message', parsed);
            }
        }
        return res.status(200).send('Processed');
    }

    protected listen() {
        this.server.post('/webhook', this.handleIncomingMessage.bind(this));
    }
    
    public async init() {
        await this.setupWebhook();
        this.emit('ready', true);
    }
    
    async sendMessage(to: string, message: string): Promise<any> {
        return axios.post(`${this.apiUrl}/messages/text`, {
            to: to.replace(/@s\.whatsapp\.net$/, ''),
            body: message
        }, { headers: this.getHeaders() });
    }

    async sendPresenceUpdate(to: string, type: 'composing' | 'paused') {}
    
    protected beforeHttpServerInit(): void {}
    protected afterHttpServerInit(): void {}
    
    // CORREGIDO: Convertido a método para cumplir la interfaz
    public busEvents() {
        return [];
    }
    
    public globalVendorArgs: any = {};
}
