// scripts/test-whapi-access.js
// Script para verificar acceso a WHAPI antes de la prueba CRM

require('dotenv').config();
const fetch = require('node-fetch');

const PHONE_NUMBER = '573003913251';
const CHAT_ID = `${PHONE_NUMBER}@s.whatsapp.net`;

console.log('🔍 VERIFICANDO ACCESO A WHAPI...');
console.log('═'.repeat(50));

async function testWhapiHealth() {
  console.log('\n1. 🏥 Testeando salud del canal...');
  
  try {
    const response = await fetch(`${process.env.WHAPI_API_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`
      }
    });
    
    const data = await response.json();
    console.log(`✅ Estado: ${response.status}`);
    console.log(`📊 Respuesta:`, data);
    
    return response.ok;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testChatExists() {
  console.log('\n2. 💬 Verificando si el chat existe...');
  
  try {
    const response = await fetch(`${process.env.WHAPI_API_URL}/chats/${encodeURIComponent(CHAT_ID)}`, {
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Chat encontrado:`, {
        id: data.id,
        name: data.name,
        type: data.type,
        unread_count: data.unread_count
      });
      return true;
    } else {
      console.log(`⚠️ Chat no encontrado (${response.status})`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testMessagesList() {
  console.log('\n3. 📜 Probando endpoint de mensajes...');
  
  try {
    const url = `${process.env.WHAPI_API_URL}/messages/list?chat_id=${encodeURIComponent(CHAT_ID)}&count=5`;
    console.log(`🌐 URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Mensajes obtenidos: ${data.messages?.length || 0}`);
      
      if (data.messages && data.messages.length > 0) {
        console.log('\n📋 Muestra de mensajes:');
        data.messages.slice(0, 2).forEach((msg, i) => {
          const sender = msg.from_name || (msg.from_me ? 'Bot' : 'Cliente');
          const content = msg.text?.body || msg.body || '[Media]';
          const time = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString() : 'Sin timestamp';
          console.log(`  ${i + 1}. ${sender} (${time}): ${content.substring(0, 50)}...`);
        });
      }
      
      return data.messages?.length > 0;
    } else {
      const errorText = await response.text();
      console.log(`❌ Error ${response.status}: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`📱 Usuario objetivo: ${PHONE_NUMBER}`);
  console.log(`💬 Chat ID: ${CHAT_ID}`);
  console.log(`🌐 WHAPI URL: ${process.env.WHAPI_API_URL}`);
  console.log(`🔑 Token: ${process.env.WHAPI_TOKEN ? 'SET' : 'NOT SET'}`);
  
  const results = {
    health: await testWhapiHealth(),
    chat: await testChatExists(),
    messages: await testMessagesList()
  };
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 RESULTADOS:');
  console.log('═'.repeat(50));
  console.log(`🏥 Salud del canal: ${results.health ? '✅ OK' : '❌ FAIL'}`);
  console.log(`💬 Chat existe: ${results.chat ? '✅ OK' : '❌ FAIL'}`);
  console.log(`📜 Mensajes accesibles: ${results.messages ? '✅ OK' : '❌ FAIL'}`);
  
  const allGood = Object.values(results).every(r => r);
  
  console.log('\n🎯 CONCLUSIÓN:');
  if (allGood) {
    console.log('✅ WHAPI está funcionando correctamente');
    console.log('🚀 Puedes ejecutar la prueba CRM: npm run update-crm-real');
  } else {
    console.log('❌ Hay problemas con WHAPI');
    console.log('🔧 Revisa la configuración antes de continuar');
  }
}

main().catch(console.error);