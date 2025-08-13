import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('💰 Actualizando extraCharge según tipo de apartamento...');
        
        // Obtener apartamentos actuales
        const apartments = await prisma.hotelApartment.findMany();
        
        console.log('📋 Aplicando nuevos cargos:');
        
        for (const apt of apartments) {
            let newExtraCharge;
            
            if (apt.capacity === 6) {
                // Apartamentos 1 Alcoba = 70000 "Registro y Limpieza"
                newExtraCharge = {
                    description: "Registro y Limpieza",
                    amount: 70000
                };
                console.log(`✅ ${apt.roomName}: $70,000 (Registro y Limpieza)`);
            } else if (apt.capacity === 4) {
                // Estudios = 60000 "Registro y Limpieza"
                newExtraCharge = {
                    description: "Registro y Limpieza", 
                    amount: 60000
                };
                console.log(`✅ ${apt.roomName}: $60,000 (Registro y Limpieza)`);
            }
            
            await prisma.hotelApartment.update({
                where: { id: apt.id },
                data: { extraCharge: newExtraCharge }
            });
        }
        
        // Verificar resultados
        const updatedApartments = await prisma.hotelApartment.findMany({
            orderBy: { propertyId: 'asc' }
        });
        
        console.log('\n📊 Tabla actualizada con nuevos cargos:');
        updatedApartments.forEach(apt => {
            const charge = apt.extraCharge as any;
            console.log(`- ${apt.roomName}`);
            console.log(`  Capacidad: ${apt.capacity} personas`);
            console.log(`  Cargo: $${charge.amount.toLocaleString()} (${charge.description})`);
        });
        
        // Estadísticas de cargos
        console.log('\n📊 Resumen de cargos por tipo:');
        const apartamentos1Alcoba = updatedApartments.filter(apt => apt.capacity === 6);
        const estudios = updatedApartments.filter(apt => apt.capacity === 4);
        
        console.log(`- Apartamentos 1 Alcoba (${apartamentos1Alcoba.length}): $70,000 - Registro y Limpieza`);
        console.log(`- Estudios (${estudios.length}): $60,000 - Registro y Limpieza`);
        
        console.log('\n🎉 Cargos actualizados correctamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);