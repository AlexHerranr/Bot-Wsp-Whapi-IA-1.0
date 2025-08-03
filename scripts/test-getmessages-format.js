// scripts/test-getmessages-format.js  
// Test para verificar que getMessages funciona con el formato correcto
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();
const WHAPI_API_URL = 'https://gate.whapi.cloud';
const WHAPI_TOKEN = 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';

async function testGetMessagesFormat() {
    try {
        console.log('🚀 Test getMessages con formato correcto...\n');
        
        // 1. Crear usuario con formato correcto en BD
        console.log('📝 Creando usuario con formato correcto...');
        await prisma.clientView.upsert({
            where: { phoneNumber: '573246703524' },
            update: {
                userName: 'Dan Test Format',
                chatId: '573246703524@s.whatsapp.net',
                lastActivity: new Date()
            },
            create: {
                phoneNumber: '573246703524',        // Solo número
                userName: 'Dan Test Format',
                chatId: '573246703524@s.whatsapp.net',  // Formato completo
                lastActivity: new Date(),
                prioridad: 'MEDIA'
            }
        });
        
        // 2. Verificar datos en BD
        const user = await prisma.clientView.findUnique({
            where: { phoneNumber: '573246703524' }
        });
        
        console.log('✅ Usuario en BD:');
        console.log({
            phoneNumber: user.phoneNumber,  // 573246703524
            chatId: user.chatId,           // 573246703524@s.whatsapp.net  
            userName: user.userName
        });
        
        // 3. Test getMessages usando chatId
        console.log('\n📨 Probando getMessages con chatId...');
        const messagesUrl = `${WHAPI_API_URL}/chats/${user.chatId}/messages?count=5`;
        console.log('URL:', messagesUrl);
        
        const response = await fetch(messagesUrl, {
            headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
        });
        
        console.log(`📊 Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ getMessages funciona correctamente!');
            console.log(`📈 Mensajes obtenidos: ${data.messages?.length || 0}`);
            
            if (data.messages && data.messages.length > 0) {
                console.log('\n🔍 Primeros mensajes:');
                data.messages.slice(0, 2).forEach((msg, i) => {
                    console.log(`${i+1}. ${msg.from_name || 'Sin nombre'}: ${msg.text?.body || 'Sin texto'}`);
                });
            }
        } else {
            console.log('❌ Error en getMessages:', response.status);
            const errorText = await response.text();
            console.log('Error:', errorText);
        }
        
        // 4. Verificar formato
        const phoneCorrect = !user.phoneNumber.includes('@');
        const chatCorrect = user.chatId.includes('@s.whatsapp.net');
        
        console.log('\n🎯 VALIDACIÓN FINAL:');
        console.log(`phoneNumber (identificación): ${phoneCorrect ? '✅' : '❌'} ${user.phoneNumber}`);
        console.log(`chatId (para APIs): ${chatCorrect ? '✅' : '❌'} ${user.chatId}`);
        
        if (phoneCorrect && chatCorrect && response.ok) {
            console.log('\n🎉 FORMATO PERFECTO - Sistema listo para producción!');
        }
        
    } catch (error) {
        console.error('❌ Error en test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testGetMessagesFormat();