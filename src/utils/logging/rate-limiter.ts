/**
 * 🚦 SISTEMA DE RATE LIMITING PARA LOGGING
 * 
 * Previene log flooding y ataques de spam en el sistema de logging.
 * CRÍTICO para estabilidad en producción.
 */

interface RateLimitConfig {
    maxLogsPerMinute: number;
    maxLogsPerHour: number;
    maxLogsSameMessage: number;
    windowSizeMs: number;
    cleanupIntervalMs: number;
    enableCategoryLimits: boolean;
    enableUserLimits: boolean;
}

interface LogEntry {
    timestamp: number;
    category: string;
    messageHash: string;
    userId: string;
}

interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    remainingQuota?: number;
    resetTime?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
    maxLogsPerMinute: 100,        // 100 logs por minuto por usuario
    maxLogsPerHour: 1000,         // 1000 logs por hora por usuario
    maxLogsSameMessage: 5,        // Máximo 5 logs idénticos
    windowSizeMs: 60000,          // Ventana de 1 minuto
    cleanupIntervalMs: 300000,    // Limpiar cada 5 minutos
    enableCategoryLimits: true,
    enableUserLimits: true
};

/**
 * 🎯 LÍMITES POR CATEGORÍA
 */
const CATEGORY_LIMITS: Record<string, { perMinute: number; perHour: number }> = {
    // Categorías de alta frecuencia - límites más estrictos
    'MESSAGE_RECEIVED': { perMinute: 30, perHour: 500 },
    'MESSAGE_PROCESS': { perMinute: 20, perHour: 300 },
    'WHATSAPP_SEND': { perMinute: 25, perHour: 400 },
    
    // OpenAI - límites moderados
    'OPENAI_REQUEST': { perMinute: 15, perHour: 200 },
    'OPENAI_RESPONSE': { perMinute: 15, perHour: 200 },
    'FUNCTION_EXECUTING': { perMinute: 10, perHour: 150 },
    
    // Beds24 - límites moderados
    'BEDS24_REQUEST': { perMinute: 10, perHour: 100 },
    'BEDS24_API_CALL': { perMinute: 8, perHour: 80 },
    'BEDS24_RESPONSE_DETAIL': { perMinute: 12, perHour: 120 },
    
    // Sistema - límites altos (menos frecuentes pero importantes)
    'THREAD_CREATED': { perMinute: 5, perHour: 50 },
    'THREAD_PERSIST': { perMinute: 20, perHour: 200 },
    'SERVER_START': { perMinute: 1, perHour: 5 },
    'BOT_READY': { perMinute: 1, perHour: 5 },
    
    // Errores - límites especiales
    'ERROR': { perMinute: 50, perHour: 500 },    // Permitir más errores para debugging
    'WARNING': { perMinute: 30, perHour: 300 }
};

/**
 * 🔒 CLASE PRINCIPAL DE RATE LIMITING
 */
export class LogRateLimiter {
    private userLogs: Map<string, LogEntry[]> = new Map();
    private categoryLogs: Map<string, LogEntry[]> = new Map();
    private messageHashes: Map<string, number> = new Map();
    private config: RateLimitConfig;
    private cleanupTimer: NodeJS.Timeout | null = null;
    
    // Métricas
    private blockedLogs = 0;
    private totalChecks = 0;
    private blockedByUser = 0;
    private blockedByCategory = 0;
    private blockedByDuplicate = 0;
    
    constructor(customConfig?: Partial<RateLimitConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...customConfig };
        this.startCleanupTimer();
    }
    
    /**
     * 🔍 VERIFICAR SI LOG ESTÁ PERMITIDO
     */
    checkRateLimit(
        userId: string, 
        category: string, 
        message: string, 
        level: string = 'INFO'
    ): RateLimitResult {
        this.totalChecks++;
        
        const now = Date.now();
        const messageHash = this.generateMessageHash(message);
        
        // 1. Verificar límites por usuario
        if (this.config.enableUserLimits) {
            const userCheck = this.checkUserLimits(userId, now, category, messageHash);
            if (!userCheck.allowed) {
                this.blockedLogs++;
                this.blockedByUser++;
                return userCheck;
            }
        }
        
        // 2. Verificar límites por categoría
        if (this.config.enableCategoryLimits) {
            const categoryCheck = this.checkCategoryLimits(category, now, userId, messageHash);
            if (!categoryCheck.allowed) {
                this.blockedLogs++;
                this.blockedByCategory++;
                return categoryCheck;
            }
        }
        
        // 3. Verificar duplicados
        const duplicateCheck = this.checkDuplicateMessages(messageHash, now);
        if (!duplicateCheck.allowed) {
            this.blockedLogs++;
            this.blockedByDuplicate++;
            return duplicateCheck;
        }
        
        // 4. Registrar log si está permitido
        this.recordLog(userId, category, messageHash, now);
        
        return { 
            allowed: true, 
            remainingQuota: this.getRemainingQuota(userId, category, now)
        };
    }
    
    /**
     * 👤 VERIFICAR LÍMITES POR USUARIO
     */
    private checkUserLimits(userId: string, now: number, category: string, messageHash: string): RateLimitResult {
        const userLogs = this.getUserLogs(userId);
        
        // Limpiar logs antiguos
        const recentLogs = userLogs.filter(log => now - log.timestamp < this.config.windowSizeMs);
        const hourlyLogs = userLogs.filter(log => now - log.timestamp < 3600000); // 1 hora
        
        // Verificar límite por minuto
        if (recentLogs.length >= this.config.maxLogsPerMinute) {
            const oldestLog = Math.min(...recentLogs.map(log => log.timestamp));
            const resetTime = oldestLog + this.config.windowSizeMs;
            
            return {
                allowed: false,
                reason: `Usuario ${userId} excedió límite de ${this.config.maxLogsPerMinute} logs/minuto`,
                resetTime
            };
        }
        
        // Verificar límite por hora
        if (hourlyLogs.length >= this.config.maxLogsPerHour) {
            const oldestLog = Math.min(...hourlyLogs.map(log => log.timestamp));
            const resetTime = oldestLog + 3600000;
            
            return {
                allowed: false,
                reason: `Usuario ${userId} excedió límite de ${this.config.maxLogsPerHour} logs/hora`,
                resetTime
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * 🏷️ VERIFICAR LÍMITES POR CATEGORÍA
     */
    private checkCategoryLimits(category: string, now: number, userId: string, messageHash: string): RateLimitResult {
        const limits = CATEGORY_LIMITS[category];
        if (!limits) {
            return { allowed: true }; // Sin límites específicos para esta categoría
        }
        
        const categoryLogs = this.getCategoryLogs(category);
        
        // Limpiar logs antiguos
        const recentLogs = categoryLogs.filter(log => now - log.timestamp < this.config.windowSizeMs);
        const hourlyLogs = categoryLogs.filter(log => now - log.timestamp < 3600000);
        
        // Verificar límite por minuto para la categoría
        if (recentLogs.length >= limits.perMinute) {
            const oldestLog = Math.min(...recentLogs.map(log => log.timestamp));
            const resetTime = oldestLog + this.config.windowSizeMs;
            
            return {
                allowed: false,
                reason: `Categoría ${category} excedió límite de ${limits.perMinute} logs/minuto`,
                resetTime
            };
        }
        
        // Verificar límite por hora para la categoría
        if (hourlyLogs.length >= limits.perHour) {
            const oldestLog = Math.min(...hourlyLogs.map(log => log.timestamp));
            const resetTime = oldestLog + 3600000;
            
            return {
                allowed: false,
                reason: `Categoría ${category} excedió límite de ${limits.perHour} logs/hora`,
                resetTime
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * 🔄 VERIFICAR MENSAJES DUPLICADOS
     */
    private checkDuplicateMessages(messageHash: string, now: number): RateLimitResult {
        const count = this.messageHashes.get(messageHash) || 0;
        
        if (count >= this.config.maxLogsSameMessage) {
            return {
                allowed: false,
                reason: `Mensaje duplicado excedió límite de ${this.config.maxLogsSameMessage} repeticiones`
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * 📝 REGISTRAR LOG
     */
    private recordLog(userId: string, category: string, messageHash: string, timestamp: number): void {
        const logEntry: LogEntry = { timestamp, category, messageHash, userId };
        
        // Registrar por usuario
        const userLogs = this.getUserLogs(userId);
        userLogs.push(logEntry);
        this.userLogs.set(userId, userLogs);
        
        // Registrar por categoría
        const categoryLogs = this.getCategoryLogs(category);
        categoryLogs.push(logEntry);
        this.categoryLogs.set(category, categoryLogs);
        
        // Registrar hash de mensaje
        const currentCount = this.messageHashes.get(messageHash) || 0;
        this.messageHashes.set(messageHash, currentCount + 1);
    }
    
    /**
     * 📊 OBTENER CUOTA RESTANTE
     */
    private getRemainingQuota(userId: string, category: string, now: number): number {
        const userLogs = this.getUserLogs(userId);
        const recentLogs = userLogs.filter(log => now - log.timestamp < this.config.windowSizeMs);
        
        return Math.max(0, this.config.maxLogsPerMinute - recentLogs.length);
    }
    
    /**
     * 👤 OBTENER LOGS DE USUARIO
     */
    private getUserLogs(userId: string): LogEntry[] {
        return this.userLogs.get(userId) || [];
    }
    
    /**
     * 🏷️ OBTENER LOGS DE CATEGORÍA
     */
    private getCategoryLogs(category: string): LogEntry[] {
        return this.categoryLogs.get(category) || [];
    }
    
    /**
     * 🔨 GENERAR HASH DE MENSAJE
     */
    private generateMessageHash(message: string): string {
        // Hash simple pero efectivo
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit
        }
        return hash.toString(36);
    }
    
    /**
     * 🧹 INICIAR TIMER DE LIMPIEZA
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupIntervalMs);
    }
    
    /**
     * 🗑️ LIMPIAR DATOS ANTIGUOS
     */
    private cleanup(): void {
        const now = Date.now();
        const hourAgo = now - 3600000;
        let cleanedEntries = 0;
        
        // Limpiar logs de usuarios
        for (const [userId, logs] of this.userLogs.entries()) {
            const recentLogs = logs.filter(log => log.timestamp > hourAgo);
            if (recentLogs.length === 0) {
                this.userLogs.delete(userId);
            } else {
                this.userLogs.set(userId, recentLogs);
            }
            cleanedEntries += logs.length - recentLogs.length;
        }
        
        // Limpiar logs de categorías
        for (const [category, logs] of this.categoryLogs.entries()) {
            const recentLogs = logs.filter(log => log.timestamp > hourAgo);
            if (recentLogs.length === 0) {
                this.categoryLogs.delete(category);
            } else {
                this.categoryLogs.set(category, recentLogs);
            }
        }
        
        // Limpiar hashes de mensajes (cada 5 minutos)
        if (Math.random() < 0.2) { // 20% de probabilidad
            this.messageHashes.clear();
        }
        
        if (cleanedEntries > 0) {
            console.log(`🧹 Rate limiter cleanup: ${cleanedEntries} entradas antiguas eliminadas`);
        }
    }
    
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    getStats() {
        return {
            totalChecks: this.totalChecks,
            blockedLogs: this.blockedLogs,
            blockedByUser: this.blockedByUser,
            blockedByCategory: this.blockedByCategory,
            blockedByDuplicate: this.blockedByDuplicate,
            blockingRate: this.totalChecks > 0 ? (this.blockedLogs / this.totalChecks * 100).toFixed(2) + '%' : '0%',
            activeUsers: this.userLogs.size,
            activeCategories: this.categoryLogs.size,
            uniqueMessages: this.messageHashes.size,
            config: this.config
        };
    }
    
    /**
     * 🔄 RESETEAR ESTADÍSTICAS
     */
    reset(): void {
        this.userLogs.clear();
        this.categoryLogs.clear();
        this.messageHashes.clear();
        this.blockedLogs = 0;
        this.totalChecks = 0;
        this.blockedByUser = 0;
        this.blockedByCategory = 0;
        this.blockedByDuplicate = 0;
    }
    
    /**
     * 🛑 DESTRUCTOR
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.reset();
    }
    
    /**
     * ⚙️ ACTUALIZAR CONFIGURACIÓN
     */
    updateConfig(newConfig: Partial<RateLimitConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * 🎯 VERIFICACIÓN ESPECÍFICA POR USUARIO
     */
    getUserStatus(userId: string): {
        logsLastMinute: number;
        logsLastHour: number;
        quotaRemaining: number;
        isBlocked: boolean;
    } {
        const now = Date.now();
        const userLogs = this.getUserLogs(userId);
        
        const logsLastMinute = userLogs.filter(log => now - log.timestamp < this.config.windowSizeMs).length;
        const logsLastHour = userLogs.filter(log => now - log.timestamp < 3600000).length;
        
        return {
            logsLastMinute,
            logsLastHour,
            quotaRemaining: Math.max(0, this.config.maxLogsPerMinute - logsLastMinute),
            isBlocked: logsLastMinute >= this.config.maxLogsPerMinute
        };
    }
}

// Instancia singleton global
export const globalRateLimiter = new LogRateLimiter();

/**
 * 🤖 PARA IAs: SISTEMA DE RATE LIMITING ROBUSTO
 * 
 * Este sistema:
 * - Previene log flooding por usuario y categoría
 * - Límites configurables por tipo de log
 * - Detección de mensajes duplicados
 * - Limpieza automática de memoria
 * - Métricas detalladas de bloqueo
 * - Configuración dinámica
 * - Manejo eficiente de memoria
 * - Protección contra ataques de spam
 */ 