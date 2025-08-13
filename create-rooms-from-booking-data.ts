import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Creando habitaciones basado en datos reales de reservas...');
        
        // Obtener roomIds y unitIds únicos de las reservas
        const bookingData = await prisma.booking.findMany({
            where: {
                raw: { not: null }
            },
            select: {
                propertyName: true,
                raw: true
            }
        });
        
        console.log(`📋 Analizando ${bookingData.length} reservas...`);
        
        // Extraer propiedades únicas y crear habitaciones por cada una
        const propertiesMap = new Map();
        
        bookingData.forEach((booking) => {
            try {
                const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
                
                if (booking.propertyName) {
                    const key = booking.propertyName.trim();
                    
                    if (!propertiesMap.has(key)) {
                        propertiesMap.set(key, {
                            propertyName: key,
                            roomId: rawData.roomId || 1,
                            unitId: rawData.unitId || 1,
                            count: 1
                        });
                    } else {
                        propertiesMap.get(key).count++;
                    }
                }
            } catch (error) {
                // Continuar con la siguiente reserva
            }
        });
        
        console.log(`✅ Encontradas ${propertiesMap.size} propiedades únicas`);
        
        if (propertiesMap.size === 0) {
            console.log('❌ No se encontraron propiedades en las reservas');
            return;
        }
        
        // Crear mapeo de nombres de propiedades conocidas
        const propertyMapping: { [key: string]: number } = {
            '2005 A': 173207,
            '2005 B': 173311,
            '1820 ': 173307,
            '1820': 173307,  // Versión sin espacio
            '1317': 173308,
            '1722B': 173309,
            '1722 A': 173312,
            '0715': 240061
        };
        
        // Función para generar nombres de habitaciones basados en patrones conocidos
        function generateRoomNames(propertyName: string): { studio: string, apartment: string } {
            const property = propertyName.trim();
            
            return {
                studio: `Estudio ${property}`,
                apartment: `1 Alcoba ${property}`
            };
        }
        
        // Función para determinar capacidad basada en el nombre generado
        function getCapacity(roomName: string): number {
            const name = roomName.toLowerCase();
            
            if (name.includes('estudio') || name.includes('studio')) {
                return 4;
            }
            if (name.includes('1 alcoba') || name.includes('1 bedroom')) {
                return 6;
            }
            if (name.includes('2 alcoba') || name.includes('2 bedroom')) {
                return 8;
            }
            
            return 4; // Default: estudios
        }
        
        // Limpiar tabla existente
        await prisma.hotelApartment.deleteMany();
        console.log('🧹 Tabla HotelApartment limpiada');
        
        // Preparar datos para insertar - crear estudio y 1 alcoba por cada propiedad
        const insertData: any[] = [];
        
        Array.from(propertiesMap.values()).forEach((property, index) => {
            const propertyId = propertyMapping[property.propertyName] || 0;
            
            if (propertyId > 0) {
                const roomNames = generateRoomNames(property.propertyName);
                
                // Crear estudio
                insertData.push({
                    propertyId: propertyId,
                    roomId: propertyId * 1000 + 1, // ID único para estudio
                    roomName: roomNames.studio,
                    capacity: 4,
                    extraCharge: {
                        description: "Cargo adicional:",
                        amount: 70000
                    }
                });
                
                // Crear 1 alcoba
                insertData.push({
                    propertyId: propertyId,
                    roomId: propertyId * 1000 + 2, // ID único para 1 alcoba
                    roomName: roomNames.apartment,
                    capacity: 6,
                    extraCharge: {
                        description: "Cargo adicional:",
                        amount: 70000
                    }
                });
            }
        });
        
        // Eliminar duplicados por roomId
        const uniqueData = insertData.filter((item, index, self) => 
            index === self.findIndex(t => t.roomId === item.roomId)
        );
        
        await prisma.hotelApartment.createMany({
            data: uniqueData
        });
        
        console.log(`✅ Insertadas ${uniqueData.length} habitaciones basadas en datos reales`);
        
        // Mostrar estadísticas por propiedad
        console.log('\n📊 Habitaciones creadas por propiedad:');
        Array.from(propertiesMap.values()).forEach(property => {
            const propertyId = propertyMapping[property.propertyName];
            if (propertyId) {
                const roomNames = generateRoomNames(property.propertyName);
                console.log(`- ${property.propertyName} (${propertyId}): "${roomNames.studio}" (4 personas) + "${roomNames.apartment}" (6 personas) | ${property.count} reservas totales`);
            }
        });
        
        // Estadísticas de capacidades
        const capacityStats = await prisma.hotelApartment.groupBy({
            by: ['capacity'],
            _count: { capacity: true }
        });
        
        console.log('\n📊 Estadísticas de capacidades:');
        capacityStats.forEach(stat => {
            const tipo = stat.capacity === 4 ? 'Estudios' : 
                        stat.capacity === 6 ? '1 Alcoba' :
                        stat.capacity === 8 ? '2 Alcobas' : 'Otros';
            
            console.log(`- ${tipo}: ${stat._count.capacity} habitaciones (${stat.capacity} personas c/u)`);
        });
        
        console.log('\n🎉 Tabla de hoteles creada con datos reales de reservas exitosamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);