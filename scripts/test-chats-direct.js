const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: ['query', 'error']
});

async function testChats() {
    try {
        await prisma.$connect();
        console.log('Conectado\n');
        
        // Insertar directamente especificando la tabla Chats
        console.log('Insertando en tabla Chats con SQL...');
        const insertResult = await prisma.$executeRaw`
            INSERT INTO "Chats" ("phoneNumber", "lastActivity")
            VALUES ('573999TEST', NOW())
            RETURNING *
        `;
        console.log('Insertado:', insertResult, 'fila(s)\n');
        
        // Consultar
        console.log('Consultando tabla Chats...');
        const data = await prisma.$queryRaw`
            SELECT * FROM "Chats" WHERE "phoneNumber" = '573999TEST'
        `;
        console.log('Datos:', data);
        
        // Limpiar
        await prisma.$executeRaw`
            DELETE FROM "Chats" WHERE "phoneNumber" = '573999TEST'
        `;
        console.log('\n✅ Tabla Chats funciona correctamente con SQL directo');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Detalles:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testChats();