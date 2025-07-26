#!/usr/bin/env node

/**
 * Script de prueba para la funcionalidad de transcripción de voz
 * 
 * Uso: node scripts/test-voice-transcription.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const WEBHOOK_URL = process.env.BASE_URL || 'http://localhost:3008';

// Simular un mensaje de voz
const testVoiceMessage = {
    messages: [{
        id: 'test_voice_' + Date.now(),
        from: '5491234567890@s.whatsapp.net',
        from_me: false,
        type: 'voice',
        chat_id: '5491234567890@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test',
        // Simular datos de audio (URL de audio de prueba)
        voice: {
            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            duration: 10,
            mimetype: 'audio/ogg; codecs=opus'
        }
    }]
};

// Mensaje de audio tipo PTT (Push to Talk)
const testPTTMessage = {
    messages: [{
        id: 'test_ptt_' + Date.now(),
        from: '5491234567891@s.whatsapp.net',
        from_me: false,
        type: 'ptt',
        chat_id: '5491234567891@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test 2',
        ptt: {
            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            duration: 5
        }
    }]
};

// Mensaje de audio sin URL (para probar fallback)
const testAudioNoUrl = {
    messages: [{
        id: 'test_audio_nourl_' + Date.now(),
        from: '5491234567892@s.whatsapp.net',
        from_me: false,
        type: 'audio',
        chat_id: '5491234567892@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test 3',
        audio: {}
    }]
};

async function testVoiceTranscription() {
    console.log('🧪 Iniciando prueba de transcripción de voz...\n');
    
    // Verificar configuración
    if (process.env.ENABLE_VOICE_TRANSCRIPTION !== 'true') {
        console.log('⚠️  ADVERTENCIA: ENABLE_VOICE_TRANSCRIPTION no está habilitado en .env');
        console.log('   Configura ENABLE_VOICE_TRANSCRIPTION=true para activar la funcionalidad\n');
    }
    
    try {
        // Test 1: Mensaje de voz normal
        console.log('📤 Test 1: Enviando nota de voz (type: voice)...');
        console.log('   Duración: 10 segundos\n');
        
        let response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testVoiceMessage)
        });
        
        if (response.ok) {
            console.log('✅ Webhook procesó la nota de voz correctamente');
            console.log('   Verifica los logs para ver: "🎤 Procesando nota de voz..."');
            console.log('   La transcripción debe aparecer como: "🎤 [transcripción...]"\n');
        } else {
            console.error('❌ Error en el webhook:', response.status, response.statusText);
        }
        
        // Esperar un poco antes del siguiente test
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 2: Mensaje PTT (Push to Talk)
        console.log('📤 Test 2: Enviando audio PTT (Push to Talk)...');
        console.log('   Duración: 5 segundos\n');
        
        response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPTTMessage)
        });
        
        if (response.ok) {
            console.log('✅ Webhook procesó el PTT correctamente\n');
        }
        
        // Esperar un poco antes del siguiente test
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 3: Audio sin URL (fallback)
        console.log('📤 Test 3: Enviando audio sin URL (prueba de fallback)...\n');
        
        response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testAudioNoUrl)
        });
        
        if (response.ok) {
            console.log('✅ Webhook manejó el fallback correctamente');
            console.log('   Debe aparecer: "[Nota de voz recibida]"\n');
        }
        
        console.log('📋 Checklist de verificación:');
        console.log('   ✓ ENABLE_VOICE_TRANSCRIPTION=true en .env');
        console.log('   ✓ OpenAI API key configurada correctamente');
        console.log('   ✓ Modelo Whisper disponible');
        console.log('   ✓ Los logs muestran el procesamiento de audio');
        console.log('   ✓ La transcripción aparece con emoji 🎤');
        console.log('   ✓ El estado lastInputVoice se marca como true');
        
        console.log('\n💡 Tips:');
        console.log('   - El audio debe ser menor a 25MB (MAX_AUDIO_SIZE)');
        console.log('   - El idioma por defecto es español (WHISPER_LANGUAGE=es)');
        console.log('   - La transcripción usa temperatura 0.2 para mayor precisión');
        
    } catch (error) {
        console.error('❌ Error enviando mensaje de prueba:', error.message);
    }
}

// Ejecutar prueba
testVoiceTranscription();