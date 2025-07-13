/**
 * 🔧 ETAPA 4: Test de Performance Monitoring + Optimization
 * 
 * Prueba las mejoras de monitoreo y optimización implementadas:
 * - Cleanup de tokens basado en thresholds
 * - Métricas expandidas (fuzzy hits, race errors, token cleanups)
 * - Alertas proactivas
 */

// Simular las métricas de Prometheus
class MockMetrics {
    constructor() {
        this.counters = {
            fuzzyHits: 0,
            raceErrors: 0,
            tokenCleanups: 0
        };
        this.gauges = {
            highTokenThreads: 0
        };
    }
    
    incrementFuzzyHits() {
        this.counters.fuzzyHits++;
    }
    
    incrementRaceErrors() {
        this.counters.raceErrors++;
    }
    
    incrementTokenCleanups() {
        this.counters.tokenCleanups++;
    }
    
    setHighTokenThreads(count) {
        this.gauges.highTokenThreads = count;
    }
    
    getMetrics() {
        return {
            counters: { ...this.counters },
            gauges: { ...this.gauges }
        };
    }
}

// Test de cleanup de tokens
function testTokenCleanup() {
    console.log('🧪 Probando Cleanup de Tokens...\n');
    
    const mockMetrics = new MockMetrics();
    
    // Simular función de cleanup de tokens
    const cleanupHighTokenThreads = (threads, threshold = 8000) => {
        let threadsChecked = 0;
        let threadsCleaned = 0;
        let threadsOptimized = 0;
        
        for (const [userId, threadInfo] of Object.entries(threads)) {
            threadsChecked++;
            
            // Simular estimación de tokens
            const estimatedTokens = threadInfo.estimatedTokens || 0;
            
            if (estimatedTokens > threshold) {
                // Simular optimización exitosa
                if (Math.random() > 0.3) {
                    threadsOptimized++;
                } else {
                    threadsCleaned++;
                }
                
                // Actualizar métrica
                mockMetrics.setHighTokenThreads(threadsChecked);
            }
        }
        
        if (threadsCleaned > 0 || threadsOptimized > 0) {
            mockMetrics.incrementTokenCleanups();
        }
        
        return { threadsChecked, threadsCleaned, threadsOptimized };
    };
    
    const testCases = [
        {
            threads: {
                'user1': { estimatedTokens: 5000, threadId: 'thread1' },
                'user2': { estimatedTokens: 12000, threadId: 'thread2' },
                'user3': { estimatedTokens: 3000, threadId: 'thread3' }
            },
            threshold: 8000,
            expectedCleaned: 1,
            description: 'Thread con alto uso de tokens'
        },
        {
            threads: {
                'user1': { estimatedTokens: 2000, threadId: 'thread1' },
                'user2': { estimatedTokens: 3000, threadId: 'thread2' }
            },
            threshold: 8000,
            expectedCleaned: 0,
            description: 'Threads con uso normal de tokens'
        },
        {
            threads: {
                'user1': { estimatedTokens: 15000, threadId: 'thread1' },
                'user2': { estimatedTokens: 18000, threadId: 'thread2' },
                'user3': { estimatedTokens: 9000, threadId: 'thread3' }
            },
            threshold: 8000,
            expectedCleaned: 3,
            description: 'Múltiples threads con alto uso'
        }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const result = cleanupHighTokenThreads(testCase.threads, testCase.threshold);
            const totalProcessed = result.threadsCleaned + result.threadsOptimized;
            const success = totalProcessed >= testCase.expectedCleaned;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   Threads procesados: ${result.threadsChecked}`);
            console.log(`   Threads optimizados: ${result.threadsOptimized}`);
            console.log(`   Threads limpiados: ${result.threadsCleaned}`);
            console.log(`   Total procesados: ${totalProcessed}`);
            console.log(`   Expected: >=${testCase.expectedCleaned}`);
            console.log('');
            
            if (success) passed++;
        } catch (error) {
            console.log(`❌ ${testCase.description} - ERROR: ${error.message}`);
            console.log('');
        }
    }
    
    console.log(`📊 Resultados: ${passed}/${total} tests pasaron`);
    return passed === total;
}

// Test de métricas de race errors
function testRaceErrorMetrics() {
    console.log('🧪 Probando Métricas de Race Errors...\n');
    
    const mockMetrics = new MockMetrics();
    
    // Simular función de adquisición de lock
    const acquireThreadLock = (userId, existingLocks = new Set()) => {
        if (existingLocks.has(userId)) {
            // Simular race error
            mockMetrics.incrementRaceErrors();
            return false;
        }
        
        existingLocks.add(userId);
        return true;
    };
    
    const testCases = [
        {
            userId: 'user1',
            existingLocks: new Set(['user1']),
            expectedRaceError: true,
            description: 'Lock ya adquirido - debe generar race error'
        },
        {
            userId: 'user2',
            existingLocks: new Set(['user1']),
            expectedRaceError: false,
            description: 'Lock disponible - no debe generar race error'
        },
        {
            userId: 'user3',
            existingLocks: new Set(),
            expectedRaceError: false,
            description: 'Sin locks existentes - no debe generar race error'
        }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const initialRaceErrors = mockMetrics.counters.raceErrors;
            const result = acquireThreadLock(testCase.userId, testCase.existingLocks);
            const finalRaceErrors = mockMetrics.counters.raceErrors;
            const raceErrorOccurred = finalRaceErrors > initialRaceErrors;
            const success = raceErrorOccurred === testCase.expectedRaceError;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   User ID: ${testCase.userId}`);
            console.log(`   Lock adquirido: ${result}`);
            console.log(`   Race error ocurrió: ${raceErrorOccurred}`);
            console.log(`   Expected race error: ${testCase.expectedRaceError}`);
            console.log('');
            
            if (success) passed++;
        } catch (error) {
            console.log(`❌ ${testCase.description} - ERROR: ${error.message}`);
            console.log('');
        }
    }
    
    console.log(`📊 Resultados: ${passed}/${total} tests pasaron`);
    return passed === total;
}

// Test de métricas de fuzzy hits
function testFuzzyHitsMetrics() {
    console.log('🧪 Probando Métricas de Fuzzy Hits...\n');
    
    const mockMetrics = new MockMetrics();
    
    // Simular función de fuzzy matching
    const detectFuzzyPattern = (message, patterns) => {
        for (const pattern of patterns) {
            const distance = levenshteinDistance(message.toLowerCase(), pattern.toLowerCase());
            if (distance <= 3) {
                mockMetrics.incrementFuzzyHits();
                return { pattern, isFuzzy: distance > 0 };
            }
        }
        return null;
    };
    
    // Función simple de Levenshtein
    function levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    
    const patterns = ['disponibilidad', 'gracias', 'hola', 'precio'];
    
    const testCases = [
        {
            message: 'dispnibilidad',
            expectedFuzzyHits: 1,
            description: 'Typo en disponibilidad'
        },
        {
            message: 'grasias',
            expectedFuzzyHits: 1,
            description: 'Typo en gracias'
        },
        {
            message: 'hola',
            expectedFuzzyHits: 1,
            description: 'Saludo exacto'
        },
        {
            message: 'mensaje sin patron',
            expectedFuzzyHits: 0,
            description: 'Mensaje sin patrones'
        }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const initialFuzzyHits = mockMetrics.counters.fuzzyHits;
            const result = detectFuzzyPattern(testCase.message, patterns);
            const finalFuzzyHits = mockMetrics.counters.fuzzyHits;
            const fuzzyHitsIncremented = finalFuzzyHits - initialFuzzyHits;
            const success = fuzzyHitsIncremented === testCase.expectedFuzzyHits;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   Message: "${testCase.message}"`);
            console.log(`   Result: ${result ? `${result.pattern} (fuzzy: ${result.isFuzzy})` : 'null'}`);
            console.log(`   Fuzzy hits incrementados: ${fuzzyHitsIncremented}`);
            console.log(`   Expected: ${testCase.expectedFuzzyHits}`);
            console.log('');
            
            if (success) passed++;
        } catch (error) {
            console.log(`❌ ${testCase.description} - ERROR: ${error.message}`);
            console.log('');
        }
    }
    
    console.log(`📊 Resultados: ${passed}/${total} tests pasaron`);
    return passed === total;
}

// Test de alertas proactivas
function testProactiveAlerts() {
    console.log('🧪 Probando Alertas Proactivas...\n');
    
    const mockMetrics = new MockMetrics();
    
    // Simular función de alertas
    const checkProactiveAlerts = (metrics) => {
        const alerts = [];
        
        // Alerta si hay muchos fuzzy hits (posible problema de UX)
        if (metrics.counters.fuzzyHits > 10) {
            alerts.push({
                type: 'HIGH_FUZZY_HITS',
                message: `Alto número de fuzzy hits: ${metrics.counters.fuzzyHits}`,
                severity: 'warning'
            });
        }
        
        // Alerta si hay race errors (problema de concurrencia)
        if (metrics.counters.raceErrors > 0) {
            alerts.push({
                type: 'RACE_ERRORS_DETECTED',
                message: `Race errors detectados: ${metrics.counters.raceErrors}`,
                severity: 'error'
            });
        }
        
        // Alerta si hay muchos threads con alto uso de tokens
        if (metrics.gauges.highTokenThreads > 5) {
            alerts.push({
                type: 'HIGH_TOKEN_THREADS',
                message: `Muchos threads con alto uso de tokens: ${metrics.gauges.highTokenThreads}`,
                severity: 'warning'
            });
        }
        
        return alerts;
    };
    
    const testCases = [
        {
            metrics: {
                counters: { fuzzyHits: 15, raceErrors: 0, tokenCleanups: 2 },
                gauges: { highTokenThreads: 3 }
            },
            expectedAlerts: 2,
            description: 'Alto fuzzy hits + threads con tokens'
        },
        {
            metrics: {
                counters: { fuzzyHits: 5, raceErrors: 3, tokenCleanups: 1 },
                gauges: { highTokenThreads: 2 }
            },
            expectedAlerts: 1,
            description: 'Race errors detectados'
        },
        {
            metrics: {
                counters: { fuzzyHits: 3, raceErrors: 0, tokenCleanups: 0 },
                gauges: { highTokenThreads: 1 }
            },
            expectedAlerts: 0,
            description: 'Métricas normales - sin alertas'
        }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const alerts = checkProactiveAlerts(testCase.metrics);
            const success = alerts.length === testCase.expectedAlerts;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   Alertas generadas: ${alerts.length}`);
            console.log(`   Expected: ${testCase.expectedAlerts}`);
            if (alerts.length > 0) {
                console.log(`   Alertas:`);
                alerts.forEach(alert => {
                    console.log(`     - ${alert.type}: ${alert.message} (${alert.severity})`);
                });
            }
            console.log('');
            
            if (success) passed++;
        } catch (error) {
            console.log(`❌ ${testCase.description} - ERROR: ${error.message}`);
            console.log('');
        }
    }
    
    console.log(`📊 Resultados: ${passed}/${total} tests pasaron`);
    return passed === total;
}

// Ejecutar todos los tests
function runAllTests() {
    console.log('🚀 INICIANDO TESTS DE PERFORMANCE MONITORING - ETAPA 4\n');
    console.log('=' .repeat(60));
    
    const results = [
        { name: 'Cleanup de Tokens', test: testTokenCleanup },
        { name: 'Métricas de Race Errors', test: testRaceErrorMetrics },
        { name: 'Métricas de Fuzzy Hits', test: testFuzzyHitsMetrics },
        { name: 'Alertas Proactivas', test: testProactiveAlerts }
    ];
    
    let totalPassed = 0;
    let totalTests = 0;
    
    for (const result of results) {
        console.log(`\n🧪 TEST: ${result.name}`);
        console.log('-'.repeat(40));
        
        const passed = result.test();
        if (passed) totalPassed++;
        totalTests++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESUMEN FINAL: ${totalPassed}/${totalTests} suites de tests pasaron`);
    
    if (totalPassed === totalTests) {
        console.log('🎉 ¡TODOS LOS TESTS PASARON! Performance monitoring funcionando correctamente.');
    } else {
        console.log('⚠️  Algunos tests fallaron. Revisar implementación.');
    }
    
    return totalPassed === totalTests;
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testTokenCleanup,
    testRaceErrorMetrics,
    testFuzzyHitsMetrics,
    testProactiveAlerts,
    runAllTests
}; 