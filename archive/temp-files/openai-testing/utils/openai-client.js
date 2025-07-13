import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde la raíz del proyecto
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Configuración centralizada
const config = {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID || 'org-SLzuAJSiM1gqPZbyX7gWQe8D',
    model: process.env.OPENAI_MODEL || 'o3-mini',
    rateLimits: {
        tokensPerMinute: 200000,
        requestsPerMinute: 10000
    }
};

class OpenAIClient {
    constructor(options = {}) {
        this.client = new OpenAI({
            apiKey: options.apiKey || config.apiKey,
            organization: options.organization || config.organization
        });
        
        this.model = options.model || config.model;
        this.rateLimits = { ...config.rateLimits, ...options.rateLimits };
        this.requestHistory = [];
        this.maxHistorySize = options.maxHistorySize || 50;
    }

    // Método para hacer requests con tracking
    async makeRequest(endpoint, options = {}) {
        const startTime = Date.now();
        
        try {
            const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${this.client.apiKey}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Extraer headers de rate limit
            const rateLimitHeaders = this.extractRateLimitHeaders(response);

            // Registrar request
            this.logRequest({
                endpoint,
                method: options.method || 'GET',
                duration,
                status: response.status,
                rateLimitHeaders,
                timestamp: new Date().toISOString()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return {
                data: await response.json(),
                headers: rateLimitHeaders,
                duration,
                status: response.status
            };

        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            this.logRequest({
                endpoint,
                method: options.method || 'GET',
                duration,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            throw error;
        }
    }

    extractRateLimitHeaders(response) {
        return {
            limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
            remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
            resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
            limitRequests: response.headers.get('x-ratelimit-limit-requests'),
            remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
            resetRequests: response.headers.get('x-ratelimit-reset-requests'),
            requestId: response.headers.get('x-request-id')
        };
    }

    logRequest(requestInfo) {
        this.requestHistory.push(requestInfo);
        
        // Mantener tamaño máximo del historial
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory.shift();
        }
    }

    // Métodos específicos para diferentes endpoints
    async listModels() {
        return this.makeRequest('/models');
    }

    async getModel(modelId) {
        return this.makeRequest(`/models/${modelId}`);
    }

    async createThread() {
        return this.makeRequest('/threads', {
            method: 'POST',
            body: JSON.stringify({})
        });
    }

    async getThread(threadId) {
        return this.makeRequest(`/threads/${threadId}`);
    }

    async listMessages(threadId, options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.order) params.append('order', options.order);
        if (options.after) params.append('after', options.after);
        if (options.before) params.append('before', options.before);
        
        const query = params.toString();
        const endpoint = `/threads/${threadId}/messages${query ? '?' + query : ''}`;
        
        return this.makeRequest(endpoint);
    }

    async addMessage(threadId, message) {
        return this.makeRequest(`/threads/${threadId}/messages`, {
            method: 'POST',
            body: JSON.stringify(message)
        });
    }

    async createRun(threadId, runConfig) {
        return this.makeRequest(`/threads/${threadId}/runs`, {
            method: 'POST',
            body: JSON.stringify(runConfig)
        });
    }

    async getRun(threadId, runId) {
        return this.makeRequest(`/threads/${threadId}/runs/${runId}`);
    }

    // Análisis de uso
    getUsageStats() {
        const validRequests = this.requestHistory.filter(req => !req.error);
        
        if (validRequests.length === 0) {
            return { message: 'No hay requests válidos para analizar' };
        }

        const durations = validRequests.map(req => req.duration);
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);

        const statusCounts = {};
        this.requestHistory.forEach(req => {
            const status = req.error ? 'ERROR' : req.status;
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        // Obtener último estado de rate limits
        const lastValidRequest = validRequests[validRequests.length - 1];
        const rateLimitStatus = lastValidRequest?.rateLimitHeaders ? {
            remainingTokens: parseInt(lastValidRequest.rateLimitHeaders.remainingTokens) || 0,
            limitTokens: parseInt(lastValidRequest.rateLimitHeaders.limitTokens) || this.rateLimits.tokensPerMinute,
            remainingRequests: parseInt(lastValidRequest.rateLimitHeaders.remainingRequests) || 0,
            limitRequests: parseInt(lastValidRequest.rateLimitHeaders.limitRequests) || this.rateLimits.requestsPerMinute
        } : null;

        return {
            totalRequests: this.requestHistory.length,
            validRequests: validRequests.length,
            errors: this.requestHistory.length - validRequests.length,
            performance: {
                avgDuration: Math.round(avgDuration),
                maxDuration,
                minDuration
            },
            statusCounts,
            rateLimitStatus,
            model: this.model,
            organization: config.organization
        };
    }

    // Guardar estadísticas
    saveStats() {
        const stats = {
            timestamp: new Date().toISOString(),
            config: {
                model: this.model,
                organization: config.organization,
                rateLimits: this.rateLimits
            },
            usage: this.getUsageStats(),
            requestHistory: this.requestHistory
        };

        const statsPath = path.join(__dirname, '..', 'results', 'client-stats.json');
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
        
        console.log(`💾 Estadísticas guardadas: ${this.requestHistory.length} requests`);
        return statsPath;
    }

    // Limpiar historial
    clearHistory() {
        this.requestHistory = [];
        console.log('🧹 Historial de requests limpiado');
    }

    // Verificar configuración
    validateConfig() {
        const issues = [];
        
        if (!config.apiKey) {
            issues.push('❌ OPENAI_API_KEY no configurada');
        }
        
        if (!config.organization) {
            issues.push('⚠️  OPENAI_ORG_ID no configurada (usando default)');
        }
        
        if (config.apiKey && !config.apiKey.startsWith('sk-')) {
            issues.push('⚠️  API Key no parece válida (debería empezar con sk-)');
        }

        return {
            valid: issues.length === 0,
            issues,
            config: {
                hasApiKey: !!config.apiKey,
                hasOrganization: !!config.organization,
                model: this.model,
                rateLimits: this.rateLimits
            }
        };
    }
}

// Función helper para crear cliente con configuración por defecto
export function createOpenAIClient(options = {}) {
    return new OpenAIClient(options);
}

// Función para verificar configuración
export function checkConfiguration() {
    const client = new OpenAIClient();
    return client.validateConfig();
}

export default OpenAIClient; 