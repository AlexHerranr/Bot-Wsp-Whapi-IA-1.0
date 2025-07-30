#!/usr/bin/env node

/**
 * Test completo de entrada de voz → respuesta de voz
 * 
 * Este test simula:
 * 1. Un usuario enviando una nota de voz
 * 2. El bot transcribiendo el audio
 * 3. El bot respondiendo con una nota de voz
 * 
 * Uso: node tests/test-voice-to-voice.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Cargar variables de entorno
dotenv.config();

const WEBHOOK_URL = process.env.BASE_URL || 'http://localhost:3008';
const TEST_CHAT_ID = '573003913251'; // ID del chat de prueba

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Función para esperar
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para imprimir con color
const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    step: (msg) => console.log(`${colors.magenta}▸${colors.reset} ${msg}`)
};

// Verificar configuración necesaria
function checkConfiguration() {
    console.log(`\n${colors.bright}=== Verificando Configuración ===${colors.reset}\n`);
    
    const requiredEnvVars = {
        'ENABLE_VOICE_RESPONSES': process.env.ENABLE_VOICE_RESPONSES,
        'ENABLE_VOICE_TRANSCRIPTION': process.env.ENABLE_VOICE_TRANSCRIPTION,
        'TTS_VOICE': process.env.TTS_VOICE || 'alloy',
        'VOICE_THRESHOLD': process.env.VOICE_THRESHOLD || '150',
        'WHISPER_LANGUAGE': process.env.WHISPER_LANGUAGE || 'es'
    };
    
    let isValid = true;
    
    for (const [key, value] of Object.entries(requiredEnvVars)) {
        if (key.startsWith('ENABLE_') && value !== 'true') {
            log.error(`${key} = ${value || 'undefined'} (debe ser 'true')`);
            isValid = false;
        } else {
            log.success(`${key} = ${value}`);
        }
    }
    
    return isValid;
}

// Simular un mensaje de voz con contenido específico
const createVoiceMessage = (content = "Hola, este es un test específico para verificar que se envía la nota de voz al contacto. Deberías responderme con una nota de voz también.") => ({
    messages: [{
        id: 'test_voice_' + Date.now(),
        from: TEST_CHAT_ID + '@s.whatsapp.net',
        from_me: false,
        type: 'voice',
        chat_id: TEST_CHAT_ID + '@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test',
        voice: {
            // URL de un audio OGG real (puedes cambiar esto por un audio de prueba real)
            url: 'https://www.w3schools.com/html/horse.ogg',
            duration: 5,
            mimetype: 'audio/ogg; codecs=opus'
        }
    }]
});

// Verificar logs para confirmar respuesta de voz
async function checkLogsForVoiceResponse() {
    try {
        // Buscar en el archivo de log más reciente
        const { stdout } = await execAsync('tail -n 100 logs/bot-session-*.log | grep -E "(VOICE_RESPONSE_SENT|🔊)"');
        return stdout.includes('VOICE_RESPONSE_SENT') || stdout.includes('🔊');
    } catch (error) {
        // grep no encuentra coincidencias devuelve código de error
        return false;
    }
}

// Test principal
async function runVoiceToVoiceTest() {
    console.log(`\n${colors.bright}=== Test de Voz a Voz ===${colors.reset}`);
    console.log(`${colors.cyan}Objetivo: Verificar que el bot responda con nota de voz cuando recibe una${colors.reset}\n`);
    
    // Verificar configuración
    if (!checkConfiguration()) {
        log.error('\nLa configuración no es válida. Por favor configura las variables de entorno necesarias.');
        log.info('Agrega estas líneas a tu archivo .env:');
        console.log(`
ENABLE_VOICE_RESPONSES=true
ENABLE_VOICE_TRANSCRIPTION=true
TTS_VOICE=nova
VOICE_THRESHOLD=150
WHISPER_LANGUAGE=es
        `);
        return;
    }
    
    console.log(`\n${colors.bright}=== Ejecutando Test ===${colors.reset}\n`);
    
    try {
        // Paso 1: Enviar mensaje de voz
        log.step('Enviando nota de voz al webhook...');
        
        const voiceMessage = createVoiceMessage();
        const response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(voiceMessage)
        });
        
        if (!response.ok) {
            log.error(`Error en webhook: ${response.status} ${response.statusText}`);
            return;
        }
        
        log.success('Webhook procesó el mensaje correctamente');
        
        // Paso 2: Esperar procesamiento
        log.step('Esperando procesamiento (transcripción + generación de respuesta)...');
        
        // Mostrar progreso
        for (let i = 1; i <= 10; i++) {
            process.stdout.write(`\r${colors.yellow}⏳${colors.reset} Procesando... ${i * 10}%`);
            await wait(1000);
        }
        console.log('\n');
        
        // Paso 3: Verificar resultados
        log.step('Verificando resultados...\n');
        
        console.log(`${colors.bright}Resultados esperados:${colors.reset}`);
        console.log('1. ✓ El mensaje de voz debe ser transcrito');
        console.log('2. ✓ OpenAI debe procesar la transcripción');
        console.log('3. ✓ El bot debe generar una respuesta de voz (TTS)');
        console.log('4. ✓ La nota de voz debe enviarse vía WHAPI');
        
        // Verificar logs
        const hasVoiceResponse = await checkLogsForVoiceResponse();
        
        console.log(`\n${colors.bright}Verificación de logs:${colors.reset}`);
        if (hasVoiceResponse) {
            log.success('Se encontró evidencia de respuesta de voz en los logs');
        } else {
            log.warning('No se encontró evidencia clara de respuesta de voz');
            log.info('Revisa manualmente los logs para buscar:');
            console.log('  - "🎤 Procesando nota de voz..."');
            console.log('  - "🔊 Generando respuesta de voz..."');
            console.log('  - "VOICE_RESPONSE_SENT"');
        }
        
        // Mostrar comandos útiles
        console.log(`\n${colors.bright}Comandos útiles para debugging:${colors.reset}`);
        console.log(`${colors.cyan}# Ver logs en tiempo real:${colors.reset}`);
        console.log('tail -f logs/bot-session-*.log | grep -E "(VOICE|🎤|🔊)"');
        console.log(`\n${colors.cyan}# Buscar errores de voz:${colors.reset}`);
        console.log('grep -E "(VOICE_.*ERROR|AUDIO_.*ERROR)" logs/bot-session-*.log');
        
        // Resumen final
        console.log(`\n${colors.bright}=== Resumen del Test ===${colors.reset}\n`);
        
        if (hasVoiceResponse) {
            log.success('✅ El test parece haber funcionado correctamente');
            log.info('Verifica en WhatsApp que hayas recibido una nota de voz');
        } else {
            log.warning('⚠️ El test se ejecutó pero no se pudo confirmar la respuesta de voz');
            log.info('Posibles causas:');
            console.log('  1. El audio de prueba no pudo ser descargado/transcrito');
            console.log('  2. OpenAI no generó una respuesta adecuada');
            console.log('  3. El archivo de audio no se guardó correctamente');
            console.log('  4. WHAPI no pudo descargar el archivo desde la URL generada');
        }
        
    } catch (error) {
        log.error(`Error ejecutando el test: ${error.message}`);
        console.error(error);
    }
}

// Ejecutar test
console.log(`${colors.bright}🧪 Test de Voz a Voz${colors.reset}`);
console.log(`${colors.cyan}Chat ID de prueba: ${TEST_CHAT_ID}${colors.reset}`);

runVoiceToVoiceTest();