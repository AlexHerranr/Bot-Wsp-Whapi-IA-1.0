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
    lastTypingTimestamp: number;
    lastMessageTimestamp: number;
    messages: string[];
    chatId: string;
    userName: string;
    typingEventsCount: number;
    averageTypingDuration: number;
    lastInputVoice: boolean;
    lastTyping: number;
    isCurrentlyRecording?: boolean;
}

// Buffer de Mensajes
export interface MessageBuffer {
    messages: string[];
    chatId: string;
    userName: string;
    lastActivity: number;
    timer: NodeJS.Timeout | null;
    currentDelay?: number;
}

// Registro de Threads en Persistencia
export interface ThreadRecord {
    threadId: string;
    chatId: string;
    userName?: string;
    lastActivity: Date;
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
export interface MediaProcessingResult {
    success: boolean;
    content?: string;
    error?: string;
    processingTime: number;
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