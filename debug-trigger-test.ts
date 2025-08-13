import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Debuggeando el trigger de sincronización...');
        
        const testBookingId = '73842286';
        
        // 1. Verificar estado actual
        const booking = await prisma.booking.findUnique({
            where: { bookingId: testBookingId },
            select: { bookingId: true, BDStatus: true, guestName: true }
        });
        
        const lead = await prisma.leads.findFirst({
            where: { bookingId: testBookingId },
            select: { bookingId: true, guestName: true }
        });
        
        console.log('📊 Estado actual:');
        console.log('Booking:', booking);
        console.log('Lead:', lead);
        
        // 2. Test manual del trigger
        console.log('\n🧪 Test 1: Cambiar a "Futura Confirmada" (debe eliminar lead)');
        
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Futura Confirmada' }
        });
        
        const leadAfterChange = await prisma.leads.findFirst({
            where: { bookingId: testBookingId }
        });
        
        console.log('Lead después del cambio:', leadAfterChange);
        console.log(leadAfterChange ? '❌ ERROR: Lead NO eliminado' : '✅ SUCCESS: Lead eliminado correctamente');
        
        // 3. Test 2: Cambiar de vuelta
        console.log('\n🧪 Test 2: Cambiar a "Futura Pendiente" (debe crear lead)');
        
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Futura Pendiente' }
        });
        
        const leadAfterRevert = await prisma.leads.findFirst({
            where: { bookingId: testBookingId }
        });
        
        console.log('Lead después del revert:', leadAfterRevert);
        console.log(leadAfterRevert ? '✅ SUCCESS: Lead creado correctamente' : '❌ ERROR: Lead NO creado');
        
        // 4. Verificar triggers existen
        console.log('\n🔍 Verificando triggers...');
        
        const triggers = await prisma.$queryRaw`
            SELECT trigger_name, event_manipulation, action_timing, action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'Booking'
            ORDER BY trigger_name;
        `;
        
        console.log('Triggers activos:');
        console.table(triggers);
        
        // 5. Test directo con query
        console.log('\n🧪 Test 3: Trigger directo con query SQL');
        
        // Cambiar a "Cancelada Futura" para test
        await prisma.$executeRawUnsafe(`
            UPDATE "Booking" 
            SET "BDStatus" = 'Cancelada Futura' 
            WHERE "bookingId" = '${testBookingId}';
        `);
        
        const leadAfterDirect = await prisma.leads.findFirst({
            where: { bookingId: testBookingId }
        });
        
        console.log('Lead después de query directa:', leadAfterDirect);
        console.log(leadAfterDirect ? '❌ ERROR: Lead NO eliminado con query directa' : '✅ SUCCESS: Lead eliminado con query directa');
        
        // 6. Restaurar estado final
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Futura Pendiente' }
        });
        
        console.log('\n✅ Test completado - booking restaurado a "Futura Pendiente"');
        
    } catch (error) {
        console.error('❌ Error en debug:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();