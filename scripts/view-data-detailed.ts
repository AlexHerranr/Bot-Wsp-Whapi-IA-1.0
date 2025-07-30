// scripts/view-data-detailed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function viewDetailedData() {
    try {
        await prisma.$connect();
        console.log('📊 DATOS DETALLADOS DE LA BASE DE DATOS');
        console.log('==========================================\n');

        // Obtener todos los datos con relaciones
        const users = await prisma.user.findMany({
            include: {
                threads: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'asc' }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const totalUsers = users.length;
        const totalThreads = users.reduce((sum, user) => sum + user.threads.length, 0);
        const totalMessages = users.reduce((sum, user) => 
            sum + user.threads.reduce((threadSum, thread) => threadSum + thread.messages.length, 0), 0
        );

        console.log(`📈 RESUMEN GENERAL:`);
        console.log(`   👥 Total Usuarios: ${totalUsers}`);
        console.log(`   💬 Total Threads: ${totalThreads}`);
        console.log(`   📝 Total Mensajes: ${totalMessages}`);
        console.log(`   📅 Último registro: ${users[0]?.createdAt || 'N/A'}\n`);

        console.log('👥 USUARIOS DETALLADOS:');
        console.log('========================\n');

        users.forEach((user, userIndex) => {
            console.log(`${userIndex + 1}. 📱 USUARIO: ${user.phoneNumber}`);
            console.log(`   👤 Nombre: ${user.name || 'Sin nombre'}`);
            console.log(`   🆔 ID: ${user.id}`);
            console.log(`   📅 Creado: ${user.createdAt.toLocaleString('es-CO')}`);
            console.log(`   ⏰ Última actividad: ${user.lastActivity.toLocaleString('es-CO')}`);
            console.log(`   💬 Threads: ${user.threads.length}`);
            
            if (user.threads.length > 0) {
                console.log(`\n   🧵 CONVERSACIONES:`);
                user.threads.forEach((thread, threadIndex) => {
                    console.log(`     ${threadIndex + 1}. Thread: ${thread.openaiId}`);
                    console.log(`        💬 Chat ID: ${thread.chatId}`);
                    console.log(`        👤 Usuario: ${thread.userName || 'N/A'}`);
                    console.log(`        📅 Creado: ${thread.createdAt.toLocaleString('es-CO')}`);
                    console.log(`        ⏰ Última actividad: ${thread.lastActivity.toLocaleString('es-CO')}`);
                    console.log(`        🏷️ Labels: ${JSON.stringify(thread.labels) || '[]'}`);
                    console.log(`        📝 Mensajes: ${thread.messages.length}`);
                    
                    if (thread.messages.length > 0) {
                        console.log(`\n        💬 MENSAJES:`);
                        thread.messages.forEach((message, msgIndex) => {
                            const role = message.role === 'user' ? '👤' : '🤖';
                            const preview = message.content.length > 50 ? 
                                message.content.substring(0, 50) + '...' : 
                                message.content;
                            console.log(`           ${msgIndex + 1}. ${role} ${message.role}: "${preview}"`);
                            console.log(`              📅 ${message.createdAt.toLocaleString('es-CO')}`);
                            if (message.metadata) {
                                console.log(`              🔧 Metadata: ${JSON.stringify(message.metadata)}`);
                            }
                        });
                    }
                    console.log('');
                });
            }
            console.log(''.padEnd(50, '─'));
            console.log('');
        });

        if (totalUsers === 0) {
            console.log('⚠️ No hay datos en la base de datos aún.');
            console.log('💡 Envía un mensaje al webhook para crear datos de prueba.');
        }

        console.log('\n✅ Consulta completada exitosamente');
        
    } catch (error) {
        console.error('❌ Error consultando datos:', error);
    } finally {
        await prisma.$disconnect();
    }
}

viewDetailedData();