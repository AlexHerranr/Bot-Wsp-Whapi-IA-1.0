import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOpenAIClient, checkConfiguration } from './utils/openai-client.js';
import checkCurrentLimits from './rate-limits/check-limits.js';
import analyzeThreads from './rate-limits/thread-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 DIAGNÓSTICO COMPLETO DE OPENAI RATE LIMITS');
console.log('=' .repeat(60));
console.log(`⏰ Iniciado: ${new Date().toLocaleString()}`);
console.log('=' .repeat(60));

async function runCompleteDiagnostics() {
    const results = {
        timestamp: new Date().toISOString(),
        diagnostics: {},
        summary: {},
        recommendations: []
    };

    try {
        // 1. Verificar configuración
        console.log('\n🔧 1. VERIFICANDO CONFIGURACIÓN...');
        console.log('-'.repeat(40));
        
        const configCheck = checkConfiguration();
        results.diagnostics.configuration = configCheck;
        
        if (configCheck.valid) {
            console.log('✅ Configuración válida');
        } else {
            console.log('❌ Problemas en configuración:');
            configCheck.issues.forEach(issue => console.log(`   ${issue}`));
        }

        // 2. Verificar rate limits actuales
        console.log('\n📊 2. VERIFICANDO RATE LIMITS ACTUALES...');
        console.log('-'.repeat(40));
        
        try {
            const rateLimits = await checkCurrentLimits();
            results.diagnostics.rateLimits = rateLimits;
            
            if (rateLimits) {
                console.log(`✅ Rate limits obtenidos: ${rateLimits.analysis.usagePercentage}% de uso`);
                
                // Añadir recomendaciones basadas en rate limits
                if (rateLimits.analysis.usagePercentage > 90) {
                    results.recommendations.push({
                        priority: 'CRITICAL',
                        message: 'Rate limit muy alto, pausar requests inmediatamente'
                    });
                } else if (rateLimits.analysis.usagePercentage > 70) {
                    results.recommendations.push({
                        priority: 'WARNING',
                        message: 'Rate limit elevado, reducir frecuencia de requests'
                    });
                }
            }
        } catch (error) {
            console.log(`❌ Error obteniendo rate limits: ${error.message}`);
            results.diagnostics.rateLimits = { error: error.message };
        }

        // 3. Analizar threads existentes
        console.log('\n🧵 3. ANALIZANDO THREADS EXISTENTES...');
        console.log('-'.repeat(40));
        
        try {
            const threadAnalysis = await analyzeThreads();
            results.diagnostics.threads = threadAnalysis;
            
            if (threadAnalysis) {
                console.log(`✅ Threads analizados: ${threadAnalysis.totalThreads} threads`);
                console.log(`   Total tokens estimados: ${threadAnalysis.summary.totalEstimatedTokens.toLocaleString()}`);
                
                // Añadir recomendaciones basadas en threads
                const inactiveThreads = threadAnalysis.threads.filter(t => t.status === 'INACTIVE').length;
                const heavyThreads = threadAnalysis.threads.filter(t => t.estimatedTokens > 10000).length;
                
                if (inactiveThreads > 0) {
                    results.recommendations.push({
                        priority: 'INFO',
                        message: `Considera limpiar ${inactiveThreads} threads inactivos para optimizar memoria`
                    });
                }
                
                if (heavyThreads > 0) {
                    results.recommendations.push({
                        priority: 'WARNING',
                        message: `${heavyThreads} threads consumen muchos tokens, considera optimizar contexto`
                    });
                }
            }
        } catch (error) {
            console.log(`❌ Error analizando threads: ${error.message}`);
            results.diagnostics.threads = { error: error.message };
        }

        // 4. Verificar archivos de log del bot
        console.log('\n📋 4. VERIFICANDO LOGS DEL BOT...');
        console.log('-'.repeat(40));
        
        try {
            const logsPath = path.join(__dirname, '..', 'logs');
            if (fs.existsSync(logsPath)) {
                const logFiles = fs.readdirSync(logsPath).filter(f => f.endsWith('.log'));
                const latestLog = logFiles.sort().reverse()[0];
                
                if (latestLog) {
                    const logPath = path.join(logsPath, latestLog);
                    const logContent = fs.readFileSync(logPath, 'utf8');
                    
                    // Buscar errores de rate limit en logs
                    const rateLimitErrors = logContent.split('\n')
                        .filter(line => line.includes('rate_limit_exceeded') || line.includes('Rate limit reached'))
                        .length;
                    
                    results.diagnostics.logs = {
                        latestLogFile: latestLog,
                        rateLimitErrors,
                        logSize: Math.round(logContent.length / 1024) + 'KB'
                    };
                    
                    console.log(`✅ Log más reciente: ${latestLog}`);
                    console.log(`   Errores de rate limit encontrados: ${rateLimitErrors}`);
                    
                    if (rateLimitErrors > 0) {
                        results.recommendations.push({
                            priority: 'WARNING',
                            message: `Se encontraron ${rateLimitErrors} errores de rate limit en logs recientes`
                        });
                    }
                } else {
                    console.log('⚠️  No se encontraron archivos de log');
                }
            } else {
                console.log('⚠️  Directorio de logs no encontrado');
            }
        } catch (error) {
            console.log(`❌ Error verificando logs: ${error.message}`);
            results.diagnostics.logs = { error: error.message };
        }

        // 5. Generar resumen
        console.log('\n📊 5. GENERANDO RESUMEN...');
        console.log('-'.repeat(40));
        
        results.summary = generateSummary(results.diagnostics);
        
        console.log(`✅ Diagnóstico completado`);
        console.log(`   Configuración: ${results.diagnostics.configuration.valid ? 'OK' : 'PROBLEMAS'}`);
        console.log(`   Rate Limits: ${results.diagnostics.rateLimits?.analysis ? 'OK' : 'ERROR'}`);
        console.log(`   Threads: ${results.diagnostics.threads?.totalThreads || 'ERROR'} analizados`);
        console.log(`   Recomendaciones: ${results.recommendations.length} generadas`);

        // 6. Guardar resultados
        const resultsPath = path.join(__dirname, 'results', 'complete-diagnostics.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        
        console.log(`\n💾 Resultados guardados en: ${resultsPath}`);

        // 7. Mostrar recomendaciones
        if (results.recommendations.length > 0) {
            console.log('\n💡 RECOMENDACIONES:');
            console.log('=' .repeat(40));
            
            results.recommendations.forEach((rec, index) => {
                const emoji = rec.priority === 'CRITICAL' ? '🚨' : 
                             rec.priority === 'WARNING' ? '⚠️' : '💡';
                console.log(`${index + 1}. ${emoji} [${rec.priority}] ${rec.message}`);
            });
        }

        return results;

    } catch (error) {
        console.error('\n❌ ERROR EN DIAGNÓSTICO:', error.message);
        results.diagnostics.globalError = error.message;
        return results;
    }
}

function generateSummary(diagnostics) {
    const summary = {
        overallStatus: 'UNKNOWN',
        criticalIssues: 0,
        warnings: 0,
        info: 0,
        details: {}
    };

    // Evaluar configuración
    if (diagnostics.configuration) {
        summary.details.configuration = diagnostics.configuration.valid ? 'OK' : 'ISSUES';
        if (!diagnostics.configuration.valid) {
            summary.criticalIssues++;
        }
    }

    // Evaluar rate limits
    if (diagnostics.rateLimits?.analysis) {
        const usage = diagnostics.rateLimits.analysis.usagePercentage;
        if (usage > 90) {
            summary.details.rateLimits = 'CRITICAL';
            summary.criticalIssues++;
        } else if (usage > 70) {
            summary.details.rateLimits = 'WARNING';
            summary.warnings++;
        } else {
            summary.details.rateLimits = 'OK';
        }
    } else {
        summary.details.rateLimits = 'ERROR';
        summary.criticalIssues++;
    }

    // Evaluar threads
    if (diagnostics.threads?.totalThreads) {
        const avgTokens = diagnostics.threads.summary.averageTokensPerThread;
        if (avgTokens > 10000) {
            summary.details.threads = 'WARNING';
            summary.warnings++;
        } else {
            summary.details.threads = 'OK';
        }
    } else {
        summary.details.threads = 'ERROR';
        summary.warnings++;
    }

    // Determinar estado general
    if (summary.criticalIssues > 0) {
        summary.overallStatus = 'CRITICAL';
    } else if (summary.warnings > 0) {
        summary.overallStatus = 'WARNING';
    } else {
        summary.overallStatus = 'OK';
    }

    return summary;
}

// Ejecutar diagnóstico si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    runCompleteDiagnostics()
        .then(results => {
            console.log('\n🎯 DIAGNÓSTICO FINALIZADO');
            console.log('=' .repeat(60));
            console.log(`Estado general: ${results.summary.overallStatus}`);
            console.log(`Timestamp: ${results.timestamp}`);
            console.log('=' .repeat(60));
        })
        .catch(error => {
            console.error('\n💥 ERROR FATAL:', error);
            process.exit(1);
        });
}

export default runCompleteDiagnostics; 