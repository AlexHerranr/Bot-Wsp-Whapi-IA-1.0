// scripts/check-db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
    try {
        await prisma.$connect();
        console.log('🔍 Verificando datos en la base de datos...\n');

        const users = await prisma.user.findMany({ 
            include: { 
                threads: {
                    include: {
                        messages: true
                    }
                } 
            } 
        });
        
        const totalMessages = await prisma.message.count();
        
        console.log('📊 ESTADÍSTICAS:');
        console.log(`👥 Usuarios: ${users.length}`);
        console.log(`💬 Threads: ${users.reduce((acc, user) => acc + user.threads.length, 0)}`);
        console.log(`📝 Mensajes: ${totalMessages}\n`);

        if (users.length > 0) {
            console.log('👥 USUARIOS REGISTRADOS:');
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.phoneNumber} (${user.name || 'Sin nombre'})`);
                console.log(`   📅 Creado: ${user.createdAt}`);
                console.log(`   ⏰ Última actividad: ${user.lastActivity}`);
                
                if (user.threads.length > 0) {
                    console.log(`   💬 Threads (${user.threads.length}):`);
                    user.threads.forEach((thread, tIndex) => {
                        console.log(`     ${tIndex + 1}. ID: ${thread.openaiId}`);
                        console.log(`        Chat: ${thread.chatId}`);
                        console.log(`        Usuario: ${thread.userName || 'N/A'}`);
                        console.log(`        Mensajes: ${thread.messages.length}`);
                        if (thread.labels) {
                            console.log(`        Labels: ${JSON.stringify(thread.labels)}`);
                        }
                    });
                }
                console.log('');
            });
        } else {
            console.log('⚠️ No hay usuarios registrados aún');
        }

        console.log('✅ Verificación completada');
        
    } catch (error) {
        console.error('❌ Error verificando base de datos:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();