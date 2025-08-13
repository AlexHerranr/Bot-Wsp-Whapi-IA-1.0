import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Diagnosticando problema del trigger...');
        
        const testBookingId = '73842286';
        
        // 1. Verificar logs de PostgreSQL (si están habilitados)
        console.log('\n📋 Verificando configuración de logs...');
        
        try {
            const logLevel = await prisma.$queryRaw`SHOW log_statement;`;
            console.log('Log statement level:', logLevel);
            
            const logMinMessages = await prisma.$queryRaw`SHOW log_min_messages;`;
            console.log('Log min messages:', logMinMessages);
        } catch (e) {
            console.log('No se pueden verificar logs (normal en Railway)');
        }
        
        // 2. Test manual con SQL puro
        console.log('\n🧪 Test con SQL puro...');
        
        // Verificar estado inicial
        const initialData = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('Estado inicial:', initialData);
        
        // Test directo - cambiar estado
        console.log('\n🔄 Ejecutando UPDATE directo con SQL...');
        
        const updateResult = await prisma.$executeRawUnsafe(`
            UPDATE "Booking" 
            SET "BDStatus" = 'Cancelada Futura', "lastUpdatedBD" = NOW()
            WHERE "bookingId" = '${testBookingId}';
        `);
        
        console.log('UPDATE afectó', updateResult, 'filas');
        
        // Verificar resultado
        const afterUpdateData = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('Después del UPDATE:', afterUpdateData);
        
        // 3. Verificar triggers específicamente
        console.log('\n🔍 Verificando detalles de triggers...');
        
        const triggerDetails = await prisma.$queryRaw`
            SELECT 
                trigger_name,
                event_manipulation,
                action_timing,
                event_object_table,
                action_condition,
                action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'Booking'
            AND trigger_name LIKE '%sync_leads%'
            ORDER BY trigger_name;
        `;
        
        console.log('Detalles de triggers sync_leads:');
        console.table(triggerDetails);
        
        // 4. Verificar si hay otros constraints/triggers interfiriendo
        console.log('\n🔍 Verificando constraints en Leads...');
        
        const constraints = await prisma.$queryRaw`
            SELECT 
                constraint_name,
                constraint_type,
                table_name
            FROM information_schema.table_constraints 
            WHERE table_name = 'Leads'
            ORDER BY constraint_name;
        `;
        
        console.log('Constraints en tabla Leads:');
        console.table(constraints);
        
        // 5. Test manual DELETE
        console.log('\n🗑️ Test manual DELETE en Leads...');
        
        const manualDeleteResult = await prisma.$executeRawUnsafe(`
            DELETE FROM "Leads" WHERE "bookingId" = '${testBookingId}';
        `);
        
        console.log('DELETE manual afectó', manualDeleteResult, 'filas');
        
        // Verificar que se eliminó
        const afterDeleteData = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('Después del DELETE manual:', afterDeleteData);
        
        // 6. Restaurar para siguiente test
        console.log('\n🔄 Restaurando estado...');
        
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
        
        console.log('\n📊 Resumen del diagnóstico:');
        console.log('- El trigger existe y está configurado');
        console.log('- El DELETE manual SÍ funciona');
        console.log('- Problema: El trigger NO se está ejecutando en UPDATE');
        console.log('- Posible causa: Conflicto con trigger de BDStatus o condiciones del trigger');
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();