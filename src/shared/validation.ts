// src/shared/validation.ts
import { z } from 'zod';

// Esquema para validar mensajes de WhatsApp
export const WhatsAppMessageSchema = z.object({
    id: z.string(),
    from: z.string(),
    from_me: z.boolean(),
    chat_id: z.string().optional(),
    chat_name: z.string().optional(),  // Nombre del chat/contacto (reemplaza from_name)
    type: z.enum(['text', 'image', 'voice', 'audio', 'ptt', 'document', 'video', 'link_preview']),
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

// Esquema principal del webhook - Compatible con todos los tipos de WHAPI
export const WebhookPayloadSchema = z.object({
    messages: z.array(WhatsAppMessageSchema).optional(),
    presences: z.array(PresenceEventSchema).optional(),
    statuses: z.array(z.any()).optional(),
    chats: z.array(z.any()).optional(),
    contacts: z.array(z.any()).optional(),
    groups: z.array(z.any()).optional(),
    labels: z.array(z.any()).optional()
}).refine(
    (data) => data.messages || data.presences || data.statuses || data.chats || data.contacts || data.groups || data.labels,
    {
        message: "Webhook debe contener al menos un tipo de datos válido"
    }
);

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;
export type PresenceEvent = z.infer<typeof PresenceEventSchema>;

// Esquemas para OpenAI
export const OpenAIRunSchema = z.object({
    id: z.string(),
    status: z.enum(['queued', 'in_progress', 'requires_action', 'completed', 'failed', 'cancelled', 'expired']),
    required_action: z.object({
        type: z.literal('submit_tool_outputs'),
        submit_tool_outputs: z.object({
            tool_calls: z.array(z.any())
        })
    }).optional()
});

export const FunctionCallSchema = z.object({
    id: z.string(),
    function: z.object({
        name: z.string(),
        arguments: z.string()
    })
});

// Esquemas para UserState
export const UserStateSchema = z.object({
    userId: z.string(),
    isTyping: z.boolean(),
    lastTypingTimestamp: z.number(),
    lastMessageTimestamp: z.number(),
    messages: z.array(z.string()),
    chatId: z.string(),
    userName: z.string(),
    typingEventsCount: z.number(),
    averageTypingDuration: z.number(),
    lastInputVoice: z.boolean(),
    lastTyping: z.number(),
    isCurrentlyRecording: z.boolean().optional()
});

// Esquemas para Media Processing
export const MediaProcessingResultSchema = z.object({
    success: z.boolean(),
    content: z.string().optional(),
    error: z.string().optional(),
    processingTime: z.number()
});

export type OpenAIRun = z.infer<typeof OpenAIRunSchema>;
export type FunctionCall = z.infer<typeof FunctionCallSchema>;
export type UserState = z.infer<typeof UserStateSchema>;
export type MediaProcessingResult = z.infer<typeof MediaProcessingResultSchema>;