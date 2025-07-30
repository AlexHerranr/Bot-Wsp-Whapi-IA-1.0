// scripts/client-simple-table.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showSimpleTable() {
    try {
        console.clear();
        console.log('📊 TABLA UNIFICADA - TODOS LOS DATOS DE CLIENTES');
        console.log('================================================\n');

        const users = await prisma.user.findMany({
            include: {
                threads: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { lastActivity: 'desc' }
        });

        if (users.length === 0) {
            console.log('⚠️ No hay datos en la base de datos.');
            return;
        }

        let totalClients = 0;
        const tableData: any[] = [];

        for (const user of users) {
            for (const thread of user.threads) {
                totalClients++;
                
                const messageCount = await prisma.message.count({
                    where: { threadId: thread.id }
                });

                const lastMessage = thread.messages[0];
                const cleanPhone = user.phoneNumber.replace('@s.whatsapp.net', '');
                const cleanChatId = thread.chatId?.replace('@s.whatsapp.net', '') || 'N/A';
                
                tableData.push({
                    '#': totalClients,
                    'TELÉFONO': cleanPhone,
                    'NOMBRE': user.name || thread.userName || 'Sin nombre',
                    'CHAT_ID': cleanChatId,
                    'THREAD_OPENAI': thread.openaiId,
                    'TOTAL_MSGS': messageCount,
                    'ÚLTIMO_MSG': lastMessage ? (lastMessage.role === 'user' ? '👤' : '🤖') : '❌',
                    'CREADO': thread.createdAt.toLocaleDateString('es-CO'),
                    'ACTIVIDAD': thread.lastActivity.toLocaleDateString('es-CO'),
                    'LABELS': thread.labels ? JSON.stringify(thread.labels) : '[]'
                });
            }
        }

        console.log(`📈 Total de conversaciones: ${totalClients}\n`);
        console.table(tableData);

        // Detalles adicionales
        console.log('\n📋 INFORMACIÓN DETALLADA:');
        console.log('=========================\n');

        tableData.forEach((row, index) => {
            console.log(`${index + 1}. 📱 ${row.TELÉFONO}`);
            console.log(`   👤 Nombre: ${row.NOMBRE}`);
            console.log(`   💬 Chat ID (WHAPI): ${row.CHAT_ID}`);
            console.log(`   🧵 Thread OpenAI: ${row.THREAD_OPENAI}`);
            console.log(`   📊 Mensajes totales: ${row.TOTAL_MSGS}`);
            console.log(`   📅 Creado: ${row.CREADO}`);
            console.log(`   ⏰ Última actividad: ${row.ACTIVIDAD}`);
            console.log(`   🏷️ Labels: ${row.LABELS}`);
            console.log('   ' + '─'.repeat(50));
        });

        console.log('\n✅ Tabla generada exitosamente');
        console.log('💡 Datos ordenados por actividad más reciente');

    } catch (error) {
        console.error('❌ Error generando tabla:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    showSimpleTable();
}

export { showSimpleTable };