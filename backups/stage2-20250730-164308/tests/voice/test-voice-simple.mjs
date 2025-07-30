#!/usr/bin/env node

/**
 * Test simplificado de voz a voz
 * Este test simula que el usuario ya envió una transcripción de voz
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const WEBHOOK_URL = process.env.BASE_URL || 'http://localhost:3008';
const TEST_CHAT_ID = '573003913251';

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

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    step: (msg) => console.log(`${colors.magenta}▸${colors.reset} ${msg}`)
};

// Simular un mensaje de texto que contiene una transcripción de voz
const createVoiceTranscriptionMessage = () => ({
    messages: [{
        id: 'test_voice_trans_' + Date.now(),
        from: TEST_CHAT_ID + '@s.whatsapp.net',
        from_me: false,
        type: 'text',
        chat_id: TEST_CHAT_ID + '@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        from_name: 'Usuario Test',
        text: {
            body: '🎤 [NOTA DE VOZ]: Hola, estoy probando el sistema de notas de voz. Por favor respóndeme también con una nota de voz.'
        }
    }]
});

async function runSimpleVoiceTest() {
    console.log(`\n${colors.bright}=== Test Simplificado de Voz ===${colors.reset}`);
    console.log(`${colors.cyan}Objetivo: Verificar que el bot responda con voz cuando detecta transcripción de voz${colors.reset}\n`);
    
    try {
        // Paso 1: Marcar que el usuario envió voz
        log.step('Marcando que el usuario envió una nota de voz...');
        
        // Primero enviamos un mensaje especial para marcar el estado
        const voiceMarker = {
            messages: [{
                id: 'test_voice_marker_' + Date.now(),
                from: TEST_CHAT_ID + '@s.whatsapp.net',
                from_me: false,
                type: 'voice',
                chat_id: TEST_CHAT_ID + '@s.whatsapp.net',
                timestamp: Math.floor(Date.now() / 1000),
                from_name: 'Usuario Test',
                voice: {
                    // Simular voz sin URL real
                    duration: 3
                }
            }]
        };
        
        let response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(voiceMarker)
        });
        
        log.success('Estado de voz marcado');
        
        // Esperar un poco
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Paso 2: Enviar la transcripción simulada
        log.step('Enviando transcripción de voz simulada...');
        
        const transcriptionMessage = createVoiceTranscriptionMessage();
        response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transcriptionMessage)
        });
        
        if (!response.ok) {
            log.error(`Error en webhook: ${response.status} ${response.statusText}`);
            return;
        }
        
        log.success('Transcripción procesada correctamente');
        
        // Paso 3: Esperar procesamiento
        log.step('Esperando respuesta del bot (10 segundos)...');
        
        for (let i = 1; i <= 10; i++) {
            process.stdout.write(`\r${colors.yellow}⏳${colors.reset} Esperando... ${i}s`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n');
        
        // Resultados esperados
        console.log(`\n${colors.bright}Resultados esperados:${colors.reset}`);
        console.log('1. El bot debe detectar "🎤 [NOTA DE VOZ]" en el mensaje');
        console.log('2. OpenAI debe recibir instrucciones para responder brevemente');
        console.log('3. La respuesta debe ser convertida a voz con TTS');
        console.log('4. El bot debe enviar una nota de voz (no texto)');
        
        console.log(`\n${colors.bright}Verificar en los logs:${colors.reset}`);
        console.log('tail -f logs/bot-session-*.log | grep -E "(VOICE|🔊|TTS)"');
        
        console.log(`\n${colors.bright}=== Resumen ===${colors.reset}`);
        log.info('Test completado. Verifica manualmente:');
        console.log('  - Los logs muestran "VOICE_MESSAGE_DETECTED"');
        console.log('  - Se genera archivo de audio');
        console.log('  - Se envía nota de voz vía WHAPI');
        
    } catch (error) {
        log.error(`Error ejecutando el test: ${error.message}`);
        console.error(error);
    }
}

// Ejecutar test
console.log(`${colors.bright}🧪 Test Simplificado de Voz${colors.reset}`);
console.log(`${colors.cyan}Chat ID de prueba: ${TEST_CHAT_ID}${colors.reset}`);

runSimpleVoiceTest();