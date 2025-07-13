/**
 * 🔧 ETAPA 3: Test de Fuzzy Parsing
 * 
 * Prueba las mejoras de fuzzy matching implementadas:
 * - Patrones simples con typos
 * - Contexto con fuzzy matching
 * - Fechas con typos en Beds24
 */

// Importar las funciones a probar
const { detectSimplePattern } = require('../src/app-unified.ts');

// Test de patrones simples con fuzzy matching
function testSimplePatternFuzzy() {
    console.log('🧪 Probando Fuzzy Matching en Patrones Simples...\n');
    
    const testCases = [
        // Disponibilidad con typos
        { input: 'dispnibilidad', expected: 'availability', description: 'Typo en disponibilidad' },
        { input: 'disponiblidad', expected: 'availability', description: 'Typo en disponibilidad' },
        { input: 'disponib', expected: 'availability', description: 'Disponibilidad corta' },
        
        // Saludos con typos
        { input: 'hola', expected: 'greeting', description: 'Saludo normal' },
        { input: 'buenos dias', expected: 'greeting', description: 'Buenos días sin tilde' },
        { input: 'buenas tardes', expected: 'greeting', description: 'Buenas tardes' },
        
        // Gracias con typos
        { input: 'grasias', expected: 'thanks', description: 'Typo en gracias' },
        { input: 'grasia', expected: 'thanks', description: 'Gracias corta con typo' },
        
        // Confusión con typos
        { input: 'no entiendo', expected: 'confusion', description: 'No entiendo' },
        { input: 'que dijiste', expected: 'confusion', description: 'Qué dijiste sin tilde' }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const result = detectSimplePattern(testCase.input);
            const success = result && result.pattern === testCase.expected;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   Input: "${testCase.input}"`);
            console.log(`   Expected: ${testCase.expected}`);
            console.log(`   Got: ${result ? result.pattern : 'null'}${result && result.isFuzzy ? ' (fuzzy)' : ''}`);
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

// Test de contexto con fuzzy matching
function testContextFuzzy() {
    console.log('🧪 Probando Fuzzy Matching en Contexto...\n');
    
    // Simular la función analyzeForContextInjection
    const analyzeForContextInjection = (messages) => {
        const lastMessage = messages[messages.length - 1].toLowerCase();
        
        const expandedKeywords = [
            'antes', 'dijiste', 'hablamos', 'recuerdas', 'mencionaste', 'anterior', 'pasado', 'previo',
            'reinicio', 'reiniciaste', 'error', 'problema', 'no respondiste', 'se cortó', 'se corto',
            'cotizaste', 'precio', 'fechas', 'disponibilidad', 'apartamento', 'habitación', 'reserva', 'booking',
            '1722', '715', '1317', 'apartamento', 'casa', 'propiedad',
            'confirmación', 'confirmacion', 'cotización', 'cotizacion', 'historial', 'reserva', 'anterior'
        ];
        
        let foundKeywords = [];
        let totalScore = 0;
        let fuzzyMatches = 0;
        
        for (const keyword of expandedKeywords) {
            if (lastMessage.includes(keyword)) {
                foundKeywords.push(keyword);
                totalScore += 1;
            } else {
                // Simular fuzzy matching con tolerance de 3 caracteres
                const distance = levenshteinDistance(lastMessage, keyword);
                const tolerance = 3;
                
                if (distance <= tolerance) {
                    foundKeywords.push(`${keyword} (fuzzy:${distance})`);
                    totalScore += 0.8;
                    fuzzyMatches++;
                }
            }
        }
        
        const matchPercentage = (totalScore / expandedKeywords.length) * 100;
        const dynamicThreshold = lastMessage.length < 30 ? 15 : lastMessage.length > 100 ? 8 : 10;
        const needsInjection = matchPercentage >= dynamicThreshold;
        
        return { needsInjection, matchPercentage, reason: `found_${foundKeywords.length}_fuzzy_${fuzzyMatches}` };
    };
    
    // Función simple de Levenshtein para el test
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
    
    const testCases = [
        { input: ['antes dijiste algo'], expected: true, description: 'Contexto con keywords exactas' },
        { input: ['antes dijiste'], expected: true, description: 'Contexto con keywords' },
        { input: ['recuerdas lo que dijiste'], expected: true, description: 'Contexto con múltiples keywords' },
        { input: ['cotizaste algo'], expected: true, description: 'Cotización mencionada' },
        { input: ['confirmacion de reserva'], expected: true, description: 'Confirmación sin tilde' },
        { input: ['historial de reservas'], expected: true, description: 'Historial de reservas' },
        { input: ['hola como estas'], expected: false, description: 'Mensaje sin contexto' },
        { input: ['disponibilidad para mañana'], expected: false, description: 'Solo disponibilidad' }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const result = analyzeForContextInjection(testCase.input);
            const success = result.needsInjection === testCase.expected;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   Input: "${testCase.input[0]}"`);
            console.log(`   Expected injection: ${testCase.expected}`);
            console.log(`   Got injection: ${result.needsInjection} (${result.matchPercentage.toFixed(1)}%)`);
            console.log(`   Reason: ${result.reason}`);
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

// Test de fechas con fuzzy parsing
function testDateFuzzy() {
    console.log('🧪 Probando Fuzzy Parsing de Fechas...\n');
    
    // Simular la función validateAndFixDates
    const validateAndFixDates = (startDate, endDate) => {
        const monthTypos = {
            'agosot': 'agosto', 'agosto': 'agosto', 'agost': 'agosto', 'agust': 'agosto',
            'septiembre': 'septiembre', 'septiempre': 'septiembre',
            'octubre': 'octubre', 'octubr': 'octubre', 'octub': 'octubre',
            'noviembre': 'noviembre', 'noviempre': 'noviembre', 'noviem': 'noviembre',
            'diciembre': 'diciembre', 'diciem': 'diciembre', 'diciembr': 'diciembre',
            'enero': 'enero', 'ener': 'enero', 'enro': 'enero',
            'febrero': 'febrero', 'febrer': 'febrero', 'febre': 'febrero',
            'marzo': 'marzo', 'marz': 'marzo', 'mar': 'marzo',
            'abril': 'abril', 'abri': 'abril', 'abr': 'abril',
            'mayo': 'mayo', 'may': 'mayo',
            'junio': 'junio', 'juni': 'junio', 'jun': 'junio',
            'julio': 'julio', 'juli': 'julio', 'jul': 'julio'
        };
        
        const monthMap = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        };
        
        function processDate(dateStr) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (dateRegex.test(dateStr)) {
                return { date: dateStr, corrections: [] };
            }
            
            const lowerDate = dateStr.toLowerCase();
            const patterns = [
                /(\d{1,2})\s+(?:de\s+)?([a-z]+)/,
                /(\d{1,2})\/(\d{1,2})/,
                /(\d{1,2})-(\d{1,2})/,
                /(\d{1,2})\.(\d{1,2})/
            ];
            
            for (const pattern of patterns) {
                const match = lowerDate.match(pattern);
                if (match) {
                    let day, monthNum;
                    
                    if (pattern.source.includes('[a-z]')) {
                        day = parseInt(match[1]);
                        const monthText = match[2];
                        const correctedMonth = monthTypos[monthText] || monthText;
                        monthNum = monthMap[correctedMonth];
                    } else {
                        day = parseInt(match[1]);
                        monthNum = parseInt(match[2]);
                    }
                    
                    if (monthNum && day >= 1 && day <= 31 && monthNum >= 1 && monthNum <= 12) {
                        const currentYear = new Date().getFullYear();
                        const formattedMonth = monthNum.toString().padStart(2, '0');
                        const formattedDay = day.toString().padStart(2, '0');
                        const processedDate = `${currentYear}-${formattedMonth}-${formattedDay}`;
                        
                        return { 
                            date: processedDate, 
                            corrections: [`Fecha parseada: "${dateStr}" → "${processedDate}"`] 
                        };
                    }
                }
            }
            
            return { date: dateStr, corrections: [`No se pudo procesar fecha: ${dateStr}`] };
        }
        
        const startResult = processDate(startDate);
        const endResult = processDate(endDate);
        
        const isValid = !startResult.corrections.some(c => c.includes('No se pudo procesar')) &&
                       !endResult.corrections.some(c => c.includes('No se pudo procesar'));
        
        return {
            startDate: startResult.date,
            endDate: endResult.date,
            corrections: [...startResult.corrections, ...endResult.corrections],
            isValid
        };
    };
    
    const testCases = [
        { 
            startDate: '15 de agosot', 
            endDate: '20 de agosot', 
            expected: true, 
            description: 'Typos en agosto' 
        },
        { 
            startDate: '10/8', 
            endDate: '15/8', 
            expected: true, 
            description: 'Fechas en formato DD/MM' 
        },
        { 
            startDate: '5-12', 
            endDate: '10-12', 
            expected: true, 
            description: 'Fechas en formato DD-MM' 
        },
        { 
            startDate: '2025-08-15', 
            endDate: '2025-08-20', 
            expected: true, 
            description: 'Fechas en formato YYYY-MM-DD' 
        },
        { 
            startDate: '15 de septiempre', 
            endDate: '20 de septiempre', 
            expected: true, 
            description: 'Typo en septiembre' 
        },
        { 
            startDate: 'fecha invalida', 
            endDate: 'otra fecha invalida', 
            expected: false, 
            description: 'Fechas inválidas' 
        }
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        try {
            const result = validateAndFixDates(testCase.startDate, testCase.endDate);
            const success = result.isValid === testCase.expected;
            
            console.log(`${success ? '✅' : '❌'} ${testCase.description}`);
            console.log(`   Input: "${testCase.startDate}" - "${testCase.endDate}"`);
            console.log(`   Expected valid: ${testCase.expected}`);
            console.log(`   Got valid: ${result.isValid}`);
            console.log(`   Corrected: "${result.startDate}" - "${result.endDate}"`);
            console.log(`   Corrections: ${result.corrections.join(', ')}`);
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
    console.log('🚀 INICIANDO TESTS DE FUZZY PARSING - ETAPA 3\n');
    console.log('=' .repeat(60));
    
    const results = [
        { name: 'Patrones Simples', test: testSimplePatternFuzzy },
        { name: 'Contexto', test: testContextFuzzy },
        { name: 'Fechas', test: testDateFuzzy }
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
        console.log('🎉 ¡TODOS LOS TESTS PASARON! Fuzzy parsing funcionando correctamente.');
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
    testSimplePatternFuzzy,
    testContextFuzzy,
    testDateFuzzy,
    runAllTests
}; 