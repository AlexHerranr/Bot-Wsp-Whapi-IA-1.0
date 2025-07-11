/**
 * 📊 ENDPOINT DE MÉTRICAS PARA DASHBOARD DE LOGGING
 * 
 * Proporciona métricas en tiempo real del sistema de logging para análisis
 * y monitoreo del rendimiento del bot en Google Cloud Run.
 */

import { Router, Request, Response } from 'express';
import { LogFilterMetrics } from '../utils/logging/log-filters';
import { cloudLog } from '../utils/logging/cloud-logger';

const router = Router();

// Métricas en memoria para análisis
class MetricsCollector {
    private static instance: MetricsCollector;
    private metrics: {
        totalRequests: number;
        totalLogs: number;
        logsByCategory: Record<string, number>;
        logsByLevel: Record<string, number>;
        logsByUser: Record<string, number>;
        errorsByType: Record<string, number>;
        responseTimesByFunction: Record<string, number[]>;
        activeThreads: number;
        systemHealth: {
            uptime: number;
            memoryUsage: number;
            cpuUsage: number;
            environment: string;
        };
        recentActivity: Array<{
            timestamp: string;
            category: string;
            level: string;
            userId: string;
            message: string;
        }>;
        aggregationStats: {
            totalLogs: number;
            aggregatedLogs: number;
            filteringEfficiency: number;
        };
    };
    
    private constructor() {
        this.metrics = {
            totalRequests: 0,
            totalLogs: 0,
            logsByCategory: {},
            logsByLevel: {},
            logsByUser: {},
            errorsByType: {},
            responseTimesByFunction: {},
            activeThreads: 0,
            systemHealth: {
                uptime: Date.now(),
                memoryUsage: 0,
                cpuUsage: 0,
                environment: process.env.K_SERVICE ? 'production' : 'development'
            },
            recentActivity: [],
            aggregationStats: {
                totalLogs: 0,
                aggregatedLogs: 0,
                filteringEfficiency: 0
            }
        };
        
        // Actualizar métricas del sistema cada 30 segundos
        setInterval(() => {
            this.updateSystemHealth();
        }, 30000);
    }
    
    static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }
    
    recordLog(category: string, level: string, userId: string, message: string): void {
        this.metrics.totalLogs++;
        
        // Contar por categoría
        this.metrics.logsByCategory[category] = (this.metrics.logsByCategory[category] || 0) + 1;
        
        // Contar por nivel
        this.metrics.logsByLevel[level] = (this.metrics.logsByLevel[level] || 0) + 1;
        
        // Contar por usuario (solo primeros 10 para evitar memoria excesiva)
        if (Object.keys(this.metrics.logsByUser).length < 10 || this.metrics.logsByUser[userId]) {
            this.metrics.logsByUser[userId] = (this.metrics.logsByUser[userId] || 0) + 1;
        }
        
        // Registrar actividad reciente (solo últimos 100)
        this.metrics.recentActivity.unshift({
            timestamp: new Date().toISOString(),
            category,
            level,
            userId,
            message: message.substring(0, 100) // Limitar longitud
        });
        
        if (this.metrics.recentActivity.length > 100) {
            this.metrics.recentActivity = this.metrics.recentActivity.slice(0, 100);
        }
    }
    
    recordError(errorType: string): void {
        this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    }
    
    recordFunctionResponseTime(functionName: string, responseTime: number): void {
        if (!this.metrics.responseTimesByFunction[functionName]) {
            this.metrics.responseTimesByFunction[functionName] = [];
        }
        
        this.metrics.responseTimesByFunction[functionName].push(responseTime);
        
        // Mantener solo las últimas 50 mediciones por función
        if (this.metrics.responseTimesByFunction[functionName].length > 50) {
            this.metrics.responseTimesByFunction[functionName] = 
                this.metrics.responseTimesByFunction[functionName].slice(-50);
        }
    }
    
    recordRequest(): void {
        this.metrics.totalRequests++;
    }
    
    updateActiveThreads(count: number): void {
        this.metrics.activeThreads = count;
    }
    
    private updateSystemHealth(): void {
        const memUsage = process.memoryUsage();
        this.metrics.systemHealth.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
        this.metrics.systemHealth.uptime = Date.now() - this.metrics.systemHealth.uptime;
        
        // Actualizar estadísticas de agregación
        const filterStats = LogFilterMetrics.getStats();
        this.metrics.aggregationStats = {
            totalLogs: filterStats.totalLogs,
            aggregatedLogs: filterStats.filteredLogs,
            filteringEfficiency: parseFloat(filterStats.filteredPercentage)
        };
    }
    
    getMetrics() {
        // Calcular métricas derivadas
        const now = Date.now();
        const uptimeHours = (now - this.metrics.systemHealth.uptime) / (1000 * 60 * 60);
        
        // Calcular promedios de tiempo de respuesta
        const avgResponseTimes: Record<string, number> = {};
        for (const [functionName, times] of Object.entries(this.metrics.responseTimesByFunction)) {
            avgResponseTimes[functionName] = times.reduce((a, b) => a + b, 0) / times.length;
        }
        
        // Top categorías
        const topCategories = Object.entries(this.metrics.logsByCategory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        // Top usuarios
        const topUsers = Object.entries(this.metrics.logsByUser)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        return {
            // Métricas básicas
            totalRequests: this.metrics.totalRequests,
            totalLogs: this.metrics.totalLogs,
            activeThreads: this.metrics.activeThreads,
            
            // Distribución de logs
            logsByCategory: this.metrics.logsByCategory,
            logsByLevel: this.metrics.logsByLevel,
            topCategories,
            topUsers,
            
            // Errores
            errorsByType: this.metrics.errorsByType,
            totalErrors: Object.values(this.metrics.errorsByType).reduce((a, b) => a + b, 0),
            
            // Rendimiento
            avgResponseTimes,
            
            // Salud del sistema
            systemHealth: {
                ...this.metrics.systemHealth,
                uptimeHours: Math.round(uptimeHours * 100) / 100,
                memoryUsageMB: this.metrics.systemHealth.memoryUsage
            },
            
            // Actividad reciente
            recentActivity: this.metrics.recentActivity.slice(0, 20),
            
            // Estadísticas de agregación
            aggregationStats: this.metrics.aggregationStats,
            
            // Métricas de eficiencia
            efficiency: {
                logsPerHour: Math.round(this.metrics.totalLogs / Math.max(uptimeHours, 1)),
                requestsPerHour: Math.round(this.metrics.totalRequests / Math.max(uptimeHours, 1)),
                errorRate: this.metrics.totalLogs > 0 ? 
                    (Object.values(this.metrics.errorsByType).reduce((a, b) => a + b, 0) / this.metrics.totalLogs * 100).toFixed(2) : '0'
            },
            
            // Timestamp de la consulta
            timestamp: new Date().toISOString(),
            generatedAt: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
        };
    }
    
    reset(): void {
        this.metrics = {
            totalRequests: 0,
            totalLogs: 0,
            logsByCategory: {},
            logsByLevel: {},
            logsByUser: {},
            errorsByType: {},
            responseTimesByFunction: {},
            activeThreads: 0,
            systemHealth: {
                uptime: Date.now(),
                memoryUsage: 0,
                cpuUsage: 0,
                environment: process.env.K_SERVICE ? 'production' : 'development'
            },
            recentActivity: [],
            aggregationStats: {
                totalLogs: 0,
                aggregatedLogs: 0,
                filteringEfficiency: 0
            }
        };
    }
}

// Instancia singleton
const metricsCollector = MetricsCollector.getInstance();

/**
 * 📊 GET /metrics - Métricas completas del sistema
 */
router.get('/', (req: Request, res: Response) => {
    try {
        metricsCollector.recordRequest();
        
        const metrics = metricsCollector.getMetrics();
        
        // Log de acceso a métricas
        cloudLog('INFO', 'METRICS_ACCESS', 'Dashboard de métricas consultado', {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            data: metrics,
            meta: {
                endpoint: '/metrics',
                version: '1.0.0',
                description: 'Métricas en tiempo real del sistema de logging'
            }
        });
        
    } catch (error) {
        cloudLog('ERROR', 'METRICS_ERROR', 'Error generando métricas', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: 'No se pudieron generar las métricas'
        });
    }
});

/**
 * 📊 GET /metrics/summary - Resumen de métricas clave
 */
router.get('/summary', (req: Request, res: Response) => {
    try {
        metricsCollector.recordRequest();
        
        const fullMetrics = metricsCollector.getMetrics();
        
        const summary = {
            totalLogs: fullMetrics.totalLogs,
            totalRequests: fullMetrics.totalRequests,
            activeThreads: fullMetrics.activeThreads,
            totalErrors: fullMetrics.totalErrors,
            errorRate: fullMetrics.efficiency.errorRate,
            memoryUsage: fullMetrics.systemHealth.memoryUsageMB,
            uptime: fullMetrics.systemHealth.uptimeHours,
            environment: fullMetrics.systemHealth.environment,
            topCategory: fullMetrics.topCategories[0] || null,
            recentActivity: fullMetrics.recentActivity.slice(0, 5),
            timestamp: fullMetrics.timestamp
        };
        
        res.json({
            success: true,
            data: summary,
            meta: {
                endpoint: '/metrics/summary',
                description: 'Resumen de métricas clave'
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error generando resumen'
        });
    }
});

/**
 * 📊 GET /metrics/health - Health check con métricas básicas
 */
router.get('/health', (req: Request, res: Response) => {
    try {
        const metrics = metricsCollector.getMetrics();
        
        const health = {
            status: 'healthy',
            uptime: metrics.systemHealth.uptimeHours,
            memoryUsage: metrics.systemHealth.memoryUsageMB,
            totalLogs: metrics.totalLogs,
            activeThreads: metrics.activeThreads,
            environment: metrics.systemHealth.environment,
            timestamp: new Date().toISOString()
        };
        
        res.json(health);
        
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 🔄 POST /metrics/reset - Reiniciar métricas (solo desarrollo)
 */
router.post('/reset', (req: Request, res: Response) => {
    try {
        const environment = process.env.K_SERVICE ? 'production' : 'development';
        
        if (environment === 'production') {
            return res.status(403).json({
                success: false,
                error: 'No permitido en producción'
            });
        }
        
        metricsCollector.reset();
        LogFilterMetrics.reset();
        
        cloudLog('WARNING', 'METRICS_RESET', 'Métricas reiniciadas manualmente', {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            environment
        });
        
        res.json({
            success: true,
            message: 'Métricas reiniciadas correctamente'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error reiniciando métricas'
        });
    }
});

// Exportar el colector de métricas para uso en otros módulos
export { metricsCollector };
export default router; 