// scripts/populate-from-whapi-messages.js
// Script para alimentar BD con datos reales del endpoint WHAPI /messages/list

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

// Configuración WHAPI (usando variables de entorno)
const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud/';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

const prisma = new PrismaClient();

async function populateFromWhapiMessages() {
    try {
        console.log('🚀 Iniciando población de BD desde WHAPI messages...');
        
        // Verificar credenciales
        if (!WHAPI_TOKEN) {
            throw new Error('❌ WHAPI_TOKEN no está configurado en las variables de entorno');
        }

        // Conectar a la base de datos
        await prisma.$connect();
        console.log('✅ Conectado a PostgreSQL');

        // 1. Obtener mensajes del endpoint WHAPI
        console.log('📡 Obteniendo mensajes de WHAPI...');
        const messagesUrl = `${WHAPI_API_URL}/messages/list?count=100`;
        
        const response = await fetch(messagesUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`❌ Error en WHAPI API: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`📨 Obtenidos ${data.messages.length} mensajes del endpoint WHAPI`);
        console.log(`📊 Total mensajes disponibles: ${data.total}`);

        // 2. Procesar mensajes y extraer usuarios únicos
        console.log('👥 Procesando usuarios únicos...');
        const uniqueUsers = new Map();

        data.messages.forEach(message => {
            const phoneNumber = message.from;
            const existing = uniqueUsers.get(phoneNumber);
            
            if (!existing || message.timestamp > existing.lastActivity.getTime() / 1000) {
                uniqueUsers.set(phoneNumber, {
                    phoneNumber,
                    userName: message.from_name || existing?.userName,
                    chatId: message.chat_id,
                    lastActivity: new Date(message.timestamp * 1000),
                    messageCount: (existing?.messageCount || 0) + 1,
                    lastMessageType: message.type
                });
            } else {
                existing.messageCount++;
            }
        });

        console.log(`👥 Identificados ${uniqueUsers.size} usuarios únicos`);

        // 3. Insertar usuarios en la base de datos
        console.log('💾 Insertando usuarios en la base de datos...');
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const [phoneNumber, userData] of uniqueUsers) {
            try {
                // Verificar si el usuario ya existe
                const existingUser = await prisma.clientView.findUnique({
                    where: { phoneNumber }
                });
                
                if (existingUser) {
                    // Actualizar usuario existente
                    await prisma.clientView.update({
                        where: { phoneNumber },
                        data: {
                            userName: userData.userName || existingUser.userName,
                            chatId: userData.chatId,
                            lastActivity: userData.lastActivity
                        }
                    });
                    updatedCount++;
                    console.log(`🔄 Actualizado: ${phoneNumber} (${userData.userName || 'Sin nombre'})`);
                } else {
                    // Crear nuevo usuario
                    await prisma.clientView.create({
                        data: {
                            phoneNumber,
                            userName: userData.userName,
                            chatId: userData.chatId,
                            lastActivity: userData.lastActivity,
                            prioridad: 'MEDIA' // Valor por defecto
                        }
                    });
                    insertedCount++;
                    console.log(`✅ Insertado: ${phoneNumber} (${userData.userName || 'Sin nombre'}) - ${userData.messageCount} mensajes`);
                }
                
            } catch (error) {
                console.error(`❌ Error procesando ${phoneNumber}:`, error.message);
                errorCount++;
            }
        }

        // 4. Mostrar resultados
        console.log('\n📊 RESULTADOS FINALES:');
        console.log(`   ✅ Usuarios nuevos: ${insertedCount}`);
        console.log(`   🔄 Usuarios actualizados: ${updatedCount}`);
        console.log(`   ❌ Errores: ${errorCount}`);
        console.log(`   📈 Total procesados: ${insertedCount + updatedCount}`);

        // 5. Verificar en la base de datos
        const totalUsers = await prisma.clientView.count();
        console.log(`\n🗄️  Total usuarios en BD: ${totalUsers}`);

        // 6. Mostrar algunos ejemplos
        const sampleUsers = await prisma.clientView.findMany({
            take: 5,
            orderBy: { lastActivity: 'desc' },
            select: {
                phoneNumber: true,
                userName: true,
                lastActivity: true,
                chatId: true
            }
        });

        console.log('\n📋 Ejemplos de usuarios más recientes:');
        sampleUsers.forEach(user => {
            const activityTime = user.lastActivity.toLocaleString();
            console.log(`   📱 ${user.phoneNumber}`);
            console.log(`      👤 ${user.userName || 'Sin nombre'}`);
            console.log(`      🕐 ${activityTime}`);
            console.log(`      💬 ${user.chatId}`);
            console.log('');
        });

        console.log('🎉 ¡Población completada exitosamente!');

    } catch (error) {
        console.error('💥 Error durante la población:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Desconectado de PostgreSQL');
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    populateFromWhapiMessages()
        .then(() => {
            console.log('✨ Script completado exitosamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Error en el script:', error);
            process.exit(1);
        });
}

module.exports = { populateFromWhapiMessages };