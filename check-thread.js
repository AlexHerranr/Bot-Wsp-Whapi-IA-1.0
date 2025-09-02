const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkThread() {
    try {
        const user = await prisma.whatsApp.findUnique({
            where: { phoneNumber: '573003913251' }
        });
        
        if (user) {
            console.log('Usuario encontrado:');
            console.log('- phoneNumber:', user.phoneNumber);
            console.log('- threadId:', user.threadId || 'NULL');
            console.log('- threadTokenCount:', user.threadTokenCount || 0);
            console.log('- lastActivity:', user.lastActivity);
            console.log('- chatId:', user.chatId || 'NULL');
        } else {
            console.log('Usuario NO encontrado en BD');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkThread();
