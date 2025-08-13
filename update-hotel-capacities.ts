import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🏨 Actualizando capacidades de apartamentos...');
        
        // Función para determinar capacidad según nombre
        function getCapacity(roomName: string): number {
            const name = roomName.toLowerCase();
            
            if (name.includes('estudio') || name.includes('studio')) {
                return 4;  // Estudios = 4 personas
            }
            if (name.includes('1 alcoba') || name.includes('1 bedroom') || name.includes('one bedroom')) {
                return 6;  // 1 alcoba = 6 personas
            }
            if (name.includes('2 alcoba') || name.includes('2 bedroom') || name.includes('two bedroom')) {
                return 8;  // 2 alcobas = 8 personas
            }
            if (name.includes('3 alcoba') || name.includes('3 bedroom') || name.includes('three bedroom')) {
                return 10; // 3 alcobas = 10 personas
            }
            
            // Default: estudios (la mayoría son estudios)
            return 4;
        }
        
        // Obtener todos los apartamentos
        const apartments = await prisma.hotelApartment.findMany();
        console.log(`📋 Encontrados ${apartments.length} apartamentos para actualizar`);
        
        if (apartments.length === 0) {
            console.log('⚠️ No hay apartamentos en la tabla. Ejecutando script de importación...');
            
            // Importar datos desde Beds24 API
            const { getBeds24Config } = await import('./src/config/integrations/beds24.config');
            const { getBeds24Service } = await import('./src/plugins/hotel/services/beds24/beds24.service');
            
            const config = getBeds24Config();
            const beds24Service = getBeds24Service(config);
            
            // Obtener propiedades
            const properties = await beds24Service.getProperties();
            console.log(`✅ Encontradas ${properties.length} propiedades`);
            
            // Crear entradas básicas por propiedad
            const insertData: any[] = [];
            
            properties.forEach(property => {
                // Crear un estudio por cada propiedad (capacidad 4)
                insertData.push({
                    propertyId: property.id,
                    roomId: property.id * 1000 + 1,
                    roomName: `Estudio - ${property.name}`,
                    capacity: 4,
                    extraCharge: {
                        description: "Cargo adicional:",
                        amount: 70000
                    }
                });
                
                // Crear un 1 alcoba por cada propiedad (capacidad 6)
                insertData.push({
                    propertyId: property.id,
                    roomId: property.id * 1000 + 2,
                    roomName: `1 Alcoba - ${property.name}`,
                    capacity: 6,
                    extraCharge: {
                        description: "Cargo adicional:",
                        amount: 70000
                    }
                });
            });
            
            await prisma.hotelApartment.createMany({
                data: insertData
            });
            
            console.log(`✅ Insertadas ${insertData.length} habitaciones nuevas`);
        } else {
            // Actualizar capacidades existentes
            let updated = 0;
            
            for (const apartment of apartments) {
                const newCapacity = getCapacity(apartment.roomName);
                
                if (apartment.capacity !== newCapacity) {
                    await prisma.hotelApartment.update({
                        where: { id: apartment.id },
                        data: { capacity: newCapacity }
                    });
                    
                    console.log(`📝 Actualizado: ${apartment.roomName} -> ${newCapacity} personas`);
                    updated++;
                }
            }
            
            console.log(`✅ Actualizadas ${updated} capacidades`);
        }
        
        // Mostrar estadísticas finales
        const stats = await prisma.hotelApartment.groupBy({
            by: ['capacity'],
            _count: {
                capacity: true
            }
        });
        
        console.log('\n📊 Estadísticas de capacidades:');
        stats.forEach(stat => {
            const tipo = stat.capacity === 4 ? 'Estudios' : 
                        stat.capacity === 6 ? '1 Alcoba' :
                        stat.capacity === 8 ? '2 Alcobas' :
                        stat.capacity === 10 ? '3 Alcobas' : 'Otros';
            
            console.log(`- ${tipo}: ${stat._count.capacity} apartamentos (${stat.capacity} personas c/u)`);
        });
        
        // Muestra de datos finales
        const sample = await prisma.hotelApartment.findMany({
            take: 5,
            orderBy: { capacity: 'asc' }
        });
        
        console.log('\n📋 Muestra de apartamentos:');
        sample.forEach(apt => {
            console.log(`- ${apt.roomName} | Capacidad: ${apt.capacity} personas | Propiedad: ${apt.propertyId}`);
        });
        
        console.log('\n🎉 Proceso completado exitosamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);