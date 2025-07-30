// src/shared/validation.ts
import { z } from 'zod';

// Esquema para validar mensajes de WhatsApp
export const WhatsAppMessageSchema = z.object({
    id: z.string(),
    from: z.string(),
    from_me: z.boolean(),
    chat_id: z.string().optional(),
    from_name: z.string().optional(),
    type: z.enum(['text', 'image', 'voice', 'audio', 'ptt', 'document', 'video']),
    text: z.object({
        body: z.string()
    }).optional(),
    voice: z.object({
        link: z.string()
    }).optional(),
    audio: z.object({
        link: z.string()
    }).optional(),
    image: z.object({
        link: z.string()
    }).optional()
});

// Esquema para eventos de presencia
export const PresenceEventSchema = z.object({
    contact_id: z.string(),
    status: z.string()
});

// Esquema principal del webhook
export const WebhookPayloadSchema = z.object({
    messages: z.array(WhatsAppMessageSchema).optional(),
    presences: z.array(PresenceEventSchema).optional()
}).refine(
    (data) => data.messages || data.presences,
    {
        message: "Webhook debe contener al menos 'messages' o 'presences'"
    }
);

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;
export type PresenceEvent = z.infer<typeof PresenceEventSchema>;