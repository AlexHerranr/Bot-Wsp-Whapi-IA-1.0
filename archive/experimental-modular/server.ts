/**
 * Servidor Express Modular (EXPERIMENTAL)
 * Configuración y rutas del bot
 * 
 * @status EXPERIMENTAL - Archivado para futura referencia
 */

import express from 'express';
import { config, logEnvironmentConfig } from '../src/config/environment.js';
import { logSuccess, logInfo } from '../src/utils/logger.js';
import { threadPersistence } from '../src/utils/persistence/index.js';

interface BotStatus {
    status: 'healthy' | 'initializing' | 'error';
    timestamp: string;
    environment: string;
    port: number;
    initialized: boolean;
    version: string;
    systemHealth: {
        userBuffers: number;
        manualBuffers: number;
        activeTimers: number;
        totalThreads: number;
    };
}

export function createServer() {
    const app = express();
    
    // Middlewares básicos
    app.use(express.json());
    
    // Log de configuración
    logEnvironmentConfig();
    
    // Variables de estado
    let isServerInitialized = false;
    
    // --- Endpoints de Salud ---
    app.get('/health', (req, res) => {
        const stats = threadPersistence.getStats();
        const healthStatus: BotStatus = {
            status: isServerInitialized ? 'healthy' : 'initializing',
            timestamp: new Date().toISOString(),
            environment: config.environment,
            port: config.port,
            initialized: isServerInitialized,
            version: '2.0.0-modular-experimental',
            systemHealth: {
                userBuffers: 0, // TODO: Implementar métricas reales
                manualBuffers: 0,
                activeTimers: 0,
                totalThreads: stats.totalThreads
            }
        };
        
        if (config.enableDetailedLogs) {
            logInfo('HEALTH_CHECK', 'Health check solicitado', healthStatus);
        }
        
        res.status(200).json(healthStatus);
    });

    app.get('/', (req, res) => {
        res.json({
            service: 'TeAlquilamos Bot',
            version: '2.0.0-modular-experimental',
            environment: config.environment,
            status: isServerInitialized ? 'ready' : 'initializing',
            port: config.port,
            webhookUrl: config.webhookUrl,
            baseUrl: config.baseUrl,
            architecture: 'modular-experimental'
        });
    });

    app.get('/ready', (req, res) => {
        if (isServerInitialized) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                message: 'Bot completamente inicializado y listo',
                environment: config.environment,
                version: '2.0.0-modular-experimental'
            });
        } else {
            res.status(503).json({
                status: 'initializing',
                timestamp: new Date().toISOString(),
                message: 'Bot aún inicializándose',
                environment: config.environment,
                version: '2.0.0-modular-experimental'
            });
        }
    });

    // TODO: Webhook endpoint - implementar en webhook.handler.ts
    app.post('/hook', (req, res) => {
        res.status(200).json({
            message: 'Webhook endpoint - Implementación modular pendiente',
            timestamp: new Date().toISOString()
        });
    });

    // --- Inicialización del Servidor ---
    const server = app.listen(config.port, config.host, () => {
        console.log(`🚀 Servidor HTTP iniciado en ${config.host}:${config.port}`);
        console.log(`🔗 Webhook URL: ${config.webhookUrl}`);
        
        logSuccess('SERVER_START', 'Servidor HTTP iniciado', { 
            host: config.host,
            port: config.port,
            environment: config.environment,
            webhookUrl: config.webhookUrl,
            version: '2.0.0-modular-experimental'
        });
        
        // Marcar como inicializado
        isServerInitialized = true;
        
        console.log('✅ Servidor modular experimental listo y funcionando');
    });

    // --- Manejo de Errores del Servidor ---
    server.on('error', (error: any) => {
        console.error('❌ Error del servidor:', error);
        logSuccess('SERVER_ERROR', 'Error del servidor', { 
            error: error.message, 
            code: error.code,
            environment: config.environment
        });
    });

    server.on('listening', () => {
        console.log(`✅ Servidor escuchando en ${config.environment} mode`);
        logSuccess('SERVER_LISTENING', 'Servidor escuchando correctamente', { 
            port: config.port,
            environment: config.environment,
            version: '2.0.0-modular-experimental'
        });
    });

    return { app, server };
} 