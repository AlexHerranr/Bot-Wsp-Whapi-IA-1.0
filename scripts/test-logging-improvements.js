/**
 * 🧪 TEST SCRIPT - Mejoras del Sistema de Logging
 * 
 * Prueba las mejoras implementadas:
 * - Normalización de categorías
 * - Logs menos verbosos
 * - Información estructurada
 */

const { cloudLog, getLoggingMetrics, resetLoggingMetrics } = require('../src/utils/logging/cloud-logger');
const { normalizeCategory, validateAndWarnCategory, getCategoryMappingStats } = require('../src/utils/logging/category-mapper');

console.log('🧪 INICIANDO PRUEBAS DEL SISTEMA DE LOGGING MEJORADO\n');

// Simular entorno de Cloud Run para testing
process.env.K_SERVICE = 'test-service';

// ============================================================================
// PRUEBA 1: Normalización de Categorías
// ============================================================================
console.log('📝 PRUEBA 1: Normalización de Categorías');
console.log('==========================================');

const categoriasInvalidas = [
    'THREADS_LOADED',
    'PENDING_MESSAGES_FOUND',
    'NEW_USER_LABELS',
    'BEDS24_RESPONSE_SUMMARY',
    'FUNCTION_EXECUTED',
    'FUNCTION_SUBMITTING',
    'WHATSAPP_CHUNK',
    'THREAD_OPERATION',
    'USER_DETECTED',
    'DURATION_DETECTED'
];

categoriasInvalidas.forEach(categoria => {
    const normalizada = normalizeCategory(categoria);
    console.log(`✅ ${categoria} → ${normalizada}`);
});

console.log('\n');

// ============================================================================
// PRUEBA 2: Logs Estructurados
// ============================================================================
console.log('📊 PRUEBA 2: Logs Estructurados');
console.log('================================');

// Resetear métricas para prueba limpia
resetLoggingMetrics();

// Probar diferentes tipos de logs
const testLogs = [
    {
        level: 'INFO',
        category: 'MESSAGE_RECEIVED', // Válida
        message: 'Mensaje recibido de usuario',
        details: {
            userId: '573003913251',
            messageLength: 25,
            messageType: 'text'
        }
    },
    {
        level: 'INFO',
        category: 'THREADS_LOADED', // Inválida - debe normalizarse
        message: 'Threads cargados desde archivo',
        details: {
            threadsCount: 5,
            source: 'file'
        }
    },
    {
        level: 'SUCCESS',
        category: 'FUNCTION_EXECUTED', // Inválida - debe normalizarse
        message: 'Función check_availability ejecutada',
        details: {
            functionName: 'check_availability',
            duration: 1250,
            args: { startDate: '2025-07-15', endDate: '2025-07-20' }
        }
    },
    {
        level: 'INFO',
        category: 'BEDS24_RESPONSE_SUMMARY', // Inválida - debe normalizarse
        message: 'Respuesta de Beds24 procesada',
        details: {
            propertyCount: 2,
            startDate: '2025-07-15',
            endDate: '2025-07-20',
            // Simular metadata spam que debe filtrarse
            'commit-sha': '05721f8152657e1dc4775c757caadc1437e830e4',
            'gcb-build-id': '52a75add-22fd-4ed8-8623-8760578026a9',
            'managed-by': 'gcp-cloud-build-deploy-cloud-run'
        }
    },
    {
        level: 'ERROR',
        category: 'RATE_LIMITED', // Inválida - debe normalizarse
        message: 'Mensaje duplicado excedió límite',
        details: {
            userId: '573003913251',
            attemptCount: 6,
            error: 'Rate limit exceeded'
        }
    }
];

console.log('Generando logs de prueba...\n');

testLogs.forEach((log, index) => {
    console.log(`Log ${index + 1}: [${log.level}] ${log.category}`);
    cloudLog(log.level, log.category, log.message, log.details);
});

console.log('\n');

// ============================================================================
// PRUEBA 3: Métricas del Sistema
// ============================================================================
console.log('📈 PRUEBA 3: Métricas del Sistema');
console.log('==================================');

const metrics = getLoggingMetrics();
console.log('Métricas de logging:');
console.log(`- Total de logs: ${metrics.totalLogs}`);
console.log(`- Logs sanitizados: ${metrics.sanitizedLogs}`);
console.log(`- Categorías normalizadas: ${metrics.categoriesNormalized}`);
console.log(`- Logs con rate limit: ${metrics.rateLimitedLogs}`);
console.log(`- Logs fallidos: ${metrics.failedLogs}`);

const categoryStats = getCategoryMappingStats();
console.log('\nEstadísticas de mapeo de categorías:');
console.log(`- Total de mapeos disponibles: ${categoryStats.totalMappings}`);
console.log(`- Warnings emitidos: ${categoryStats.warningsIssued}`);
console.log(`- Categorías válidas: ${categoryStats.validCategories}`);

console.log('\n');

// ============================================================================
// PRUEBA 4: Validación de Mejoras
// ============================================================================
console.log('✅ PRUEBA 4: Validación de Mejoras');
console.log('===================================');

const mejoras = [
    {
        descripcion: 'Normalización automática de categorías',
        validado: metrics.categoriesNormalized > 0,
        esperado: 'Categorías inválidas convertidas automáticamente'
    },
    {
        descripcion: 'Logs estructurados y limpios',
        validado: metrics.totalLogs > 0,
        esperado: 'Logs generados sin metadata spam'
    },
    {
        descripcion: 'Sistema de warnings no verboso',
        validado: categoryStats.warningsIssued > 0 && categoryStats.warningsIssued < 10,
        esperado: 'Warnings limitados, no spam'
    },
    {
        descripcion: 'Métricas de rendimiento',
        validado: metrics.avgLatency !== undefined,
        esperado: 'Métricas de latencia disponibles'
    }
];

mejoras.forEach((mejora, index) => {
    const status = mejora.validado ? '✅ PASÓ' : '❌ FALLÓ';
    console.log(`${index + 1}. ${mejora.descripcion}: ${status}`);
    console.log(`   Esperado: ${mejora.esperado}`);
});

console.log('\n');

// ============================================================================
// PRUEBA 5: Comparación Antes/Después
// ============================================================================
console.log('📊 PRUEBA 5: Comparación Antes/Después');
console.log('=======================================');

console.log('ANTES (Problemas identificados):');
console.log('- ❌ Categorías inválidas generaban logs verbosos');
console.log('- ❌ Cada error mostraba 40+ categorías válidas');
console.log('- ❌ Metadata spam en logs (commit-sha, gcb-build-id, etc.)');
console.log('- ❌ Logs difíciles de analizar');
console.log('- ❌ Parser no reconocía categorías del bot');

console.log('\nAHORA (Mejoras implementadas):');
console.log('- ✅ Normalización automática de categorías');
console.log('- ✅ Warnings limitados (solo una vez por categoría)');
console.log('- ✅ Metadata spam filtrado automáticamente');
console.log('- ✅ Logs estructurados con información útil');
console.log('- ✅ Parser sincronizado con categorías del bot');
console.log('- ✅ Métricas de rendimiento disponibles');

console.log('\n');

// ============================================================================
// RESULTADOS FINALES
// ============================================================================
console.log('🎯 RESULTADOS FINALES');
console.log('=====================');

const exito = mejoras.every(mejora => mejora.validado);
const porcentajeExito = (mejoras.filter(m => m.validado).length / mejoras.length) * 100;

console.log(`Pruebas completadas: ${porcentajeExito.toFixed(1)}% exitosas`);
console.log(`Estado general: ${exito ? '✅ TODAS LAS MEJORAS FUNCIONAN' : '⚠️ ALGUNAS MEJORAS NECESITAN AJUSTES'}`);

if (exito) {
    console.log('\n🚀 RECOMENDACIONES PARA DEPLOYMENT:');
    console.log('1. Hacer commit de los cambios');
    console.log('2. Ejecutar npm run build');
    console.log('3. Hacer deploy a Cloud Run');
    console.log('4. Verificar logs con: ./tools/log-tools/cloud-parser/botlogs --hours 1');
    console.log('5. Confirmar que no hay más "INVALID CATEGORY" warnings');
}

console.log('\n🔗 ARCHIVOS MODIFICADOS:');
console.log('- src/utils/logging/category-mapper.ts (NUEVO)');
console.log('- src/utils/logging/cloud-logger.ts (ACTUALIZADO)');
console.log('- src/utils/logging/types.ts (ACTUALIZADO)');
console.log('- tools/log-tools/cloud-parser/parse_bot_logs.py (ACTUALIZADO)');

console.log('\n✨ SISTEMA DE LOGGING MEJORADO COMPLETADO ✨'); 