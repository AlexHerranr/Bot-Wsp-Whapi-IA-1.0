// src/utils/logging/collectors.ts - Sistema de recolección de métricas para logging compacto
import { 
    logSysMetric, 
    logCacheMetric, 
    logBufferMetric, 
    logUsageStats, 
    logRateWarn,
    logLatencyMetric 
} from './index';

interface SystemMetrics {
    memUsed: number;
    memTotal: number;
    cpu: number;
    connections: number;
    uptime: number;
    activeUsers: number;
}

interface CacheMetrics {
    hits: number;
    misses: number;
    size: number;
    users: number;
    evictions: number;
}

interface BufferMetrics {
    active: number;
    merged: number;
    abandoned: number;
    voice: number;
    text: number;
}

interface UsageMetrics {
    messagesPerHour: number;
    totalChunks: number;
    averageLength: number;
    functionsExecuted: number;
    errors: number;
}

interface RateMetrics {
    openaiRate: number;
    openaiLimit: number;
    whapiRate: number;
    whapiLimit: number;
    beds24Status: string;
}

interface LatencyMetrics {
    openaiLatency: number;
    beds24Latency: number;
    whapiLatency: number;
    dbLatency: number;
    totalLatency: number;
}

// 🔧 Contadores globales para métricas
class MetricsCollector {
    private messageCount = 0;
    private functionCalls = 0;
    private errors = 0;
    private totalChunks = 0;
    private totalLength = 0;
    private cacheHits = 0;
    private cacheMisses = 0;
    private evictions = 0;
    private activeBuffers = 0;
    private mergedMessages = 0;
    private abandonedBuffers = 0;
    private voiceMessages = 0;
    private textMessages = 0;
    private activeUsers = new Set<string>();
    private latencies: LatencyMetrics[] = [];
    private lastHourReset = Date.now();
    private cacheSize = 0;

    // Rate limiting tracking
    private openaiCalls = 0;
    private whapiCalls = 0;
    private beds24Status = 'ok';

    incrementMessage(length: number = 0): void {
        this.messageCount++;
        this.totalLength += length;
    }

    incrementFunction(): void {
        this.functionCalls++;
    }

    incrementError(): void {
        this.errors++;
    }

    incrementChunks(count: number = 1): void {
        this.totalChunks += count;
    }

    updateCache(hit: boolean, evicted: boolean = false): void {
        if (hit) {
            this.cacheHits++;
        } else {
            this.cacheMisses++;
        }
        if (evicted) {
            this.evictions++;
        }
    }

    setCacheSize(size: number): void {
        this.cacheSize = size;
    }

    updateBuffer(type: 'active' | 'merged' | 'abandoned' | 'voice' | 'text', count: number = 1): void {
        switch (type) {
            case 'active':
                this.activeBuffers = count; // Set absolute value
                break;
            case 'merged':
                this.mergedMessages += count;
                break;
            case 'abandoned':
                this.abandonedBuffers += count;
                break;
            case 'voice':
                this.voiceMessages += count;
                break;
            case 'text':
                this.textMessages += count;
                break;
        }
    }

    addActiveUser(userId: string): void {
        this.activeUsers.add(userId);
    }

    addLatency(latency: LatencyMetrics): void {
        this.latencies.push(latency);
        // Keep only last 100 entries
        if (this.latencies.length > 100) {
            this.latencies = this.latencies.slice(-100);
        }
    }

    incrementApiCall(service: 'openai' | 'whapi' | 'beds24'): void {
        switch (service) {
            case 'openai':
                this.openaiCalls++;
                break;
            case 'whapi':
                this.whapiCalls++;
                break;
            case 'beds24':
                // beds24 doesn't have rate limits, just track status
                break;
        }
    }

    setBeds24Status(status: string): void {
        this.beds24Status = status;
    }

    private resetHourlyMetrics(): void {
        const now = Date.now();
        if (now - this.lastHourReset > 60 * 60 * 1000) { // 1 hour
            this.messageCount = 0;
            this.functionCalls = 0;
            this.errors = 0;
            this.totalChunks = 0;
            this.totalLength = 0;
            this.mergedMessages = 0;
            this.abandonedBuffers = 0;
            this.voiceMessages = 0;
            this.textMessages = 0;
            this.openaiCalls = 0;
            this.whapiCalls = 0;
            this.activeUsers.clear();
            this.lastHourReset = now;
        }
    }

    collectSystemMetrics(): SystemMetrics {
        const memUsage = process.memoryUsage();
        return {
            memUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            memTotal: 512, // Default, can be detected dynamically
            cpu: 0, // Would need a CPU monitoring library
            connections: 0, // Would track active connections
            uptime: Math.floor(process.uptime()),
            activeUsers: this.activeUsers.size
        };
    }

    collectCacheMetrics(): CacheMetrics {
        const total = this.cacheHits + this.cacheMisses;
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            size: this.cacheSize,
            users: this.activeUsers.size,
            evictions: this.evictions
        };
    }

    collectBufferMetrics(): BufferMetrics {
        return {
            active: this.activeBuffers,
            merged: this.mergedMessages,
            abandoned: this.abandonedBuffers,
            voice: this.voiceMessages,
            text: this.textMessages
        };
    }

    collectUsageMetrics(): UsageMetrics {
        return {
            messagesPerHour: this.messageCount,
            totalChunks: this.totalChunks,
            averageLength: this.messageCount > 0 ? Math.round(this.totalLength / this.messageCount) : 0,
            functionsExecuted: this.functionCalls,
            errors: this.errors
        };
    }

    collectRateMetrics(): RateMetrics {
        return {
            openaiRate: this.openaiCalls,
            openaiLimit: 25, // Default RPM limit
            whapiRate: this.whapiCalls,
            whapiLimit: 1000, // Default RPM limit
            beds24Status: this.beds24Status
        };
    }

    collectLatencyMetrics(): LatencyMetrics {
        if (this.latencies.length === 0) {
            return {
                openaiLatency: 0,
                beds24Latency: 0,
                whapiLatency: 0,
                dbLatency: 0,
                totalLatency: 0
            };
        }

        // Calculate averages
        const avg = this.latencies.reduce((acc, curr) => ({
            openaiLatency: acc.openaiLatency + curr.openaiLatency,
            beds24Latency: acc.beds24Latency + curr.beds24Latency,
            whapiLatency: acc.whapiLatency + curr.whapiLatency,
            dbLatency: acc.dbLatency + curr.dbLatency,
            totalLatency: acc.totalLatency + curr.totalLatency
        }), { openaiLatency: 0, beds24Latency: 0, whapiLatency: 0, dbLatency: 0, totalLatency: 0 });

        const count = this.latencies.length;
        return {
            openaiLatency: Math.round(avg.openaiLatency / count),
            beds24Latency: Math.round(avg.beds24Latency / count),
            whapiLatency: Math.round(avg.whapiLatency / count),
            dbLatency: Math.round(avg.dbLatency / count),
            totalLatency: Math.round(avg.totalLatency / count)
        };
    }

    logAllMetrics(): void {
        this.resetHourlyMetrics();
        
        const sysMetrics = this.collectSystemMetrics();
        const cacheMetrics = this.collectCacheMetrics();
        const bufferMetrics = this.collectBufferMetrics();
        const usageMetrics = this.collectUsageMetrics();
        const rateMetrics = this.collectRateMetrics();
        const latencyMetrics = this.collectLatencyMetrics();

        logSysMetric('System metrics collected', sysMetrics);
        logCacheMetric('Cache metrics collected', cacheMetrics);
        logBufferMetric('Buffer metrics collected', bufferMetrics);
        logUsageStats('Usage statistics collected', usageMetrics);
        
        // Only log rate warnings if approaching limits
        if (rateMetrics.openaiRate / rateMetrics.openaiLimit > 0.8 || 
            rateMetrics.whapiRate / rateMetrics.whapiLimit > 0.8 ||
            rateMetrics.beds24Status !== 'ok') {
            logRateWarn('Rate limit warning', rateMetrics);
        }

        // Only log latencies if we have data
        if (this.latencies.length > 0) {
            logLatencyMetric('Average latencies', latencyMetrics);
        }
    }
}

// Global instance
export const metricsCollector = new MetricsCollector();

// Auto-collect metrics every minute
setInterval(() => {
    metricsCollector.logAllMetrics();
}, 60000); // 1 minute

// Utility functions for easy integration
export const trackMessage = (length: number = 0) => metricsCollector.incrementMessage(length);
export const trackFunction = () => metricsCollector.incrementFunction();
export const trackError = () => metricsCollector.incrementError();
export const trackChunks = (count: number = 1) => metricsCollector.incrementChunks(count);
export const trackCache = (hit: boolean, evicted: boolean = false) => metricsCollector.updateCache(hit, evicted);
export const setCacheSize = (size: number) => metricsCollector.setCacheSize(size);
export const trackBuffer = (type: 'active' | 'merged' | 'abandoned' | 'voice' | 'text', count: number = 1) => 
    metricsCollector.updateBuffer(type, count);
export const trackUser = (userId: string) => metricsCollector.addActiveUser(userId);
export const trackLatencies = (latency: LatencyMetrics) => metricsCollector.addLatency(latency);
export const trackApiCall = (service: 'openai' | 'whapi' | 'beds24') => metricsCollector.incrementApiCall(service);
export const setBeds24Status = (status: string) => metricsCollector.setBeds24Status(status);