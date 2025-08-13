import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🧹 Limpiando y poblando tabla Leads...');
        
        // 1. Verificar estructura actual de Leads
        console.log('\n📋 Verificando estructura de tabla Leads...');
        const leadsCount = await prisma.leads.count();
        console.log(`📊 Registros actuales en Leads: ${leadsCount}`);
        
        // 2. Verificar reservas con "Futura Pendiente"
        console.log('\n🔍 Verificando reservas "Futura Pendiente"...');
        const futurasPendientes = await prisma.booking.findMany({
            where: {
                BDStatus: 'Futura Pendiente'
            },
            select: {
                id: true,
                bookingId: true,
                guestName: true,
                propertyName: true,
                arrivalDate: true,
                departureDate: true,
                totalPersons: true,
                lastUpdatedBD: true,
                phone: true,
                channel: true,
                status: true
            }
        });
        
        console.log(`📊 Reservas "Futura Pendiente" encontradas: ${futurasPendientes.length}`);
        
        if (futurasPendientes.length > 0) {
            console.log('\n📋 Ejemplo de reserva "Futura Pendiente":');
            console.log('ID:', futurasPendientes[0].id);
            console.log('Booking ID:', futurasPendientes[0].bookingId);
            console.log('Guest Name:', futurasPendientes[0].guestName);
            console.log('Property Name:', futurasPendientes[0].propertyName);
            console.log('Arrival Date:', futurasPendientes[0].arrivalDate);
            console.log('Total Persons:', futurasPendientes[0].totalPersons);
            console.log('Phone:', futurasPendientes[0].phone);
            console.log('Channel:', futurasPendientes[0].channel);
            console.log('Status:', futurasPendientes[0].status);
        }
        
        // 3. Limpiar tabla Leads
        console.log('\n🗑️ Limpiando tabla Leads...');
        const deleteResult = await prisma.leads.deleteMany();
        console.log(`✅ Eliminados ${deleteResult.count} registros de Leads`);
        
        // 4. Copiar reservas "Futura Pendiente" a Leads
        if (futurasPendientes.length > 0) {
            console.log('\n📋 Copiando reservas "Futura Pendiente" a tabla Leads...');
            
            const leadsData = futurasPendientes.map(booking => ({
                bookingId: booking.bookingId,
                phone: booking.phone || 'N/A', // Campo requerido en Leads
                guestName: booking.guestName,
                propertyName: booking.propertyName,
                arrivalDate: booking.arrivalDate || '',
                departureDate: booking.departureDate,
                totalPersons: booking.totalPersons,
                leadType: 'reserva_pendiente',
                source: 'beds24',
                channel: booking.channel,
                lastUpdated: booking.lastUpdatedBD
            }));
            
            console.log('\n📊 Datos a insertar (primeros 3):');
            console.table(leadsData.slice(0, 3));
            
            const insertResult = await prisma.leads.createMany({
                data: leadsData
            });
            
            console.log(`✅ Insertados ${insertResult.count} leads desde reservas "Futura Pendiente"`);
        } else {
            console.log('⚠️ No hay reservas "Futura Pendiente" para copiar');
        }
        
        // 5. Verificar resultado final
        console.log('\n📊 Verificando resultado final...');
        const finalLeadsCount = await prisma.leads.count();
        console.log(`📋 Total de leads finales: ${finalLeadsCount}`);
        
        if (finalLeadsCount > 0) {
            const sampleLeads = await prisma.leads.findMany({
                take: 3,
                orderBy: { arrivalDate: 'asc' }
            });
            
            console.log('\n📋 Primeros 3 leads creados:');
            console.table(sampleLeads);
        }
        
        console.log('\n🎉 ¡Tabla Leads limpiada y poblada exitosamente!');
        console.log('\n📋 Resumen:');
        console.log(`- ✅ Leads eliminados: ${deleteResult.count}`);
        console.log(`- ✅ Reservas "Futura Pendiente" procesadas: ${futurasPendientes.length}`);
        console.log(`- ✅ Nuevos leads creados: ${finalLeadsCount}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();