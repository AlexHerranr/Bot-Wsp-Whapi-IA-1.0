// Script simple para verificar la columna last_response_id
const { PrismaClient } = require('@prisma/client');

async function verifyDatabase() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway?sslmode=require"
            }
        }
    });

    try {
        console.log('🔍 Verificando base de datos...\n');
        
        // 1. Verificar usuario de prueba
        const testUser = await prisma.whatsApp.findUnique({
            where: { phoneNumber: '573000000001' }
        });
        
        if (testUser) {
            console.log('✅ Usuario de prueba encontrado:');
            console.log(`   - phoneNumber: ${testUser.phoneNumber}`);
            console.log(`   - last_response_id: ${testUser.last_response_id || 'NULL'}`);
            console.log(`   - lastActivity: ${testUser.lastActivity}\n`);
        }
        
        // 2. Buscar usuarios con response_id
        const usersWithResponseId = await prisma.whatsApp.findMany({
            where: {
                last_response_id: {
                    not: null
                }
            },
            take: 5,
            orderBy: {
                lastActivity: 'desc'
            }
        });
        
        console.log(`📊 Usuarios con last_response_id: ${usersWithResponseId.length}`);
        if (usersWithResponseId.length > 0) {
            console.log('\nPrimeros registros:');
            usersWithResponseId.forEach((user, i) => {
                console.log(`${i + 1}. ${user.phoneNumber}: ${user.last_response_id}`);
            });
        }
        
        // 3. Estadísticas generales
        const total = await prisma.whatsApp.count();
        const withResponseId = await prisma.whatsApp.count({
            where: {
                last_response_id: {
                    not: null
                }
            }
        });
        
        console.log('\n📈 Estadísticas:');
        console.log(`   - Total usuarios: ${total}`);
        console.log(`   - Con response_id: ${withResponseId}`);
        console.log(`   - Porcentaje: ${total > 0 ? ((withResponseId / total) * 100).toFixed(1) : 0}%`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

verifyDatabase();