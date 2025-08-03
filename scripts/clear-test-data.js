// scripts/clear-test-data.js
// Script para limpiar datos de prueba de la base de datos

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

async function clearTestData() {
    try {
        console.log('🧹 Iniciando limpieza de datos de prueba...');
        
        // Conectar a la base de datos
        await prisma.$connect();
        console.log('✅ Conectado a PostgreSQL');

        // Obtener estadísticas antes de la limpieza
        const countBefore = await prisma.clientView.count();
        console.log(`📊 Registros actuales en ClientView: ${countBefore}`);

        if (countBefore === 0) {
            console.log('🎉 La base de datos ya está limpia');
            return;
        }

        // Mostrar algunos ejemplos de datos actuales
        const sampleData = await prisma.clientView.findMany({
            take: 5,
            select: {
                phoneNumber: true,
                userName: true,
                lastActivity: true
            }
        });
        
        console.log('📋 Ejemplos de datos actuales:');
        sampleData.forEach(record => {
            console.log(`  - ${record.phoneNumber} (${record.userName || 'Sin nombre'}) - ${record.lastActivity}`);
        });

        // Confirmar antes de eliminar
        console.log('\n⚠️  ¿CONFIRMAS QUE QUIERES ELIMINAR TODOS LOS DATOS?');
        console.log('   Presiona Ctrl+C para cancelar o espera 5 segundos para continuar...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Eliminar todos los registros
        console.log('🗑️  Eliminando todos los registros...');
        const deleteResult = await prisma.clientView.deleteMany({});
        
        console.log(`✅ Eliminados ${deleteResult.count} registros`);

        // Verificar que está limpio
        const countAfter = await prisma.clientView.count();
        console.log(`📊 Registros después de la limpieza: ${countAfter}`);

        if (countAfter === 0) {
            console.log('🎉 ¡Base de datos limpiada exitosamente!');
        } else {
            console.log('⚠️  Algunos registros no se eliminaron');
        }

    } catch (error) {
        console.error('❌ Error durante la limpieza:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Desconectado de PostgreSQL');
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    clearTestData()
        .then(() => {
            console.log('✨ Limpieza completada');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Error en la limpieza:', error);
            process.exit(1);
        });
}

module.exports = { clearTestData };