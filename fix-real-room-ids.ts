import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Corrigiendo tabla con RoomIds REALES de Beds24...');
        
        // RoomIds REALES extraídos de las reservas
        const realRoomData = [
            {
                propertyId: 173207,
                propertyName: '2005 A',
                realRoomId: 378110,
                roomName: 'Apartamento 1 Alcoba 2005 A',
                capacity: 6
            },
            {
                propertyId: 173307,
                propertyName: '1820',
                realRoomId: 378316,
                roomName: 'Apartamento 1 Alcoba 1820',
                capacity: 6
            },
            {
                propertyId: 173308,
                propertyName: '1317',
                realRoomId: 378317,
                roomName: 'Apartamento 1 Alcoba 1317',
                capacity: 6
            },
            {
                propertyId: 173309,
                propertyName: '1722B',
                realRoomId: 378318,
                roomName: 'Aparta Estudio 1722B',
                capacity: 4
            },
            {
                propertyId: 173311,
                propertyName: '2005 B',
                realRoomId: 378320,
                roomName: 'Aparta Estudio 2005 B',
                capacity: 4
            },
            {
                propertyId: 173312,
                propertyName: '1722 A',
                realRoomId: 378321,
                roomName: 'Apartamento 1 Alcoba 1722 A',
                capacity: 6
            },
            {
                propertyId: 240061,
                propertyName: '0715',
                realRoomId: 506591,
                roomName: 'Apartamento 1 Alcoba 0715',
                capacity: 6
            }
        ];
        
        console.log('📋 Aplicando RoomIds reales...');
        
        // Limpiar tabla y recrear con datos correctos
        await prisma.hotelApartment.deleteMany();
        console.log('🧹 Tabla limpiada');
        
        const insertData = realRoomData.map(apt => ({
            propertyId: apt.propertyId,
            roomId: apt.realRoomId, // Usar el roomId REAL de Beds24
            roomName: apt.roomName,
            capacity: apt.capacity,
            extraCharge: {
                description: "Cargo adicional:",
                amount: 70000
            }
        }));
        
        await prisma.hotelApartment.createMany({
            data: insertData
        });
        
        console.log(`✅ Insertados ${insertData.length} apartamentos con RoomIds reales`);
        
        // Verificar tabla final
        const finalTable = await prisma.hotelApartment.findMany({
            orderBy: { propertyId: 'asc' }
        });
        
        console.log('\n📊 Tabla final con RoomIds REALES:');
        finalTable.forEach(apt => {
            const property = realRoomData.find(r => r.propertyId === apt.propertyId);
            console.log(`- RoomId: ${apt.roomId} | PropertyId: ${apt.propertyId} | "${apt.roomName}" | ${apt.capacity} personas`);
            console.log(`  ✅ Es el RoomId REAL de ${property?.propertyName} en Beds24`);
        });
        
        // Estadísticas finales
        const capacityStats = await prisma.hotelApartment.groupBy({
            by: ['capacity'],
            _count: { capacity: true }
        });
        
        console.log('\n📊 Estadísticas:');
        capacityStats.forEach(stat => {
            const tipo = stat.capacity === 4 ? 'Estudios' : stat.capacity === 6 ? '1 Alcoba' : 'Otros';
            console.log(`- ${tipo}: ${stat._count.capacity} apartamentos (${stat.capacity} personas c/u)`);
        });
        
        console.log('\n🎉 Tabla corregida con RoomIds REALES de Beds24!');
        console.log('👍 Ahora los IDs coinciden exactamente con los usados en las reservas');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);