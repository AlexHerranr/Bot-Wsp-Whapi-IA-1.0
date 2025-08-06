// Métricas de performance para monitoreo del sistema
import { logInfo, logWarning } from './logging';

export interface PerformanceMetrics {
    // Métricas de OpenAI
    openaiCalls: number;
    openaiLatencyAvg: number;
    openaiErrors: number;
    concurrencyHits: number;
    
    // Métricas de memoria
    memoryUsageMB: number;
    activeUsers: number;
    activeBuffers: number;
    
    // Métricas de throughput
    messagesPerMinute: number;
    successRate: number;
    
    // Métricas de funciones
    functionCalls: number;
    functionErrors: number;
    
    // Timestamp
    timestamp: Date;
}

export class PerformanceMonitor {
    private metrics: {
        openaiCalls: number;
        openaiLatencies: number[];
        openaiErrors: number;
        concurrencyHits: number;
        functionCalls: number;
        functionErrors: number;
        messagesProcessed: number;
        messagesSuccessful: number;
        startTime: Date;
    };
    
    private intervalId?: NodeJS.Timeout;
    
    constructor() {
        this.metrics = {
            openaiCalls: 0,
            openaiLatencies: [],
            openaiErrors: 0,
            concurrencyHits: 0,
            functionCalls: 0,
            functionErrors: 0,
            messagesProcessed: 0,
            messagesSuccessful: 0,
            startTime: new Date()
        };
    }
    
    // Iniciar monitoreo periódico
    startMonitoring(intervalMs: number = 60000) { // 1 minuto por defecto
        this.intervalId = setInterval(() => {
            this.generatePerformanceReport();
        }, intervalMs);
        
        logInfo('PERFORMANCE_MONITOR_START', 'Monitor de performance iniciado', {
            interval: intervalMs,
            startTime: this.metrics.startTime.toISOString()
        });
    }
    
    // Detener monitoreo
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }
    
    // Registrar llamada a OpenAI
    recordOpenAICall(latencyMs: number, success: boolean = true) {
        this.metrics.openaiCalls++;
        this.metrics.openaiLatencies.push(latencyMs);
        
        // Mantener solo las últimas 100 latencias para no consumir memoria
        if (this.metrics.openaiLatencies.length > 100) {
            this.metrics.openaiLatencies = this.metrics.openaiLatencies.slice(-100);
        }
        
        if (!success) {
            this.metrics.openaiErrors++;
        }
    }
    
    // Registrar hit de concurrencia
    recordConcurrencyHit() {
        this.metrics.concurrencyHits++;
    }
    
    // Registrar función ejecutada
    recordFunctionCall(success: boolean = true) {
        this.metrics.functionCalls++;
        if (!success) {
            this.metrics.functionErrors++;
        }
    }
    
    // Registrar mensaje procesado
    recordMessageProcessed(success: boolean = true) {
        this.metrics.messagesProcessed++;
        if (success) {
            this.metrics.messagesSuccessful++;
        }
    }
    
    // Obtener métricas actuales
    getCurrentMetrics(): PerformanceMetrics {
        const now = new Date();
        const uptimeMs = now.getTime() - this.metrics.startTime.getTime();
        const uptimeMinutes = uptimeMs / (1000 * 60);
        
        // Calcular latencia promedio
        const avgLatency = this.metrics.openaiLatencies.length > 0
            ? this.metrics.openaiLatencies.reduce((a, b) => a + b, 0) / this.metrics.openaiLatencies.length
            : 0;
            
        // Calcular tasa de éxito
        const successRate = this.metrics.messagesProcessed > 0
            ? (this.metrics.messagesSuccessful / this.metrics.messagesProcessed) * 100
            : 100;
            
        // Obtener uso de memoria
        const memUsage = process.memoryUsage();
        
        return {
            openaiCalls: this.metrics.openaiCalls,
            openaiLatencyAvg: Math.round(avgLatency),
            openaiErrors: this.metrics.openaiErrors,
            concurrencyHits: this.metrics.concurrencyHits,
            memoryUsageMB: Math.round(memUsage.rss / 1024 / 1024),
            activeUsers: 0, // Se actualizará externamente
            activeBuffers: 0, // Se actualizará externamente
            messagesPerMinute: Math.round(this.metrics.messagesProcessed / Math.max(uptimeMinutes, 1)),
            successRate: Math.round(successRate * 100) / 100,
            functionCalls: this.metrics.functionCalls,
            functionErrors: this.metrics.functionErrors,
            timestamp: now
        };
    }
    
    // Generar reporte de performance
    generatePerformanceReport() {
        const metrics = this.getCurrentMetrics();
        
        // Log de métricas consolidadas
        logInfo('PERFORMANCE_METRICS', 'Reporte de performance del sistema', {
            openai: {
                calls: metrics.openaiCalls,
                avgLatency: `${metrics.openaiLatencyAvg}ms`,
                errors: metrics.openaiErrors,
                concurrencyHits: metrics.concurrencyHits
            },
            system: {
                memoryMB: metrics.memoryUsageMB,
                activeUsers: metrics.activeUsers,
                activeBuffers: metrics.activeBuffers
            },
            throughput: {
                messagesPerMin: metrics.messagesPerMinute,
                successRate: `${metrics.successRate}%`
            },
            functions: {
                calls: metrics.functionCalls,
                errors: metrics.functionErrors
            }
        });
        
        // Alertas de performance
        this.checkPerformanceAlerts(metrics);
    }
    
    // Verificar alertas de performance
    private checkPerformanceAlerts(metrics: PerformanceMetrics) {
        // Alerta: Latencia alta
        if (metrics.openaiLatencyAvg > 15000) { // > 15 segundos
            logWarning('PERFORMANCE_ALERT_LATENCY', 'Latencia alta detectada en OpenAI', {
                currentLatency: `${metrics.openaiLatencyAvg}ms`,
                threshold: '15000ms',
                recommendation: 'Verificar conectividad y carga del sistema'
            });
        }
        
        // Alerta: Memoria alta
        if (metrics.memoryUsageMB > 400) { // > 400MB
            logWarning('PERFORMANCE_ALERT_MEMORY', 'Uso de memoria alto detectado', {
                currentMemory: `${metrics.memoryUsageMB}MB`,
                threshold: '400MB',
                recommendation: 'Verificar limpieza de estados y buffers'
            });
        }
        
        // Alerta: Tasa de éxito baja
        if (metrics.successRate < 85) { // < 85%
            logWarning('PERFORMANCE_ALERT_SUCCESS', 'Tasa de éxito baja detectada', {
                currentRate: `${metrics.successRate}%`,
                threshold: '85%',
                recommendation: 'Verificar errores de OpenAI y funciones'
            });
        }
        
        // Alerta: Muchos hits de concurrencia
        if (metrics.concurrencyHits > metrics.openaiCalls * 0.3) { // > 30% de calls
            logWarning('PERFORMANCE_ALERT_CONCURRENCY', 'Alto nivel de concurrencia detectado', {
                concurrencyHits: metrics.concurrencyHits,
                totalCalls: metrics.openaiCalls,
                percentage: `${Math.round(metrics.concurrencyHits / metrics.openaiCalls * 100)}%`,
                recommendation: 'Considerar aumentar límite de concurrencia o optimizar carga'
            });
        }
    }
    
    // Reiniciar métricas
    reset() {
        this.metrics = {
            openaiCalls: 0,
            openaiLatencies: [],
            openaiErrors: 0,
            concurrencyHits: 0,
            functionCalls: 0,
            functionErrors: 0,
            messagesProcessed: 0,
            messagesSuccessful: 0,
            startTime: new Date()
        };
        
        logInfo('PERFORMANCE_METRICS_RESET', 'Métricas de performance reiniciadas');
    }
    
    // Obtener resumen de estadísticas
    getStatsSummary() {
        const metrics = this.getCurrentMetrics();
        const uptime = Date.now() - this.metrics.startTime.getTime();
        
        return {
            uptime: Math.round(uptime / 1000), // segundos
            totalRequests: this.metrics.messagesProcessed,
            avgLatency: metrics.openaiLatencyAvg,
            memoryMB: metrics.memoryUsageMB,
            successRate: metrics.successRate,
            alertsTriggered: 0 // Se podría implementar contador de alertas
        };
    }
}

// Instancia singleton para uso global
export const performanceMonitor = new PerformanceMonitor();