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