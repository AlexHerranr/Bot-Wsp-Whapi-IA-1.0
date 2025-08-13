import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🏨 Actualizando nombres de apartamentos con tipos específicos...');
        
        // Reglas específicas:
        // - 1722B y 2005B = "Aparta Estudio" 
        // - Todos los demás = "Apartamento 1 Alcoba"
        
        const updates = [
            // Apartamentos 1 Alcoba
            { propertyName: '2005 A', newName: 'Apartamento 1 Alcoba 2005 A', capacity: 6 },
            { propertyName: '1820', newName: 'Apartamento 1 Alcoba 1820', capacity: 6 },
            { propertyName: '1317', newName: 'Apartamento 1 Alcoba 1317', capacity: 6 },
            { propertyName: '1722 A', newName: 'Apartamento 1 Alcoba 1722 A', capacity: 6 },
            { propertyName: '0715', newName: 'Apartamento 1 Alcoba 0715', capacity: 6 },
            
            // Estudios
            { propertyName: '1722B', newName: 'Aparta Estudio 1722B', capacity: 4 },
            { propertyName: '2005 B', newName: 'Aparta Estudio 2005 B', capacity: 4 }
        ];
        
        console.log('📋 Aplicando actualizaciones...');
        
        for (const update of updates) {
            const result = await prisma.hotelApartment.updateMany({
                where: {
                    roomName: update.propertyName
                },
                data: {
                    roomName: update.newName,
                    capacity: update.capacity
                }
            });
            
            console.log(`✅ ${update.propertyName} -> "${update.newName}" (${update.capacity} personas) | Actualizados: ${result.count}`);
        }
        
        // Verificar resultados
        const updatedApartments = await prisma.hotelApartment.findMany({
            orderBy: { propertyId: 'asc' }
        });
        
        console.log('\n📊 Tabla actualizada:');
        updatedApartments.forEach(apt => {
            console.log(`- ID: ${apt.roomId} | "${apt.roomName}" | Capacidad: ${apt.capacity} personas`);
        });
        
        // Estadísticas de capacidades
        const capacityStats = await prisma.hotelApartment.groupBy({
            by: ['capacity'],
            _count: { capacity: true }
        });
        
        console.log('\n📊 Estadísticas de capacidades:');
        capacityStats.forEach(stat => {
            const tipo = stat.capacity === 4 ? 'Estudios' : stat.capacity === 6 ? '1 Alcoba' : 'Otros';
            console.log(`- ${tipo}: ${stat._count.capacity} apartamentos (${stat.capacity} personas c/u)`);
        });
        
        console.log('\n🎉 Nombres de apartamentos actualizados correctamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);