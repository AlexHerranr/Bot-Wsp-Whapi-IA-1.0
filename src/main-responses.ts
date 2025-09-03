// src/main-responses.ts
// Versión principal que usa Responses API sin threads
import 'reflect-metadata';
import 'dotenv/config';
import { container } from 'tsyringe';
import { CoreBotResponses as CoreBot } from './core/bot-responses';
import { FunctionRegistryService } from './core/services/function-registry.service';
import { HotelPlugin } from './plugins/hotel';
import { DatabaseService } from './core/services/database.service';
import { logInfo } from './utils/logging';

interface AppConfig {
    port: number;
    host: string;
    secrets: {
        OPENAI_API_KEY: string;
        WHAPI_API_URL: string;
        WHAPI_TOKEN: string;
    };
}

function loadConfig(): AppConfig {
    const config = {
        port: parseInt(process.env.PORT || '8080'), // Railway usa 8080
        host: process.env.HOST || '0.0.0.0',
        secrets: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
            WHAPI_API_URL: process.env.WHAPI_API_URL || '',
            WHAPI_TOKEN: process.env.WHAPI_TOKEN || '',
        }
    };

    // Validate critical environment variables
    const requiredVars = {
        OPENAI_API_KEY: config.secrets.OPENAI_API_KEY,
        WHAPI_TOKEN: config.secrets.WHAPI_TOKEN
    };

    const missingVars = Object.entries(requiredVars)
        .filter(([_, value]) => !value)
        .map(([key, _]) => key);

    if (missingVars.length > 0) {
        console.error(`❌ Missing critical environment variables: ${missingVars.join(', ')}`);
        console.error('Please check your .env file and ensure all required variables are set.');
        process.exit(1);
    }

    console.log('✅ Configuration loaded successfully');
    
    // Log técnico de sesión
    logInfo('CONFIG_LOADED', 'Configuración cargada exitosamente', {
        port: config.port,
        host: config.host,
        hasOpenAI: !!config.secrets.OPENAI_API_KEY,
        hasWhapi: !!config.secrets.WHAPI_TOKEN,
        apiVersion: 'responses' // Indicar que usa nueva API
    }, 'main-responses.ts');
    console.log(`🌍 Server will start on ${config.host}:${config.port}`);
    console.log(`🔄 Using OpenAI Responses API (no threads)`);
    
    return config;
}

function setupDependencyInjection() {
    console.log('🔧 DI ✓ 5 services, 1 function');
    
    // Register Function Registry as singleton
    const functionRegistry = new FunctionRegistryService();
    container.registerInstance('FunctionRegistry', functionRegistry);
    
    // Register Database Service
    const databaseService = new DatabaseService();
    container.registerInstance('DatabaseService', databaseService);
    
    
    // Register plugins conditionally
    const enabledPlugins = [];
    
    if (process.env.PLUGIN_HOTEL_ENABLED !== 'false') {
        const hotelPlugin = new HotelPlugin();
        hotelPlugin.register(functionRegistry, 'hotel-plugin');
        enabledPlugins.push('hotel');
    }
    
    // Log técnico consolidado
    logInfo('DI_COMPLETED', 'DI ✓ 2 services, 1 function (CRM jobs deshabilitados)', {
        services: ['FunctionRegistry', 'DatabaseService'],
        functions: functionRegistry.list(),
        container: 'tsyringe',
        crmStatus: 'disabled',
        apiVersion: 'responses'
    }, 'main-responses.ts');
    
    return { functionRegistry, enabledPlugins };
}

async function main() {
    let bot: CoreBot | null = null;
    
    try {
        console.log('🚀 Starting TeAlquilamos Bot (Responses API Version)...');
        
        // Log técnico de sesión - inicio de aplicación
        logInfo('APP_START', 'Iniciando TeAlquilamos Bot con Responses API', {
            version: process.env.npm_package_version || '1.0.0',
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'development',
            pid: process.pid,
            apiVersion: 'responses',
            openaiModel: process.env.OPENAI_MODEL || 'gpt-5'
        }, 'main-responses.ts');
        
        // Load configuration
        const config = loadConfig();
        
        // Setup DI container
        const { functionRegistry, enabledPlugins } = setupDependencyInjection();
        
        
        // Create and start bot
        bot = new CoreBot(config, functionRegistry);
        
        // Setup graceful shutdown
        const handleShutdown = async (signal: string) => {
            console.log(`🛑 Received ${signal}, shutting down gracefully...`);
            
            // Log la señal recibida
            logInfo('SHUTDOWN_SIGNAL', `Señal de parada recibida: ${signal}`, {
                signal,
                timestamp: new Date().toISOString(),
                graceful: true
            });
            
            if (bot) {
                await bot.stop();
            }
            process.exit(0);
        };
        
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        
        // Start the bot
        await bot.start();
        
    } catch (error: any) {
        console.error('❌ Fatal error during initialization:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Log del error fatal
        logInfo('FATAL_ERROR', 'Error fatal durante inicialización', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            graceful: false
        });
        
        if (bot) {
            try {
                await bot.stop();
            } catch (stopError) {
                console.error('Error during emergency shutdown:', stopError);
            }
        }
        
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Log la rejection no manejada
    logInfo('UNHANDLED_REJECTION', 'Promise rejection no manejada', {
        reason: String(reason),
        promise: String(promise),
        timestamp: new Date().toISOString(),
        graceful: false
    });
    
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    // Log la excepción no capturada
    logInfo('UNCAUGHT_EXCEPTION', 'Excepción no capturada', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        graceful: false
    });
    
    process.exit(1);
});

// Start the application
main().catch((error) => {
    console.error('Application failed to start:', error);
    process.exit(1);
});

export default main;
export { AppConfig, loadConfig, setupDependencyInjection };