// scripts/test-final-webhook-format.js  
// Test para verificar formato correcto: phoneNumber solo número, chatId con @s.whatsapp.net
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();
const WEBHOOK_URL = 'http://localhost:3008/hook';

// Estructura real del webhook WHAPI
const testMessage = {
    "messages": [{
        "id": "wamid.test_final",
        "type": "text", 
        "timestamp": Math.floor(Date.now() / 1000),
        "from": "573246703524",  // Solo número
        "from_me": false,        // Requerido por validación
        "chat_id": "573246703524", // Solo número  
        "from_name": "Dan Final Test",
        "text": {
            "body": "Test formato final correcto"
        }
    }]
};

async function testFinalWebhookFormat() {
    try {
        console.log('🚀 Test formato final: phoneNumber vs chatId...\n');
        
        // 1. Limpiar usuario test si existe
        await prisma.clientView.deleteMany({
            where: { phoneNumber: '573246703524' }
        });
        console.log('🧹 Usuario test limpiado');
        
        // 2. Enviar webhook
        console.log('📨 Enviando webhook...');
        console.log('Datos:', JSON.stringify(testMessage, null, 2));
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testMessage)
        });
        
        console.log('📊 Respuesta:', response.status);
        
        // 3. Esperar procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. Verificar BD
        const user = await prisma.clientView.findUnique({
            where: { phoneNumber: '573246703524' }  // Buscar por número solo
        });
        
        if (user) {
            console.log('\n✅ Usuario encontrado en BD:');
            console.log({
                phoneNumber: user.phoneNumber,  
                chatId: user.chatId,           
                userName: user.userName,
                lastActivity: user.lastActivity
            });
            
            // Verificar formato correcto
            const phoneCorrect = !user.phoneNumber.includes('@');
            const chatCorrect = user.chatId.includes('@s.whatsapp.net');
            
            console.log('\n🔍 VALIDACIÓN FORMATO:');
            console.log(`phoneNumber solo número: ${phoneCorrect ? '✅' : '❌'} (${user.phoneNumber})`);
            console.log(`chatId con @s.whatsapp.net: ${chatCorrect ? '✅' : '❌'} (${user.chatId})`);
            
            if (phoneCorrect && chatCorrect) {
                console.log('\n🎉 FORMATO PERFECTO - Listo para getMessages con chatId!');
                console.log(`📞 Para getMessages usar: ${user.chatId}`);
            } else {
                console.log('\n❌ FORMATO INCORRECTO');
            }
            
        } else {
            console.log('\n❌ Usuario no encontrado en BD');
        }
        
    } catch (error) {
        console.error('❌ Error en test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testFinalWebhookFormat();