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
    console.log('🔍  TEST RAW - Ver TODOS los datos de Beds24 incluyendo numAvail=0');
    console.log('    npx tsx tests/beds24/test-beds24.js raw YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js raw 2025-08-15 2025-08-16');
    console.log('    💡 Útil para debuggear disponibilidad y ver propiedades ocultas');
    console.log('');
    console.log('🔧  TEST CRUDE - Ver datos COMPLETAMENTE CRUDOS de la API Beds24');
    console.log('    npx tsx tests/beds24/test-beds24.js crude YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js crude 2025-07-09 2025-07-11');
    console.log('    💡 Muestra la respuesta JSON exacta sin procesamiento');
    console.log('');
    console.log('🌍  TEST TIMEZONE - Análisis de zona horaria de Beds24');
    console.log('    npx tsx tests/beds24/test-beds24.js timezone');
    console.log('    💡 Analiza comportamiento de fechas y zonas horarias');
    console.log('');
    console.log('🔧  TEST SOLUTION - Prueba solución de ajuste de timezone');
    console.log('    npx tsx tests/beds24/test-beds24.js solution YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js solution 2025-07-09 2025-07-10');
    console.log('    💡 Prueba la solución que compensa desfase UTC-Colombia');
    console.log('');
    console.log('🔄  TEST COMPARISON - Comparar endpoints calendar vs availability');
    console.log('    npx tsx tests/beds24/test-beds24.js comparison YYYY-MM-DD YYYY-MM-DD');
    console.log('    Ejemplo: npx tsx tests/beds24/test-beds24.js comparison 2025-07-08 2025-07-09');
    console.log('    💡 Compara si availability tiene datos cuando calendar no');
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

// TEST 8: Análisis RAW de datos de Beds24
async function testRawData(startDate, endDate) {
    console.log('\n🔍 TEST 8: ANÁLISIS RAW DE DATOS BEDS24');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Analizando datos RAW: ${startDate} al ${endDate}`);
    console.log('🔍 Mostrando TODOS los datos incluyendo numAvail=0...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
        const BEDS24_API_URL = 'https://api.beds24.com/v2';
        
        // Generar rango de noches (sin incluir fecha de checkout)
        const generateNightsRange = (start, end) => {
            const dates = [];
            const startDate = new Date(start);
            const endDate = new Date(end);
            
            // NO incluir la fecha de fin (día de checkout)
            for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
                dates.push(date.toISOString().split('T')[0]);
            }
            return dates;
        };
        
        const nightsRange = generateNightsRange(startDate, endDate);
        console.log(`💡 Noches reales de estadía: ${nightsRange.join(', ')}`);
        
        // Obtener nombres de propiedades
        console.log('\n📋 PASO 1: Obteniendo lista de propiedades...');
        const propsResponse = await fetch(`${BEDS24_API_URL}/properties`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
        });
        const propsData = await propsResponse.json();
        
        const propertyNames = {};
        if (propsData.success && propsData.data) {
            propsData.data.forEach(property => {
                propertyNames[property.id] = property.name;
            });
            console.log(`✅ ${propsData.data.length} propiedades encontradas`);
        }
        
        // Obtener datos del calendario
        console.log('\n📋 PASO 2: Obteniendo datos del calendario...');
        const calendarResponse = await fetch(`${BEDS24_API_URL}/inventory/rooms/calendar?startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
        });
        const calendarData = await calendarResponse.json();
        
        if (calendarData.success && calendarData.data) {
            console.log(`✅ ${calendarData.data.length} habitaciones analizadas`);
            
            console.log('\n🔍 ANÁLISIS DETALLADO POR PROPIEDAD:');
            console.log('═══════════════════════════════════════════════════════════');
            
            // Agrupar por propiedad
            const propertiesData = {};
            calendarData.data.forEach(roomData => {
                const propId = roomData.propertyId;
                if (!propertiesData[propId]) {
                    propertiesData[propId] = {
                        name: propertyNames[propId] || `Propiedad ${propId}`,
                        rooms: []
                    };
                }
                propertiesData[propId].rooms.push(roomData);
            });
            
            // Mostrar cada propiedad
            Object.entries(propertiesData).forEach(([propId, propData]) => {
                console.log(`\n🏠 **${propData.name}** (ID: ${propId})`);
                
                propData.rooms.forEach(room => {
                    console.log(`   📍 Habitación ${room.roomId}:`);
                    
                    if (room.calendar && room.calendar.length > 0) {
                        // Procesar cada elemento del calendario
                        room.calendar.forEach(calItem => {
                            // Generar fechas inclusivas del calendario de Beds24
                            const calendarDates = [];
                            const calStart = new Date(calItem.from);
                            const calEnd = new Date(calItem.to || calItem.from);
                            
                            for (let date = new Date(calStart); date <= calEnd; date.setDate(date.getDate() + 1)) {
                                calendarDates.push(date.toISOString().split('T')[0]);
                            }
                            
                            // Solo mostrar fechas que corresponden a noches reales
                            const relevantNights = calendarDates.filter(date => nightsRange.includes(date));
                            
                            relevantNights.forEach(night => {
                                const numAvail = calItem.numAvail || 0;
                                const price = calItem.price1 || 0;
                                const status = numAvail > 0 ? '✅ DISPONIBLE' : '❌ OCUPADO';
                                
                                console.log(`      🌙 NOCHE ${night}: ${status} (numAvail: ${numAvail})`);
                                if (price > 0) {
                                    console.log(`         💰 Precio: $${price.toLocaleString()}`);
                                }
                            });
                        });
                    } else {
                        console.log(`      ⚠️ Sin datos de calendario`);
                    }
                });
            });
            
            // Resumen estadístico
            console.log('\n📊 RESUMEN ESTADÍSTICO:');
            console.log('═══════════════════════════════════════════════════════════');
            
            let totalRooms = 0;
            let availableRooms = 0;
            let occupiedRooms = 0;
            
            Object.values(propertiesData).forEach(propData => {
                propData.rooms.forEach(room => {
                    if (room.calendar && room.calendar.length > 0) {
                        totalRooms++;
                        
                        // Verificar disponibilidad solo para noches reales
                        let hasAvailabilityForNights = false;
                        room.calendar.forEach(calItem => {
                            const calendarDates = [];
                            const calStart = new Date(calItem.from);
                            const calEnd = new Date(calItem.to || calItem.from);
                            
                            for (let date = new Date(calStart); date <= calEnd; date.setDate(date.getDate() + 1)) {
                                calendarDates.push(date.toISOString().split('T')[0]);
                            }
                            
                            const relevantNights = calendarDates.filter(date => nightsRange.includes(date));
                            if (relevantNights.length > 0 && (calItem.numAvail || 0) > 0) {
                                hasAvailabilityForNights = true;
                            }
                        });
                        
                        if (hasAvailabilityForNights) {
                            availableRooms++;
                        } else {
                            occupiedRooms++;
                        }
                    }
                });
            });
            
            console.log(`📈 Total habitaciones: ${totalRooms}`);
            console.log(`✅ Con disponibilidad: ${availableRooms}`);
            console.log(`❌ Ocupadas: ${occupiedRooms}`);
            console.log(`📊 Tasa ocupación: ${totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0}%`);
            console.log(`🌙 Noches analizadas: ${nightsRange.length}`);
            
            // Buscar específicamente 2005A
            console.log('\n🔍 BÚSQUEDA ESPECÍFICA: 2005A');
            console.log('═══════════════════════════════════════════════════════════');
            
            const found2005A = Object.entries(propertiesData).find(([propId, propData]) => 
                propData.name.includes('2005') && propData.name.includes('A')
            );
            
            if (found2005A) {
                const [propId, propData] = found2005A;
                console.log(`✅ ENCONTRADO: ${propData.name} (ID: ${propId})`);
                
                // Mostrar el estado de CADA noche específicamente
                console.log(`\n📅 ANÁLISIS NOCHE POR NOCHE:`);
                nightsRange.forEach(night => {
                    console.log(`\n🌙 NOCHE ${night}:`);
                    
                    let foundDataForNight = false;
                    propData.rooms.forEach(room => {
                        if (room.calendar && room.calendar.length > 0) {
                            room.calendar.forEach(calItem => {
                                // Generar fechas inclusivas del calendario
                                const calendarDates = [];
                                const calStart = new Date(calItem.from);
                                const calEnd = new Date(calItem.to || calItem.from);
                                
                                for (let date = new Date(calStart); date <= calEnd; date.setDate(date.getDate() + 1)) {
                                    calendarDates.push(date.toISOString().split('T')[0]);
                                }
                                
                                // Verificar si esta entrada del calendario aplica a esta noche
                                if (calendarDates.includes(night)) {
                                    const numAvail = calItem.numAvail || 0;
                                    const price = calItem.price1 || 0;
                                    const status = numAvail > 0 ? '✅ DISPONIBLE' : '❌ OCUPADO';
                                    
                                    console.log(`   📊 numAvail: ${numAvail} → ${status}`);
                                    if (price > 0) {
                                        console.log(`   💰 Precio: $${price.toLocaleString()}`);
                                    }
                                    foundDataForNight = true;
                                }
                            });
                        }
                    });
                    
                    if (!foundDataForNight) {
                        console.log(`   ⚠️ Sin datos del calendario para esta noche`);
                        console.log(`   📊 numAvail: N/A → ❓ DESCONOCIDO`);
                    }
                });
                
            } else {
                console.log('❌ NO ENCONTRADO: 2005A no aparece en los datos');
                console.log('💡 Posibles razones:');
                console.log('   • No existe en Beds24');
                console.log('   • Está desactivada');
                console.log('   • Nombre diferente al esperado');
                
                // Mostrar propiedades similares
                const similar = Object.entries(propertiesData).filter(([propId, propData]) => 
                    propData.name.includes('2005')
                );
                
                if (similar.length > 0) {
                    console.log('\n🔍 PROPIEDADES SIMILARES ENCONTRADAS:');
                    similar.forEach(([propId, propData]) => {
                        console.log(`   🏠 ${propData.name} (ID: ${propId})`);
                    });
                }
            }
            
        } else {
            console.error('❌ Error obteniendo datos del calendario');
            console.error('Respuesta:', calendarData);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL ANÁLISIS RAW:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Tipo: ${error.constructor.name}`);
    }
}

// TEST 9: Datos completamente crudos de Beds24
async function testCrudeData(startDate, endDate) {
    console.log('\n🔍 TEST 9: DATOS COMPLETAMENTE CRUDOS DE BEDS24');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Datos sin procesar: ${startDate} al ${endDate}`);
    console.log('🔍 Mostrando respuesta EXACTA de la API...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
        const BEDS24_API_URL = 'https://api.beds24.com/v2';
        
        console.log('\n📋 LLAMADA A LA API:');
        console.log(`URL: ${BEDS24_API_URL}/inventory/rooms/calendar`);
        console.log(`Parámetros: startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true`);
        console.log(`Timestamp de consulta: ${new Date().toISOString()}`);
        console.log(`Hora Colombia: ${new Date(Date.now() - 5*60*60*1000).toISOString()}`);
        
        // Obtener datos del calendario - EXACTOS
        const calendarResponse = await fetch(`${BEDS24_API_URL}/inventory/rooms/calendar?startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
        });
        const calendarData = await calendarResponse.json();
        
        console.log('\n📋 RESPUESTA CRUDA COMPLETA:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(JSON.stringify(calendarData, null, 2));
        
        if (calendarData.success && calendarData.data) {
            console.log('\n🔍 RESUMEN DE DATOS CRUDOS:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`✅ Total habitaciones: ${calendarData.data.length}`);
            console.log(`✅ Páginas adicionales: ${calendarData.pages.nextPageExists ? 'Sí' : 'No'}`);
            console.log(`✅ Tipo de respuesta: ${calendarData.type}`);
            console.log(`✅ Count: ${calendarData.count}`);
            
            console.log('\n📋 LISTADO DE TODAS LAS PROPIEDADES:');
            console.log('═══════════════════════════════════════════════════════════');
            calendarData.data.forEach((room, index) => {
                console.log(`\n🏠 PROPIEDAD ${index + 1}:`);
                console.log(`   🆔 PropertyID: ${room.propertyId}`);
                console.log(`   🏠 RoomID: ${room.roomId}`);
                console.log(`   📝 Name: ${room.name}`);
                console.log(`   📅 Calendar entries: ${room.calendar ? room.calendar.length : 0}`);
                
                if (room.calendar && room.calendar.length > 0) {
                    room.calendar.forEach((calItem, calIndex) => {
                        console.log(`   📋 Entry ${calIndex + 1}:`);
                        console.log(`      📅 from: ${calItem.from}`);
                        console.log(`      📅 to: ${calItem.to || calItem.from}`);
                        console.log(`      📊 numAvail: ${calItem.numAvail}`);
                        console.log(`      💰 price1: ${calItem.price1}`);
                        if (calItem.price2) console.log(`      💰 price2: ${calItem.price2}`);
                        if (calItem.price3) console.log(`      💰 price3: ${calItem.price3}`);
                    });
                } else {
                    console.log(`   ❌ Sin datos de calendario`);
                }
            });
            
        } else {
            console.error('\n❌ ERROR EN RESPUESTA DE BEDS24:');
            console.error('Success:', calendarData.success);
            console.error('Error:', calendarData.error);
            console.error('Data:', calendarData.data);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR EN LLAMADA A API:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
    }
}

// TEST 10: Análisis de zona horaria de Beds24
async function testTimezoneAnalysis() {
    console.log('\n🌍 TEST 10: ANÁLISIS DE ZONA HORARIA BEDS24');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🕐 Analizando comportamiento de zona horaria...');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
        const BEDS24_API_URL = 'https://api.beds24.com/v2';
        
        // Mostrar diferentes zonas horarias
        const now = new Date();
        const utcTime = now.toISOString();
        const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000)).toISOString();
        
        console.log('\n🕐 ANÁLISIS DE TIEMPO:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`⏰ Tiempo actual UTC: ${utcTime}`);
        console.log(`🇨🇴 Tiempo Colombia (UTC-5): ${colombiaTime}`);
        console.log(`📅 Fecha UTC: ${utcTime.split('T')[0]}`);
        console.log(`📅 Fecha Colombia: ${colombiaTime.split('T')[0]}`);
        
        // Probar diferentes fechas
        const testDates = [
            { start: '2025-07-09', end: '2025-07-10', desc: 'Noche del 9 (Colombia)' },
            { start: '2025-07-10', end: '2025-07-11', desc: 'Noche del 10 (Colombia)' },
            { start: '2025-07-11', end: '2025-07-12', desc: 'Noche del 11 (Colombia)' }
        ];
        
        for (const test of testDates) {
            console.log(`\n🔍 PROBANDO: ${test.desc}`);
            console.log('───────────────────────────────────────────────────────────');
            console.log(`📤 Enviando: startDate=${test.start}&endDate=${test.end}`);
            
            const response = await fetch(`${BEDS24_API_URL}/inventory/rooms/calendar?startDate=${test.start}&endDate=${test.end}&includeNumAvail=true&includePrices=true`, {
                headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
            });
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                console.log(`✅ Respuesta exitosa: ${data.data.length} habitaciones`);
                
                // Analizar fechas en la respuesta
                const allDates = new Set();
                data.data.forEach(room => {
                    if (room.calendar) {
                        room.calendar.forEach(cal => {
                            allDates.add(cal.from);
                            if (cal.to !== cal.from) allDates.add(cal.to);
                        });
                    }
                });
                
                console.log(`📅 Fechas en respuesta: ${Array.from(allDates).sort().join(', ')}`);
                
                // Mostrar ejemplo de 2005A si está disponible
                const property2005A = data.data.find(room => room.propertyId === 173207);
                if (property2005A && property2005A.calendar) {
                    console.log(`🏠 2005A calendar:`);
                    property2005A.calendar.forEach(cal => {
                        console.log(`   📅 ${cal.from} -> ${cal.to}: numAvail=${cal.numAvail}`);
                    });
                } else {
                    console.log(`❌ 2005A no encontrado en respuesta`);
                }
            } else {
                console.log(`❌ Sin datos o error: ${data.error || 'Unknown'}`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ ERROR EN ANÁLISIS:');
        console.error(`   Mensaje: ${error.message}`);
    }
}

// TEST 11: Prueba de solución de timezone con ajuste de fechas
async function testTimezoneSolution(startDate, endDate) {
    console.log('\n🔧 TEST 11: SOLUCIÓN DE TIMEZONE - AJUSTE DE FECHAS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Probando solución: ${startDate} al ${endDate}`);
    console.log('🎯 Objetivo: Recuperar datos perdidos por desfase UTC-Colombia');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
        const BEDS24_API_URL = 'https://api.beds24.com/v2';
        
        // 🕐 ANÁLISIS DE TIMEZONE ACTUAL
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcDate = now.toISOString().split('T')[0];
        
        // Calcular hora Colombia manualmente (UTC-5)
        const colombiaHour = (utcHour - 5 + 24) % 24;
        const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const colombiaDate = colombiaTime.toISOString().split('T')[0];
        
        console.log('\n🕐 ANÁLISIS DE TIMEZONE:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`🇨🇴 Colombia: ${colombiaDate} ${colombiaHour}:00`);
        console.log(`🌍 UTC: ${utcDate} ${utcHour}:00`);
        console.log(`📅 Desfase de fecha: ${utcDate !== colombiaDate ? 'SÍ' : 'NO'}`);
        
        // 🎯 DETECTAR DESFASE PROBLEMÁTICO
        const isTimezoneShiftProblematic = (
            utcDate !== colombiaDate &&  // UTC en día diferente a Colombia
            colombiaHour >= 19 &&        // Después de 7 PM Colombia
            utcHour >= 0 && utcHour <= 6 // Entre 12 AM y 6 AM UTC
        );
        
        console.log(`🚨 Desfase problemático: ${isTimezoneShiftProblematic ? 'SÍ' : 'NO'}`);
        
        // 🔧 APLICAR AJUSTE SI ES NECESARIO
        let adjustedStartDate = startDate;
        let adjustedEndDate = endDate;
        let adjustmentReason = 'NO_ADJUSTMENT_NEEDED';
        
        if (isTimezoneShiftProblematic) {
            // Restar 1 día para compensar adelanto de UTC
            const startDateObj = new Date(startDate + 'T00:00:00Z');
            const endDateObj = new Date(endDate + 'T00:00:00Z');
            
            startDateObj.setUTCDate(startDateObj.getUTCDate() - 1);
            endDateObj.setUTCDate(endDateObj.getUTCDate() - 1);
            
            adjustedStartDate = startDateObj.toISOString().split('T')[0];
            adjustedEndDate = endDateObj.toISOString().split('T')[0];
            adjustmentReason = 'UTC_AHEAD_COMPENSATION';
            
            console.log('\n🔧 AJUSTE APLICADO:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`📅 Original: ${startDate} → ${endDate}`);
            console.log(`📅 Ajustado: ${adjustedStartDate} → ${adjustedEndDate}`);
            console.log(`🎯 Razón: ${adjustmentReason}`);
        }
        
        // 📞 CONSULTA A BEDS24 CON FECHAS AJUSTADAS
        console.log('\n📞 CONSULTA A BEDS24:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📤 Enviando: ${adjustedStartDate} → ${adjustedEndDate}`);
        
        const response = await fetch(`${BEDS24_API_URL}/inventory/rooms/calendar?startDate=${adjustedStartDate}&endDate=${adjustedEndDate}&includeNumAvail=true&includePrices=true`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
        });
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            console.log(`✅ Respuesta exitosa: ${data.data.length} habitaciones`);
            
            // 📊 ANÁLISIS DE RESULTADOS
            console.log('\n📊 ANÁLISIS DE RESULTADOS:');
            console.log('═══════════════════════════════════════════════════════════');
            
            // Obtener todas las fechas en la respuesta
            const allDates = new Set();
            data.data.forEach(room => {
                if (room.calendar) {
                    room.calendar.forEach(cal => {
                        allDates.add(cal.from);
                        if (cal.to !== cal.from) allDates.add(cal.to);
                    });
                }
            });
            
            const sortedDates = Array.from(allDates).sort();
            console.log(`📅 Fechas en respuesta: ${sortedDates.join(', ')}`);
            
            // 🏠 ANÁLISIS POR PROPIEDAD
            console.log('\n🏠 ANÁLISIS POR PROPIEDAD:');
            console.log('═══════════════════════════════════════════════════════════');
            
            data.data.forEach((room, index) => {
                console.log(`\n🏠 PROPIEDAD ${index + 1} (ID: ${room.propertyId}):`);
                console.log(`   📝 Nombre: ${room.name}`);
                
                if (room.calendar && room.calendar.length > 0) {
                    room.calendar.forEach((cal, calIndex) => {
                        const availability = cal.numAvail > 0 ? '✅ DISPONIBLE' : '❌ OCUPADO';
                        console.log(`   📅 ${cal.from} → ${cal.to}: ${availability} (numAvail: ${cal.numAvail})`);
                        console.log(`   💰 Precio: $${cal.price1?.toLocaleString() || 'N/A'}`);
                    });
                } else {
                    console.log(`   ❌ Sin datos de calendario`);
                }
            });
            
            // 🎯 MAPEO A NOCHES ORIGINALES
            console.log('\n🎯 MAPEO A NOCHES ORIGINALES:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`👤 Usuario solicitó: Noche del ${startDate} al ${endDate}`);
            
            // Generar noches originales solicitadas
            const originalNights = [];
            const startDateObj = new Date(startDate + 'T00:00:00');
            const endDateObj = new Date(endDate + 'T00:00:00');
            
            for (let date = new Date(startDateObj); date < endDateObj; date.setDate(date.getDate() + 1)) {
                originalNights.push(date.toISOString().split('T')[0]);
            }
            
            console.log(`🌙 Noches solicitadas: ${originalNights.join(', ')}`);
            
            // Mapear datos de Beds24 a noches originales
            originalNights.forEach(night => {
                console.log(`\n🌙 NOCHE ${night}:`);
                
                data.data.forEach(room => {
                    if (room.calendar) {
                        room.calendar.forEach(cal => {
                            // Verificar si esta entrada de calendario corresponde a la noche solicitada
                            const nightObj = new Date(night + 'T00:00:00');
                            const nextDay = new Date(nightObj.getTime() + (24 * 60 * 60 * 1000));
                            const checkoutDate = nextDay.toISOString().split('T')[0];
                            
                            if (cal.from === checkoutDate || (cal.from <= checkoutDate && cal.to >= checkoutDate)) {
                                const availability = cal.numAvail > 0 ? '✅ DISPONIBLE' : '❌ OCUPADO';
                                console.log(`   🏠 ${room.propertyId}: ${availability} (numAvail: ${cal.numAvail})`);
                            }
                        });
                    }
                });
            });
            
        } else {
            console.log(`❌ Sin datos o error: ${data.error || 'Unknown'}`);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR EN TEST:');
        console.error(`   Mensaje: ${error.message}`);
    }
}

// TEST 12: Comparar endpoints calendar vs availability
async function testEndpointsComparison(startDate, endDate) {
    console.log('\n🔄 TEST 12: COMPARACIÓN DE ENDPOINTS CALENDAR VS AVAILABILITY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📅 Comparando endpoints: ${startDate} al ${endDate}`);
    console.log('🎯 Objetivo: Ver si availability tiene datos cuando calendar no');
    console.log('───────────────────────────────────────────────────────────');

    try {
        const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
        const BEDS24_API_URL = 'https://api.beds24.com/v2';
        
        console.log('\n📞 CONSULTA 1: ENDPOINT CALENDAR');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📤 URL: ${BEDS24_API_URL}/inventory/rooms/calendar`);
        console.log(`📤 Parámetros: startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true`);
        
        // Consulta al endpoint calendar
        const calendarResponse = await fetch(`${BEDS24_API_URL}/inventory/rooms/calendar?startDate=${startDate}&endDate=${endDate}&includeNumAvail=true&includePrices=true`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
        });
        const calendarData = await calendarResponse.json();
        
        console.log('\n📋 RESPUESTA CALENDAR:');
        console.log(`✅ Success: ${calendarData.success}`);
        console.log(`📊 Count: ${calendarData.count}`);
        console.log(`🏠 Habitaciones: ${calendarData.data?.length || 0}`);
        
        let calendarHasData = false;
        if (calendarData.data) {
            calendarData.data.forEach((room, index) => {
                const hasCalendarData = room.calendar && room.calendar.length > 0;
                if (hasCalendarData) calendarHasData = true;
                console.log(`   🏠 ${room.propertyId}: ${hasCalendarData ? `${room.calendar.length} entradas` : 'Sin datos'}`);
            });
        }
        
        console.log('\n📞 CONSULTA 2: ENDPOINT AVAILABILITY');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📤 URL: ${BEDS24_API_URL}/inventory/rooms/availability`);
        console.log(`📤 Parámetros: startDate=${startDate}&endDate=${endDate}&includeNumAvail=true`);
        
        // Consulta al endpoint availability
        const availabilityResponse = await fetch(`${BEDS24_API_URL}/inventory/rooms/availability?startDate=${startDate}&endDate=${endDate}&includeNumAvail=true`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
        });
        const availabilityData = await availabilityResponse.json();
        
        console.log('\n📋 RESPUESTA AVAILABILITY:');
        console.log(`✅ Success: ${availabilityData.success}`);
        console.log(`📊 Count: ${availabilityData.count || 'N/A'}`);
        console.log(`🏠 Habitaciones: ${availabilityData.data?.length || 0}`);
        
        if (availabilityData.success) {
            console.log('\n📋 RESPUESTA AVAILABILITY COMPLETA:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(JSON.stringify(availabilityData, null, 2));
        } else {
            console.log(`❌ Error: ${availabilityData.error || 'Unknown'}`);
        }
        
        console.log('\n📞 CONSULTA 3: ENDPOINT AVAILABILITY (ALTERNATIVO)');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📤 URL: ${BEDS24_API_URL}/availability`);
        console.log(`📤 Parámetros: startDate=${startDate}&endDate=${endDate}`);
        
        // Consulta al endpoint availability alternativo
        const availabilityAltResponse = await fetch(`${BEDS24_API_URL}/availability?startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN }
        });
        const availabilityAltData = await availabilityAltResponse.json();
        
        console.log('\n📋 RESPUESTA AVAILABILITY ALTERNATIVO:');
        console.log(`✅ Success: ${availabilityAltData.success}`);
        console.log(`📊 Count: ${availabilityAltData.count || 'N/A'}`);
        console.log(`🏠 Data: ${availabilityAltData.data ? 'Sí' : 'No'}`);
        
        if (availabilityAltData.success) {
            console.log('\n📋 RESPUESTA AVAILABILITY ALTERNATIVO COMPLETA:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(JSON.stringify(availabilityAltData, null, 2));
        } else {
            console.log(`❌ Error: ${availabilityAltData.error || 'Unknown'}`);
        }
        
        // Comparación de resultados
        console.log('\n🔄 COMPARACIÓN DE RESULTADOS:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📅 Calendar tiene datos: ${calendarHasData ? 'SÍ' : 'NO'}`);
        console.log(`📅 Availability funciona: ${availabilityData.success ? 'SÍ' : 'NO'}`);
        console.log(`📅 Availability Alt funciona: ${availabilityAltData.success ? 'SÍ' : 'NO'}`);
        
        if (!calendarHasData && (availabilityData.success || availabilityAltData.success)) {
            console.log('🎯 ¡ENDPOINT ALTERNATIVO PUEDE TENER DATOS!');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR EN COMPARACIÓN:');
        console.error(`   Mensaje: ${error.message}`);
    }
}

// Función principal
async function runTest() {
    const testType = process.argv[2];
    const startDate = process.argv[3];
    const endDate = process.argv[4];
    const propertyId = process.argv[5];

    // Validar tipo de test
    if (!testType || !['general', 'apartment', 'format', 'health', 'error', 'performance', 'splits', 'tokens', 'raw', 'crude', 'timezone', 'solution', 'comparison'].includes(testType)) {
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

        case 'raw':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testRawData(startDate, endDate);
            break;

        case 'crude':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testCrudeData(startDate, endDate);
            break;

        case 'timezone':
            await testTimezoneAnalysis();
            break;

        case 'solution':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testTimezoneSolution(startDate, endDate);
            break;

        case 'comparison':
            if (!startDate || !endDate) {
                console.error('\n❌ ERROR: Debes proporcionar las fechas de inicio y fin.');
                showHelp();
                process.exit(1);
            }
            if (!validateDates(startDate, endDate)) {
                process.exit(1);
            }
            await testEndpointsComparison(startDate, endDate);
            break;
    }
}

// Ejecutar el test
runTest(); 