// src/main.ts
import 'dotenv/config';
import { CoreBot } from './core/bot';

function loadConfig() {
    // Validaci�n de configuraci�n robusta ir� aqu� m�s adelante
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
        console.error("Error: Faltan variables de entorno cr�ticas (OPENAI_API_KEY, WHAPI_TOKEN)");
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
        console.error('L Error fatal durante la inicializaci�n:', error);
        process.exit(1);
    }
}

main();