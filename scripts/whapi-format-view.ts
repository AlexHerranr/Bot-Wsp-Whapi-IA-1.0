// scripts/whapi-format-view.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WhapiFormatData {
    phoneNumber: string;
    metadata: {
        threadId: string;
        chatId: string;
        userName: string | null;
        createdAt: string;
        lastActivity: string;
        labels: string[];
        totalMessages?: number;
        lastMessage?: string;
        lastMessageRole?: 'user' | 'assistant';
    };
}

async function getWhapiFormatData(): Promise<WhapiFormatData[]> {
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

        const whapiFormatData: WhapiFormatData[] = [];

        for (const user of users) {
            for (const thread of user.threads) {
                const messageCount = await prisma.message.count({
                    where: { threadId: thread.id }
                });

                const lastMessage = thread.messages[0] || null;
                const cleanPhone = user.phoneNumber.replace('@s.whatsapp.net', '');

                whapiFormatData.push({
                    phoneNumber: cleanPhone,
                    metadata: {
                        threadId: thread.openaiId,
                        chatId: thread.chatId || `${cleanPhone}@s.whatsapp.net`,
                        userName: user.name || thread.userName || null,
                        createdAt: thread.createdAt.toISOString(),
                        lastActivity: thread.lastActivity.toISOString(),
                        labels: (thread.labels as string[]) || [],
                        totalMessages: messageCount,
                        lastMessage: lastMessage?.content || null,
                        lastMessageRole: (lastMessage?.role as 'user' | 'assistant') || undefined
                    }
                });
            }
        }

        return whapiFormatData.sort((a, b) => 
            new Date(b.metadata.lastActivity).getTime() - new Date(a.metadata.lastActivity).getTime()
        );
        
    } finally {
        await prisma.$disconnect();
    }
}

async function displayWhapiFormat() {
    try {
        console.clear();
        console.log('📱 DATOS EN FORMATO WHAPI ORIGINAL');
        console.log('==================================\n');

        const data = await getWhapiFormatData();

        if (data.length === 0) {
            console.log('⚠️ No hay datos disponibles.');
            return;
        }

        console.log(`📊 Total de conversaciones: ${data.length}\n`);

        // Mostrar como array de arrays (formato original)
        console.log('📋 FORMATO ARRAY ORIGINAL (como threads.json):');
        console.log('==============================================\n');

        const arrayFormat = data.map(item => [
            item.phoneNumber,
            {
                threadId: item.metadata.threadId,
                chatId: item.metadata.chatId,
                userName: item.metadata.userName,
                createdAt: item.metadata.createdAt,
                lastActivity: item.metadata.lastActivity,
                labels: item.metadata.labels
            }
        ]);

        console.log(JSON.stringify(arrayFormat, null, 2));

        console.log('\n\n📊 TABLA RESUMIDA:');
        console.log('==================\n');

        // Tabla resumida para vista rápida
        const tableData = data.map((item, index) => ({
            '#': (index + 1),
            'TELÉFONO': item.phoneNumber,
            'NOMBRE': item.metadata.userName || 'Sin nombre',
            'CHAT_ID': item.metadata.chatId.replace('@s.whatsapp.net', ''),
            'THREAD_ID': item.metadata.threadId,
            'LABELS': JSON.stringify(item.metadata.labels),
            'MSGS': item.metadata.totalMessages,
            'ÚLTIMO_MSG': item.metadata.lastMessageRole === 'user' ? '👤' : 
                         item.metadata.lastMessageRole === 'assistant' ? '🤖' : '❌',
            'ACTIVIDAD': new Date(item.metadata.lastActivity).toLocaleDateString('es-CO')
        }));

        console.table(tableData);

        console.log('\n📋 DETALLES POR CLIENTE (FORMATO WHAPI):');
        console.log('========================================\n');

        data.forEach((item, index) => {
            console.log(`${index + 1}. 📱 "${item.phoneNumber}"`);
            console.log('   📦 Metadata:');
            console.log(`      threadId: "${item.metadata.threadId}"`);
            console.log(`      chatId: "${item.metadata.chatId}"`);
            console.log(`      userName: ${item.metadata.userName ? `"${item.metadata.userName}"` : 'null'}`);
            console.log(`      createdAt: "${item.metadata.createdAt}"`);
            console.log(`      lastActivity: "${item.metadata.lastActivity}"`);
            console.log(`      labels: ${JSON.stringify(item.metadata.labels)}`);
            
            // Información adicional de Prisma
            console.log('   📊 Info adicional (Prisma):');
            console.log(`      totalMessages: ${item.metadata.totalMessages}`);
            if (item.metadata.lastMessage) {
                const roleIcon = item.metadata.lastMessageRole === 'user' ? '👤' : '🤖';
                const preview = item.metadata.lastMessage.length > 50 ? 
                    item.metadata.lastMessage.substring(0, 50) + '...' : 
                    item.metadata.lastMessage;
                console.log(`      lastMessage (${roleIcon}): "${preview}"`);
            }
            
            console.log('   ' + '─'.repeat(50));
        });

        console.log('\n✅ Datos mostrados en formato WHAPI original');
        console.log('💡 Este es el formato que esperas en la columna de Prisma');
        
    } catch (error) {
        console.error('❌ Error generando formato WHAPI:', error);
    }
}

// Función para exportar datos en formato WHAPI
async function exportWhapiFormat(): Promise<any[]> {
    const data = await getWhapiFormatData();
    return data.map(item => [
        item.phoneNumber,
        {
            threadId: item.metadata.threadId,
            chatId: item.metadata.chatId,
            userName: item.metadata.userName,
            createdAt: item.metadata.createdAt,
            lastActivity: item.metadata.lastActivity,
            labels: item.metadata.labels
        }
    ]);
}

// Exportar funciones
export { getWhapiFormatData, WhapiFormatData, exportWhapiFormat };

// Ejecutar si se llama directamente
if (require.main === module) {
    displayWhapiFormat();
}