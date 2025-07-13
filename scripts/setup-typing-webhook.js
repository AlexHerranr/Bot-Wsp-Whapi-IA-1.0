#!/usr/bin/env node

/**
 * Script para configurar el webhook de Whapi para eventos de presencia (typing)
 * 
 * Uso:
 * node scripts/setup-typing-webhook.js
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

async function setupTypingWebhook() {
    console.log('🔧 Configurando webhook de typing para Whapi...\n');
    
    const config = loadConfig();
    
    if (!config.WHAPI_API_URL || !config.WHAPI_TOKEN) {
        console.error('❌ Error: WHAPI_API_URL y WHAPI_TOKEN deben estar configurados en .env.local');
        console.log('\n📝 Ejemplo de configuración:');
        console.log('WHAPI_API_URL=https://gate.whapi.cloud');
        console.log('WHAPI_TOKEN=tu_token_aqui');
        process.exit(1);
    }
    
    const webhookUrl = config.WEBHOOK_URL || 'https://tu-dominio.com/hook';
    
    console.log('📋 Configuración actual:');
    console.log(`   API URL: ${config.WHAPI_API_URL}`);
    console.log(`   Webhook URL: ${webhookUrl}`);
    console.log(`   Token: ${config.WHAPI_TOKEN.substring(0, 10)}...`);
    console.log('');
    
    try {
        // Configurar webhook con eventos de presencia
        const response = await fetch(`${config.WHAPI_API_URL}/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.WHAPI_TOKEN}`
            },
            body: JSON.stringify({
                webhooks: [{
                    url: webhookUrl,
                    events: [
                        { type: "messages", method: "post" },
                        { type: "presences", method: "post" }
                    ],
                    mode: "body"
                }]
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Webhook configurado exitosamente!');
            console.log('');
            console.log('📊 Eventos activados:');
            console.log('   ✅ messages: POST');
            console.log('   ✅ presences: POST');
            console.log('');
            console.log('🎯 Próximos pasos:');
            console.log('   1. Reinicia el bot: npm run dev');
            console.log('   2. Envía un mensaje desde WhatsApp');
            console.log('   3. Verifica los logs para eventos de presencia');
            console.log('');
            console.log('📝 Nota: Los eventos de presencia solo funcionan si:');
            console.log('   • El usuario no tiene "visto por última vez" oculto');
            console.log('   • Ya ha interactuado previamente con el bot');
            console.log('   • El bot está suscrito a su presencia');
            console.log('');
            console.log('⚡ Configuración optimizada:');
            console.log('   • Fallback: 2 segundos (sin typing)');
            console.log('   • Post-typing: 3 segundos (después de escribir)');
            console.log('');
            console.log('🔧 APIs de Presencia:');
            console.log('   • PUT /presences/{id}: ENVIAR presencia (bot → usuario)');
            console.log('   • POST /presences/{id}: SUSCRIBIRSE a presencia (bot ← usuario)');
            console.log('   • Webhook /hook: RECIBIR eventos de presencia');
            
        } else {
            const error = await response.text();
            console.error('❌ Error configurando webhook:', error);
            console.log('');
            console.log('🔍 Posibles causas:');
            console.log('   • Token inválido o expirado');
            console.log('   • URL de webhook no accesible');
            console.log('   • Permisos insuficientes en la cuenta de Whapi');
        }
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.log('');
        console.log('🔍 Verifica:');
        console.log('   • Conexión a internet');
        console.log('   • URL de API correcta');
        console.log('   • Token válido');
    }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    setupTypingWebhook().catch(console.error);
}

export { setupTypingWebhook }; 