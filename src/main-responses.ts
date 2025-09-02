// src/main-responses.ts
// Punto de entrada principal para la versión con Responses API
import 'reflect-metadata';
import { container } from 'tsyringe';
import { CoreBotResponses } from './core/bot-responses';
import { FunctionRegistryService } from './core/services/function-registry.service';
import { HotelPlugin } from './plugins/hotel';
import { loadConfig } from './config/config-loader';
import { validateSecrets } from './config/secrets';
import { logInfo, logSuccess, logError } from './utils/logging';

async function main() {
    try {
        console.log('🚀 Iniciando TeAlquilamos Bot con Responses API...');
        
        // Cargar configuración
        const config = loadConfig();
        
        // Validar secretos
        const secrets = validateSecrets();
        
        // Configurar el contenedor de inyección de dependencias
        const functionRegistry = new FunctionRegistryService();
        container.register('IFunctionRegistry', { useValue: functionRegistry });
        
        // Crear instancia del bot con Responses API
        const bot = new CoreBotResponses(
            {
                port: config.port,
                host: config.host,
                secrets
            },
            functionRegistry
        );
        
        // Registrar plugins
        console.log('📦 Registrando plugins...');
        
        // Hotel Plugin
        const hotelPlugin = container.resolve(HotelPlugin);
        await hotelPlugin.register(functionRegistry);
        logSuccess('PLUGIN_REGISTERED', 'Hotel plugin registrado', {
            functionsCount: functionRegistry.list().filter(name => name.startsWith('hotel_')).length
        });
        
        // Iniciar el bot
        await bot.start();
        
        // Manejo de señales para cierre limpio
        process.on('SIGINT', async () => {
            console.log('\n⏹️ Deteniendo bot...');
            await bot.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n⏹️ Deteniendo bot...');
            await bot.stop();
            process.exit(0);
        });
        
    } catch (error) {
        logError('STARTUP_FATAL', 'Error fatal durante el inicio', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    }
}

// Ejecutar
main().catch(error => {
    console.error('Error no capturado:', error);
    process.exit(1);
});