// src/core/api/webhook-validator.ts
import { WebhookPayloadSchema, WebhookPayload } from '../../shared/validation';
import { TerminalLog } from '../utils/terminal-log';

export class WebhookValidator {
    private terminalLog: TerminalLog;

    constructor(terminalLog: TerminalLog) {
        this.terminalLog = terminalLog;
    }

    /**
     * Valida un payload de webhook usando Zod
     */
    public validatePayload(payload: unknown): { valid: boolean; data?: WebhookPayload; error?: string } {
        try {
            const validation = WebhookPayloadSchema.safeParse(payload);
            
            if (!validation.success) {
                const error = `Webhook validation failed: ${validation.error.message}`;
                this.terminalLog.error(`Webhook inválido: ${validation.error.issues.map(i => i.message).join(', ')}`);
                return { valid: false, error };
            }

            this.terminalLog.debug(`Webhook válido: ${validation.data.messages?.length || 0} mensajes, ${validation.data.presences?.length || 0} presencias`);
            return { valid: true, data: validation.data };
        } catch (error: any) {
            const errorMsg = `Webhook validation error: ${error.message}`;
            this.terminalLog.error(errorMsg);
            return { valid: false, error: errorMsg };
        }
    }

    /**
     * Valida y limpia un payload básico (fallback si Zod falla)
     */
    public validateBasic(payload: any): boolean {
        if (!payload || typeof payload !== 'object') {
            this.terminalLog.error('Payload no es un objeto válido');
            return false;
        }

        const hasMessages = Array.isArray(payload.messages) && payload.messages.length > 0;
        const hasPresences = Array.isArray(payload.presences) && payload.presences.length > 0;

        if (!hasMessages && !hasPresences) {
            this.terminalLog.error('Payload debe contener al menos messages o presences');
            return false;
        }

        // Validación básica de mensajes
        if (hasMessages) {
            const invalidMessages = payload.messages.filter((msg: any) => 
                !msg.id || !msg.from || !msg.type
            );
            if (invalidMessages.length > 0) {
                this.terminalLog.error(`${invalidMessages.length} mensajes inválidos encontrados`);
                return false;
            }
        }

        // Validación básica de presencias
        if (hasPresences) {
            const invalidPresences = payload.presences.filter((presence: any) =>
                !presence.contact_id || !presence.status
            );
            if (invalidPresences.length > 0) {
                this.terminalLog.error(`${invalidPresences.length} presencias inválidas encontradas`);
                return false;
            }
        }

        return true;
    }

    /**
     * Sanitizar payload removiendo campos peligrosos
     */
    public sanitizePayload(payload: any): any {
        if (!payload || typeof payload !== 'object') {
            return payload;
        }

        // Clonar para evitar mutaciones
        const sanitized = JSON.parse(JSON.stringify(payload));

        // Remover campos peligrosos
        const dangerousFields = ['__proto__', 'constructor', 'prototype'];
        
        const removeDangerousFields = (obj: any) => {
            if (typeof obj !== 'object' || obj === null) return;
            
            for (const field of dangerousFields) {
                delete obj[field];
            }
            
            for (const key in obj) {
                if (typeof obj[key] === 'object') {
                    removeDangerousFields(obj[key]);
                }
            }
        };

        removeDangerousFields(sanitized);
        return sanitized;
    }

    /**
     * Validación completa con sanitización y logging
     */
    public process(payload: unknown): { valid: boolean; data?: WebhookPayload; error?: string } {
        // 1. Sanitizar primero
        const sanitized = this.sanitizePayload(payload);

        // 2. Validar con Zod
        const zodResult = this.validatePayload(sanitized);
        if (zodResult.valid) {
            return zodResult;
        }

        // 3. Fallback a validación básica
        this.terminalLog.warning('Zod validation failed, trying basic validation...');
        const basicValid = this.validateBasic(sanitized);
        
        if (basicValid) {
            this.terminalLog.warning('Basic validation passed, using sanitized payload');
            return { valid: true, data: sanitized as WebhookPayload };
        }

        return { valid: false, error: zodResult.error || 'All validations failed' };
    }
}