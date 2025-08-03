// scripts/analyze-whapi-data-structure.js
// Script para analizar cómo vienen realmente los datos de WHAPI

const fetch = require('node-fetch');

const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';

async function analyzeWhapiDataStructure() {
    try {
        console.log('🔍 Analizando estructura real de datos WHAPI...\n');

        // 1. Analizar endpoint /messages/list
        console.log('📨 ENDPOINT: /messages/list');
        console.log('='.repeat(50));
        
        const messagesUrl = `${WHAPI_API_URL}/messages/list?count=5`;
        const messagesResponse = await fetch(messagesUrl, {
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            
            console.log('📋 Estructura de mensajes:');
            messagesData.messages.slice(0, 3).forEach((msg, index) => {
                console.log(`\nMensaje ${index + 1}:`);
                console.log(`  from:     "${msg.from}"`);
                console.log(`  chat_id:  "${msg.chat_id}"`);
                console.log(`  from_me:  ${msg.from_me}`);
                console.log(`  type:     ${msg.type}`);
                
                // Analizar diferencias
                if (msg.from !== msg.chat_id) {
                    console.log(`  ⚠️  from ≠ chat_id`);
                } else {
                    console.log(`  ✅ from = chat_id`);
                }
            });
        }

        // 2. Analizar endpoint getChatInfo
        console.log('\n\n💬 ENDPOINT: getChatInfo');
        console.log('='.repeat(50));

        // Probar con algunos chat IDs conocidos
        const testChatIds = [
            '573003913251@s.whatsapp.net',
            '573246703524@s.whatsapp.net',
            '573208627565@s.whatsapp.net'
        ];

        for (const chatId of testChatIds) {
            try {
                console.log(`\n🔍 Analizando chat: ${chatId}`);
                
                const chatInfoUrl = `${WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}`;
                const chatResponse = await fetch(chatInfoUrl, {
                    headers: {
                        'Authorization': `Bearer ${WHAPI_TOKEN}`,
                        'Accept': 'application/json'
                    }
                });

                if (chatResponse.ok) {
                    const chatData = await chatResponse.json();
                    
                    console.log(`  id:        "${chatData.id}"`);
                    console.log(`  type:      "${chatData.type}"`);
                    console.log(`  name:      "${chatData.name || 'N/A'}"`);
                    console.log(`  timestamp: ${chatData.timestamp}`);
                    
                    if (chatData.last_message) {
                        console.log(`  last_msg.from:     "${chatData.last_message.from}"`);
                        console.log(`  last_msg.chat_id:  "${chatData.last_message.chat_id}"`);
                        
                        // Comparar datos
                        console.log('\n  📊 ANÁLISIS:');
                        console.log(`    chatInfo.id = ${chatData.id}`);
                        console.log(`    last_msg.from = ${chatData.last_message.from}`);
                        console.log(`    last_msg.chat_id = ${chatData.last_message.chat_id}`);
                        
                        if (chatData.id === chatData.last_message.chat_id) {
                            console.log(`    ✅ chatInfo.id = last_msg.chat_id`);
                        } else {
                            console.log(`    ⚠️  chatInfo.id ≠ last_msg.chat_id`);
                        }
                        
                        if (chatData.last_message.from === chatData.last_message.chat_id) {
                            console.log(`    ⚠️  last_msg.from = last_msg.chat_id (mensaje propio)`);
                        } else {
                            console.log(`    ✅ last_msg.from ≠ last_msg.chat_id (mensaje de contacto)`);
                        }
                    }
                } else {
                    console.log(`  ❌ Error ${chatResponse.status}: ${await chatResponse.text()}`);
                }
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }

        // 3. Análisis conceptual
        console.log('\n\n🧠 ANÁLISIS CONCEPTUAL:');
        console.log('='.repeat(50));
        
        console.log('📚 DEFINICIONES WHAPI:');
        console.log('  📱 phoneNumber: Número del REMITENTE del mensaje');
        console.log('  💬 chatId: ID del CHAT donde ocurre la conversación');
        console.log('  👤 contactId: ID del contacto (normalmente = phoneNumber)');
        
        console.log('\n🔄 CASOS DE USO:');
        console.log('  1. CHAT INDIVIDUAL:');
        console.log('     - chatId = phoneNumber del contacto');
        console.log('     - message.from = phoneNumber del que envía');
        console.log('     - Si yo envío: from = mi número, chat_id = número del contacto');
        console.log('     - Si contacto envía: from = número del contacto, chat_id = número del contacto');
        
        console.log('\n  2. GRUPO:');
        console.log('     - chatId = ID del grupo');
        console.log('     - message.from = phoneNumber del participante que envía');
        console.log('     - chat_id siempre es el mismo (ID del grupo)');
        
        console.log('\n💡 CONCLUSIÓN:');
        console.log('   En CHATS INDIVIDUALES: chatId = phoneNumber del contacto');
        console.log('   En GRUPOS: chatId ≠ phoneNumber de participantes');
        console.log('   Para nuestro caso (chats individuales): es CORRECTO que sean iguales');

        // 4. Verificar si tenemos grupos
        console.log('\n\n🔍 VERIFICANDO TIPOS DE CHAT:');
        console.log('='.repeat(50));
        
        if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            
            const chatTypes = new Map();
            const chatIdPatterns = new Map();
            
            messagesData.messages.forEach(msg => {
                // Analizar patrones de chat_id
                if (msg.chat_id.includes('@g.us')) {
                    chatTypes.set('grupo', (chatTypes.get('grupo') || 0) + 1);
                } else if (msg.chat_id.includes('@s.whatsapp.net')) {
                    chatTypes.set('individual', (chatTypes.get('individual') || 0) + 1);
                } else {
                    chatTypes.set('otro', (chatTypes.get('otro') || 0) + 1);
                }
                
                // Contar patrones únicos
                if (!chatIdPatterns.has(msg.chat_id)) {
                    chatIdPatterns.set(msg.chat_id, {
                        from_values: new Set(),
                        message_count: 0
                    });
                }
                
                chatIdPatterns.get(msg.chat_id).from_values.add(msg.from);
                chatIdPatterns.get(msg.chat_id).message_count++;
            });
            
            console.log('📊 Tipos de chat encontrados:');
            for (const [type, count] of chatTypes) {
                console.log(`   ${type}: ${count} mensajes`);
            }
            
            console.log('\n📋 Análisis de chats únicos:');
            let chatCount = 0;
            for (const [chatId, data] of chatIdPatterns) {
                if (chatCount < 5) { // Mostrar solo los primeros 5
                    console.log(`\n   Chat: ${chatId}`);
                    console.log(`     Mensajes: ${data.message_count}`);
                    console.log(`     Remitentes únicos: ${data.from_values.size}`);
                    console.log(`     Remitentes: ${Array.from(data.from_values).join(', ')}`);
                    
                    if (data.from_values.size === 1 && data.from_values.has(chatId.replace('@s.whatsapp.net', ''))) {
                        console.log(`     ✅ Chat individual - solo mensajes del contacto`);
                    } else if (data.from_values.size > 1) {
                        console.log(`     🌟 Chat con múltiples remitentes (grupo o conversación)`);
                    }
                    chatCount++;
                }
            }
        }

    } catch (error) {
        console.error('💥 Error analizando datos WHAPI:', error.message);
    }
}

// Ejecutar análisis
if (require.main === module) {
    analyzeWhapiDataStructure()
        .then(() => console.log('\n✨ Análisis completado'))
        .catch(console.error);
}

module.exports = { analyzeWhapiDataStructure };