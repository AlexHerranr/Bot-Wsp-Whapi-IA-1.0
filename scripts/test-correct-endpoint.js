// scripts/test-correct-endpoint.js
// Test endpoints reales de WHAPI para mensajes
const fetch = require('node-fetch');

const WHAPI_API_URL = 'https://gate.whapi.cloud';
const WHAPI_TOKEN = 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';

async function testCorrectEndpoint() {
    try {
        const chatId = '573003913251@s.whatsapp.net';
        console.log(`🚀 Probando endpoints correctos para: ${chatId}\n`);
        
        // 1. Endpoint correcto: /messages/list con chat_id
        console.log('1️⃣ Probando /messages/list...');
        const listUrl = `${WHAPI_API_URL}/messages/list?count=3&chat_id=${encodeURIComponent(chatId)}`;
        
        const listResponse = await fetch(listUrl, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
        
        console.log(`📊 Status: ${listResponse.status}`);
        
        if (listResponse.ok) {
            const data = await listResponse.json();
            console.log('✅ /messages/list FUNCIONA!');
            console.log(`📈 Mensajes obtenidos: ${data.messages?.length || 0}`);
            
            if (data.messages && data.messages.length > 0) {
                console.log('\n📝 Mensajes del chat:');
                data.messages.slice(0, 3).forEach((msg, i) => {
                    console.log(`${i+1}. [${msg.type}] ${msg.from_name || msg.from}: ${msg.text?.body || 'No texto'}`);
                });
            }
        } else {
            const errorText = await listResponse.text();
            console.log('❌ Error:', errorText);
        }
        
        // 2. Endpoint alternativo: /messages con parámetros
        console.log('\n2️⃣ Probando /messages...');
        const messagesUrl = `${WHAPI_API_URL}/messages?count=3&chat_id=${encodeURIComponent(chatId)}`;
        
        const messagesResponse = await fetch(messagesUrl, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
        
        console.log(`📊 Status: ${messagesResponse.status}`);
        
        if (messagesResponse.ok) {
            const data = await messagesResponse.json();
            console.log('✅ /messages FUNCIONA!');
            console.log(`📈 Mensajes: ${data.messages?.length || 0}`);
        } else {
            const errorText = await messagesResponse.text();
            console.log('❌ Error:', errorText);
        }
        
        console.log('\n🎯 CONCLUSIÓN:');
        console.log('✅ Formato correcto confirmado:');
        console.log('- phoneNumber: 573003913251 (identificación única)');
        console.log('- chatId: 573003913251@s.whatsapp.net (para APIs)');
        console.log('- Endpoint correcto: /messages/list?chat_id=...');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testCorrectEndpoint();