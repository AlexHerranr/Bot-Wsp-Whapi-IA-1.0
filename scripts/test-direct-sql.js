const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDirectSQL() {
    try {
        await prisma.$connect();
        console.log('Conectado a la BD\n');
        
        // Insertar directamente con SQL
        console.log('Insertando con SQL directo...');
        const result = await prisma.$executeRaw`
            INSERT INTO "Chats" ("phoneNumber", "name", "userName", "labels", "chatId", "lastActivity", "threadId", "threadTokenCount")
            VALUES ('573TEST', 'Test User', 'TestUser', 'test', '573TEST@s.whatsapp.net', NOW(), 'thread_test', 100)
        `;
        console.log('Insertado:', result, 'fila(s)\n');
        
        // Consultar con SQL directo
        console.log('Consultando con SQL directo...');
        const rows = await prisma.$queryRaw`
            SELECT * FROM "Chats" WHERE "phoneNumber" = '573TEST'
        `;
        console.log('Encontrado:', rows);
        
        // Limpiar
        console.log('\nLimpiando...');
        await prisma.$executeRaw`
            DELETE FROM "Chats" WHERE "phoneNumber" = '573TEST'
        `;
        console.log('Eliminado\n');
        
        console.log('✅ SQL directo funciona correctamente');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testDirectSQL();