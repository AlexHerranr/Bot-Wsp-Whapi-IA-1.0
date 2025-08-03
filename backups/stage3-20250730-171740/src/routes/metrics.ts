/**
 * 📊 ENDPOINT DE MÉTRICAS PARA DASHBOARD DE LOGGING
 * 
 * Proporciona métricas en tiempo real del sistema de logging para análisis
 * y monitoreo del rendimiento del bot en Google Cloud Run.
 */

import { Router, Request, Response } from 'express';
// --- INICIO PROMETHEUS ---
import client from 'prom-client';

const router = Router();

// --- MÉTRICAS PROMETHEUS ---
const fallbackCounter = new client.Counter({
    name: 'bot_fallbacks_total',
    help: 'Total de fallbacks activados en el bot'
});
const tokenGauge = new client.Gauge({
    name: 'openai_tokens_used',
    help: 'Tokens usados en el último run de OpenAI'
});
const latencyGauge = new client.Gauge({
    name: 'openai_latency_ms',
    help: 'Latencia (ms) del último run de OpenAI'
});
const messagesCounter = new client.Counter({
    name: 'bot_messages_processed_total',
    help: 'Total de mensajes procesados por el bot'
});
const threadsGauge = new client.Gauge({
    name: 'bot_active_threads',
    help: 'Threads activos en memoria'
});

// 🔧 ETAPA 2: Métricas para cache de labels
const labelCacheHitsCounter = new client.Counter({
    name: 'label_cache_hits_total',
    help: 'Total de hits en cache de labels'
});
const labelCacheMissesCounter = new client.Counter({
    name: 'label_cache_misses_total',
    help: 'Total de misses en cache de labels'
});
const labelCacheSizeGauge = new client.Gauge({
    name: 'label_cache_size',
    help: 'Número de entradas en cache de labels'
});
const labelCacheInvalidationsCounter = new client.Counter({
    name: 'label_cache_invalidations_total',
    help: 'Total de invalidaciones de cache de labels'
});

// 🔧 ETAPA 3: Métricas para duplicados evitados
const syncCallsCounter = new client.Counter({
    name: 'label_sync_calls_total',
    help: 'Total de llamadas a sincronización de labels'
});
const duplicatesAvoidedCounter = new client.Counter({
    name: 'label_duplicates_avoided_total',
    help: 'Total de duplicados evitados por cache'
});

// Contador de hits de patrones temáticos
export const patternHitsCounter = new client.Counter({
    name: 'pattern_hits_total',
    help: 'Total de veces que se detectó un patrón temático y se forzó inyección de contexto.'
});

// 🔧 ETAPA 3: Métricas para fuzzy matching
export const fuzzyHitsCounter = new client.Counter({
    name: 'fuzzy_hits_total',
    help: 'Total de matches fuzzy encontrados en patrones y contexto'
});

// 🔧 ETAPA 4: Métricas para race conditions y errores
export const raceErrorsCounter = new client.Counter({
    name: 'race_errors_total',
    help: 'Total de errores de race condition en threads'
});

// 🔧 ETAPA 4: Métricas para cleanup de tokens
export const tokenCleanupsCounter = new client.Counter({
    name: 'token_cleanups_total',
    help: 'Total de cleanups de threads con alto uso de tokens'
});

// 🔧 ETAPA 4: Gauge para threads con alto uso de tokens
export const highTokenThreadsGauge = new client.Gauge({
    name: 'high_token_threads',
    help: 'Número de threads con uso de tokens por encima del threshold'
});

// --- FIN PROMETHEUS ---

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
 * 📊 GET /metrics - Métricas Prometheus
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        res.set('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    } catch (error: any) {
        res.status(500).send('Error generando métricas Prometheus: ' + error.message);
    }
});

/**
 * 📊 GET /metrics/json - Métricas básicas del sistema (JSON)
 */
router.get('/json', (req: Request, res: Response) => {
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
                endpoint: '/metrics/json',
                version: '2.0.0',
                description: 'Métricas básicas del sistema (JSON)'
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

/**
 * 🔧 ETAPA 2: GET /metrics/cache - Estadísticas del cache de labels
 */
router.get('/cache', (req: Request, res: Response) => {
    try {
        // Cache obsoleto removido - usar CacheManager modular
        res.json({
            success: true,
            data: {
                cache: {
                    enabled: false,
                    message: 'Cache migrado a CacheManager modular'
                },
                metrics: {
                    hits: labelCacheHitsCounter.get(),
                    misses: labelCacheMissesCounter.get(),
                    size: labelCacheSizeGauge.get(),
                    invalidations: labelCacheInvalidationsCounter.get()
                }
            },
            meta: {
                endpoint: '/metrics/cache',
                version: '2.0.0',
                description: 'Estadísticas del cache de labels'
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Error obteniendo estadísticas del cache',
            message: error.message
        });
    }
});

// --- FUNCIONES PARA USO EXTERNO (desde el bot) ---
export const recordLog = () => {
    metrics.totalLogs++;
};
export const updateActiveThreads = (count: number) => {
    metrics.activeThreads = count;
    threadsGauge.set(count);
};
export const incrementFallbacks = () => {
    fallbackCounter.inc();
};
export const setTokensUsed = (tokens: number) => {
    tokenGauge.set(tokens);
};
export const setLatency = (ms: number) => {
    latencyGauge.set(ms);
};
export const incrementMessages = () => {
    messagesCounter.inc();
};

// 🔧 ETAPA 2: Funciones para métricas del cache de labels
export const incrementLabelCacheHits = () => {
    labelCacheHitsCounter.inc();
};
export const incrementLabelCacheMisses = () => {
    labelCacheMissesCounter.inc();
};
export const setLabelCacheSize = (size: number) => {
    labelCacheSizeGauge.set(size);
};
export const incrementLabelCacheInvalidations = () => {
    labelCacheInvalidationsCounter.inc();
};

// 🔧 ETAPA 3: Funciones para métricas de duplicados
export const incrementSyncCalls = () => {
    syncCallsCounter.inc();
};
export const incrementDuplicatesAvoided = () => {
    duplicatesAvoidedCounter.inc();
};

// 🔧 ETAPA 3: Función para incrementar fuzzy hits
export const incrementFuzzyHits = () => {
    fuzzyHitsCounter.inc();
};

// 🔧 ETAPA 4: Funciones para métricas de performance
export const incrementRaceErrors = () => {
    raceErrorsCounter.inc();
};

export const incrementTokenCleanups = () => {
    tokenCleanupsCounter.inc();
};

export const setHighTokenThreads = (count: number) => {
    highTokenThreadsGauge.set(count);
};

// Exportar el router como default
export default router; 