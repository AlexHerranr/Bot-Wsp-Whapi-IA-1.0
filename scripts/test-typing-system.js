#!/usr/bin/env node

/**
 * 🧪 Script de Prueba para Sistema de Typing
 * 
 * Este script simula eventos de typing para verificar que el sistema
 * esté funcionando correctamente.
 */

const fetch = require('node-fetch');

// Configuración
const config = {
    webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3008/hook',
    testUserId: process.env.TEST_USER_ID || '573235906292',
    whapiToken: process.env.WHAPI_TOKEN,
    whapiApiUrl: process.env.WHAPI_API_URL
};

async function testTypingEvent() {
    console.log('🧪 Probando sistema de typing...\n');
    
    // Simular evento de typing
    const typingEvent = {
        presences: [
            {
                contact_id: config.testUserId,
                status: 'typing'
            }
        ],
        event: {
            type: 'presences',
            event: 'post'
        }
    };
    
    console.log('📤 Enviando evento de typing...');
    console.log('📋 Datos:', JSON.stringify(typingEvent, null, 2));
    
    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(typingEvent)
        });
        
        const result = await response.json();
        console.log('✅ Respuesta del webhook:', result);
        
        if (response.ok) {
            console.log('\n🎉 Evento de typing enviado exitosamente!');
            console.log('📝 Verifica los logs del bot para ver:');
            console.log('   🔍 TYPING DETECTADO - Buffer existe: ...');
            console.log('   ⏰ Timer configurado para 10s por typing');
            console.log('   ✍️ [Usuario] está escribiendo...');
        } else {
            console.log('❌ Error en la respuesta:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('❌ Error enviando evento:', error.message);
    }
}

async function testStopTypingEvent() {
    console.log('\n⏸️ Probando evento de stop typing...\n');
    
    // Simular evento de stop typing
    const stopTypingEvent = {
        presences: [
            {
                contact_id: config.testUserId,
                status: 'online'
            }
        ],
        event: {
            type: 'presences',
            event: 'post'
        }
    };
    
    console.log('📤 Enviando evento de stop typing...');
    console.log('📋 Datos:', JSON.stringify(stopTypingEvent, null, 2));
    
    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stopTypingEvent)
        });
        
        const result = await response.json();
        console.log('✅ Respuesta del webhook:', result);
        
        if (response.ok) {
            console.log('\n🎉 Evento de stop typing enviado exitosamente!');
            console.log('📝 Verifica los logs del bot para ver:');
            console.log('   ⏱️ [Usuario] dejó de escribir ⏱️');
        } else {
            console.log('❌ Error en la respuesta:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('❌ Error enviando evento:', error.message);
    }
}

async function testMessageWithTyping() {
    console.log('\n💬 Probando mensaje con typing...\n');
    
    // Simular mensaje de texto
    const messageEvent = {
        messages: [
            {
                id: 'test-message-' + Date.now(),
                from: config.testUserId,
                chat_id: config.testUserId + '@s.whatsapp.net',
                type: 'text',
                text: {
                    body: 'Hola, esto es una prueba del sistema de typing'
                },
                from_name: 'Usuario Test',
                chat_name: 'Usuario Test'
            }
        ]
    };
    
    console.log('📤 Enviando mensaje de prueba...');
    console.log('📋 Datos:', JSON.stringify(messageEvent, null, 2));
    
    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageEvent)
        });
        
        const result = await response.json();
        console.log('✅ Respuesta del webhook:', result);
        
        if (response.ok) {
            console.log('\n🎉 Mensaje enviado exitosamente!');
            console.log('📝 Ahora envía un evento de typing para ver el buffer en acción');
        } else {
            console.log('❌ Error en la respuesta:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error.message);
    }
}

async function main() {
    console.log('🚀 Iniciando pruebas del sistema de typing...\n');
    
    // Verificar configuración
    if (!config.webhookUrl) {
        console.error('❌ Error: WEBHOOK_URL no configurado');
        console.log('💡 Ejecuta: export WEBHOOK_URL=http://localhost:3008/hook');
        process.exit(1);
    }
    
    console.log('⚙️ Configuración:');
    console.log(`   Webhook URL: ${config.webhookUrl}`);
    console.log(`   Test User ID: ${config.testUserId}`);
    console.log('');
    
    // Ejecutar pruebas
    await testMessageWithTyping();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2s
    
    await testTypingEvent();
    await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 3s
    
    await testStopTypingEvent();
    
    console.log('\n✅ Pruebas completadas!');
    console.log('📝 Revisa los logs del bot para verificar el funcionamiento');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testTypingEvent,
    testStopTypingEvent,
    testMessageWithTyping
}; 