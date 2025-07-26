#!/usr/bin/env node

// Test directo de la función get_conversation_context
require('dotenv').config();

const axios = require('axios');

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_BASE_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';

async function testWhatsAppHistory() {
    console.log('🧪 Test Directo - get_conversation_context');
    console.log('==========================================\n');

    const testUserId = '573003913251@s.whatsapp.net'; // Formato correcto Whapi
    const messageCounts = [30, 60, 100];

    console.log(`👤 Usuario de prueba: ${testUserId}`);
    console.log(`🔑 WHAPI Token: ${WHAPI_TOKEN ? 'Configurado ✅' : 'NO configurado ❌'}`);
    console.log(`🌐 WHAPI URL: ${WHAPI_BASE_URL}`);
    console.log('');

    for (const count of messageCounts) {
        try {
            console.log(`📊 Obteniendo últimos ${count} mensajes...`);
            
            const startTime = Date.now();
            
            const response = await axios.get(`${WHAPI_BASE_URL}/messages/list/${testUserId}`, {
                headers: {
                    'Authorization': `Bearer ${WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    count: count
                }
            });
            
            const duration = Date.now() - startTime;
            console.log(`⏱️  Tiempo de respuesta: ${duration}ms`);
            
            if (response.data && response.data.messages) {
                console.log(`✅ Mensajes obtenidos: ${response.data.messages.length}`);
                console.log(`📊 Total en historial: ${response.data.total || 'N/A'}`);
                
                // Mostrar algunos mensajes recientes
                const messages = response.data.messages.slice(0, 3);
                console.log('📝 Últimos mensajes:');
                
                messages.forEach((msg, index) => {
                    const date = new Date(msg.timestamp * 1000);
                    const timeStr = date.toLocaleString('es-ES');
                    const sender = msg.from_me ? 'Bot' : 'Cliente';
                    const content = msg.text?.body || '[Sin texto]';
                    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
                    
                    console.log(`   ${index + 1}. [${timeStr}] ${sender}: ${preview}`);
                });
                
            } else {
                console.log('⚠️  No se encontraron mensajes');
            }
            
        } catch (error) {
            console.log('❌ Error obteniendo historial:');
            console.log(`🔍 Status: ${error.response?.status || 'N/A'}`);
            console.log(`🔍 Error: ${error.response?.data?.message || error.message}`);
        }
        
        console.log('-'.repeat(50));
    }

    console.log('\n🎯 Test completado');
    console.log('\n💡 Si el test es exitoso, significa que:');
    console.log('   ✅ WHAPI API está accesible');
    console.log('   ✅ Token está configurado correctamente');
    console.log('   ✅ El usuario tiene historial de mensajes');
    console.log('   ✅ La función get_conversation_context debería funcionar');
    
    console.log('\n🔧 Próximo paso:');
    console.log('   Configura el Assistant y prueba con un mensaje que requiera contexto');
}

// Ejecutar test
testWhatsAppHistory().catch(console.error);