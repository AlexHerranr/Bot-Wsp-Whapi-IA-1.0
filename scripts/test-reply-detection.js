#!/usr/bin/env node

/**
 * Script de prueba para la funcionalidad de detección de respuestas citadas
 * 
 * Uso: node scripts/test-reply-detection.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const WEBHOOK_URL = process.env.BASE_URL || 'http://localhost:3008';

// Simular un mensaje con respuesta citada
const testQuotedMessage = {
    messages: [{
        id: 'test_msg_' + Date.now(),
        from: '5491234567890@s.whatsapp.net',
        from_me: false,
        type: 'text',
        chat_id: '5491234567890@s.whatsapp.net',
        timestamp: Math.floor(Date.now() / 1000),
        text: {
            body: '¿Cuál es el precio de esa habitación?'
        },
        from_name: 'Usuario Test',
        // Simular contexto de respuesta citada
        context: {
            quoted_content: {
                body: 'Tenemos habitaciones disponibles desde $100 por noche',
                caption: null
            }
        }
    }]
};

async function testReplyDetection() {
    console.log('🧪 Iniciando prueba de detección de respuestas citadas...\n');
    
    try {
        console.log('📤 Enviando mensaje con respuesta citada al webhook...');
        console.log('   Mensaje original: "Tenemos habitaciones disponibles desde $100 por noche"');
        console.log('   Respuesta: "¿Cuál es el precio de esa habitación?"\n');
        
        const response = await fetch(`${WEBHOOK_URL}/hook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testQuotedMessage)
        });
        
        if (response.ok) {
            console.log('✅ Webhook procesó el mensaje correctamente');
            console.log('\n📋 Verifica los logs del servidor para confirmar:');
            console.log('   1. Debe aparecer: "📱 Respuesta detectada a:"');
            console.log('   2. El mensaje enriquecido debe incluir el contexto citado');
            console.log('   3. OpenAI debe recibir el mensaje con contexto completo');
        } else {
            console.error('❌ Error en el webhook:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('❌ Error enviando mensaje de prueba:', error.message);
    }
    
    console.log('\n💡 Tip: Asegúrate de que ENABLE_REPLY_DETECTION=true en tu .env');
}

// Ejecutar prueba
testReplyDetection();