#!/usr/bin/env node

// Test para verificar función get_conversation_context
require('dotenv').config();

const { executeFunction } = require('../src/functions/registry/function-registry.js');

async function testContextFunction() {
    console.log('🧪 Test de función get_conversation_context');
    console.log('========================================\n');

    const testUserId = '573003913251'; // Sin @ - la función debe agregarlo automáticamente
    const testLevels = ['recent_30', 'recent_60', 'recent_100'];

    for (const level of testLevels) {
        try {
            console.log(`📊 Probando nivel: ${level}`);
            console.log(`👤 Usuario: ${testUserId}`);
            
            const startTime = Date.now();
            
            const result = await executeFunction(
                'get_conversation_context',
                { context_level: level },
                testUserId // requestId contiene el userId
            );
            
            const duration = Date.now() - startTime;
            console.log(`⏱️  Tiempo: ${duration}ms`);
            
            if (result.success) {
                console.log('✅ Función ejecutada exitosamente');
                console.log(`📝 Nivel solicitado: ${result.context_level}`);
                console.log(`📊 Mensajes obtenidos: ${result.message_count}`);
                console.log(`📏 Longitud contexto: ${result.context_length} caracteres`);
                console.log(`📅 Timestamp: ${result.timestamp}`);
                
                // Mostrar preview del contexto (primeros 200 caracteres)
                if (result.context && result.context.length > 0) {
                    const preview = result.context.substring(0, 200) + '...';
                    console.log(`📖 Preview contexto:\n${preview}`);
                } else {
                    console.log('⚠️  No hay contexto disponible');
                }
            } else {
                console.log('❌ Función falló');
                console.log(`🔍 Error: ${result.error}`);
            }
            
        } catch (error) {
            console.log('💥 Error ejecutando función:');
            console.log(`🔍 Detalle: ${error.message}`);
        }
        
        console.log('-'.repeat(50));
    }

    console.log('\n🎯 Test completado');
    console.log('\n💡 Cómo OpenAI usará esta función:');
    console.log('   get_conversation_context({context_level: "recent_30"})');
    console.log('   get_conversation_context({context_level: "recent_60"})');
    console.log('   get_conversation_context({context_level: "recent_100"})');
    console.log('   get_conversation_context({context_level: "recent_200"})');
}

// Ejecutar test
testContextFunction().catch(console.error);