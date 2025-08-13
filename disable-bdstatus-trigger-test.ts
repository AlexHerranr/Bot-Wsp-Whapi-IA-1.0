import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Test: Deshabilitar temporalmente trigger BDStatus...');
        
        const testBookingId = '73842286';
        
        // 1. Deshabilitar trigger BDStatus temporalmente
        console.log('⏸️ Deshabilitando trigger update_bdstatus_trigger...');
        
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Booking" DISABLE TRIGGER update_bdstatus_trigger;
        `);
        
        console.log('✅ Trigger BDStatus deshabilitado');
        
        // 2. Test UPDATE directo
        console.log('\n🧪 Test UPDATE sin trigger BDStatus...');
        
        // Verificar estado inicial
        const initialData = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('Estado inicial:', initialData);
        
        // Cambiar a "Cancelada Futura"
        console.log('\n🔄 Cambiando a "Cancelada Futura"...');
        
        await prisma.$executeRawUnsafe(`
            UPDATE "Booking" 
            SET "BDStatus" = 'Cancelada Futura', "lastUpdatedBD" = NOW()
            WHERE "bookingId" = '${testBookingId}';
        `);
        
        // Verificar resultado
        const afterUpdateData = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('Después del UPDATE:', afterUpdateData);
        
        const lead = (afterUpdateData as any)[0];
        if (lead.BDStatus === 'Cancelada Futura' && !lead.lead_booking_id) {
            console.log('✅ ¡SUCCESS! Sin trigger BDStatus, el trigger sync funciona correctamente');
        } else {
            console.log('❌ ERROR: Aún hay problema con el trigger sync');
        }
        
        // 3. Test cambio de vuelta a "Futura Pendiente"
        console.log('\n🔄 Cambiando de vuelta a "Futura Pendiente"...');
        
        await prisma.$executeRawUnsafe(`
            UPDATE "Booking" 
            SET "BDStatus" = 'Futura Pendiente', "lastUpdatedBD" = NOW()
            WHERE "bookingId" = '${testBookingId}';
        `);
        
        const finalData = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('Estado final:', finalData);
        
        const finalLead = (finalData as any)[0];
        if (finalLead.BDStatus === 'Futura Pendiente' && finalLead.lead_booking_id) {
            console.log('✅ ¡SUCCESS! Trigger sync funciona en ambas direcciones');
        } else {
            console.log('❌ ERROR: Problema con la restauración del lead');
        }
        
        // 4. Rehabilitar trigger BDStatus
        console.log('\n▶️ Rehabilitando trigger update_bdstatus_trigger...');
        
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Booking" ENABLE TRIGGER update_bdstatus_trigger;
        `);
        
        console.log('✅ Trigger BDStatus rehabilitado');
        
        console.log('\n📊 CONCLUSIÓN:');
        console.log('El problema ERA el conflicto entre triggers:');
        console.log('- update_bdstatus_trigger (BEFORE) sobrescribe cambios manuales de BDStatus');
        console.log('- trg_Booking_sync_leads (AFTER) sí funciona correctamente');
        console.log('- Solución: Necesitamos permitir cambios manuales de BDStatus o coordinar los triggers');
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        // Asegurar que el trigger se rehabilite en caso de error
        try {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "Booking" ENABLE TRIGGER update_bdstatus_trigger;
            `);
            console.log('🔧 Trigger BDStatus rehabilitado después del error');
        } catch (e) {
            console.error('❌ Error rehabilitando trigger:', e);
        }
        
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();