// scripts/test-getmessages-real.js
// Test getMessages con chatId real
const fetch = require('node-fetch');

const WHAPI_API_URL = 'https://gate.whapi.cloud';
const WHAPI_TOKEN = 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';

async function testGetMessagesReal() {
    try {
        // Usar chatId real de usuario conocido  
        const chatId = '573003913251@s.whatsapp.net';
        console.log(`🚀 Test getMessages con chatId real: ${chatId}\n`);
        
        const messagesUrl = `${WHAPI_API_URL}/chats/${chatId}/messages?count=3`;
        console.log('📨 URL:', messagesUrl);
        
        const response = await fetch(messagesUrl, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
        
        console.log(`📊 Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ getMessages FUNCIONA correctamente!');
            console.log(`📈 Mensajes obtenidos: ${data.messages?.length || 0}`);
            
            if (data.messages && data.messages.length > 0) {
                console.log('\n📝 Últimos mensajes:');
                data.messages.slice(0, 3).forEach((msg, i) => {
                    console.log(`${i+1}. [${msg.type}] ${msg.from_name || msg.from}: ${msg.text?.body || 'No texto'}`);
                });
                
                console.log('\n🎯 FORMATO COMPROBADO:');
                console.log(`✅ chatId usado: ${chatId}`);
                console.log('✅ getMessages responde correctamente');
                console.log('✅ Nuestro formato phoneNumber + chatId es CORRECTO');
                
                console.log('\n💡 CONCLUSIÓN:');
                console.log('- phoneNumber: Solo número (573003913251) para identificación');
                console.log('- chatId: Formato completo (573003913251@s.whatsapp.net) para APIs WHAPI');
                console.log('- El sistema está listo para usar ambos campos correctamente');
                
            } else {
                console.log('⚠️ Chat sin mensajes, pero endpoint funciona');
            }
        } else {
            console.log('❌ Error en getMessages:', response.status);
            const errorText = await response.text();
            console.log('Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testGetMessagesReal();