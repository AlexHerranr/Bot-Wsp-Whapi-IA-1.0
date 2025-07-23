#!/usr/bin/env node

/**
 * Script para testear la estabilidad del webhook
 * Ejecuta múltiples webhooks para verificar que el bot no se reinicie
 */

const axios = require('axios');

const WEBHOOK_URL = 'https://actual-bobcat-handy.ngrok-free.app/hook';
const TEST_USER_ID = '573003913251';

// Simular webhook de presencia (typing)
const typingWebhook = {
    presences: [
        {
            contact_id: TEST_USER_ID,
            status: 'typing'
        }
    ],
    event: {
        type: 'presences',
        event: 'post'
    }
};

// Simular webhook de mensaje
const messageWebhook = {
    messages: [
        {
            id: `test_msg_${Date.now()}`,
            type: 'text',
            text: {
                body: 'Test message for stability'
            },
            from: TEST_USER_ID,
            timestamp: Date.now()
        }
    ]
};

async function sendWebhook(data, description) {
    try {
        console.log(`📤 Enviando ${description}...`);
        const response = await axios.post(WEBHOOK_URL, data, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
        console.log(`✅ ${description} enviado exitosamente (${response.status})`);
        return true;
    } catch (error) {
        console.error(`❌ Error enviando ${description}:`, error.message);
        return false;
    }
}

async function testWebhookStability() {
    console.log('🧪 Iniciando test de estabilidad de webhook...\n');
    
    const tests = [
        { data: typingWebhook, description: 'webhook de typing' },
        { data: messageWebhook, description: 'webhook de mensaje' },
        { data: typingWebhook, description: 'webhook de typing (2)' },
        { data: messageWebhook, description: 'webhook de mensaje (2)' },
        { data: typingWebhook, description: 'webhook de typing (3)' }
    ];
    
    let successCount = 0;
    let totalTests = tests.length;
    
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.log(`\n--- Test ${i + 1}/${totalTests} ---`);
        
        const success = await sendWebhook(test.data, test.description);
        if (success) successCount++;
        
        // Esperar 2 segundos entre tests
        if (i < tests.length - 1) {
            console.log('⏳ Esperando 2 segundos...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log('\n📊 Resultados del test:');
    console.log(`✅ Exitosos: ${successCount}/${totalTests}`);
    console.log(`❌ Fallidos: ${totalTests - successCount}/${totalTests}`);
    
    if (successCount === totalTests) {
        console.log('\n🎉 ¡Todos los webhooks se enviaron exitosamente!');
        console.log('💡 Verifica en los logs del bot que no haya reinicios.');
    } else {
        console.log('\n⚠️ Algunos webhooks fallaron. Revisa la conexión de ngrok.');
    }
    
    console.log('\n📝 Instrucciones:');
    console.log('1. Ejecuta este test mientras el bot está corriendo');
    console.log('2. Verifica que el PID del bot no cambie en los logs');
    console.log('3. Si el bot se reinicia, revisa los logs de error');
}

// Ejecutar el test
testWebhookStability().catch(console.error); 