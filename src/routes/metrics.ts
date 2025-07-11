/**
 * 📊 ENDPOINT DE MÉTRICAS PARA DASHBOARD DE LOGGING
 * 
 * Proporciona métricas en tiempo real del sistema de logging para análisis
 * y monitoreo del rendimiento del bot en Google Cloud Run.
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Métricas básicas en memoria
interface BasicMetrics {
    totalRequests: number;
    totalLogs: number;
    activeThreads: number;
    uptime: number;
    environment: string;
}

const metrics: BasicMetrics = {
    totalRequests: 0,
    totalLogs: 0,
    activeThreads: 0,
    uptime: Date.now(),
    environment: process.env.K_SERVICE ? 'production' : 'development'
};

/**
 * 📊 GET /metrics - Métricas básicas del sistema
 */
router.get('/', (req: Request, res: Response) => {
    try {
        metrics.totalRequests++;
        
        const uptimeHours = (Date.now() - metrics.uptime) / (1000 * 60 * 60);
        
        const basicMetrics = {
            totalRequests: metrics.totalRequests,
            totalLogs: metrics.totalLogs,
            activeThreads: metrics.activeThreads,
            uptime: Math.round(uptimeHours * 100) / 100,
            environment: metrics.environment,
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: basicMetrics,
            meta: {
                endpoint: '/metrics',
                version: '1.0.0',
                description: 'Métricas básicas del sistema'
            }
        });
        
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * 📊 GET /metrics/health - Health check básico
 */
router.get('/health', (req: Request, res: Response) => {
    try {
        const health = {
            status: 'healthy',
            uptime: Math.round((Date.now() - metrics.uptime) / (1000 * 60 * 60) * 100) / 100,
            totalRequests: metrics.totalRequests,
            environment: metrics.environment,
            timestamp: new Date().toISOString()
        };
        
        res.json(health);
        
    } catch (error: any) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Función para incrementar logs (para uso externo)
export const recordLog = () => {
    metrics.totalLogs++;
};

// Función para actualizar threads activos (para uso externo)
export const updateActiveThreads = (count: number) => {
    metrics.activeThreads = count;
};

// Exportar el router como default
export default router; 