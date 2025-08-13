import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Corrigiendo tabla de hoteles - solo 7 apartamentos reales...');
        
        // Mapeo de propiedades reales con sus características conocidas
        const realApartments = [
            {
                propertyId: 173207,
                propertyName: '2005 A',
                roomId: 173207001,
                roomName: '2005 A',
                capacity: 4, // Basado en datos reales de reservas, la mayoría son estudios
            },
            {
                propertyId: 173311,
                propertyName: '2005 B', 
                roomId: 173311001,
                roomName: '2005 B',
                capacity: 4,
            },
            {
                propertyId: 173307,
                propertyName: '1820',
                roomId: 173307001,
                roomName: '1820',
                capacity: 4,
            },
            {
                propertyId: 173308,
                propertyName: '1317',
                roomId: 173308001,
                roomName: '1317',
                capacity: 4,
            },
            {
                propertyId: 173309,
                propertyName: '1722B',
                roomId: 173309001,
                roomName: '1722B',
                capacity: 4,
            },
            {
                propertyId: 173312,
                propertyName: '1722 A',
                roomId: 173312001,
                roomName: '1722 A',
                capacity: 4,
            },
            {
                propertyId: 240061,
                propertyName: '0715',
                roomId: 240061001,
                roomName: '0715',
                capacity: 4,
            }
        ];
        
        console.log(`📋 Creando ${realApartments.length} apartamentos reales...`);
        
        // Limpiar tabla existente
        await prisma.hotelApartment.deleteMany();
        console.log('🧹 Tabla HotelApartment limpiada');
        
        // Insertar apartamentos reales
        const insertData = realApartments.map(apt => ({
            propertyId: apt.propertyId,
            roomId: apt.roomId,
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
        
        console.log(`✅ Insertados ${insertData.length} apartamentos reales`);
        
        // Verificar reservas por apartamento
        console.log('\n📊 Verificación con reservas existentes:');
        
        for (const apt of realApartments) {
            const reservasCount = await prisma.booking.count({
                where: {
                    propertyName: apt.propertyName
                }
            });
            
            console.log(`- ${apt.roomName} (${apt.propertyId}): ${reservasCount} reservas | Capacidad: ${apt.capacity} personas`);
        }
        
        // Estadísticas finales
        const totalApartments = await prisma.hotelApartment.count();
        const capacityStats = await prisma.hotelApartment.groupBy({
            by: ['capacity'],
            _count: { capacity: true }
        });
        
        console.log('\n📊 Estadísticas finales:');
        console.log(`- Total apartamentos: ${totalApartments}`);
        capacityStats.forEach(stat => {
            console.log(`- Capacidad ${stat.capacity} personas: ${stat._count.capacity} apartamentos`);
        });
        
        // Mostrar tabla final
        const finalTable = await prisma.hotelApartment.findMany({
            orderBy: { propertyId: 'asc' }
        });
        
        console.log('\n📋 Tabla final de apartamentos:');
        finalTable.forEach(apt => {
            console.log(`- ID: ${apt.roomId} | Propiedad: ${apt.propertyId} | Nombre: "${apt.roomName}" | Capacidad: ${apt.capacity} personas`);
        });
        
        console.log('\n🎉 Tabla corregida - 7 apartamentos reales únicos!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);