/**
 * 🎤 TEST SIMPLE - Verificar Respuestas de Voz
 * 
 * Prueba básica para verificar que el sistema de respuestas de voz está funcionando
 * Basado en tu configuración actual
 */

require('dotenv').config();

const CONFIG = {
    // Variables importantes del .env
    enableVoiceResponses: process.env.ENABLE_VOICE_RESPONSES,
    ttsVoice: process.env.TTS_VOICE,
    voiceThreshold: process.env.VOICE_THRESHOLD,
    openaiApiKey: process.env.OPENAI_API_KEY,
    assistantId: process.env.ASSISTANT_ID,
    
    // Test específico
    testMessage: 'Hola, ¿tienen habitaciones disponibles para este fin de semana?'
};

console.log('🎤 TEST SIMPLE - RESPUESTAS DE VOZ\n');
console.log('📋 Verificando configuración actual:');
console.log('═'.repeat(50));

// ✅ Verificación de configuración
console.log(`✅ ENABLE_VOICE_RESPONSES: ${CONFIG.enableVoiceResponses}`);
console.log(`✅ TTS_VOICE: ${CONFIG.ttsVoice}`);
console.log(`✅ VOICE_THRESHOLD: ${CONFIG.voiceThreshold}`);
console.log(`✅ OPENAI_API_KEY: ${CONFIG.openaiApiKey ? '***configurada***' : '❌ NO CONFIGURADA'}`);
console.log(`✅ ASSISTANT_ID: ${CONFIG.assistantId ? '***configurada***' : '❌ NO CONFIGURADA'}`);

// ⚠️ Validación de estado
let allReady = true;

if (CONFIG.enableVoiceResponses !== 'true') {
    console.log('\n❌ PROBLEMA: ENABLE_VOICE_RESPONSES no está en "true"');
    console.log('   Solución: En tu .env, cambiar a: ENABLE_VOICE_RESPONSES=true');
    allReady = false;
}

if (!CONFIG.openaiApiKey) {
    console.log('\n❌ PROBLEMA: OPENAI_API_KEY no está configurada');
    allReady = false;
}

if (!CONFIG.assistantId) {
    console.log('\n❌ PROBLEMA: ASSISTANT_ID no está configurada');
    allReady = false;
}

console.log('\n' + '═'.repeat(50));

if (allReady) {
    console.log('🎯 ESTADO: ✅ TODO LISTO PARA RESPUESTAS DE VOZ');
    console.log('\n📱 INSTRUCCIONES PARA PROBAR:');
    console.log('   1. Asegúrate de que el bot esté corriendo');
    console.log('   2. Envía una NOTA DE VOZ al bot en WhatsApp');
    console.log('   3. Ejemplo: "Hola, ¿tienen habitaciones disponibles?"');
    console.log('   4. Deberías recibir una respuesta en AUDIO');
    
    console.log('\n🔍 QUÉ BUSCAR EN LOS LOGS:');
    console.log('   - 🎤 Usuario: [Nota de voz recibida]');
    console.log('   - ✍️ Usuario está escribiendo...');
    console.log('   - 🤖 OpenAI → Usuario: "..." (Xs)');
    console.log('   - 🎤 Generando voz para Usuario...');
    console.log('   - ✅ Voz enviada exitosamente');
    
    console.log('\n🎛️ CONFIGURACIÓN ACTUAL:');
    console.log(`   - Voz TTS: ${CONFIG.ttsVoice} (nova es natural)`);
    console.log(`   - Umbral caracteres: ${CONFIG.voiceThreshold} (ideal 100-200)`);
    
} else {
    console.log('🎯 ESTADO: ❌ CONFIGURACIÓN INCOMPLETA');
    console.log('\n🔧 PASOS PARA SOLUCIONARLO:');
    console.log('   1. Revisa las variables del .env mencionadas arriba');
    console.log('   2. Reinicia el bot después de cambiar el .env');
    console.log('   3. Vuelve a ejecutar este test');
}

console.log('\n' + '═'.repeat(50));
console.log('📊 CONFIGURACIÓN COMPLETA DEL .env:');
console.log('─'.repeat(30));

const voiceConfig = {
    'ENABLE_VOICE_RESPONSES': CONFIG.enableVoiceResponses,
    'TTS_VOICE': CONFIG.ttsVoice,
    'VOICE_THRESHOLD': CONFIG.voiceThreshold,
    'VOICE_RANDOM_PROBABILITY': process.env.VOICE_RANDOM_PROBABILITY,
    'ENABLE_VOICE_TRANSCRIPTION': process.env.ENABLE_VOICE_TRANSCRIPTION,
    'WHISPER_LANGUAGE': process.env.WHISPER_LANGUAGE
};

Object.entries(voiceConfig).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`${status} ${key}: ${value || 'NO CONFIGURADA'}`);
});

console.log('\n🏁 Test de verificación completado\n');

// Si todo está listo, mostrar ejemplo de uso
if (allReady) {
    console.log('💡 EJEMPLO DE INTERACCIÓN ESPERADA:');
    console.log('─'.repeat(40));
    console.log('👤 Usuario: [Envía nota de voz] "Hola, ¿tienen habitaciones?"');
    console.log('🤖 Bot: [Responde con nota de voz] "¡Hola! Sí, tenemos..."');
    console.log('\n¡Pruébalo ahora! 🚀');
}