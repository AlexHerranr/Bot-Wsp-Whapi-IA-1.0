// src/core/processors/base/IWebhookProcessor.interface.ts
export interface IWebhookProcessor {
    /**
     * Determina si este processor puede manejar el payload dado
     */
    canHandle(payload: any): boolean;
    
    /**
     * Procesa el webhook payload
     */
    process(payload: any): Promise<void>;
    
    /**
     * Nombre identificativo del processor
     */
    getProcessorName(): string;
    
    /**
     * Configuración específica del processor
     */
    getConfig(): ProcessorConfig;
}

export interface ProcessorConfig {
    assistantId: string;
    chatId?: string;
    bufferSettings?: {
        timeout?: number;
        fastMode?: boolean;
    };
    presenceSettings?: {
        enabled?: boolean;
        showTyping?: boolean;
        showRecording?: boolean;
    };
    timingSettings?: {
        humanTiming?: boolean;
        responseDelay?: number;
    };
    logSettings?: {
        compactMode?: boolean;
        debugLevel?: 'minimal' | 'normal' | 'verbose';
    };
}