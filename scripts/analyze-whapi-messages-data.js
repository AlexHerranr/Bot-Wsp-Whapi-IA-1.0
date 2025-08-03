// scripts/analyze-whapi-messages-data.js
// Script para analizar qué datos adicionales podemos extraer del endpoint /messages/list

const fetch = require('node-fetch');

const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';

async function analyzeWhapiData() {
    try {
        console.log('🔍 Analizando datos disponibles en endpoint /messages/list...');
        
        if (!WHAPI_TOKEN) {
            throw new Error('❌ WHAPI_TOKEN no está configurado');
        }

        // Obtener una muestra más grande de mensajes
        const messagesUrl = `${WHAPI_API_URL}/messages/list?count=50`;
        
        const response = await fetch(messagesUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`❌ Error en WHAPI API: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`📨 Analizando ${data.messages.length} mensajes...\n`);

        // Analizar estructura de mensajes
        const messageTypes = new Set();
        const availableFields = new Set();
        const sampleMessages = [];

        data.messages.forEach((message, index) => {
            messageTypes.add(message.type);
            
            // Recopilar todos los campos disponibles
            Object.keys(message).forEach(key => availableFields.add(key));
            
            // Guardar muestras de diferentes tipos
            if (index < 5) {
                sampleMessages.push(message);
            }
        });

        console.log('📋 CAMPOS DISPONIBLES EN MENSAJES:');
        console.log('=====================================');
        Array.from(availableFields).sort().forEach(field => {
            console.log(`   📄 ${field}`);
        });

        console.log('\n🎭 TIPOS DE MENSAJES ENCONTRADOS:');
        console.log('=====================================');
        Array.from(messageTypes).sort().forEach(type => {
            const count = data.messages.filter(m => m.type === type).length;
            console.log(`   ${type}: ${count} mensajes`);
        });

        console.log('\n🔍 MUESTRAS DE MENSAJES:');
        console.log('=====================================');
        sampleMessages.forEach((message, index) => {
            console.log(`\n📨 Mensaje ${index + 1} (${message.type}):`);
            console.log(`   ID: ${message.id}`);
            console.log(`   From: ${message.from}`);
            console.log(`   From Name: ${message.from_name || 'N/A'}`);
            console.log(`   Chat ID: ${message.chat_id}`);
            console.log(`   Timestamp: ${message.timestamp} (${new Date(message.timestamp * 1000).toLocaleString()})`);
            console.log(`   From Me: ${message.from_me}`);
            console.log(`   Source: ${message.source}`);
            console.log(`   Device ID: ${message.device_id || 'N/A'}`);
            console.log(`   Status: ${message.status || 'N/A'}`);
            
            if (message.text) {
                console.log(`   Text: "${message.text.body?.substring(0, 50)}..."`);
            }
            
            if (message.context) {
                console.log(`   Context: ${JSON.stringify(message.context, null, 2).substring(0, 100)}...`);
            }
            
            if (message.labels && message.labels.length > 0) {
                console.log(`   Labels: ${JSON.stringify(message.labels)}`);
            }
        });

        // Analizar datos por usuario
        console.log('\n👥 ANÁLISIS POR USUARIO:');
        console.log('=====================================');
        const userStats = new Map();

        data.messages.forEach(message => {
            const userId = message.from;
            if (!userStats.has(userId)) {
                userStats.set(userId, {
                    phoneNumber: userId,
                    userName: message.from_name,
                    messageCount: 0,
                    messageTypes: new Set(),
                    firstMessage: message.timestamp,
                    lastMessage: message.timestamp,
                    fromMe: 0,
                    fromThem: 0,
                    hasLabels: false
                });
            }
            
            const stats = userStats.get(userId);
            stats.messageCount++;
            stats.messageTypes.add(message.type);
            stats.firstMessage = Math.min(stats.firstMessage, message.timestamp);
            stats.lastMessage = Math.max(stats.lastMessage, message.timestamp);
            
            if (message.from_me) {
                stats.fromMe++;
            } else {
                stats.fromThem++;
            }
            
            if (message.labels && message.labels.length > 0) {
                stats.hasLabels = true;
            }
        });

        Array.from(userStats.values()).forEach(stats => {
            console.log(`\n📱 ${stats.phoneNumber} (${stats.userName || 'Sin nombre'})`);
            console.log(`   📊 Mensajes: ${stats.messageCount} (${stats.fromThem} recibidos, ${stats.fromMe} enviados)`);
            console.log(`   🎭 Tipos: ${Array.from(stats.messageTypes).join(', ')}`);
            console.log(`   🕐 Período: ${new Date(stats.firstMessage * 1000).toLocaleDateString()} - ${new Date(stats.lastMessage * 1000).toLocaleDateString()}`);
            console.log(`   🏷️  Tiene labels: ${stats.hasLabels ? 'Sí' : 'No'}`);
        });

        // Mapeo a schema ClientView
        console.log('\n🗄️  MAPEO A SCHEMA ClientView:');
        console.log('=====================================');
        console.log('✅ CAMPOS QUE PODEMOS MAPEAR:');
        console.log('   phoneNumber ← message.from');
        console.log('   userName ← message.from_name');
        console.log('   chatId ← message.chat_id');
        console.log('   lastActivity ← message.timestamp (último mensaje)');
        
        console.log('\n❓ CAMPOS QUE NECESITAN INVESTIGACIÓN:');
        console.log('   name ← Requiere llamada a getChatInfo()');
        console.log('   label1-3 ← Requiere llamada a getChatInfo() o message.labels');
        console.log('   threadId ← Se genera con OpenAI');
        console.log('   perfilStatus-prioridad ← Campos manuales/calculados');

        console.log('\n📊 DATOS ADICIONALES DISPONIBLES:');
        console.log('   📈 Conteo de mensajes por usuario');
        console.log('   📧 Ratio mensajes enviados/recibidos');
        console.log('   🎭 Tipos de mensaje más usados');
        console.log('   📅 Período de actividad');
        console.log('   💬 Último contenido de mensaje');

    } catch (error) {
        console.error('💥 Error en análisis:', error.message);
    }
}

// Ejecutar
if (require.main === module) {
    analyzeWhapiData()
        .then(() => console.log('\n✨ Análisis completado'))
        .catch(console.error);
}

module.exports = { analyzeWhapiData };