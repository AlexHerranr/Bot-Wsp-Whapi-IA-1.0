#!/usr/bin/env node

/**
 * Script para probar el sistema de typing enviando eventos simulados
 * 
 * Uso:
 * node scripts/test-typing-events.js [webhook_url] [user_id]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar configuración
function loadConfig() {
    const envFile = path.join(__dirname, '..', '.env.local');
    const envExample = path.join(__dirname, '..', 'env.example');
    
    let envPath = envFile;
    if (!fs.existsSync(envFile)) {
        envPath = envExample;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const config = {};
    
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            config[key.trim()] = valueParts.join('=').trim();
        }
    });
    
    return config;
}

async function testTypingEvents() {
    const config = loadConfig();
    const webhookUrl = process.argv[2] || config.WEBHOOK_URL || 'http://localhost:3000/hook';
    const testUserId = process.argv[3] || '573235906292'; // Tu número de teléfono para pruebas
    
    console.log('🧪 Probando sistema de typing...\n');
    console.log(`📡 Webhook URL: ${webhookUrl}`);
    console.log(`👤 Usuario de prueba: ${testUserId}`);
    console.log('');
    
    // Evento 1: Usuario comienza a escribir
    console.log('1️⃣ Simulando: Usuario comienza a escribir...');
    await sendPresenceEvent(webhookUrl, testUserId, 'typing');
    await sleep(2000);
    
    // Evento 2: Usuario envía mensaje mientras escribe
    console.log('2️⃣ Simulando: Usuario envía mensaje...');
    await sendMessageEvent(webhookUrl, testUserId, 'Hola, estoy escribiendo un mensaje largo...');
    await sleep(3000);
    
    // Evento 3: Usuario envía segundo mensaje
    console.log('3️⃣ Simulando: Usuario envía segundo mensaje...');
    await sendMessageEvent(webhookUrl, testUserId, 'Y aquí está la segunda parte.');
    await sleep(2000);
    
    // Evento 4: Usuario deja de escribir
    console.log('4️⃣ Simulando: Usuario deja de escribir...');
    await sendPresenceEvent(webhookUrl, testUserId, 'online');
    await sleep(1000);
    
    console.log('');
    console.log('✅ Prueba completada!');
    console.log('');
    console.log('📊 Verifica en los logs del bot:');
    console.log('   • Eventos de presencia recibidos');
    console.log('   • Timers pausados por typing');
    console.log('   • Procesamiento después de 5 segundos');
    console.log('   • Mensajes agrupados correctamente');
}

async function sendPresenceEvent(webhookUrl, userId, status) {
    const payload = {
        presences: [{
            contact_id: userId,
            status: status
        }],
        event: {
            type: "presences",
            event: "post"
        }
    };
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log(`   ✅ Evento de presencia enviado: ${status}`);
        } else {
            console.log(`   ❌ Error enviando evento: ${response.status}`);
        }
    } catch (error) {
        console.log(`   ❌ Error de conexión: ${error.message}`);
    }
}

async function sendMessageEvent(webhookUrl, userId, messageText) {
    const payload = {
        messages: [{
            id: `test_${Date.now()}`,
            from: userId,
            chat_id: `${userId}@s.whatsapp.net`,
            from_name: 'Usuario de Prueba',
            text: {
                body: messageText
            },
            type: 'text',
            from_me: false,
            timestamp: Math.floor(Date.now() / 1000)
        }],
        event: {
            type: "messages",
            event: "post"
        }
    };
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log(`   ✅ Mensaje enviado: "${messageText.substring(0, 30)}..."`);
        } else {
            console.log(`   ❌ Error enviando mensaje: ${response.status}`);
        }
    } catch (error) {
        console.log(`   ❌ Error de conexión: ${error.message}`);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    testTypingEvents().catch(console.error);
}

export { testTypingEvents }; 