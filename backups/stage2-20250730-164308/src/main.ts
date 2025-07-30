// src/main.ts
import 'dotenv/config';
import { CoreBot } from './core/bot';

function loadConfig() {
    // Validación de configuración robusta irá aquí más adelante
    const config = {
        port: parseInt(process.env.PORT || '3008'),
        host: process.env.HOST || '0.0.0.0',
        secrets: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
            WHAPI_API_URL: process.env.WHAPI_API_URL || '',
            WHAPI_TOKEN: process.env.WHAPI_TOKEN || '',
        }
    };

    if (!config.secrets.OPENAI_API_KEY || !config.secrets.WHAPI_TOKEN) {
        console.error("Error: Faltan variables de entorno críticas (OPENAI_API_KEY, WHAPI_TOKEN)");
        process.exit(1);
    }

    return config;
}

async function main() {
    try {
        const config = loadConfig();
        const bot = new CoreBot(config);
        bot.start();
    } catch (error) {
        console.error('L Error fatal durante la inicialización:', error);
        process.exit(1);
    }
}

main();