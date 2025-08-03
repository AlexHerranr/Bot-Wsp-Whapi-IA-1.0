// scripts/enrich-database-with-chat-info.js
// Script para enriquecer BD con datos del endpoint getChatInfo usando chatIds existentes

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';

const prisma = new PrismaClient();

// ✅ RAILWAY BD VERIFICATION
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no encontrada en .env');
    process.exit(1);
}
if (process.env.DATABASE_URL.includes('railway') || process.env.DATABASE_URL.includes('rlwy.net')) {
    console.log('🚂 Conectando a Railway PostgreSQL...');
} else {
    console.warn('⚠️  DATABASE_URL no parece ser de Railway');
}

async function enrichDatabaseWithChatInfo() {
    try {
        console.log('🔍 Iniciando enriquecimiento de BD con datos de getChatInfo...\n');

        // Conectar a BD
        await prisma.$connect();
        console.log('✅ Conectado a PostgreSQL');

        // Obtener usuarios existentes con chatIds
        const existingUsers = await prisma.clientView.findMany({
            where: {
                chatId: { not: null }
            },
            select: {
                phoneNumber: true,
                userName: true,
                chatId: true,
                name: true,
                label1: true,
                label2: true,
                label3: true,
                lastActivity: true
            },
            orderBy: { lastActivity: 'desc' }
        });

        console.log(`👥 Encontrados ${existingUsers.length} usuarios con chatId para enriquecer\n`);

        if (existingUsers.length === 0) {
            console.log('⚠️  No hay usuarios para procesar');
            return;
        }

        // Mostrar usuarios que vamos a procesar
        console.log('📋 Usuarios a procesar:');
        existingUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.phoneNumber} (${user.userName || 'Sin nombre'})`);
        });
        console.log('');

        let enrichedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        // Procesar cada usuario
        for (const user of existingUsers) {
            try {
                console.log(`🔍 Procesando: ${user.phoneNumber}...`);

                // Verificar si ya tiene datos enriquecidos
                if (user.name || user.label1) {
                    console.log(`   ⏭️  Ya tiene datos enriquecidos, omitiendo`);
                    skippedCount++;
                    continue;
                }

                // Llamar al endpoint getChatInfo
                const chatInfoUrl = `${WHAPI_API_URL}/chats/${encodeURIComponent(user.chatId)}`;
                
                const response = await fetch(chatInfoUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${WHAPI_TOKEN}`,
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.log(`   ❌ Error ${response.status} obteniendo info del chat`);
                    errorCount++;
                    continue;
                }

                const chatInfo = await response.json();
                console.log(`   📨 Datos obtenidos:`, JSON.stringify(chatInfo, null, 2));

                // Extraer datos para enriquecimiento
                const enrichmentData = {
                    name: chatInfo.name || null,
                    label1: chatInfo.labels && chatInfo.labels[0] ? chatInfo.labels[0].name || chatInfo.labels[0] : null,
                    label2: chatInfo.labels && chatInfo.labels[1] ? chatInfo.labels[1].name || chatInfo.labels[1] : null,
                    label3: chatInfo.labels && chatInfo.labels[2] ? chatInfo.labels[2].name || chatInfo.labels[2] : null
                };

                // Actualizar en BD solo si tenemos nuevos datos
                const hasNewData = enrichmentData.name || enrichmentData.label1 || enrichmentData.label2 || enrichmentData.label3;

                if (hasNewData) {
                    await prisma.clientView.update({
                        where: { phoneNumber: user.phoneNumber },
                        data: enrichmentData
                    });

                    console.log(`   ✅ Usuario enriquecido:`);
                    if (enrichmentData.name) console.log(`      👤 Nombre: ${enrichmentData.name}`);
                    if (enrichmentData.label1) console.log(`      🏷️  Label 1: ${enrichmentData.label1}`);
                    if (enrichmentData.label2) console.log(`      🏷️  Label 2: ${enrichmentData.label2}`);
                    if (enrichmentData.label3) console.log(`      🏷️  Label 3: ${enrichmentData.label3}`);
                    
                    enrichedCount++;
                } else {
                    console.log(`   ℹ️  No hay datos adicionales para enriquecer`);
                    skippedCount++;
                }

                // Pausa entre llamadas para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.log(`   ❌ Error procesando ${user.phoneNumber}: ${error.message}`);
                errorCount++;
            }

            console.log(''); // Línea en blanco entre usuarios
        }

        // Mostrar resultados
        console.log('📊 RESULTADOS DEL ENRIQUECIMIENTO:');
        console.log('='.repeat(50));
        console.log(`   ✅ Usuarios enriquecidos: ${enrichedCount}`);
        console.log(`   ⏭️  Usuarios omitidos: ${skippedCount}`);
        console.log(`   ❌ Errores: ${errorCount}`);
        console.log(`   📈 Total procesados: ${enrichedCount + skippedCount + errorCount}`);

        // Mostrar algunos ejemplos de usuarios enriquecidos
        if (enrichedCount > 0) {
            console.log('\n📋 Ejemplos de usuarios enriquecidos:');
            const enrichedUsers = await prisma.clientView.findMany({
                where: {
                    OR: [
                        { name: { not: null } },
                        { label1: { not: null } },
                        { label2: { not: null } },
                        { label3: { not: null } }
                    ]
                },
                take: 5,
                orderBy: { lastActivity: 'desc' }
            });

            enrichedUsers.forEach(user => {
                console.log(`\n   📱 ${user.phoneNumber}`);
                console.log(`      👤 Usuario: ${user.userName || 'Sin nombre'}`);
                console.log(`      📝 Nombre: ${user.name || 'N/A'}`);
                console.log(`      🏷️  Labels: ${[user.label1, user.label2, user.label3].filter(Boolean).join(', ') || 'Sin labels'}`);
            });
        }

        console.log('\n🎉 Enriquecimiento completado!');

    } catch (error) {
        console.error('💥 Error durante enriquecimiento:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Desconectado de PostgreSQL');
    }
}

// Test específico para un usuario
async function testSingleUserEnrichment(phoneNumber) {
    try {
        console.log(`🔍 Test de enriquecimiento para usuario específico: ${phoneNumber}\n`);

        await prisma.$connect();
        
        // Buscar usuario
        const user = await prisma.clientView.findUnique({
            where: { phoneNumber }
        });

        if (!user) {
            console.log(`❌ Usuario ${phoneNumber} no encontrado en BD`);
            return;
        }

        console.log('👤 Usuario encontrado:');
        console.log(JSON.stringify(user, null, 2));

        if (!user.chatId) {
            console.log(`❌ Usuario no tiene chatId`);
            return;
        }

        // Obtener info del chat
        const chatInfoUrl = `${WHAPI_API_URL}/chats/${encodeURIComponent(user.chatId)}`;
        console.log(`\n🔗 Llamando: ${chatInfoUrl}`);

        const response = await fetch(chatInfoUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        console.log(`📡 Respuesta: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const chatInfo = await response.json();
            console.log('\n📨 Datos del chat:');
            console.log(JSON.stringify(chatInfo, null, 2));

            // Analizar qué podríamos extraer
            console.log('\n🔍 Análisis de datos disponibles:');
            console.log(`   👤 name: ${chatInfo.name || 'N/A'}`);
            console.log(`   🏷️  labels: ${chatInfo.labels ? JSON.stringify(chatInfo.labels) : 'N/A'}`);
            console.log(`   📱 isContact: ${chatInfo.isContact || 'N/A'}`);
            console.log(`   🔒 isGroup: ${chatInfo.isGroup || 'N/A'}`);
            console.log(`   📸 avatar: ${chatInfo.avatar ? 'Disponible' : 'N/A'}`);

        } else {
            const errorText = await response.text();
            console.log(`❌ Error: ${errorText}`);
        }

    } catch (error) {
        console.error('💥 Error en test:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar script
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length > 0 && args[0] === 'test') {
        // Test con usuario específico
        const phoneNumber = args[1] || '573555666777@s.whatsapp.net';
        testSingleUserEnrichment(phoneNumber)
            .then(() => console.log('✨ Test completado'))
            .catch(console.error);
    } else {
        // Enriquecimiento completo
        enrichDatabaseWithChatInfo()
            .then(() => {
                console.log('✨ Script completado exitosamente');
                process.exit(0);
            })
            .catch((error) => {
                console.error('💥 Error en script:', error);
                process.exit(1);
            });
    }
}

module.exports = { enrichDatabaseWithChatInfo, testSingleUserEnrichment };