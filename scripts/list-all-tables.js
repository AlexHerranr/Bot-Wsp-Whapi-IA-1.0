const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listTables() {
    try {
        await prisma.$connect();
        
        const tables = await prisma.$queryRaw`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;
        
        console.log('Tablas en la base de datos:');
        tables.forEach(t => console.log(`  - ${t.table_name}`));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listTables();