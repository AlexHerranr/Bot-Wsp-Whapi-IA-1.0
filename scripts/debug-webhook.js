// scripts/debug-webhook.js
// Script para hacer debug directo del webhook sin esperar
const fetch = require('node-fetch');

const WEBHOOK_URL = 'http://localhost:3008/hook';

const testMessage = {
    "messages": [{
        "id": "wamid.debug_test", 
        "type": "text",
        "timestamp": Math.floor(Date.now() / 1000),
        "from": "573999888777",
        "from_me": false,
        "chat_id": "573999888777",
        "from_name": "Debug User",
        "text": {
            "body": "Debug test message"
        }
    }]
};

async function debugWebhook() {
    console.log('🔍 Enviando mensaje de debug...');
    console.log(JSON.stringify(testMessage, null, 2));
    
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testMessage)
        });
        
        const responseText = await response.text();
        console.log(`📊 Status: ${response.status}`);
        console.log(`📝 Response: ${responseText}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugWebhook();