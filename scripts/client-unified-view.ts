// scripts/client-unified-view.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UnifiedClientView {
    // WhatsApp/WHAPI fields
    chatId: string | null;
    phoneNumber: string;
    name: string | null;
    
    // OpenAI fields
    threadId: string;
    openaiThreadId: string;
    
    // Labels y metadata
    labels: any;
    metadata: any;
    
    // Actividad
    createdAt: Date;
    lastActivity: Date;
    
    // Estadísticas
    totalMessages: number;
    lastMessage: string | null;
    lastMessageDate: Date | null;
    messageRole: string | null; // 'user' o 'assistant'
}

async function getUnifiedClientView(): Promise<UnifiedClientView[]> {
    try {
        await prisma.$connect();
        
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

        const unifiedView: UnifiedClientView[] = [];

        for (const user of users) {
            for (const thread of user.threads) {
                const totalMessages = await prisma.message.count({
                    where: { threadId: thread.id }
                });

                const lastMessage = thread.messages[0] || null;

                unifiedView.push({
                    // WhatsApp/WHAPI fields
                    chatId: thread.chatId,
                    phoneNumber: user.phoneNumber,
                    name: user.name || thread.userName,
                    
                    // OpenAI fields
                    threadId: thread.id,
                    openaiThreadId: thread.openaiId,
                    
                    // Labels y metadata
                    labels: thread.labels,
                    metadata: thread.metadata,
                    
                    // Actividad
                    createdAt: thread.createdAt,
                    lastActivity: thread.lastActivity,
                    
                    // Estadísticas
                    totalMessages,
                    lastMessage: lastMessage?.content || null,
                    lastMessageDate: lastMessage?.createdAt || null,
                    messageRole: lastMessage?.role || null
                });
            }
        }

        return unifiedView;
    } finally {
        await prisma.$disconnect();
    }
}

async function displayUnifiedView() {
    try {
        console.log('📊 VISTA UNIFICADA DE CLIENTES');
        console.log('===============================\n');

        const clients = await getUnifiedClientView();

        if (clients.length === 0) {
            console.log('⚠️ No hay datos en la base de datos.');
            return;
        }

        console.log(`📈 Total de conversaciones activas: ${clients.length}\n`);

        // Header
        console.log('📱 TELÉFONO'.padEnd(15) + 
                   '👤 NOMBRE'.padEnd(20) + 
                   '💬 CHAT_ID'.padEnd(25) + 
                   '🧵 THREAD_OPENAI'.padEnd(20) + 
                   '📊 MSGS'.padEnd(8) + 
                   '⏰ ÚLTIMA_ACTIVIDAD'.padEnd(20) + 
                   '🏷️ LABELS');
        console.log(''.padEnd(120, '─'));

        clients.forEach((client, index) => {
            const phone = client.phoneNumber.padEnd(15);
            const name = (client.name || 'Sin nombre').substring(0, 18).padEnd(20);
            const chatId = (client.chatId || 'N/A').substring(0, 23).padEnd(25);
            const threadId = client.openaiThreadId.substring(0, 18).padEnd(20);
            const msgs = client.totalMessages.toString().padEnd(8);
            const lastActivity = client.lastActivity.toLocaleDateString('es-CO').padEnd(20);
            const labels = JSON.stringify(client.labels || []).substring(0, 30);
            
            console.log(`${phone}${name}${chatId}${threadId}${msgs}${lastActivity}${labels}`);
        });

        console.log('\n📋 DETALLES ADICIONALES:');
        console.log('========================\n');

        clients.forEach((client, index) => {
            console.log(`${index + 1}. 📱 ${client.phoneNumber} - ${client.name || 'Sin nombre'}`);
            console.log(`   💬 Chat ID: ${client.chatId || 'N/A'}`);
            console.log(`   🧵 Thread OpenAI: ${client.openaiThreadId}`);
            console.log(`   📊 Total mensajes: ${client.totalMessages}`);
            console.log(`   ⏰ Creado: ${client.createdAt.toLocaleString('es-CO')}`);
            console.log(`   📅 Última actividad: ${client.lastActivity.toLocaleString('es-CO')}`);
            if (client.lastMessage) {
                const preview = client.lastMessage.length > 80 ? 
                    client.lastMessage.substring(0, 80) + '...' : 
                    client.lastMessage;
                const role = client.messageRole === 'user' ? '👤' : '🤖';
                console.log(`   💭 Último mensaje (${role}): "${preview}"`);
                console.log(`   📅 Fecha último mensaje: ${client.lastMessageDate?.toLocaleString('es-CO')}`);
            }
            if (client.labels && Object.keys(client.labels).length > 0) {
                console.log(`   🏷️ Labels: ${JSON.stringify(client.labels, null, 2)}`);
            }
            if (client.metadata && Object.keys(client.metadata).length > 0) {
                console.log(`   🔧 Metadata: ${JSON.stringify(client.metadata, null, 2)}`);
            }
            console.log('   ' + ''.padEnd(50, '─'));
        });

        console.log('\n✅ Vista unificada generada exitosamente');
        
    } catch (error) {
        console.error('❌ Error generando vista unificada:', error);
    }
}

// Exportar para uso en otros archivos
export { getUnifiedClientView, UnifiedClientView };

// Ejecutar si se llama directamente
if (require.main === module) {
    displayUnifiedView();
}