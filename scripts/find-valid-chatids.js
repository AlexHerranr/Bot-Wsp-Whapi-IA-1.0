// scripts/find-valid-chatids.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findValidChatIds() {
    try {
        const users = await prisma.clientView.findMany({
            where: { 
                chatId: { contains: '@s.whatsapp.net' },
                NOT: { phoneNumber: '573246703524' } // Excluir test user
            },
            take: 5,
            select: { phoneNumber: true, chatId: true, userName: true }
        });
        
        console.log('Usuarios con chatId válido:');
        users.forEach(u => {
            console.log(`- ${u.phoneNumber} → ${u.chatId} (${u.userName || 'Sin nombre'})`);
        });
        
        if (users.length > 0) {
            return users[0].chatId; // Retornar el primero para pruebas
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findValidChatIds();