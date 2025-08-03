// Obtener usuarios de BD
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = 
// DATABASE_URL Railway check
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no encontrada - verifica tu .env');
    process.exit(1);
}

if (!process.env.DATABASE_URL.includes('railway')) {
    console.warn('⚠️  DATABASE_URL no parece ser de Railway');
}

new PrismaClient();

async function getUsers() {
    const users = await prisma.clientView.findMany({
        take: 5,
        select: { phoneNumber: true, userName: true, chatId: true }
    });
    
    console.log('Usuarios disponibles:');
    users.forEach((user, i) => {
        console.log(`${i + 1}. ${user.phoneNumber} (${user.userName || 'Sin nombre'})`);
    });
    
    await prisma.$disconnect();
}

getUsers();