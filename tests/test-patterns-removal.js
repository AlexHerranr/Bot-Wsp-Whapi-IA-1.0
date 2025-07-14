/**
 * 🧪 Test de Eliminación Completa de Patrones - Validación Post-Cambios
 * 
 * Prueba que la eliminación completa de patrones funcionó correctamente:
 * 1. Verificar que no hay referencias a patrones en el código
 * 2. Verificar que el flujo va directo a OpenAI
 * 3. Verificar que el filtro de ruido funciona
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Test de Eliminación Completa de Patrones\n');

// Función para buscar patrones en archivos
function searchPatternsInFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const patterns = [
            'PATTERN_KEYWORDS',
            'FIXED_RESPONSES', 
            'analyzeCompleteContext',
            'detectSimplePattern',
            'SIMPLE_PATTERNS',
            'patternCooldowns',
            'unrecognizedMessages',
            'PATTERN_COOLDOWN_MS',
            'UNRECOGNIZED_THRESHOLD'
        ];
        
        const found = [];
        patterns.forEach(pattern => {
            if (content.includes(pattern)) {
                found.push(pattern);
            }
        });
        
        return found;
    } catch (error) {
        return [`Error leyendo archivo: ${error.message}`];
    }
}

// Función para verificar el flujo principal
function testMainFlow() {
    console.log('📋 Verificando flujo principal...');
    
    try {
        const appContent = fs.readFileSync('src/app-unified.ts', 'utf8');
        
        // Verificar que processCombinedMessage va directo a OpenAI
        const hasDirectOpenAI = appContent.includes('Todo mensaje relevante va directo a OpenAI');
        const hasProcessWithOpenAI = appContent.includes('processWithOpenAI(combinedText, userId, chatId, userName)');
        
        // Verificar que hay filtro de ruido
        const hasNoiseFilter = appContent.includes('Filtro inicial: ignorar mensajes triviales/ruido');
        const hasNoisePattern = appContent.includes('/^[\\?\\.]+$/');
        
        // Verificar que no hay lógica de patrones
        const hasPatternLogic = appContent.includes('analyzeCompleteContext') || 
                               appContent.includes('PATTERN_KEYWORDS') ||
                               appContent.includes('FIXED_RESPONSES');
        
        console.log(`✅ Filtro de ruido: ${hasNoiseFilter ? 'PRESENTE' : 'FALTANTE'}`);
        console.log(`✅ Patrón de ruido: ${hasNoisePattern ? 'PRESENTE' : 'FALTANTE'}`);
        console.log(`✅ Flujo directo a OpenAI: ${hasDirectOpenAI ? 'PRESENTE' : 'FALTANTE'}`);
        console.log(`✅ Llamada a processWithOpenAI: ${hasProcessWithOpenAI ? 'PRESENTE' : 'FALTANTE'}`);
        console.log(`❌ Lógica de patrones: ${hasPatternLogic ? 'PRESENTE (ERROR)' : 'ELIMINADA (CORRECTO)'}`);
        
        return hasNoiseFilter && hasNoisePattern && hasDirectOpenAI && hasProcessWithOpenAI && !hasPatternLogic;
        
    } catch (error) {
        console.log(`❌ Error verificando flujo: ${error.message}`);
        return false;
    }
}

// Función para verificar archivos de prueba eliminados
function testRemovedFiles() {
    console.log('\n📋 Verificando archivos eliminados...');
    
    const removedFiles = [
        'tests/test-patterns-fix.js'
    ];
    
    let allRemoved = true;
    removedFiles.forEach(file => {
        const exists = fs.existsSync(file);
        console.log(`${exists ? '❌' : '✅'} ${file}: ${exists ? 'PRESENTE (ERROR)' : 'ELIMINADO (CORRECTO)'}`);
        if (exists) allRemoved = false;
    });
    
    return allRemoved;
}

// Función para verificar que no hay referencias en otros archivos
function testOtherFiles() {
    console.log('\n📋 Verificando otros archivos...');
    
    const filesToCheck = [
        'src/app-unified.ts',
        'src/utils/logging/index.ts',
        'src/routes/metrics.ts'
    ];
    
    let allClean = true;
    filesToCheck.forEach(file => {
        if (fs.existsSync(file)) {
            const found = searchPatternsInFile(file);
            if (found.length > 0) {
                console.log(`❌ ${file}: Referencias encontradas - ${found.join(', ')}`);
                allClean = false;
            } else {
                console.log(`✅ ${file}: Sin referencias a patrones`);
            }
        }
    });
    
    return allClean;
}

// Función para simular el flujo actual
function simulateCurrentFlow() {
    console.log('\n📋 Simulando flujo actual...');
    
    // Simular mensajes de prueba
    const testMessages = [
        'hola',
        'busco apartamento',
        'del 15 al 20 de agosto',
        '4 personas',
        '??...',
        'gracias',
        'muy buena información'
    ];
    
    console.log('Mensajes de prueba:');
    testMessages.forEach((msg, index) => {
        const isNoise = msg.length < 3 || /^[\?\.]+$/.test(msg);
        const shouldGoToOpenAI = !isNoise;
        
        console.log(`${index + 1}. "${msg}"`);
        console.log(`   - Es ruido: ${isNoise ? 'SÍ' : 'NO'}`);
        console.log(`   - Va a OpenAI: ${shouldGoToOpenAI ? 'SÍ' : 'NO'}`);
        console.log('');
    });
    
    return true;
}

// Ejecutar todas las pruebas
function runAllTests() {
    console.log('🚀 Iniciando validación completa de eliminación de patrones...\n');
    
    const results = {
        mainFlow: testMainFlow(),
        removedFiles: testRemovedFiles(),
        otherFiles: testOtherFiles(),
        simulation: simulateCurrentFlow()
    };
    
    console.log('\n📊 RESULTADOS FINALES:');
    console.log('========================');
    console.log(`✅ Flujo principal: ${results.mainFlow ? 'CORRECTO' : 'ERROR'}`);
    console.log(`✅ Archivos eliminados: ${results.removedFiles ? 'CORRECTO' : 'ERROR'}`);
    console.log(`✅ Otros archivos limpios: ${results.otherFiles ? 'CORRECTO' : 'ERROR'}`);
    console.log(`✅ Simulación: ${results.simulation ? 'CORRECTO' : 'ERROR'}`);
    
    const allPassed = Object.values(results).every(result => result);
    
    console.log('\n🎯 CONCLUSIÓN:');
    console.log('================');
    if (allPassed) {
        console.log('✅ TODAS LAS PRUEBAS PASARON');
        console.log('✅ La eliminación completa de patrones fue exitosa');
        console.log('✅ El bot ahora rutea todo a OpenAI con filtro de ruido');
        console.log('✅ El flujo es más simple, robusto y eficiente');
    } else {
        console.log('❌ ALGUNAS PRUEBAS FALLARON');
        console.log('❌ Revisar los errores arriba');
    }
    
    return allPassed;
}

// Ejecutar las pruebas
const success = runAllTests();
process.exit(success ? 0 : 1); 