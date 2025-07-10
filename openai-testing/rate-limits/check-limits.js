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

async function checkCurrentLimits() {
    console.log('🔍 Verificando Rate Limits Actuales...\n');
    
    try {
        // Test request para obtener headers de rate limit
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Extraer todos los headers de rate limit
        const rateLimitInfo = {
            timestamp: new Date().toISOString(),
            model: 'o3-mini', // Modelo que estás usando según los logs
            organization: 'org-SLzuAJSiM1gqPZbyX7gWQe8D', // De los logs
            headers: {
                // Rate limits
                limitRequests: response.headers.get('x-ratelimit-limit-requests'),
                limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
                remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
                remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
                resetRequests: response.headers.get('x-ratelimit-reset-requests'),
                resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
                
                // Headers adicionales
                requestId: response.headers.get('x-request-id'),
                processingTime: response.headers.get('openai-processing-ms'),
                version: response.headers.get('openai-version')
            },
            analysis: {}
        };

        // Análisis de los datos
        const limitTokens = parseInt(rateLimitInfo.headers.limitTokens) || 200000; // Límite conocido de o3-mini
        const remainingTokens = parseInt(rateLimitInfo.headers.remainingTokens) || 0;
        const usedTokens = limitTokens - remainingTokens;
        const usagePercentage = (usedTokens / limitTokens) * 100;

        rateLimitInfo.analysis = {
            limitTokens,
            remainingTokens,
            usedTokens,
            usagePercentage: Math.round(usagePercentage * 100) / 100,
            status: usagePercentage > 90 ? 'CRITICAL' : usagePercentage > 70 ? 'WARNING' : 'OK',
            resetTimeSeconds: rateLimitInfo.headers.resetTokens ? 
                parseFloat(rateLimitInfo.headers.resetTokens) : null
        };

        // Mostrar resultados
        console.log('📊 RATE LIMITS ACTUALES:');
        console.log('========================');
        console.log(`🎯 Modelo: ${rateLimitInfo.model}`);
        console.log(`🏢 Organización: ${rateLimitInfo.organization}`);
        console.log(`⏰ Timestamp: ${rateLimitInfo.timestamp}`);
        console.log('');
        
        console.log('🔢 TOKENS:');
        console.log(`   Límite total: ${rateLimitInfo.analysis.limitTokens.toLocaleString()} TPM`);
        console.log(`   Tokens usados: ${rateLimitInfo.analysis.usedTokens.toLocaleString()}`);
        console.log(`   Tokens restantes: ${rateLimitInfo.analysis.remainingTokens.toLocaleString()}`);
        console.log(`   Uso actual: ${rateLimitInfo.analysis.usagePercentage}%`);
        console.log(`   Estado: ${getStatusEmoji(rateLimitInfo.analysis.status)} ${rateLimitInfo.analysis.status}`);
        console.log('');

        if (rateLimitInfo.headers.limitRequests) {
            console.log('📞 REQUESTS:');
            console.log(`   Límite: ${rateLimitInfo.headers.limitRequests} RPM`);
            console.log(`   Restantes: ${rateLimitInfo.headers.remainingRequests}`);
            console.log('');
        }

        if (rateLimitInfo.analysis.resetTimeSeconds) {
            console.log(`⏳ Reset en: ${rateLimitInfo.analysis.resetTimeSeconds} segundos`);
            console.log('');
        }

        // Recomendaciones
        console.log('💡 RECOMENDACIONES:');
        if (rateLimitInfo.analysis.usagePercentage > 90) {
            console.log('   🚨 CRÍTICO: Muy cerca del límite');
            console.log('   ⏸️  Considera pausar requests temporalmente');
            console.log('   🔄 Implementa retry con backoff exponencial');
        } else if (rateLimitInfo.analysis.usagePercentage > 70) {
            console.log('   ⚠️  ADVERTENCIA: Uso elevado');
            console.log('   📉 Reduce la frecuencia de requests');
            console.log('   🎯 Optimiza el tamaño de contexto');
        } else {
            console.log('   ✅ Uso normal, límites OK');
            console.log('   📈 Puedes aumentar requests si necesario');
        }

        // Guardar resultados
        const resultsPath = path.join(__dirname, '..', 'results', 'current-limits.json');
        fs.writeFileSync(resultsPath, JSON.stringify(rateLimitInfo, null, 2));
        
        console.log(`\n💾 Resultados guardados en: ${resultsPath}`);
        
        return rateLimitInfo;

    } catch (error) {
        console.error('❌ Error obteniendo rate limits:', error.message);
        
        // Guardar error para análisis
        const errorInfo = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        const errorPath = path.join(__dirname, '..', 'results', 'limits-error.json');
        fs.writeFileSync(errorPath, JSON.stringify(errorInfo, null, 2));
        
        return null;
    }
}

function getStatusEmoji(status) {
    switch (status) {
        case 'CRITICAL': return '🚨';
        case 'WARNING': return '⚠️';
        case 'OK': return '✅';
        default: return '❓';
    }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    checkCurrentLimits();
}

export default checkCurrentLimits; 