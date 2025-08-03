// Quick script to view your PostgreSQL data
const { PrismaClient } = require('@prisma/client');

async function viewData() {
    const prisma = new PrismaClient();
    
    try {
        console.log('🔍 Conectando a PostgreSQL...');
        
        // Count total users
        const totalUsers = await prisma.clientView.count();
        console.log(`📊 Total usuarios: ${totalUsers}`);
        
        // Get sample of recent users
        const recentUsers = await prisma.clientView.findMany({
            take: 10,
            orderBy: { lastActivity: 'desc' },
            select: {
                phoneNumber: true,
                userName: true,
                name: true,
                prioridad: true,
                label1: true,
                label2: true,
                label3: true,
                lastActivity: true
            }
        });
        
        console.log('\n📱 Últimos 10 usuarios:');
        console.table(recentUsers);
        
        // Stats by priority
        const priorityStats = await prisma.clientView.groupBy({
            by: ['prioridad'],
            _count: { prioridad: true }
        });
        
        console.log('\n📈 Usuarios por prioridad:');
        console.table(priorityStats);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
        console.log('\n✅ Desconectado de PostgreSQL');
    }
}

viewData();