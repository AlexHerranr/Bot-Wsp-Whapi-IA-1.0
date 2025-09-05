"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBeds24Status = exports.trackApiCall = exports.trackLatencies = exports.trackUser = exports.trackBuffer = exports.setCacheSize = exports.trackCache = exports.trackChunks = exports.trackError = exports.trackFunction = exports.trackMessage = exports.metricsCollector = void 0;
// src/utils/logging/collectors.ts - Sistema de recolección de métricas para logging compacto
const index_1 = require("./index");
// 🔧 Contadores globales para métricas
class MetricsCollector {
    constructor() {
        this.messageCount = 0;
        this.functionCalls = 0;
        this.errors = 0;
        this.totalChunks = 0;
        this.totalLength = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.evictions = 0;
        this.activeBuffers = 0;
        this.mergedMessages = 0;
        this.abandonedBuffers = 0;
        this.voiceMessages = 0;
        this.textMessages = 0;
        this.activeUsers = new Set();
        this.latencies = [];
        this.lastHourReset = Date.now();
        this.cacheSize = 0;
        // Rate limiting tracking
        this.openaiCalls = 0;
        this.whapiCalls = 0;
        this.beds24Status = 'ok';
    }
    incrementMessage(length = 0) {
        this.messageCount++;
        this.totalLength += length;
    }
    incrementFunction() {
        this.functionCalls++;
    }
    incrementError() {
        this.errors++;
    }
    incrementChunks(count = 1) {
        this.totalChunks += count;
    }
    updateCache(hit, evicted = false) {
        if (hit) {
            this.cacheHits++;
        }
        else {
            this.cacheMisses++;
        }
        if (evicted) {
            this.evictions++;
        }
    }
    setCacheSize(size) {
        this.cacheSize = size;
    }
    updateBuffer(type, count = 1) {
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
    addActiveUser(userId) {
        this.activeUsers.add(userId);
    }
    addLatency(latency) {
        this.latencies.push(latency);
        // Keep only last 100 entries
        if (this.latencies.length > 100) {
            this.latencies = this.latencies.slice(-100);
        }
    }
    incrementApiCall(service) {
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
    setBeds24Status(status) {
        this.beds24Status = status;
    }
    resetHourlyMetrics() {
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
    collectSystemMetrics() {
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
    collectCacheMetrics() {
        const total = this.cacheHits + this.cacheMisses;
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            size: this.cacheSize,
            users: this.activeUsers.size,
            evictions: this.evictions
        };
    }
    collectBufferMetrics() {
        return {
            active: this.activeBuffers,
            merged: this.mergedMessages,
            abandoned: this.abandonedBuffers,
            voice: this.voiceMessages,
            text: this.textMessages
        };
    }
    collectUsageMetrics() {
        return {
            messagesPerHour: this.messageCount,
            totalChunks: this.totalChunks,
            averageLength: this.messageCount > 0 ? Math.round(this.totalLength / this.messageCount) : 0,
            functionsExecuted: this.functionCalls,
            errors: this.errors
        };
    }
    collectRateMetrics() {
        return {
            openaiRate: this.openaiCalls,
            openaiLimit: 25, // Default RPM limit
            whapiRate: this.whapiCalls,
            whapiLimit: 1000, // Default RPM limit
            beds24Status: this.beds24Status
        };
    }
    collectLatencyMetrics() {
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
    logAllMetrics() {
        this.resetHourlyMetrics();
        const sysMetrics = this.collectSystemMetrics();
        const cacheMetrics = this.collectCacheMetrics();
        const bufferMetrics = this.collectBufferMetrics();
        const usageMetrics = this.collectUsageMetrics();
        const rateMetrics = this.collectRateMetrics();
        const latencyMetrics = this.collectLatencyMetrics();
        (0, index_1.logSysMetric)('System metrics collected', sysMetrics);
        (0, index_1.logCacheMetric)('Cache metrics collected', cacheMetrics);
        (0, index_1.logBufferMetric)('Buffer metrics collected', bufferMetrics);
        (0, index_1.logUsageStats)('Usage statistics collected', usageMetrics);
        // Only log rate warnings if approaching limits
        if (rateMetrics.openaiRate / rateMetrics.openaiLimit > 0.8 ||
            rateMetrics.whapiRate / rateMetrics.whapiLimit > 0.8 ||
            rateMetrics.beds24Status !== 'ok') {
            (0, index_1.logRateWarn)('Rate limit warning', rateMetrics);
        }
        // Only log latencies if we have data
        if (this.latencies.length > 0) {
            (0, index_1.logLatencyMetric)('Average latencies', latencyMetrics);
        }
    }
}
// Global instance
exports.metricsCollector = new MetricsCollector();
// Auto-collect metrics every minute
setInterval(() => {
    exports.metricsCollector.logAllMetrics();
}, 60000); // 1 minute
// Utility functions for easy integration
const trackMessage = (length = 0) => exports.metricsCollector.incrementMessage(length);
exports.trackMessage = trackMessage;
const trackFunction = () => exports.metricsCollector.incrementFunction();
exports.trackFunction = trackFunction;
const trackError = () => exports.metricsCollector.incrementError();
exports.trackError = trackError;
const trackChunks = (count = 1) => exports.metricsCollector.incrementChunks(count);
exports.trackChunks = trackChunks;
const trackCache = (hit, evicted = false) => exports.metricsCollector.updateCache(hit, evicted);
exports.trackCache = trackCache;
const setCacheSize = (size) => exports.metricsCollector.setCacheSize(size);
exports.setCacheSize = setCacheSize;
const trackBuffer = (type, count = 1) => exports.metricsCollector.updateBuffer(type, count);
exports.trackBuffer = trackBuffer;
const trackUser = (userId) => exports.metricsCollector.addActiveUser(userId);
exports.trackUser = trackUser;
const trackLatencies = (latency) => exports.metricsCollector.addLatency(latency);
exports.trackLatencies = trackLatencies;
const trackApiCall = (service) => exports.metricsCollector.incrementApiCall(service);
exports.trackApiCall = trackApiCall;
const setBeds24Status = (status) => exports.metricsCollector.setBeds24Status(status);
exports.setBeds24Status = setBeds24Status;
