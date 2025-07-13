import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde la raíz del proyecto
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Configurar cliente OpenAI
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class RateLimitMonitor {
    constructor(options = {}) {
        this.intervalMs = options.intervalMs || 30000; // 30 segundos por defecto
        this.alertThresholds = {
            critical: options.criticalThreshold || 95,
            warning: options.warningThreshold || 80,
            info: options.infoThreshold || 60
        };
        this.logHistory = [];
        this.maxHistorySize = options.maxHistorySize || 100;
        this.isRunning = false;
        this.intervalId = null;
        this.lastAlertLevel = null;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 5;
    }

    async checkRateLimit() {
        try {
            // Hacer request pequeño para obtener headers
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Extraer headers de rate limit
            const headers = {
                limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
                remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
                resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
                limitRequests: response.headers.get('x-ratelimit-limit-requests'),
                remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
                resetRequests: response.headers.get('x-ratelimit-reset-requests')
            };

            // Calcular métricas
            const limitTokens = parseInt(headers.limitTokens) || 200000;
            const remainingTokens = parseInt(headers.remainingTokens) || 0;
            const usedTokens = limitTokens - remainingTokens;
            const usagePercentage = (usedTokens / limitTokens) * 100;

            const status = {
                timestamp: new Date().toISOString(),
                time: new Date().toLocaleTimeString(),
                limitTokens,
                remainingTokens,
                usedTokens,
                usagePercentage: Math.round(usagePercentage * 100) / 100,
                resetTimeSeconds: headers.resetTokens ? parseFloat(headers.resetTokens) : null,
                limitRequests: headers.limitRequests ? parseInt(headers.limitRequests) : null,
                remainingRequests: headers.remainingRequests ? parseInt(headers.remainingRequests) : null,
                alertLevel: this.getAlertLevel(usagePercentage)
            };

            // Resetear contador de errores consecutivos
            this.consecutiveErrors = 0;

            return status;

        } catch (error) {
            this.consecutiveErrors++;
            
            const errorStatus = {
                timestamp: new Date().toISOString(),
                time: new Date().toLocaleTimeString(),
                error: error.message,
                consecutiveErrors: this.consecutiveErrors,
                alertLevel: 'ERROR'
            };

            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                console.log(`🚨 ALERTA: ${this.consecutiveErrors} errores consecutivos. Pausando monitor...`);
                this.stop();
            }

            return errorStatus;
        }
    }

    getAlertLevel(usagePercentage) {
        if (usagePercentage >= this.alertThresholds.critical) return 'CRITICAL';
        if (usagePercentage >= this.alertThresholds.warning) return 'WARNING';
        if (usagePercentage >= this.alertThresholds.info) return 'INFO';
        return 'OK';
    }

    getAlertEmoji(level) {
        switch (level) {
            case 'CRITICAL': return '🚨';
            case 'WARNING': return '⚠️';
            case 'INFO': return '📊';
            case 'OK': return '✅';
            case 'ERROR': return '❌';
            default: return '❓';
        }
    }

    displayStatus(status) {
        const emoji = this.getAlertEmoji(status.alertLevel);
        
        if (status.error) {
            console.log(`${emoji} ${status.time} | ERROR: ${status.error} (${status.consecutiveErrors}/${this.maxConsecutiveErrors})`);
            return;
        }

        // Mostrar línea de estado
        const tokensDisplay = `${status.remainingTokens.toLocaleString()}/${status.limitTokens.toLocaleString()}`;
        const percentageDisplay = `${status.usagePercentage}%`;
        const resetDisplay = status.resetTimeSeconds ? `Reset: ${Math.round(status.resetTimeSeconds)}s` : '';
        
        console.log(`${emoji} ${status.time} | Tokens: ${tokensDisplay} | Uso: ${percentageDisplay} | ${resetDisplay}`);

        // Mostrar alerta si cambió el nivel
        if (status.alertLevel !== this.lastAlertLevel && status.alertLevel !== 'OK') {
            this.showAlert(status);
        }
        
        this.lastAlertLevel = status.alertLevel;
    }

    showAlert(status) {
        console.log('\n' + '='.repeat(60));
        console.log(`🚨 ALERTA DE RATE LIMIT: ${status.alertLevel}`);
        console.log('='.repeat(60));
        console.log(`⏰ Tiempo: ${status.time}`);
        console.log(`📊 Uso actual: ${status.usagePercentage}%`);
        console.log(`🔢 Tokens restantes: ${status.remainingTokens.toLocaleString()}`);
        console.log(`⏳ Reset en: ${status.resetTimeSeconds ? Math.round(status.resetTimeSeconds) + 's' : 'N/A'}`);
        
        if (status.alertLevel === 'CRITICAL') {
            console.log('🚨 ACCIÓN REQUERIDA: Pausar requests inmediatamente');
        } else if (status.alertLevel === 'WARNING') {
            console.log('⚠️  RECOMENDACIÓN: Reducir frecuencia de requests');
        }
        
        console.log('='.repeat(60) + '\n');
    }

    addToHistory(status) {
        this.logHistory.push(status);
        
        // Mantener tamaño máximo del historial
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }
    }

    saveHistoryToFile() {
        try {
            const historyData = {
                timestamp: new Date().toISOString(),
                monitorConfig: {
                    intervalMs: this.intervalMs,
                    alertThresholds: this.alertThresholds,
                    maxHistorySize: this.maxHistorySize
                },
                history: this.logHistory,
                summary: this.generateSummary()
            };

            const historyPath = path.join(__dirname, '..', 'results', 'monitor-history.json');
            fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2));
            
            console.log(`💾 Historial guardado: ${this.logHistory.length} registros`);
        } catch (error) {
            console.error('❌ Error guardando historial:', error.message);
        }
    }

    generateSummary() {
        const validEntries = this.logHistory.filter(entry => !entry.error);
        
        if (validEntries.length === 0) {
            return { message: 'No hay datos válidos para generar resumen' };
        }

        const usagePercentages = validEntries.map(entry => entry.usagePercentage);
        const maxUsage = Math.max(...usagePercentages);
        const minUsage = Math.min(...usagePercentages);
        const avgUsage = usagePercentages.reduce((sum, val) => sum + val, 0) / usagePercentages.length;

        const alertCounts = {};
        this.logHistory.forEach(entry => {
            alertCounts[entry.alertLevel] = (alertCounts[entry.alertLevel] || 0) + 1;
        });

        return {
            totalEntries: this.logHistory.length,
            validEntries: validEntries.length,
            errors: this.logHistory.length - validEntries.length,
            usage: {
                max: Math.round(maxUsage * 100) / 100,
                min: Math.round(minUsage * 100) / 100,
                average: Math.round(avgUsage * 100) / 100
            },
            alerts: alertCounts,
            monitorDuration: validEntries.length > 0 ? 
                Math.round((this.intervalMs * validEntries.length) / 1000 / 60) + ' minutos' : '0 minutos'
        };
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Monitor ya está ejecutándose');
            return;
        }

        console.log('🚀 Iniciando Monitor de Rate Limits...');
        console.log(`⏱️  Intervalo: ${this.intervalMs / 1000} segundos`);
        console.log(`📊 Umbrales: INFO(${this.alertThresholds.info}%) | WARNING(${this.alertThresholds.warning}%) | CRITICAL(${this.alertThresholds.critical}%)`);
        console.log('📝 Presiona Ctrl+C para detener\n');

        this.isRunning = true;
        
        // Primera verificación inmediata
        const initialStatus = await this.checkRateLimit();
        this.displayStatus(initialStatus);
        this.addToHistory(initialStatus);

        // Configurar intervalo
        this.intervalId = setInterval(async () => {
            const status = await this.checkRateLimit();
            this.displayStatus(status);
            this.addToHistory(status);
        }, this.intervalMs);

        // Guardar historial cada 5 minutos
        const saveInterval = setInterval(() => {
            this.saveHistoryToFile();
        }, 5 * 60 * 1000);

        // Manejar cierre del programa
        process.on('SIGINT', () => {
            console.log('\n🛑 Deteniendo monitor...');
            this.stop();
            clearInterval(saveInterval);
            this.saveHistoryToFile();
            console.log('✅ Monitor detenido correctamente');
            process.exit(0);
        });
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('\n📊 RESUMEN FINAL:');
        const summary = this.generateSummary();
        console.log(JSON.stringify(summary, null, 2));
    }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    const monitor = new RateLimitMonitor({
        intervalMs: 30000, // 30 segundos
        criticalThreshold: 95,
        warningThreshold: 80,
        infoThreshold: 60,
        maxHistorySize: 200
    });

    monitor.start();
}

export default RateLimitMonitor; 