#!/usr/bin/env node

/**
 * 🔍 VALIDACIÓN DE LOGGING EN GOOGLE CLOUD RUN
 * 
 * Script para verificar que el sistema de logging funciona correctamente
 * después del deploy en Google Cloud Run staging.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración
const CONFIG = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id',
    serviceName: process.env.K_SERVICE || 'bot-wsp-whapi-ia',
    region: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
    validationDuration: 300, // 5 minutos
    expectedCategories: [
        'MESSAGE_RECEIVED',
        'MESSAGE_PROCESS', 
        'WHATSAPP_SEND',
        'WHATSAPP_CHUNKS_COMPLETE',
        'OPENAI_REQUEST',
        'OPENAI_RESPONSE',
        'FUNCTION_CALLING_START',
        'FUNCTION_EXECUTING',
        'FUNCTION_HANDLER',
        'BEDS24_REQUEST',
        'BEDS24_API_CALL',
        'BEDS24_RESPONSE_DETAIL',
        'BEDS24_PROCESSING',
        'THREAD_CREATED',
        'THREAD_PERSIST',
        'THREAD_CLEANUP',
        'SERVER_START',
        'BOT_READY'
    ]
};

class CloudRunLoggingValidator {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            projectId: CONFIG.projectId,
            serviceName: CONFIG.serviceName,
            region: CONFIG.region,
            validationDuration: CONFIG.validationDuration,
            categories: {
                found: [],
                missing: [],
                total: CONFIG.expectedCategories.length
            },
            logs: {
                total: 0,
                structured: 0,
                withJsonPayload: 0,
                withLabels: 0,
                aggregated: 0,
                filtered: 0
            },
            errors: [],
            warnings: [],
            performance: {
                avgLogSize: 0,
                totalSize: 0,
                logFrequency: 0
            },
            validation: {
                passed: false,
                score: 0,
                issues: []
            }
        };
    }

    /**
     * 🚀 EJECUTAR VALIDACIÓN COMPLETA
     */
    async validate() {
        console.log('🔍 Iniciando validación de logging en Cloud Run...\n');
        
        try {
            // 1. Verificar herramientas necesarias
            await this.checkPrerequisites();
            
            // 2. Obtener logs recientes
            const logs = await this.fetchRecentLogs();
            
            // 3. Analizar estructura de logs
            await this.analyzeLogs(logs);
            
            // 4. Validar categorías
            await this.validateCategories(logs);
            
            // 5. Verificar formato JSON
            await this.validateJsonFormat(logs);
            
            // 6. Verificar filtros y agregación
            await this.validateFiltersAndAggregation(logs);
            
            // 7. Probar endpoints de métricas
            await this.validateMetricsEndpoints();
            
            // 8. Generar reporte final
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Error durante validación:', error.message);
            this.results.errors.push({
                type: 'validation_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 🔧 VERIFICAR HERRAMIENTAS NECESARIAS
     */
    async checkPrerequisites() {
        console.log('🔧 Verificando herramientas necesarias...');
        
        try {
            // Verificar gcloud CLI
            execSync('gcloud --version', { stdio: 'ignore' });
            console.log('✅ gcloud CLI disponible');
            
            // Verificar autenticación
            const auth = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { encoding: 'utf8' });
            if (!auth.trim()) {
                throw new Error('No hay cuenta activa en gcloud. Ejecutar: gcloud auth login');
            }
            console.log('✅ Autenticación gcloud activa');
            
            // Verificar proyecto
            const project = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim();
            if (project !== CONFIG.projectId) {
                console.log(`⚠️  Proyecto actual: ${project}, esperado: ${CONFIG.projectId}`);
                this.results.warnings.push({
                    type: 'project_mismatch',
                    message: `Proyecto actual (${project}) no coincide con configurado (${CONFIG.projectId})`
                });
            }
            
        } catch (error) {
            throw new Error(`Error verificando herramientas: ${error.message}`);
        }
    }

    /**
     * 📥 OBTENER LOGS RECIENTES
     */
    async fetchRecentLogs() {
        console.log('📥 Obteniendo logs recientes de Cloud Run...');
        
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (CONFIG.validationDuration * 1000));
        
        const filter = [
            `resource.type="cloud_run_revision"`,
            `resource.labels.service_name="${CONFIG.serviceName}"`,
            `resource.labels.location="${CONFIG.region}"`,
            `timestamp>="${startTime.toISOString()}"`,
            `timestamp<="${endTime.toISOString()}"`
        ].join(' AND ');
        
        try {
            const command = [
                'gcloud logging read',
                `'${filter}'`,
                '--format=json',
                '--limit=1000',
                `--project=${CONFIG.projectId}`
            ].join(' ');
            
            const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
            const logs = JSON.parse(output || '[]');
            
            console.log(`✅ Obtenidos ${logs.length} logs de los últimos ${CONFIG.validationDuration} segundos`);
            this.results.logs.total = logs.length;
            
            return logs;
            
        } catch (error) {
            throw new Error(`Error obteniendo logs: ${error.message}`);
        }
    }

    /**
     * 🔍 ANALIZAR ESTRUCTURA DE LOGS
     */
    async analyzeLogs(logs) {
        console.log('🔍 Analizando estructura de logs...');
        
        let totalSize = 0;
        let structuredCount = 0;
        let jsonPayloadCount = 0;
        let labelsCount = 0;
        let aggregatedCount = 0;
        
        for (const log of logs) {
            const logString = JSON.stringify(log);
            totalSize += logString.length;
            
            // Verificar si es log estructurado
            if (log.jsonPayload || log.textPayload) {
                structuredCount++;
            }
            
            // Verificar jsonPayload
            if (log.jsonPayload) {
                jsonPayloadCount++;
                
                // Verificar si es log agregado
                if (log.jsonPayload.aggregation && log.jsonPayload.aggregation.isAggregated) {
                    aggregatedCount++;
                }
            }
            
            // Verificar labels
            if (log.labels) {
                labelsCount++;
            }
        }
        
        this.results.logs.structured = structuredCount;
        this.results.logs.withJsonPayload = jsonPayloadCount;
        this.results.logs.withLabels = labelsCount;
        this.results.logs.aggregated = aggregatedCount;
        this.results.performance.totalSize = totalSize;
        this.results.performance.avgLogSize = logs.length > 0 ? Math.round(totalSize / logs.length) : 0;
        this.results.performance.logFrequency = logs.length / CONFIG.validationDuration;
        
        console.log(`✅ Análisis completado:`);
        console.log(`   - Logs estructurados: ${structuredCount}/${logs.length}`);
        console.log(`   - Con jsonPayload: ${jsonPayloadCount}/${logs.length}`);
        console.log(`   - Con labels: ${labelsCount}/${logs.length}`);
        console.log(`   - Logs agregados: ${aggregatedCount}`);
        console.log(`   - Tamaño promedio: ${this.results.performance.avgLogSize} bytes`);
        console.log(`   - Frecuencia: ${this.results.performance.logFrequency.toFixed(2)} logs/segundo`);
    }

    /**
     * 🏷️ VALIDAR CATEGORÍAS
     */
    async validateCategories(logs) {
        console.log('🏷️ Validando categorías de logging...');
        
        const foundCategories = new Set();
        
        for (const log of logs) {
            // Buscar categorías en jsonPayload
            if (log.jsonPayload && log.jsonPayload.category) {
                foundCategories.add(log.jsonPayload.category);
            }
            
            // Buscar categorías en mensaje
            if (log.textPayload) {
                for (const category of CONFIG.expectedCategories) {
                    if (log.textPayload.includes(`[${category}]`)) {
                        foundCategories.add(category);
                    }
                }
            }
            
            // Buscar categorías en labels
            if (log.labels && log.labels.category) {
                foundCategories.add(log.labels.category);
            }
        }
        
        this.results.categories.found = Array.from(foundCategories);
        this.results.categories.missing = CONFIG.expectedCategories.filter(
            cat => !foundCategories.has(cat)
        );
        
        console.log(`✅ Categorías encontradas: ${this.results.categories.found.length}/${CONFIG.expectedCategories.length}`);
        
        if (this.results.categories.missing.length > 0) {
            console.log(`⚠️  Categorías faltantes: ${this.results.categories.missing.join(', ')}`);
            this.results.warnings.push({
                type: 'missing_categories',
                message: `Categorías no encontradas: ${this.results.categories.missing.join(', ')}`
            });
        }
    }

    /**
     * 📋 VALIDAR FORMATO JSON
     */
    async validateJsonFormat(logs) {
        console.log('📋 Validando formato JSON estructurado...');
        
        let validFormatCount = 0;
        let invalidFormatCount = 0;
        const formatIssues = [];
        
        for (const log of logs) {
            if (!log.jsonPayload) continue;
            
            const payload = log.jsonPayload;
            let isValid = true;
            const issues = [];
            
            // Verificar campos requeridos
            if (!payload.category) {
                issues.push('Falta campo category');
                isValid = false;
            }
            
            if (!payload.level) {
                issues.push('Falta campo level');
                isValid = false;
            }
            
            if (!payload.userId) {
                issues.push('Falta campo userId');
                isValid = false;
            }
            
            if (!payload.environment) {
                issues.push('Falta campo environment');
                isValid = false;
            }
            
            // Verificar información específica por categoría
            if (payload.category && payload.category.startsWith('MESSAGE_') && !payload.messageInfo) {
                issues.push('Falta messageInfo para categoría MESSAGE_*');
                isValid = false;
            }
            
            if (payload.category && payload.category.startsWith('OPENAI_') && !payload.openaiInfo) {
                issues.push('Falta openaiInfo para categoría OPENAI_*');
                isValid = false;
            }
            
            if (payload.category && payload.category.startsWith('BEDS24_') && !payload.beds24Info) {
                issues.push('Falta beds24Info para categoría BEDS24_*');
                isValid = false;
            }
            
            if (payload.category && payload.category.startsWith('THREAD_') && !payload.threadInfo) {
                issues.push('Falta threadInfo para categoría THREAD_*');
                isValid = false;
            }
            
            if (isValid) {
                validFormatCount++;
            } else {
                invalidFormatCount++;
                formatIssues.push({
                    timestamp: log.timestamp,
                    category: payload.category,
                    issues: issues
                });
            }
        }
        
        console.log(`✅ Formato JSON válido: ${validFormatCount}/${validFormatCount + invalidFormatCount}`);
        
        if (invalidFormatCount > 0) {
            console.log(`⚠️  Logs con formato inválido: ${invalidFormatCount}`);
            this.results.warnings.push({
                type: 'invalid_json_format',
                message: `${invalidFormatCount} logs con formato JSON inválido`,
                details: formatIssues.slice(0, 5) // Solo primeros 5 ejemplos
            });
        }
    }

    /**
     * 🎛️ VALIDAR FILTROS Y AGREGACIÓN
     */
    async validateFiltersAndAggregation(logs) {
        console.log('🎛️ Validando filtros y agregación...');
        
        let debugLogsInProduction = 0;
        let aggregatedLogs = 0;
        let highPriorityLogs = 0;
        
        for (const log of logs) {
            // Verificar filtros de nivel
            if (log.jsonPayload) {
                const payload = log.jsonPayload;
                
                // En producción no debería haber logs DEBUG de categorías filtradas
                if (payload.environment === 'production' && payload.level === 'DEBUG') {
                    const filteredCategories = [
                        'BEDS24_API_CALL',
                        'BEDS24_RESPONSE_DETAIL',
                        'FUNCTION_EXECUTING',
                        'THREAD_PERSIST'
                    ];
                    
                    if (filteredCategories.includes(payload.category)) {
                        debugLogsInProduction++;
                    }
                }
                
                // Contar logs agregados
                if (payload.aggregation && payload.aggregation.isAggregated) {
                    aggregatedLogs++;
                }
                
                // Contar logs de alta prioridad
                if (['ERROR', 'WARNING'].includes(payload.level) || 
                    ['SERVER_START', 'BOT_READY', 'THREAD_CREATED'].includes(payload.category)) {
                    highPriorityLogs++;
                }
            }
        }
        
        this.results.logs.filtered = debugLogsInProduction;
        this.results.logs.aggregated = aggregatedLogs;
        
        console.log(`✅ Validación de filtros:`);
        console.log(`   - Logs DEBUG filtrados en producción: ${debugLogsInProduction}`);
        console.log(`   - Logs agregados: ${aggregatedLogs}`);
        console.log(`   - Logs de alta prioridad: ${highPriorityLogs}`);
        
        if (debugLogsInProduction > 0) {
            this.results.warnings.push({
                type: 'debug_logs_in_production',
                message: `${debugLogsInProduction} logs DEBUG encontrados en producción que deberían estar filtrados`
            });
        }
    }

    /**
     * 📊 VALIDAR ENDPOINTS DE MÉTRICAS
     */
    async validateMetricsEndpoints() {
        console.log('📊 Validando endpoints de métricas...');
        
        // Obtener URL del servicio
        try {
            const serviceUrl = execSync(
                `gcloud run services describe ${CONFIG.serviceName} --region=${CONFIG.region} --format="value(status.url)"`,
                { encoding: 'utf8' }
            ).trim();
            
            if (!serviceUrl) {
                throw new Error('No se pudo obtener URL del servicio');
            }
            
            console.log(`🔗 URL del servicio: ${serviceUrl}`);
            
            // Probar endpoints (requiere curl)
            const endpoints = ['/metrics', '/metrics/summary', '/metrics/health'];
            
            for (const endpoint of endpoints) {
                try {
                    const response = execSync(`curl -s -o /dev/null -w "%{http_code}" ${serviceUrl}${endpoint}`, { encoding: 'utf8' });
                    
                    if (response.trim() === '200') {
                        console.log(`✅ ${endpoint} - OK`);
                    } else {
                        console.log(`⚠️  ${endpoint} - HTTP ${response}`);
                        this.results.warnings.push({
                            type: 'metrics_endpoint_error',
                            message: `Endpoint ${endpoint} retornó HTTP ${response}`
                        });
                    }
                } catch (error) {
                    console.log(`❌ ${endpoint} - Error: ${error.message}`);
                    this.results.errors.push({
                        type: 'metrics_endpoint_error',
                        message: `Error probando ${endpoint}: ${error.message}`
                    });
                }
            }
            
        } catch (error) {
            console.log(`⚠️  No se pudieron probar endpoints de métricas: ${error.message}`);
            this.results.warnings.push({
                type: 'metrics_validation_skipped',
                message: `No se pudieron validar endpoints de métricas: ${error.message}`
            });
        }
    }

    /**
     * 📋 GENERAR REPORTE FINAL
     */
    async generateReport() {
        console.log('\n📋 Generando reporte final...');
        
        // Calcular puntuación
        let score = 0;
        const maxScore = 100;
        
        // Puntuación por categorías (40 puntos)
        const categoryScore = (this.results.categories.found.length / this.results.categories.total) * 40;
        score += categoryScore;
        
        // Puntuación por formato JSON (30 puntos)
        const jsonScore = this.results.logs.total > 0 ? 
            (this.results.logs.withJsonPayload / this.results.logs.total) * 30 : 0;
        score += jsonScore;
        
        // Puntuación por logs estructurados (20 puntos)
        const structuredScore = this.results.logs.total > 0 ? 
            (this.results.logs.structured / this.results.logs.total) * 20 : 0;
        score += structuredScore;
        
        // Puntuación por agregación (10 puntos)
        const aggregationScore = this.results.logs.aggregated > 0 ? 10 : 0;
        score += aggregationScore;
        
        // Penalizar errores
        score -= this.results.errors.length * 10;
        score -= this.results.warnings.length * 2;
        
        score = Math.max(0, Math.min(maxScore, score));
        
        this.results.validation.score = Math.round(score);
        this.results.validation.passed = score >= 80;
        
        // Generar issues
        if (this.results.categories.missing.length > 0) {
            this.results.validation.issues.push(`Categorías faltantes: ${this.results.categories.missing.length}`);
        }
        
        if (this.results.logs.withJsonPayload < this.results.logs.total * 0.8) {
            this.results.validation.issues.push('Menos del 80% de logs tienen jsonPayload');
        }
        
        if (this.results.errors.length > 0) {
            this.results.validation.issues.push(`${this.results.errors.length} errores encontrados`);
        }
        
        // Mostrar reporte
        console.log('\n' + '='.repeat(60));
        console.log('📊 REPORTE DE VALIDACIÓN DE LOGGING');
        console.log('='.repeat(60));
        console.log(`🎯 Puntuación: ${this.results.validation.score}/100`);
        console.log(`✅ Estado: ${this.results.validation.passed ? 'APROBADO' : 'REPROBADO'}`);
        console.log(`📅 Timestamp: ${this.results.timestamp}`);
        console.log(`🔧 Servicio: ${CONFIG.serviceName} (${CONFIG.region})`);
        console.log(`⏱️  Duración: ${CONFIG.validationDuration}s`);
        console.log('');
        
        console.log('📈 MÉTRICAS:');
        console.log(`   - Total logs: ${this.results.logs.total}`);
        console.log(`   - Logs estructurados: ${this.results.logs.structured}`);
        console.log(`   - Con jsonPayload: ${this.results.logs.withJsonPayload}`);
        console.log(`   - Con labels: ${this.results.logs.withLabels}`);
        console.log(`   - Logs agregados: ${this.results.logs.aggregated}`);
        console.log(`   - Frecuencia: ${this.results.performance.logFrequency.toFixed(2)} logs/s`);
        console.log('');
        
        console.log('🏷️ CATEGORÍAS:');
        console.log(`   - Encontradas: ${this.results.categories.found.length}/${this.results.categories.total}`);
        console.log(`   - Faltantes: ${this.results.categories.missing.length}`);
        if (this.results.categories.missing.length > 0) {
            console.log(`   - Lista: ${this.results.categories.missing.join(', ')}`);
        }
        console.log('');
        
        if (this.results.warnings.length > 0) {
            console.log('⚠️  ADVERTENCIAS:');
            this.results.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning.message}`);
            });
            console.log('');
        }
        
        if (this.results.errors.length > 0) {
            console.log('❌ ERRORES:');
            this.results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.message}`);
            });
            console.log('');
        }
        
        if (this.results.validation.issues.length > 0) {
            console.log('🔍 ISSUES CRÍTICOS:');
            this.results.validation.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
            console.log('');
        }
        
        // Guardar reporte
        const reportPath = path.join(process.cwd(), 'logs', 'cloud-run-validation-report.json');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        
        console.log(`💾 Reporte guardado en: ${reportPath}`);
        console.log('='.repeat(60));
        
        // Salir con código apropiado
        process.exit(this.results.validation.passed ? 0 : 1);
    }
}

// Ejecutar validación si se llama directamente
if (require.main === module) {
    const validator = new CloudRunLoggingValidator();
    validator.validate().catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}

module.exports = CloudRunLoggingValidator;

/**
 * 🚀 INSTRUCCIONES DE USO
 * 
 * 1. Asegurar que gcloud CLI está instalado y autenticado
 * 2. Configurar variables de entorno:
 *    - GOOGLE_CLOUD_PROJECT
 *    - K_SERVICE (nombre del servicio)
 *    - GOOGLE_CLOUD_REGION
 * 
 * 3. Ejecutar:
 *    node scripts/validate-cloud-run-logging.js
 * 
 * 4. Revisar reporte en logs/cloud-run-validation-report.json
 */ 