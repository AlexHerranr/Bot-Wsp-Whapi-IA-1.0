const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTableStructure() {
    try {
        await prisma.$connect();
        
        // Verificar estructura de la tabla Chats
        const chatsColumns = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Chats'
            ORDER BY ordinal_position;
        `;
        
        console.log('Estructura de la tabla Chats:');
        console.log(chatsColumns);
        
        // Verificar estructura de la tabla Propiedades
        const propsColumns = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'Propiedades'
            ORDER BY ordinal_position;
        `;
        
        console.log('\nEstructura de la tabla Propiedades:');
        console.log(propsColumns);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTableStructure();