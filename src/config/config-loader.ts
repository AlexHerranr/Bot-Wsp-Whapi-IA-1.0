// src/config/config-loader.ts
export interface BotConfig {
    port: number;
    host: string;
    apiKey?: string;
    promptId?: string;
}

export function loadConfig(): BotConfig {
    return {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
        apiKey: process.env.OPENAI_API_KEY,
        promptId: process.env.OPENAI_PROMPT_ID
    };
}