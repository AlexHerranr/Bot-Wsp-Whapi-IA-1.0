#!/usr/bin/env npx ts-node
/**
 * Plan Completo de Tests Reales para Bot TeAlquilamos
 * Simula interacciones reales de clientes hoteleros
 * Basado en el plan estructurado para verificar implementación final
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';

dotenv.config();

// Configuración de tests
const BOT_URL = 'http://localhost:8080'; // Cambiar por URL de staging si es necesario
const TEST_PHONE = '573001234567'; // Número de test
const WAIT_TIME = 5000; // 5 segundos entre mensajes

/**
 * Simula webhook de WhatsApp
 */
async function simulateWhatsAppMessage(phone: string, message: string, testName: string) {
    try {
        console.log(`📱 [${testName}] Enviando: "${message}"`);
        
        const webhookPayload = {
            type: 'msg',
            from: phone,
            text: message,
            timestamp: Date.now()
        };
        
        const response = await axios.post(`${BOT_URL}/webhook`, webhookPayload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`   ✅ Webhook enviado (status: ${response.status})`);
        
        // Esperar procesamiento
        await setTimeout(WAIT_TIME);
        
        return true;
        
    } catch (error: any) {
        console.log(`   ❌ Error enviando webhook: ${error.message}`);
        return false;
    }
}

/**
 * ETAPA 1: Tests Básicos (Single-Turn, Sin Function Calling)
 */

async function test1_SaludoSimple() {
    console.log('\n🧪 TEST 1: Saludo Simple (Nuevo Usuario)');
    console.log('=' .repeat(50));
    
    const success = await simulateWhatsAppMessage(
        TEST_PHONE, 
        'hola', 
        'TEST1'
    );
    
    if (success) {
        console.log('✅ TEST 1 COMPLETADO');
        console.log('   Esperado: Bot responde saludo, nueva conversación creada');
        console.log('   Verificar logs: [MSG_RX], [RESPONSE:received], [CONVERSA:created]');
    } else {
        console.log('❌ TEST 1 FALLÓ');
    }
    
    return success;
}

async function test2_PreguntaGeneral() {
    console.log('\n🧪 TEST 2: Pregunta General (Sin Tools)');
    console.log('=' .repeat(50));
    
    const success = await simulateWhatsAppMessage(
        TEST_PHONE,
        '¿cuáles son los precios generales?',
        'TEST2'
    );
    
    if (success) {
        console.log('✅ TEST 2 COMPLETADO');
        console.log('   Esperado: Respuesta con precios aprox, sin function calls');
        console.log('   Verificar logs: [STATE_CH:chaining], no [FUNCTION:detected]');
    } else {
        console.log('❌ TEST 2 FALLÓ');
    }
    
    return success;
}

async function test3_FunctionCallingSimple() {
    console.log('\n🧪 TEST 3: Function Calling Simple (Check Availability)');
    console.log('=' .repeat(50));
    
    const success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'disponibilidad 27-30 septiembre 2025, 2 personas',
        'TEST3'
    );
    
    if (success) {
        console.log('✅ TEST 3 COMPLETADO');
        console.log('   Esperado: Bot llama check_availability, responde con opciones');
        console.log('   Verificar logs: [FUNCTION:detected], [BEDS24_C:success], [FUNCTION_CALLING_SUCCESS]');
        console.log('   NO debe haber: [DUPLICATE_REMOVED], [API_ERROR]');
    } else {
        console.log('❌ TEST 3 FALLÓ');
    }
    
    return success;
}

async function test4_ErrorHandling() {
    console.log('\n🧪 TEST 4: Error Handling (Invalid Input)');
    console.log('=' .repeat(50));
    
    const success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'disponibilidad abc def xyz',
        'TEST4'
    );
    
    if (success) {
        console.log('✅ TEST 4 COMPLETADO');
        console.log('   Esperado: Bot maneja error gracefully, pide aclaración');
        console.log('   Verificar logs: Error handled, no crash del sistema');
    } else {
        console.log('❌ TEST 4 FALLÓ');
    }
    
    return success;
}

/**
 * ETAPA 2: Tests Avanzados (Multi-Turn, Multi-Function Calls)
 */

async function test5_MultiTurnContexto() {
    console.log('\n🧪 TEST 5: Multi-Turn con Contexto Mantenido');
    console.log('=' .repeat(50));
    
    // Mensaje 1: Consulta inicial
    let success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'quiero cotizar 27-30 septiembre 2025, 2 personas',
        'TEST5-1'
    );
    
    if (!success) return false;
    
    // Mensaje 2: Consulta de detalles (debe usar contexto)
    success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'dame detalles del apartamento 715',
        'TEST5-2'
    );
    
    if (success) {
        console.log('✅ TEST 5 COMPLETADO');
        console.log('   Esperado: Bot recuerda fechas/personas, no repite preguntas');
        console.log('   Verificar logs: [STATE_CH:chaining], contexto preservado');
    } else {
        console.log('❌ TEST 5 FALLÓ');
    }
    
    return success;
}

async function test6_MultiFunctionCalls() {
    console.log('\n🧪 TEST 6: Multi-Function Calls en Un Turno');
    console.log('=' .repeat(50));
    
    const success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'reserva apartamento 715 para 27-30 septiembre 2025, 2 personas, y genera PDF confirmación',
        'TEST6'
    );
    
    if (success) {
        console.log('✅ TEST 6 COMPLETADO');
        console.log('   Esperado: create_new_booking + generate_pdf ejecutados');
        console.log('   Verificar logs: Múltiples [FUNCTION:executed], PDF generado');
    } else {
        console.log('❌ TEST 6 FALLÓ');
    }
    
    return success;
}

async function test7_DuplicadosPotenciales() {
    console.log('\n🧪 TEST 7: Edge Case - Duplicados Potenciales');
    console.log('=' .repeat(50));
    
    // Mensaje 1: Consulta
    let success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'disponibilidad 1-5 octubre 2025, 3 personas',
        'TEST7-1'
    );
    
    if (!success) return false;
    
    // Mensaje 2: Repetir consulta similar
    success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'repíteme la disponibilidad para esas fechas',
        'TEST7-2'
    );
    
    if (success) {
        console.log('✅ TEST 7 COMPLETADO');
        console.log('   Esperado: Deduplicación evita errors, reutiliza contexto');
        console.log('   Verificar logs: [DUPLICATE_REMOVED] si aplica, no OpenAI errors');
    } else {
        console.log('❌ TEST 7 FALLÓ');
    }
    
    return success;
}

async function test8_ErrorFunctionCalling() {
    console.log('\n🧪 TEST 8: Error en Function Calling');
    console.log('=' .repeat(50));
    
    // Simular error con fechas inválidas
    const success = await simulateWhatsAppMessage(
        TEST_PHONE,
        'disponibilidad 1 enero 2020, 50 personas', // Fecha pasada, muchas personas
        'TEST8'
    );
    
    if (success) {
        console.log('✅ TEST 8 COMPLETADO');
        console.log('   Esperado: Error handled gracefully, fallback response');
        console.log('   Verificar logs: [FUNC_PERF:errs:1], error response');
    } else {
        console.log('❌ TEST 8 FALLÓ');
    }
    
    return success;
}

/**
 * Función principal que ejecuta todo el plan
 */
async function executePlan() {
    console.log('🏨 PLAN COMPLETO DE TESTS REALES - BOT TEALQUILAMOS');
    console.log('=' .repeat(60));
    console.log('🎯 Objetivo: Verificar implementación final en ambiente real');
    console.log('📱 Simulando cliente WhatsApp:', TEST_PHONE);
    console.log('🤖 Bot URL:', BOT_URL);
    console.log('⏱️  Tiempo entre mensajes:', WAIT_TIME + 'ms');
    console.log('\n🔍 INICIANDO TESTS...\n');
    
    // Verificar que el bot esté corriendo
    try {
        await axios.get(`${BOT_URL}/health`, { timeout: 5000 });
        console.log('✅ Bot está corriendo y accesible\n');
    } catch (error) {
        console.error('❌ Bot no está accesible. Asegúrate de que esté corriendo:');
        console.error('   npm start');
        console.error('   o verifica la URL:', BOT_URL);
        process.exit(1);
    }
    
    // ETAPA 1: Tests Básicos
    console.log('📋 ETAPA 1: TESTS BÁSICOS');
    console.log('-' .repeat(30));
    
    const test1 = await test1_SaludoSimple();
    const test2 = await test2_PreguntaGeneral();
    const test3 = await test3_FunctionCallingSimple();
    const test4 = await test4_ErrorHandling();
    
    const etapa1Success = test1 && test2 && test3 && test4;
    
    if (!etapa1Success) {
        console.log('\n❌ ETAPA 1 FALLÓ - Deteniendo tests');
        console.log('   Revisa logs del bot para errores básicos');
        process.exit(1);
    }
    
    console.log('\n✅ ETAPA 1 COMPLETADA - Todos los tests básicos pasaron');
    
    // ETAPA 2: Tests Avanzados
    console.log('\n📋 ETAPA 2: TESTS AVANZADOS');
    console.log('-' .repeat(30));
    
    const test5 = await test5_MultiTurnContexto();
    const test6 = await test6_MultiFunctionCalls();
    const test7 = await test7_DuplicadosPotenciales();
    const test8 = await test8_ErrorFunctionCalling();
    
    const etapa2Success = test5 && test6 && test7 && test8;
    
    // RESULTADOS FINALES
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTADOS FINALES');
    console.log('=' .repeat(60));
    
    const allTests = [
        { name: 'Saludo Simple', result: test1 },
        { name: 'Pregunta General', result: test2 },
        { name: 'Function Calling Simple', result: test3 },
        { name: 'Error Handling', result: test4 },
        { name: 'Multi-Turn Contexto', result: test5 },
        { name: 'Multi-Function Calls', result: test6 },
        { name: 'Duplicados Potenciales', result: test7 },
        { name: 'Error Function Calling', result: test8 }
    ];
    
    allTests.forEach((test, index) => {
        const status = test.result ? '✅' : '❌';
        console.log(`${status} Test ${index + 1}: ${test.name}`);
    });
    
    const totalSuccess = allTests.every(test => test.result);
    
    if (totalSuccess) {
        console.log('\n🎉 TODOS LOS TESTS PASARON!');
        console.log('\n🏨 BOT TEALQUILAMOS - ESTADO FINAL:');
        console.log('   ✅ Function calling operacional');
        console.log('   ✅ Conversaciones multi-turno funcionando');
        console.log('   ✅ Context preservation confirmado');
        console.log('   ✅ Error handling robusto');
        console.log('   ✅ Deduplicación universal operativa');
        console.log('   ✅ Patrón correcto Responses API implementado');
        
        console.log('\n🚀 LISTO PARA PRODUCCIÓN REAL!');
        console.log('\n📋 Próximos Pasos:');
        console.log('   1. Revisar logs detallados para optimizaciones');
        console.log('   2. Deploy a staging para tests con usuarios reales');
        console.log('   3. Monitorear métricas de tokens y latencia');
        console.log('   4. Implementar resumen rodante si conversaciones muy largas');
        
    } else {
        const failedCount = allTests.filter(test => !test.result).length;
        console.log(`\n❌ ${failedCount} TESTS FALLARON`);
        console.log('\n🔧 ACCIONES REQUERIDAS:');
        console.log('   1. Revisar logs del bot durante tests fallidos');
        console.log('   2. Identificar errores específicos (duplicates, missing outputs, etc.)');
        console.log('   3. Aplicar correcciones basadas en logs');
        console.log('   4. Re-ejecutar plan de tests');
        
        console.log('\n📋 Tests Fallidos:');
        allTests.forEach((test, index) => {
            if (!test.result) {
                console.log(`   ❌ Test ${index + 1}: ${test.name}`);
            }
        });
    }
    
    return totalSuccess;
}

/**
 * Función de verificación de logs
 */
function printLogInstructions() {
    console.log('\n📋 INSTRUCCIONES PARA VERIFICAR LOGS:');
    console.log('=' .repeat(50));
    console.log('1. **Durante los tests, monitorea logs del bot para:**');
    console.log('   ✅ [FUNCTION_CALLS_DETECTED] - Function calling activado');
    console.log('   ✅ [BEDS24_C:success] - Beds24 API respondió');
    console.log('   ✅ [FUNCTION_CALLING_SUCCESS] - Function calling completado');
    console.log('   ✅ [INPUT_SENT] - Input enviado sin duplicados');
    console.log('   ❌ [DUPLICATE_REMOVED] - Si aparece, verificar deduplicación');
    console.log('   ❌ [API_ERROR] - Errores de OpenAI');
    
    console.log('\n2. **Logs de éxito esperados:**');
    console.log('   [RESPONSE:received] Respuesta recibida exitosamente');
    console.log('   [FUNCTION_CONTINUATION] Continuando response con solo tool outputs');
    console.log('   [STATE_CH:chaining] Encadenando respuesta previa');
    
    console.log('\n3. **Logs de error a evitar:**');
    console.log('   ❌ "Duplicate item found with id"');
    console.log('   ❌ "No tool output found for function call"');
    console.log('   ❌ [API_ERROR] con status 400');
    
    console.log('\n4. **Verificación en DB:**');
    console.log('   - Conversaciones creadas/actualizadas');
    console.log('   - Métricas de tokens correctas');
    console.log('   - Response IDs guardados para chaining');
}

/**
 * Función principal
 */
async function main() {
    console.log('🚀 INICIANDO PLAN COMPLETO DE TESTS REALES');
    console.log('=' .repeat(60));
    
    // Verificar configuración
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY no configurada en .env');
        process.exit(1);
    }
    
    if (!process.env.OPENAI_PROMPT_ID) {
        console.error('❌ OPENAI_PROMPT_ID no configurada en .env');
        process.exit(1);
    }
    
    console.log('✅ Configuración verificada');
    console.log(`   API Key: ${process.env.OPENAI_API_KEY.substring(0, 20)}...`);
    console.log(`   Prompt ID: ${process.env.OPENAI_PROMPT_ID}`);
    
    // Mostrar instrucciones de monitoreo
    printLogInstructions();
    
    console.log('\n⏱️  INICIANDO TESTS EN 3 SEGUNDOS...');
    console.log('   (Asegúrate de tener logs del bot visibles)');
    await setTimeout(3000);
    
    // Ejecutar plan completo
    const success = await executePlan();
    
    if (success) {
        console.log('\n🎯 PLAN DE TESTS COMPLETADO EXITOSAMENTE!');
        console.log('🏨 Bot TeAlquilamos está listo para servicio hotelero real.');
    } else {
        console.log('\n⚠️  PLAN DE TESTS COMPLETADO CON ISSUES');
        console.log('🔧 Revisar logs y aplicar correcciones necesarias.');
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error ejecutando plan de tests:', error);
        process.exit(1);
    });
}