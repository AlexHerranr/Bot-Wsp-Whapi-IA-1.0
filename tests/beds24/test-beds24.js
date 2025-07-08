import 'dotenv/config';
import { handleAvailabilityCheck, checkBeds24Health } from '../../src/handlers/integrations/beds24-availability.ts';

console.log('🧪 TEST: Sistema Inteligente de Splits y Disponibilidad (Beds24)');
console.log('================================================================');
console.log('🎯 Verificando lógica optimizada de alternativas con traslado');
console.log('📋 Nueva lógica: 0 completas=3 splits | 1 completa=2 splits | 2+ completas=1 split');
console.log('🚫 Máximo 1 traslado cuando hay opciones completas disponibles');
console.log('================================================================');

// Función helper para mostrar ayuda
function showHelp() {
    console.log('\n📋 COMANDOS DISPONIBLES:');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('1️⃣  TEST GENERAL - Consulta disponibilidad y precios por fechas');
    console.log('    npx tsx tests/beds24/test-beds24.js general YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js general 2025-08-15 2025-08-18');
    console.log('');
    console.log('2️⃣  TEST APARTAMENTO - Consulta apartamento específico');
    console.log('    npx tsx tests/beds24/test-beds24.js apartment YYYY-MM-DD YYYY-MM-DD [propertyId]');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js apartment 2025-08-15 2025-08-18 1317');
    console.log('');
    console.log('3️⃣  TEST FORMATO - Muestra exacto formato enviado a OpenAI');
    console.log('    npx tsx tests/beds24/test-beds24.js format YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js format 2025-08-15 2025-08-18');
    console.log('');
    console.log('🚨 TESTS CRÍTICOS:');
    console.log('4️⃣  TEST HEALTH - Verificar conectividad con Beds24');
    console.log('    npx tsx tests/beds24/test-beds24.js health');
    console.log('');
    console.log('5️⃣  TEST ERRORES - Simular casos de error');
    console.log('    npx tsx tests/beds24/test-beds24.js error YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js error 2024-01-01 2024-01-05');
    console.log('');
    console.log('6️⃣  TEST PERFORMANCE - Medir velocidad de respuesta');
    console.log('    npx tsx tests/beds24/test-beds24.js performance YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js performance 2025-08-15 2025-08-18');
    console.log('');
    console.log('🔧 TESTS OPCIONALES:');
    console.log('7️⃣  TEST SPLITS - Forzar opciones con traslado');
    console.log('    npx tsx tests/beds24/test-beds24.js splits YYYY-MM-DD YYYY-MM-DD');
    console.log('');
    console.log('8️⃣  TEST TOKENS - Analizar consumo de tokens');
    console.log('    npx tsx tests/beds24/test-beds24.js tokens YYYY-MM-DD YYYY-MM-DD');
    console.log('');
    console.log('9️⃣  TEST SPLITS - Verificar lógica de alternativas con traslado');
    console.log('    npx tsx tests/beds24/test-beds24.js splits YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js splits 2025-07-09 2025-07-11');
    console.log('');
    console.log('💡 NOTA: Usa fechas futuras. Hoy y fechas posteriores son válidas.');
    console.log('💡 LÓGICA SPLITS: 0 completas=3 splits | 1 completa=2 splits | 2+ completas=1 split');
    console.log('══════════════════════════════════════════════════════════════\n');
}

// Validaciones comunes
function validateDates(startDate, endDate) {
    // Validar formato de fechas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        console.error('\n❌ ERROR: Las fechas deben estar en formato YYYY-MM-DD.');
        console.error(`   Fechas recibidas: ${startDate}, ${endDate}\n`);
        return false;
    }

    // Validar que las fechas sean lógicas
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
        console.error('\n❌ ERROR: La fecha de inicio debe ser anterior a la fecha de fin.');
        console.error(`   Fechas: ${startDate} -> ${endDate}\n`);
        return false;
    }

    return true;
}

// TEST 1: Disponibilidad general por fechas
async function testGeneral(startDate, endDate) {
    console.log('\n🎯 TEST 1: DISPONIBILIDAD GENERAL POR FECHAS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Consultando disponibilidad: ${startDate} al ${endDate}`);
    console.log('🔍 Buscando todas las propiedades disponibles...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const result = await handleAvailabilityCheck({ startDate, endDate });
        
        console.log('\n✅ RESULTADO EXITOSO:\n');
        console.log(result);
        
        // Estadísticas
        const lines = result.split('\n').length;
        const chars = result.length;
        console.log(`\n📊 ESTADÍSTICAS:`);
        console.log(`   • Líneas: ${lines}`);
        console.log(`   • Caracteres: ${chars}`);
        console.log(`   • Tokens aprox: ${Math.ceil(chars / 4)}`);
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE LA PRUEBA:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// TEST 2: Apartamento específico
async function testApartment(startDate, endDate, propertyId) {
    console.log('\n🎯 TEST 2: APARTAMENTO ESPECÍFICO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Consultando disponibilidad: ${startDate} al ${endDate}`);
    console.log(`🏠 Apartamento específico: ${propertyId}`);
    console.log('🔍 Consultando solo esta propiedad...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const result = await handleAvailabilityCheck({ 
            startDate, 
            endDate, 
            propertyId: parseInt(propertyId) 
        });
        
        console.log('\n✅ RESULTADO EXITOSO:\n');
        console.log(result);
        
        // Estadísticas
        const lines = result.split('\n').length;
        const chars = result.length;
        console.log(`\n📊 ESTADÍSTICAS:`);
        console.log(`   • Líneas: ${lines}`);
        console.log(`   • Caracteres: ${chars}`);
        console.log(`   • Tokens aprox: ${Math.ceil(chars / 4)}`);
        console.log(`   • Propiedad consultada: ${propertyId}`);
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE LA PRUEBA:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// TEST 3: Formato exacto enviado a OpenAI
async function testFormat(startDate, endDate) {
    console.log('\n🎯 TEST 3: FORMATO EXACTO ENVIADO A OPENAI');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Consultando disponibilidad: ${startDate} al ${endDate}`);
    console.log('🤖 Capturando formato exacto que recibe OpenAI...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const result = await handleAvailabilityCheck({ startDate, endDate });
        
        console.log('\n🤖 FORMATO EXACTO QUE RECIBE OPENAI:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📝 Cuando OpenAI llama a check_availability(), recibe esto:');
        console.log('');
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│                   RESPUESTA DE LA FUNCIÓN               │');
        console.log('└─────────────────────────────────────────────────────────┘');
        console.log(result);
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│                      FIN DE RESPUESTA                   │');
        console.log('└─────────────────────────────────────────────────────────┘');
        
        // Análisis detallado del formato
        console.log('\n📊 ANÁLISIS DEL FORMATO:');
        console.log('───────────────────────────────────────────────────────────');
        const lines = result.split('\n');
        const chars = result.length;
        
        console.log(`   • Total líneas: ${lines.length}`);
        console.log(`   • Total caracteres: ${chars}`);
        console.log(`   • Tokens aprox: ${Math.ceil(chars / 4)}`);
        
        // Analizar contenido
        const hasCompleteOptions = result.includes('DISPONIBILIDAD COMPLETA');
        const hasSplitOptions = result.includes('ALTERNATIVAS CON TRASLADO');
        const hasEmojis = result.includes('🏠') || result.includes('💰');
        const hasDateRange = result.includes('📅');
        
        console.log(`   • Incluye opciones completas: ${hasCompleteOptions ? '✅' : '❌'}`);
        console.log(`   • Incluye alternativas con traslado: ${hasSplitOptions ? '✅' : '❌'}`);
        console.log(`   • Usa emojis: ${hasEmojis ? '✅' : '❌'}`);
        console.log(`   • Incluye rango de fechas: ${hasDateRange ? '✅' : '❌'}`);
        
        // Estructura del texto
        console.log('\n🔍 ESTRUCTURA DEL TEXTO:');
        console.log('───────────────────────────────────────────────────────────');
        lines.forEach((line, index) => {
            if (line.trim()) {
                const lineType = line.includes('**') ? 'HEADER' : 
                               line.includes('✅') ? 'OPTION' : 
                               line.includes('💰') ? 'PRICE' : 
                               line.includes('📊') ? 'STATS' : 'TEXT';
                console.log(`   ${(index + 1).toString().padStart(2, ' ')}. [${lineType}] ${line.substring(0, 50)}${line.length > 50 ? '...' : ''}`);
            }
        });
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE LA PRUEBA:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// TEST 4: Health check de Beds24
async function testHealth() {
    console.log('\n🚨 TEST 4: VERIFICACIÓN DE CONECTIVIDAD BEDS24');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 Verificando estado de conexión con Beds24...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const startTime = Date.now();
        const result = await checkBeds24Health();
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log('\n✅ RESULTADO DEL HEALTH CHECK:\n');
        console.log(result);
        
        console.log(`\n📊 ESTADÍSTICAS:`);
        console.log(`   • Tiempo de respuesta: ${responseTime}ms`);
        console.log(`   • Estado: ${result.includes('✅') ? 'CONECTADO' : 'PROBLEMAS'}`);
        
        if (responseTime > 5000) {
            console.log(`   ⚠️  ADVERTENCIA: Respuesta lenta (>5s)`);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL HEALTH CHECK:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// TEST 5: Manejo de errores
async function testError(startDate, endDate) {
    console.log('\n🚨 TEST 5: MANEJO DE ERRORES');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Probando fechas del pasado: ${startDate} al ${endDate}`);
    console.log('🔍 Verificando manejo de errores...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const result = await handleAvailabilityCheck({ startDate, endDate });
        
        console.log('\n✅ RESULTADO DEL MANEJO DE ERRORES:\n');
        console.log(result);
        
        // Analizar si el error se manejó correctamente
        const isErrorHandled = result.includes('Error:') || result.includes('❌');
        const isUserFriendly = result.includes('Por favor') || result.includes('Considera');
        
        console.log(`\n📊 ANÁLISIS DEL ERROR:`);
        console.log(`   • Error detectado: ${isErrorHandled ? '✅' : '❌'}`);
        console.log(`   • Mensaje amigable: ${isUserFriendly ? '✅' : '❌'}`);
        console.log(`   • Longitud del mensaje: ${result.length} caracteres`);
        
        if (!isErrorHandled) {
            console.log(`   ⚠️  ADVERTENCIA: El error no se manejó correctamente`);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE LA PRUEBA DE ERRORES:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// TEST 6: Performance
async function testPerformance(startDate, endDate) {
    console.log('\n🚨 TEST 6: RENDIMIENTO Y VELOCIDAD');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Mediendo tiempo de respuesta: ${startDate} al ${endDate}`);
    console.log('⏱️  Ejecutando consulta con medición de tiempo...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const startTime = Date.now();
        const result = await handleAvailabilityCheck({ startDate, endDate });
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log('\n✅ RESULTADO DEL TEST DE RENDIMIENTO:\n');
        console.log(result);
        
        console.log(`\n📊 ESTADÍSTICAS DE RENDIMIENTO:`);
        console.log(`   • Tiempo total: ${responseTime}ms`);
        console.log(`   • Tiempo en segundos: ${(responseTime / 1000).toFixed(2)}s`);
        console.log(`   • Tamaño de respuesta: ${result.length} caracteres`);
        console.log(`   • Líneas de respuesta: ${result.split('\n').length}`);
        
        // Evaluar rendimiento
        if (responseTime < 2000) {
            console.log(`   🟢 EXCELENTE: Respuesta rápida (<2s)`);
        } else if (responseTime < 5000) {
            console.log(`   🟡 ACEPTABLE: Respuesta moderada (2-5s)`);
        } else {
            console.log(`   🔴 LENTO: Respuesta lenta (>5s) - Requiere optimización`);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL TEST DE RENDIMIENTO:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// TEST 7: Verificar lógica de splits
async function testSplits(startDate, endDate) {
    console.log('\n🧪 TEST 7: VERIFICACIÓN DE LÓGICA DE SPLITS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Analizando lógica de splits: ${startDate} al ${endDate}`);
    console.log('🔍 Verificando aplicación de reglas de alternativas con traslado...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const result = await handleAvailabilityCheck({ startDate, endDate });
        
        console.log('\n✅ RESULTADO DEL TEST DE SPLITS:\n');
        console.log(result);
        
        // Analizar la lógica aplicada
        const hasCompleteOptions = result.includes('Apartamentos Disponibles');
        const hasSplitOptions = result.includes('Opciones Alternas con Traslado');
        const splitLines = result.split('\n').filter(line => line.includes('Alternativa'));
        const completeLines = result.split('\n').filter(line => line.includes('✅ **') && line.includes(' - $'));
        
        console.log(`\n📊 ANÁLISIS DE LÓGICA DE SPLITS:`);
        console.log(`   • Opciones completas detectadas: ${completeLines.length}`);
        console.log(`   • Alternativas con traslado: ${splitLines.length}`);
        console.log(`   • Tiene opciones completas: ${hasCompleteOptions ? '✅' : '❌'}`);
        console.log(`   • Tiene alternativas con traslado: ${hasSplitOptions ? '✅' : '❌'}`);
        
        // Verificar aplicación correcta de reglas
        console.log(`\n🔍 VERIFICACIÓN DE REGLAS:`);
        if (completeLines.length === 0) {
            console.log(`   📋 REGLA APLICADA: Sin opciones completas → Hasta 3 splits permitidos`);
            console.log(`   ✅ Splits mostrados: ${splitLines.length} (esperado: 0-3)`);
        } else if (completeLines.length === 1) {
            console.log(`   📋 REGLA APLICADA: 1 opción completa → Máximo 2 splits con 1 traslado`);
            console.log(`   ${splitLines.length <= 2 ? '✅' : '❌'} Splits mostrados: ${splitLines.length} (esperado: 0-2)`);
        } else if (completeLines.length >= 2) {
            console.log(`   📋 REGLA APLICADA: ${completeLines.length} opciones completas → Máximo 1 split con 1 traslado`);
            console.log(`   ${splitLines.length <= 1 ? '✅' : '❌'} Splits mostrados: ${splitLines.length} (esperado: 0-1)`);
        }
        
        // Analizar traslados en los splits
        if (hasSplitOptions) {
            console.log(`\n🔄 ANÁLISIS DE TRASLADOS:`);
            splitLines.forEach((line, index) => {
                if (line.includes('traslado')) {
                    const transfers = line.includes('1 traslado') ? 1 : 
                                    line.includes('2 traslados') ? 2 : 
                                    line.includes('3 traslados') ? 3 : 0;
                    const isValid = completeLines.length === 0 ? transfers <= 3 : transfers <= 1;
                    console.log(`   ${isValid ? '✅' : '❌'} Alternativa ${index + 1}: ${transfers} traslado${transfers > 1 ? 's' : ''} ${isValid ? '(válido)' : '(excede límite)'}`);
                }
            });
        }
        
        console.log(`\n📈 ESTADÍSTICAS:`);
        console.log(`   • Tiempo de respuesta: ${result.length > 0 ? 'Exitoso' : 'Error'}`);
        console.log(`   • Tamaño de respuesta: ${result.length} caracteres`);
        console.log(`   • Tokens estimados: ${Math.ceil(result.length / 4)}`);
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL TEST DE SPLITS:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// Función principal
async function runTest() {
    const testType = process.argv[2];
    const startDate = process.argv[3];
    const endDate = process.argv[4];
    const propertyId = process.argv[5];

    // Validar tipo de test
    if (!testType || !['general', 'apartment', 'format', 'health', 'error', 'performance', 'splits', 'tokens'].includes(testType)) {
        console.error('\n❌ ERROR: Tipo de test no válido.');
        showHelp();
        process.exit(1);
    }

    // Ejecutar test según tipo
    switch (testType) {
        case 'general':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testGeneral(startDate, endDate);
            break;
            
        case 'apartment':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            if (!propertyId) {
                console.error('\n❌ ERROR: Para test de apartamento debes proporcionar propertyId.');
                console.error('   Ejemplo: npx tsx tests/beds24/test-beds24.js apartment 2025-08-15 2025-08-18 1317');
                process.exit(1);
            }
            await testApartment(startDate, endDate, propertyId);
            break;
            
        case 'format':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testFormat(startDate, endDate);
            break;
            
        case 'health':
            await testHealth();
            break;
            
        case 'error':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            await testError(startDate, endDate);
            break;
            
        case 'performance':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testPerformance(startDate, endDate);
            break;
            
        case 'splits':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testSplits(startDate, endDate);
            break;
            
        case 'tokens':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testFormat(startDate, endDate); // Por ahora usa el mismo que format
            break;
    }
}

// Ejecutar el test
runTest(); 