import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Extrayendo nombres de habitaciones desde reservas existentes...');
        
        // Obtener todas las reservas que tengan información de propiedad
        const bookings = await prisma.booking.findMany({
            where: {
                propertyName: {
                    not: null
                }
            },
            select: {
                propertyName: true,
                raw: true
            }
        });
        
        console.log(`📋 Analizando ${bookings.length} reservas...`);
        
        // Extraer información de habitaciones del campo raw
        const roomsFound = new Map();
        
        bookings.forEach((booking, index) => {
            try {
                if (booking.raw) {
                    const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
                    
                    // Buscar campos que puedan contener información de habitaciones
                    const roomFields = [
                        'roomName', 'room_name', 'room', 'roomType', 'room_type',
                        'unitName', 'unit_name', 'unit', 'apartmentName', 'apartment_name'
                    ];
                    
                    let roomName = null;
                    let propertyId = null;
                    
                    // Buscar nombre de habitación
                    for (const field of roomFields) {
                        if (rawData[field]) {
                            roomName = rawData[field];
                            break;
                        }
                    }
                    
                    // Buscar propertyId
                    if (rawData.propertyId || rawData.property_id) {
                        propertyId = rawData.propertyId || rawData.property_id;
                    }
                    
                    if (roomName && propertyId) {
                        const key = `${propertyId}-${roomName}`;
                        if (!roomsFound.has(key)) {
                            roomsFound.set(key, {
                                propertyId: propertyId,
                                propertyName: booking.propertyName,
                                roomName: roomName,
                                count: 1
                            });
                        } else {
                            roomsFound.get(key).count++;
                        }
                    }
                }
            } catch (error) {
                // Continuar con la siguiente reserva si hay error
            }
        });
        
        console.log(`✅ Encontradas ${roomsFound.size} habitaciones únicas`);
        
        if (roomsFound.size === 0) {
            console.log('\n⚠️ No se encontraron habitaciones en los datos raw. Mostrando estructura de ejemplo...');
            
            // Mostrar estructura de algunas reservas para debugging
            const sampleBookings = await prisma.booking.findMany({
                where: { raw: { not: null } },
                take: 3,
                select: { raw: true, propertyName: true }
            });
            
            sampleBookings.forEach((booking, i) => {
                console.log(`\n📄 Reserva ${i + 1} (${booking.propertyName}):`);
                try {
                    const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
                    console.log('Campos disponibles:', Object.keys(rawData).filter(key => 
                        key.toLowerCase().includes('room') || 
                        key.toLowerCase().includes('unit') || 
                        key.toLowerCase().includes('apartment')
                    ));
                } catch (error) {
                    console.log('Error al parsear raw data');
                }
            });
            
            return;
        }
        
        // Función para determinar capacidad
        function getCapacity(roomName: string): number {
            const name = roomName.toLowerCase();
            
            if (name.includes('estudio') || name.includes('studio')) {
                return 4;
            }
            if (name.includes('1 alcoba') || name.includes('1 bedroom') || name.includes('one bedroom')) {
                return 6;
            }
            if (name.includes('2 alcoba') || name.includes('2 bedroom') || name.includes('two bedroom')) {
                return 8;
            }
            if (name.includes('3 alcoba') || name.includes('3 bedroom') || name.includes('three bedroom')) {
                return 10;
            }
            
            return 4; // Default: estudios
        }
        
        // Mostrar habitaciones encontradas
        console.log('\n📋 Habitaciones encontradas:');
        Array.from(roomsFound.values()).forEach(room => {
            const capacity = getCapacity(room.roomName);
            console.log(`- Propiedad ${room.propertyId} (${room.propertyName}): "${room.roomName}" | Capacidad: ${capacity} | Reservas: ${room.count}`);
        });
        
        // Limpiar tabla existente
        await prisma.hotelApartment.deleteMany();
        console.log('\n🧹 Tabla HotelApartment limpiada');
        
        // Preparar datos para insertar
        const insertData = Array.from(roomsFound.values()).map((room, index) => ({
            propertyId: parseInt(room.propertyId),
            roomId: parseInt(room.propertyId) * 1000 + index + 1, // ID único
            roomName: room.roomName,
            capacity: getCapacity(room.roomName),
            extraCharge: {
                description: "Cargo adicional:",
                amount: 70000
            }
        }));
        
        await prisma.hotelApartment.createMany({
            data: insertData
        });
        
        console.log(`✅ Insertadas ${insertData.length} habitaciones reales desde reservas`);
        
        // Estadísticas finales
        const stats = await prisma.hotelApartment.groupBy({
            by: ['capacity'],
            _count: { capacity: true }
        });
        
        console.log('\n📊 Estadísticas de capacidades:');
        stats.forEach(stat => {
            const tipo = stat.capacity === 4 ? 'Estudios' : 
                        stat.capacity === 6 ? '1 Alcoba' :
                        stat.capacity === 8 ? '2 Alcobas' :
                        stat.capacity === 10 ? '3 Alcobas' : 'Otros';
            
            console.log(`- ${tipo}: ${stat._count.capacity} habitaciones (${stat.capacity} personas c/u)`);
        });
        
        console.log('\n🎉 Proceso completado con nombres reales de habitaciones');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);