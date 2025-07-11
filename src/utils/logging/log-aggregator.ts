/**
 * 📊 SISTEMA DE AGREGACIÓN INTELIGENTE DE LOGS
 * 
 * Agrupa logs similares en un buffer de 5 segundos para reducir duplicación
 * y ruido en Google Cloud Logging, optimizado para análisis automático.
 */

import { LogLevel, LogEntry } from './types';

interface AggregatedLogEntry {
    firstOccurrence: string;
    lastOccurrence: string;
    count: number;
    level: LogLevel;
    category: string;
    message: string;
    aggregatedDetails: any[];
    environment: string;
    users: Set<string>;
    hash: string;
}

interface LogBuffer {
    entries: Map<string, AggregatedLogEntry>;
    timer: NodeJS.Timeout | null;
    isFlushInProgress: boolean;
}

/**
 * 🎯 CLASE PRINCIPAL DE AGREGACIÓN
 */
export class LogAggregator {
    private buffer: LogBuffer = {
        entries: new Map(),
        timer: null,
        isFlushInProgress: false
    };
    
    private readonly BUFFER_TIME = 5000; // 5 segundos
    private readonly MAX_BUFFER_SIZE = 1000; // Máximo 1000 logs en buffer
    private readonly MAX_AGGREGATED_DETAILS = 10; // Máximo 10 detalles por log agregado
    
    // ✨ LÍMITES ESTRICTOS DE MEMORIA (MEJORA CRÍTICA)
    private readonly MAX_MEMORY_MB = 50; // Máximo 50MB para el buffer
    private readonly FORCE_FLUSH_SIZE = 500; // Forzar flush a los 500 logs
    private readonly MAX_MESSAGE_LENGTH = 1000; // Máximo 1000 chars por mensaje
    
    private emitFunction: (logString: string) => void;
    
    constructor(emitFunction: (logString: string) => void) {
        this.emitFunction = emitFunction;
    }
    
    /**
     * 📝 AGREGAR LOG AL BUFFER
     */
    addLog(entry: LogEntry): void {
        // Generar hash único para el log
        const hash = this.generateLogHash(entry);
        
        // Verificar si ya existe en buffer
        const existing = this.buffer.entries.get(hash);
        
        if (existing) {
            // Actualizar log existente
            this.updateExistingLog(existing, entry);
        } else {
            // Crear nuevo log agregado
            this.createNewAggregatedLog(hash, entry);
        }
        
        // Verificar límites del buffer
        this.checkBufferLimits();
        
        // Programar flush si no está ya programado
        this.scheduleFlush();
    }
    
    /**
     * 🔑 GENERAR HASH ÚNICO PARA LOG
     */
    private generateLogHash(entry: LogEntry): string {
        // Combinar elementos clave para crear hash único
        const keyElements = [
            entry.level,
            entry.category,
            this.normalizeMessage(entry.message),
            entry.details?.functionName || '',
            entry.details?.endpoint || '',
            entry.details?.operation || '',
            entry.environment
        ];
        
        // Crear hash simple pero efectivo
        const hashString = keyElements.join('|');
        return Buffer.from(hashString).toString('base64').substring(0, 16);
    }
    
    /**
     * 📝 NORMALIZAR MENSAJE PARA AGREGACIÓN
     */
    private normalizeMessage(message: string): string {
        // Remover elementos variables para permitir agregación
        return message
            .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD') // Fechas
            .replace(/\d{2}:\d{2}:\d{2}/g, 'HH:MM:SS')   // Horas
            .replace(/\d+ms/g, 'XXXms')                    // Duraciones
            .replace(/\d+\.\d+s/g, 'XX.Xs')               // Duraciones en segundos
            .replace(/thread_[a-zA-Z0-9]+/g, 'thread_XXX') // Thread IDs
            .replace(/run_[a-zA-Z0-9]+/g, 'run_XXX')       // Run IDs
            .replace(/session-\d+/g, 'session-XXX')       // Session IDs
            .replace(/\d{10,}/g, 'TIMESTAMP')             // Timestamps
            .trim();
    }
    
    /**
     * 🔄 ACTUALIZAR LOG EXISTENTE
     */
    private updateExistingLog(existing: AggregatedLogEntry, newEntry: LogEntry): void {
        existing.count++;
        existing.lastOccurrence = newEntry.timestamp;
        
        // Agregar usuario si es diferente
        const userId = newEntry.details?.userId || newEntry.details?.shortUserId || 'system';
        existing.users.add(userId);
        
        // Agregar detalles si no excede el límite
        if (existing.aggregatedDetails.length < this.MAX_AGGREGATED_DETAILS) {
            existing.aggregatedDetails.push({
                timestamp: newEntry.timestamp,
                details: newEntry.details,
                userId
            });
        }
        
        // Actualizar nivel si es más crítico
        if (this.isMoreCritical(newEntry.level, existing.level)) {
            existing.level = newEntry.level;
        }
    }
    
    /**
     * 🆕 CREAR NUEVO LOG AGREGADO
     */
    private createNewAggregatedLog(hash: string, entry: LogEntry): void {
        const userId = entry.details?.userId || entry.details?.shortUserId || 'system';
        
        const aggregatedEntry: AggregatedLogEntry = {
            firstOccurrence: entry.timestamp,
            lastOccurrence: entry.timestamp,
            count: 1,
            level: entry.level,
            category: entry.category,
            message: entry.message,
            aggregatedDetails: [{
                timestamp: entry.timestamp,
                details: entry.details,
                userId
            }],
            environment: entry.environment,
            users: new Set([userId]),
            hash
        };
        
        this.buffer.entries.set(hash, aggregatedEntry);
    }
    
    /**
     * 🔍 VERIFICAR SI UN NIVEL ES MÁS CRÍTICO
     */
    private isMoreCritical(newLevel: LogLevel, currentLevel: LogLevel): boolean {
        const hierarchy = { 'DEBUG': 0, 'INFO': 1, 'SUCCESS': 2, 'WARNING': 3, 'ERROR': 4 };
        return hierarchy[newLevel] > hierarchy[currentLevel];
    }
    
    /**
     * 📏 VERIFICAR LÍMITES DEL BUFFER - MEJORADO CON LÍMITES DE MEMORIA
     */
    private checkBufferLimits(): void {
        // 1. Verificar límite por cantidad
        if (this.buffer.entries.size >= this.MAX_BUFFER_SIZE) {
            this.flushBuffer();
            return;
        }
        
        // 2. ✨ VERIFICAR LÍMITE DE MEMORIA
        const memoryUsage = this.getMemoryUsage();
        if (memoryUsage > this.MAX_MEMORY_MB) {
            console.warn(`🚨 Buffer memory limit exceeded: ${memoryUsage}MB > ${this.MAX_MEMORY_MB}MB. Force flushing.`);
            this.flushBuffer();
            return;
        }
        
        // 3. ✨ FLUSH PREVENTIVO
        if (this.buffer.entries.size >= this.FORCE_FLUSH_SIZE) {
            console.log(`⚡ Preventive flush at ${this.buffer.entries.size} logs`);
            this.flushBuffer();
            return;
        }
    }
    
    /**
     * 💾 CALCULAR USO DE MEMORIA DEL BUFFER
     */
    private getMemoryUsage(): number {
        try {
            const bufferString = JSON.stringify(Array.from(this.buffer.entries.values()));
            return Math.round(Buffer.byteLength(bufferString, 'utf8') / 1024 / 1024); // MB
        } catch (error) {
            console.error('Error calculating buffer memory usage:', error);
            return 0;
        }
    }
    
    /**
     * ⏰ PROGRAMAR FLUSH DEL BUFFER
     */
    private scheduleFlush(): void {
        if (this.buffer.timer || this.buffer.isFlushInProgress) {
            return; // Ya hay un flush programado o en progreso
        }
        
        this.buffer.timer = setTimeout(() => {
            this.flushBuffer();
        }, this.BUFFER_TIME);
    }
    
    /**
     * 🚀 EJECUTAR FLUSH DEL BUFFER
     */
    private flushBuffer(): void {
        if (this.buffer.isFlushInProgress) return;
        
        this.buffer.isFlushInProgress = true;
        
        try {
            // Limpiar timer
            if (this.buffer.timer) {
                clearTimeout(this.buffer.timer);
                this.buffer.timer = null;
            }
            
            // Procesar todos los logs agregados
            for (const [hash, aggregatedEntry] of this.buffer.entries) {
                this.emitAggregatedLog(aggregatedEntry);
            }
            
            // Limpiar buffer
            this.buffer.entries.clear();
            
        } finally {
            this.buffer.isFlushInProgress = false;
        }
    }
    
    /**
     * 📤 EMITIR LOG AGREGADO
     */
    private emitAggregatedLog(aggregated: AggregatedLogEntry): void {
        // Crear mensaje agregado
        const aggregatedMessage = aggregated.count > 1 
            ? `${aggregated.message} (×${aggregated.count} occurrences)`
            : aggregated.message;
        
        // Crear entrada estructurada para Google Cloud
        const structuredEntry = {
            timestamp: aggregated.lastOccurrence,
            severity: this.mapLevelToGoogleSeverity(aggregated.level),
            message: `[${aggregated.category}] ${aggregatedMessage}`,
            
            jsonPayload: {
                // Información de agregación
                aggregation: {
                    isAggregated: aggregated.count > 1,
                    count: aggregated.count,
                    firstOccurrence: aggregated.firstOccurrence,
                    lastOccurrence: aggregated.lastOccurrence,
                    timeSpan: this.calculateTimeSpan(aggregated.firstOccurrence, aggregated.lastOccurrence),
                    uniqueUsers: Array.from(aggregated.users),
                    hash: aggregated.hash
                },
                
                // Información básica
                category: aggregated.category,
                level: aggregated.level,
                environment: aggregated.environment,
                
                // Detalles agregados (limitados)
                details: aggregated.aggregatedDetails.slice(0, 5), // Solo primeros 5
                
                // Estadísticas
                stats: {
                    totalOccurrences: aggregated.count,
                    uniqueUsersCount: aggregated.users.size,
                    avgFrequency: this.calculateFrequency(aggregated)
                }
            },
            
            labels: {
                'app': 'whatsapp-bot',
                'category': aggregated.category,
                'level': aggregated.level,
                'environment': aggregated.environment,
                'isAggregated': aggregated.count > 1 ? 'true' : 'false',
                'aggregationCount': aggregated.count.toString(),
                'component': this.getCategoryComponent(aggregated.category)
            },
            
            resource: {
                type: 'cloud_run_revision',
                labels: {
                    'service_name': process.env.K_SERVICE || 'bot-wsp-whapi-ia',
                    'revision_name': process.env.K_REVISION || 'local',
                    'location': process.env.GOOGLE_CLOUD_REGION || 'us-central1'
                }
            }
        };
        
        // Emitir log estructurado
        this.emitFunction(JSON.stringify(structuredEntry));
    }
    
    /**
     * ⏱️ CALCULAR SPAN DE TIEMPO
     */
    private calculateTimeSpan(start: string, end: string): string {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        const diffMs = endTime - startTime;
        
        if (diffMs < 1000) return `${diffMs}ms`;
        if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
        return `${(diffMs / 60000).toFixed(1)}m`;
    }
    
    /**
     * 📊 CALCULAR FRECUENCIA PROMEDIO
     */
    private calculateFrequency(aggregated: AggregatedLogEntry): string {
        if (aggregated.count === 1) return '1/occurrence';
        
        const startTime = new Date(aggregated.firstOccurrence).getTime();
        const endTime = new Date(aggregated.lastOccurrence).getTime();
        const diffSeconds = (endTime - startTime) / 1000;
        
        if (diffSeconds === 0) return `${aggregated.count}/instant`;
        
        const frequency = aggregated.count / diffSeconds;
        return `${frequency.toFixed(2)}/s`;
    }
    
    /**
     * 🏷️ OBTENER COMPONENTE POR CATEGORÍA
     */
    private getCategoryComponent(category: string): string {
        if (category.startsWith('MESSAGE_')) return 'messaging';
        if (category.startsWith('OPENAI_')) return 'ai-processing';
        if (category.startsWith('BEDS24_')) return 'beds24-integration';
        if (category.startsWith('THREAD_')) return 'thread-management';
        if (category.startsWith('WHATSAPP_')) return 'whatsapp-api';
        if (category.startsWith('FUNCTION_')) return 'function-calling';
        return 'other';
    }
    
    /**
     * 🎚️ MAPEAR NIVEL A SEVERIDAD DE GOOGLE CLOUD
     */
    private mapLevelToGoogleSeverity(level: LogLevel): string {
        const mapping: Record<LogLevel, string> = {
            'DEBUG': 'DEBUG',
            'INFO': 'INFO',
            'SUCCESS': 'INFO',
            'WARNING': 'WARNING',
            'ERROR': 'ERROR'
        };
        return mapping[level] || 'INFO';
    }
    
    /**
     * 📊 OBTENER ESTADÍSTICAS DEL AGREGADOR
     */
    getStats() {
        return {
            bufferSize: this.buffer.entries.size,
            isFlushInProgress: this.buffer.isFlushInProgress,
            hasScheduledFlush: this.buffer.timer !== null,
            aggregatedEntries: Array.from(this.buffer.entries.values()).map(entry => ({
                category: entry.category,
                count: entry.count,
                users: entry.users.size,
                timeSpan: this.calculateTimeSpan(entry.firstOccurrence, entry.lastOccurrence)
            }))
        };
    }
    
    /**
     * 🧹 FORZAR FLUSH INMEDIATO
     */
    forceFlush(): void {
        this.flushBuffer();
    }
    
    /**
     * 🔄 LIMPIAR BUFFER
     */
    clear(): void {
        if (this.buffer.timer) {
            clearTimeout(this.buffer.timer);
            this.buffer.timer = null;
        }
        this.buffer.entries.clear();
        this.buffer.isFlushInProgress = false;
    }
}

/**
 * 🤖 PARA IAs: SISTEMA DE AGREGACIÓN INTELIGENTE
 * 
 * Este sistema:
 * - Agrupa logs similares en ventanas de 5 segundos
 * - Reduce duplicación manteniendo información importante
 * - Preserva detalles críticos y métricas de frecuencia
 * - Optimiza el volumen de logs para Google Cloud
 * - Facilita análisis de patrones y tendencias
 * - Mantiene trazabilidad con hashes únicos
 */ 