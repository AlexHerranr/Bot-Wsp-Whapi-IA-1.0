// Tipos para respuestas de WHAPI
export interface WHAPIMediaLink {
    link?: string;
    id?: string;
    mime_type?: string;
    file_size?: number;
}

export interface WHAPIMessage {
    id: string;
    type: string;
    audio?: WHAPIMediaLink;
    voice?: WHAPIMediaLink;
    ptt?: WHAPIMediaLink;
    image?: WHAPIMediaLink;
}

export interface WHAPIError {
    error?: {
        code: number;
        message: string;
        details?: string;
    };
}

// Estado de Usuario
export interface UserState {
    userId: string;
    isTyping: boolean;
    isRecording: boolean; // Renombrado de isCurrentlyRecording para consistencia
    lastActivity?: number; // Unificado de lastTyping/lastTypingTimestamp para claridad
    lastMessageTimestamp: number;
    messages: string[];
    chatId: string;
    userName: string;
    typingEventsCount: number;
    averageTypingDuration: number;
    lastInputVoice: boolean;
    // Legacy fields para compatibilidad
    lastTypingTimestamp: number;
    lastTyping: number;
}

// Buffer de Mensajes
export interface MessageBuffer {
    messages: string[];
    chatId: string;
    userName: string;
    lastActivity: number;
    timer: NodeJS.Timeout | null;
    isVoice?: boolean;
    pendingImage?: { type: 'image', imageUrl: string, caption: string } | null;
    quotedMessageId?: string;
    duringRunMsgId?: string; // ID para citación auto durante run activo
}

// Registro de Threads en Persistencia
export interface ThreadRecord {
    threadId: string;
    chatId: string;
    userName?: string;
    lastActivity: Date;
    tokenCount?: number;
    labels?: string[];
}

// Tipos para OpenAI Processing
export interface OpenAIRun {
    id: string;
    status: 'queued' | 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled' | 'expired';
    required_action?: {
        type: 'submit_tool_outputs';
        submit_tool_outputs: {
            tool_calls: any[];
        };
    };
}

export interface FunctionCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
}

// Tipos para Media Processing
export type MediaType = 'audio' | 'image' | 'video' | 'document';

export interface MediaProcessingResult {
    success: boolean;
    type: MediaType;
    result?: string;
    error?: string;
    metadata?: {
        processingTime?: number;
        fileSize?: number;
        duration?: number | null;
        language?: string;
        mimeType?: string;
        tokensUsed?: number | null;
        model?: string;
        attemptedUrl?: string;
        imageSize?: number;
    };
}

// Tipos para Cache
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    ttl?: number;
}

// Tipos para Terminal Logging
export type LogLevel = 'info' | 'error' | 'success' | 'warning' | 'debug';
export type LogCategory = 'MESSAGE' | 'TYPING' | 'VOICE' | 'IMAGE' | 'FUNCTION' | 'ERROR' | 'WEBHOOK' | 'OPENAI';