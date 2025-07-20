#!/usr/bin/env node

/**
 * Script de prueba para la funcionalidad de respuestas de voz automáticas
 * 
 * Uso: node scripts/test-voice-responses.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const WEBHOOK_URL = process.env.BASE_URL || 'http://localhost:3008';

// Simular un mensaje de voz para activar respuesta de voz
const testVoiceInput = {
    messages: [{
        id: 'test_voice_resp_' + Date.now(),
        from: '5491234567890@s.whatsapp.net',
        from_me: false,
        type: 'voice',
        chat_id: '5491234567890@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test Voz',
        voice: {
            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            duration: 5
        }
    }]
};

// Simular un mensaje largo para activar respuesta de voz
const testLongMessage = {
    messages: [{
        id: 'test_long_msg_' + Date.now(),
        from: '5491234567891@s.whatsapp.net',
        from_me: false,
        type: 'text',
        chat_id: '5491234567891@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test Largo',
        text: {
            body: 'Hola, necesito información detallada sobre las habitaciones disponibles para el próximo fin de semana. Me gustaría saber los precios, las comodidades incluidas, si tienen vista al mar, el horario del check-in y check-out, y si incluyen desayuno. También me interesa saber sobre las políticas de cancelación.'
        }
    }]
};

// Simular un mensaje corto (no debería activar voz)
const testShortMessage = {
    messages: [{
        id: 'test_short_msg_' + Date.now(),
        from: '5491234567892@s.whatsapp.net',
        from_me: false,
        type: 'text',
        chat_id: '5491234567892@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test Corto',
        text: {
            body: 'Hola, ¿tienen disponibilidad?'
        }
    }]
};

async function testVoiceResponses() {
    console.log('🧪 Iniciando prueba de respuestas de voz automáticas...\n');
    
    // Verificar configuración
    if (process.env.ENABLE_VOICE_RESPONSES !== 'true') {
        console.log('⚠️  ADVERTENCIA: ENABLE_VOICE_RESPONSES no está habilitado en .env');
        console.log('   Configura ENABLE_VOICE_RESPONSES=true para activar la funcionalidad\n');
    }
    
    if (process.env.ENABLE_VOICE_TRANSCRIPTION !== 'true') {
        console.log('⚠️  ADVERTENCIA: ENABLE_VOICE_TRANSCRIPTION no está habilitado');
        console.log('   Es necesario para el test de voz → voz\n');
    }
    
    console.log('📊 Configuración actual:');
    console.log(`   TTS_VOICE: ${process.env.TTS_VOICE || 'alloy'}`);
    console.log(`   VOICE_THRESHOLD: ${process.env.VOICE_THRESHOLD || '150'} caracteres`);
    console.log(`   VOICE_RANDOM_PROBABILITY: ${process.env.VOICE_RANDOM_PROBABILITY || '0.1'}`);
    console.log('');
    
    try {
        // Test 1: Voz → Voz
        console.log('📤 Test 1: Enviando nota de voz (debería recibir respuesta de voz)...\n');
        
        let response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testVoiceInput)
        });
        
        if (response.ok) {
            console.log('✅ Webhook procesó la nota de voz');
            console.log('   Espera unos segundos para la transcripción y respuesta...');
            console.log('   Deberías recibir una respuesta de voz 🔊\n');
        }
        
        // Esperar procesamiento
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Test 2: Mensaje largo → Voz
        console.log('📤 Test 2: Enviando mensaje largo (> threshold)...');
        console.log(`   Longitud: ${testLongMessage.messages[0].text.body.length} caracteres\n`);
        
        response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testLongMessage)
        });
        
        if (response.ok) {
            console.log('✅ Webhook procesó el mensaje largo');
            console.log('   Si el mensaje supera el threshold, deberías recibir voz\n');
        }
        
        // Esperar procesamiento
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 3: Mensaje corto → Texto
        console.log('📤 Test 3: Enviando mensaje corto (< threshold)...');
        console.log(`   Longitud: ${testShortMessage.messages[0].text.body.length} caracteres\n`);
        
        response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testShortMessage)
        });
        
        if (response.ok) {
            console.log('✅ Webhook procesó el mensaje corto');
            console.log('   Deberías recibir respuesta de texto (no voz)\n');
        }
        
        console.log('📋 Checklist de verificación:');
        console.log('   ✓ ENABLE_VOICE_RESPONSES=true en .env');
        console.log('   ✓ ENABLE_VOICE_TRANSCRIPTION=true para test voz→voz');
        console.log('   ✓ OpenAI API key con acceso a TTS');
        console.log('   ✓ Configurar TTS_VOICE (alloy, echo, fable, onyx, nova, shimmer)');
        console.log('   ✓ Ajustar VOICE_THRESHOLD según necesidad');
        console.log('   ✓ Los logs muestran "🔊 Generando respuesta de voz..."');
        console.log('   ✓ Las respuestas de voz se reproducen correctamente');
        
        console.log('\n💡 Tips de configuración:');
        console.log('   - alloy: voz neutral balanceada');
        console.log('   - nova: voz femenina cálida');
        console.log('   - echo: voz masculina profunda');
        console.log('   - Aumenta VOICE_THRESHOLD para menos respuestas de voz');
        console.log('   - Reduce VOICE_RANDOM_PROBABILITY para menos aleatoriedad');
        
    } catch (error) {
        console.error('❌ Error enviando mensaje de prueba:', error.message);
    }
}

// Ejecutar prueba
testVoiceResponses();