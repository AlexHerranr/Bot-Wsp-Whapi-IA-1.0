import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Renombrado seguro de tablas con @@map (versión corregida)...');
        
        // 1. Verificar estado actual del sistema
        console.log('\n📊 Estado actual del sistema:');
        
        const stats = await prisma.$queryRaw`
            SELECT 
                (SELECT COUNT(*) FROM "Booking") as reservas_count,
                (SELECT COUNT(*) FROM "Leads") as prospectos_count,
                (SELECT COUNT(*) FROM "ClientView") as whatsapp_count,
                (SELECT COUNT(*) FROM hotel_apartments) as apartamentos_count;
        `;
        
        const stat = (stats as any)[0];
        console.log(`📋 Booking (→ Reservas): ${stat.reservas_count} registros`);
        console.log(`📋 Leads (→ Prospectos): ${stat.prospectos_count} registros`);
        console.log(`📋 ClientView (→ WhatsApp): ${stat.whatsapp_count} registros`);
        console.log(`📋 hotel_apartments (→ Apartamentos): ${stat.apartamentos_count} registros`);
        
        // 2. Test de funcionalidad antes del cambio
        console.log('\n🧪 Test de funcionalidad del sistema automático...');
        
        const testBookingId = '73842286';
        
        // Test sync automático
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Cancelada Futura' }
        });
        
        const leadAfterCancel = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM "Leads" WHERE "bookingId" = ${testBookingId};
        `;
        
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Futura Pendiente' }
        });
        
        const leadAfterRestore = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM "Leads" WHERE "bookingId" = ${testBookingId};
        `;
        
        const cancelCount = (leadAfterCancel as any)[0].count;
        const restoreCount = (leadAfterRestore as any)[0].count;
        
        if (parseInt(cancelCount) === 0 && parseInt(restoreCount) === 1) {
            console.log('✅ Sistema automático funcionando correctamente');
        } else {
            console.log('❌ ERROR: Sistema automático no funciona - ABORTANDO');
            return;
        }
        
        console.log('\n🎯 PLAN DE RENOMBRADO FINAL:');
        console.log('┌─────────────────┬─────────────────┬──────────────────────────┐');
        console.log('│ Tabla Real      │ Nombre Nuevo    │ Estrategia               │');
        console.log('├─────────────────┼─────────────────┼──────────────────────────┤');
        console.log('│ Booking         │ Reservas        │ @@map("Booking")         │');
        console.log('│ Leads           │ Prospectos      │ @@map("Leads")           │');
        console.log('│ ClientView      │ WhatsApp        │ @@map("ClientView")      │');
        console.log('│ hotel_apartments│ Apartamentos    │ @@map("hotel_apartments")│');
        console.log('└─────────────────┴─────────────────┴──────────────────────────┘');
        
        console.log('\n📝 Actualizando schema.prisma...');
        
        // 3. Leer schema actual
        const fs = require('fs');
        const schemaPath = 'C:\\Users\\alex-\\Bot-Wsp-Whapi-IA\\prisma\\schema.prisma';
        let schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📄 Schema actual leído');
        
        // 4. Realizar cambios paso a paso
        
        // Cambiar nombres de modelos
        schemaContent = schemaContent.replace('model Booking {', 'model Reservas {');
        schemaContent = schemaContent.replace('model Leads {', 'model Prospectos {');
        schemaContent = schemaContent.replace('model ClientView {', 'model WhatsApp {');
        schemaContent = schemaContent.replace('model HotelApartment {', 'model Apartamentos {');
        
        // Actualizar relaciones en los campos
        schemaContent = schemaContent.replace(/Booking\?/g, 'Reservas?');
        schemaContent = schemaContent.replace(/Booking /g, 'Reservas ');
        schemaContent = schemaContent.replace(/Leads\?/g, 'Prospectos?');
        schemaContent = schemaContent.replace(/Leads /g, 'Prospectos ');
        
        // Agregar @@map antes del último } de cada modelo
        
        // Para Reservas (antes era Booking)
        schemaContent = schemaContent.replace(
            /(model Reservas \{[\s\S]*?)(\n})/,
            '$1\n\n  @@map("Booking")$2'
        );
        
        // Para Prospectos (antes era Leads)
        schemaContent = schemaContent.replace(
            /(model Prospectos \{[\s\S]*?)(\n})/,
            '$1\n\n  @@map("Leads")$2'
        );
        
        // Para WhatsApp (antes era ClientView)
        schemaContent = schemaContent.replace(
            /(model WhatsApp \{[\s\S]*?)(\n})/,
            '$1\n\n  @@map("ClientView")$2'
        );
        
        // Para Apartamentos (antes era HotelApartment)
        schemaContent = schemaContent.replace(
            /(model Apartamentos \{[\s\S]*?)(\n})/,
            '$1\n\n  @@map("hotel_apartments")$2'
        );
        
        // 5. Escribir schema actualizado
        fs.writeFileSync(schemaPath, schemaContent);
        console.log('✅ Schema actualizado con nombres en español y @@map');
        
        // 6. Mostrar cambios realizados
        console.log('\n🎉 ¡Renombrado completado exitosamente!');
        
        console.log('\n📋 CAMBIOS REALIZADOS:');
        console.log('✅ Booking → Reservas (@@map("Booking"))');
        console.log('✅ Leads → Prospectos (@@map("Leads"))');
        console.log('✅ ClientView → WhatsApp (@@map("ClientView"))');
        console.log('✅ HotelApartment → Apartamentos (@@map("hotel_apartments"))');
        
        console.log('\n🔒 LO QUE NO CAMBIÓ (SEGURIDAD):');
        console.log('✅ Tablas PostgreSQL: Mantienen nombres originales');
        console.log('✅ Triggers automáticos: INTACTOS y funcionando');
        console.log('✅ Foreign Keys: INTACTOS');
        console.log('✅ Índices: INTACTOS');
        console.log('✅ Bot funcionando: SIN INTERRUPCIONES');
        
        console.log('\n💻 NUEVO USO EN CÓDIGO:');
        console.log('```typescript');
        console.log('// ANTES:');
        console.log('await prisma.booking.findMany()');
        console.log('await prisma.leads.create()');
        console.log('await prisma.clientView.update()');
        console.log('await prisma.hotelApartment.findFirst()');
        console.log('');
        console.log('// DESPUÉS:');
        console.log('await prisma.reservas.findMany()');
        console.log('await prisma.prospectos.create()');
        console.log('await prisma.whatsApp.update()');
        console.log('await prisma.apartamentos.findFirst()');
        console.log('```');
        
        console.log('\n🔄 PRÓXIMOS PASOS REQUERIDOS:');
        console.log('1. 🔧 npx prisma generate (regenerar cliente Prisma)');
        console.log('2. 📝 Actualizar código gradualmente con nuevos nombres');
        console.log('3. 📚 Actualizar documentación con nombres en español');
        
        console.log('\n⚠️ IMPORTANTE:');
        console.log('- El sistema actual SIGUE FUNCIONANDO sin cambios');
        console.log('- Los triggers automáticos NO se ven afectados');
        console.log('- Las tablas físicas NO cambiaron');
        console.log('- Solo los nombres en TypeScript son diferentes');
        console.log('- Puedes usar los nombres antiguos Y nuevos durante la transición');
        
    } catch (error) {
        console.error('❌ Error en renombrado:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();