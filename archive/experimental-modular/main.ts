/**
 * TeAlquilamos Bot - Punto de Entrada Principal (EXPERIMENTAL)
 * Arquitectura Modular y Escalable
 * 
 * @version 2.0.0-modular
 * @author Alexander - TeAlquilamos
 * @date 2025-01-07
 * @status EXPERIMENTAL - Archivado para futura referencia
 */

import "dotenv/config";
import { createServer } from './server.js';
import { validateEnvironmentConfig } from '../src/config/environment.js';
import { logSuccess, logError } from '../src/utils/logger.js';

async function bootstrap() {
    try {
        console.log('\n🚀 Iniciando TeAlquilamos Bot v2.0 (Arquitectura Modular)...');
        
        // Validar configuración de entorno
        const configValidation = validateEnvironmentConfig();
        if (!configValidation.isValid) {
            console.error('❌ Configuración inválida:');
            configValidation.errors.forEach(error => console.error(`   - ${error}`));
            process.exit(1);
        }
        
        // Crear y inicializar servidor modular
        const app = createServer();
        console.log('✅ Servidor modular creado y funcionando');
        
        logSuccess('BOOTSTRAP', 'Bot iniciado exitosamente', {
            version: '2.0.0-modular',
            architecture: 'modular',
            timestamp: new Date().toISOString()
        });
        
        // Manejo de cierre graceful
        process.on('SIGTERM', () => {
            console.log('\n🔄 Cerrando aplicación gracefully...');
            console.log('✅ Aplicación cerrada exitosamente');
            process.exit(0);
        });
        
        process.on('SIGINT', () => {
            console.log('\n🔄 Cerrando aplicación gracefully...');
            console.log('✅ Aplicación cerrada exitosamente');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error fatal durante inicialización:', error);
        logError('BOOTSTRAP_ERROR', 'Error fatal durante inicialización', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Inicializar aplicación
bootstrap().catch(error => {
    console.error('❌ Error no manejado:', error);
    process.exit(1);
}); 