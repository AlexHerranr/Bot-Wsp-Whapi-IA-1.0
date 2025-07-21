#!/usr/bin/env node

/**
 * Script para verificar la configuración de transcripción de voz
 */

import 'dotenv/config';
import { existsSync } from 'fs';
import { join } from 'path';

console.log('\n🎤 Verificación de Configuración de Transcripción de Voz\n');
console.log('=' .repeat(50));

// Verificar archivo .env
const envPath = join(process.cwd(), '.env');
if (!existsSync(envPath)) {
    console.log('❌ ERROR: No se encontró archivo .env');
    console.log('   Crea un archivo .env basándote en env.example');
    process.exit(1);
}
console.log('✅ Archivo .env encontrado');

// Verificar variables críticas
const requiredVars = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'WHAPI_TOKEN': process.env.WHAPI_TOKEN,
    'ENABLE_VOICE_TRANSCRIPTION': process.env.ENABLE_VOICE_TRANSCRIPTION
};

let hasErrors = false;

console.log('\n📋 Variables de entorno:');
console.log('-' .repeat(50));

for (const [varName, value] of Object.entries(requiredVars)) {
    if (!value || value === 'tu-api-key-aqui' || value === 'tu-whapi-token-aqui') {
        console.log(`❌ ${varName}: No configurado o valor por defecto`);
        hasErrors = true;
    } else {
        const displayValue = varName.includes('KEY') || varName.includes('TOKEN') 
            ? value.substring(0, 10) + '...' 
            : value;
        console.log(`✅ ${varName}: ${displayValue}`);
    }
}

// Verificar configuración específica de voz
console.log('\n🎤 Configuración de Transcripción:');
console.log('-' .repeat(50));

const voiceEnabled = process.env.ENABLE_VOICE_TRANSCRIPTION === 'true';
console.log(`Transcripción habilitada: ${voiceEnabled ? '✅ SÍ' : '❌ NO'}`);

if (!voiceEnabled) {
    console.log('\n⚠️  IMPORTANTE: La transcripción de voz está DESHABILITADA');
    console.log('   Para habilitarla, configura en .env:');
    console.log('   ENABLE_VOICE_TRANSCRIPTION=true\n');
} else {
    console.log('\nConfiguración adicional:');
    console.log(`- Idioma Whisper: ${process.env.WHISPER_LANGUAGE || 'es'}`);
    console.log(`- Tamaño máximo audio: ${(parseInt(process.env.MAX_AUDIO_SIZE || '26214400') / 1024 / 1024).toFixed(1)} MB`);
    console.log(`- Respuestas de voz: ${process.env.ENABLE_VOICE_RESPONSES === 'true' ? 'Habilitadas' : 'Deshabilitadas'}`);
    
    if (process.env.ENABLE_VOICE_RESPONSES === 'true') {
        console.log(`- Modelo de voz: ${process.env.VOICE_RESPONSE_MODEL || 'nova'}`);
        console.log(`- Velocidad de voz: ${process.env.VOICE_RESPONSE_SPEED || '1.0'}x`);
    }
}

// Resumen
console.log('\n' + '=' .repeat(50));
if (hasErrors) {
    console.log('❌ Hay errores en la configuración. Revisa tu archivo .env');
    process.exit(1);
} else if (!voiceEnabled) {
    console.log('⚠️  La transcripción está deshabilitada pero la configuración base es correcta');
    console.log('   Cambia ENABLE_VOICE_TRANSCRIPTION=true para activarla');
} else {
    console.log('✅ ¡Configuración correcta! La transcripción de voz está lista para usar');
}

console.log('=' .repeat(50));
console.log('\n');