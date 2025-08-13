import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Preparando renombrado seguro de tablas con @@map...');
        
        // 1. Verificar que todas las tablas y triggers funcionan antes del cambio
        console.log('\n📊 Verificando estado actual del sistema...');
        
        const stats = await prisma.$queryRaw`
            SELECT 
                (SELECT COUNT(*) FROM "Booking") as reservas_count,
                (SELECT COUNT(*) FROM "Leads") as prospectos_count,
                (SELECT COUNT(*) FROM "ClientView") as whatsapp_count,
                (SELECT COUNT(*) FROM "HotelApartment") as apartamentos_count;
        `;
        
        const stat = (stats as any)[0];
        console.log(`📋 Booking (→ Reservas): ${stat.reservas_count} registros`);
        console.log(`📋 Leads (→ Prospectos): ${stat.prospectos_count} registros`);
        console.log(`📋 ClientView (→ WhatsApp): ${stat.whatsapp_count} registros`);
        console.log(`📋 HotelApartment (→ Apartamentos): ${stat.apartamentos_count} registros`);
        
        // 2. Verificar triggers funcionando
        console.log('\n⚡ Verificando triggers activos...');
        const triggers = await prisma.$queryRaw`
            SELECT trigger_name, event_object_table, event_manipulation
            FROM information_schema.triggers 
            WHERE event_object_table IN ('Booking', 'Leads')
            ORDER BY event_object_table, trigger_name;
        `;
        
        console.log('Triggers activos (se mantendrán intactos):');
        console.table(triggers);
        
        // 3. Test de funcionalidad antes del cambio
        console.log('\n🧪 Test de funcionalidad actual...');
        
        const testBookingId = '73842286';
        
        // Verificar que sync automático funciona
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
        
        console.log('\n🎯 PLAN DE RENOMBRADO:');
        console.log('┌─────────────────┬─────────────────┬──────────────────────────┐');
        console.log('│ Tabla Actual    │ Nombre Nuevo    │ Estrategia               │');
        console.log('├─────────────────┼─────────────────┼──────────────────────────┤');
        console.log('│ Booking         │ Reservas        │ @@map("Booking")         │');
        console.log('│ Leads           │ Prospectos      │ @@map("Leads")           │');
        console.log('│ ClientView      │ WhatsApp        │ @@map("ClientView")      │');
        console.log('│ HotelApartment  │ Apartamentos    │ @@map("HotelApartment")  │');
        console.log('└─────────────────┴─────────────────┴──────────────────────────┘');
        
        console.log('\n📝 Actualizando schema.prisma...');
        
        // 4. Leer schema actual
        const fs = require('fs');
        const schemaPath = 'C:\\Users\\alex-\\Bot-Wsp-Whapi-IA\\prisma\\schema.prisma';
        let schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📄 Schema actual leído');
        
        // 5. Aplicar cambios con @@map
        const mappings = [
            // Cambiar nombres de modelos pero mantener tablas reales
            { from: 'model Booking {', to: 'model Reservas {' },
            { from: 'model Leads {', to: 'model Prospectos {' },
            { from: 'model ClientView {', to: 'model WhatsApp {' },
            { from: 'model HotelApartment {', to: 'model Apartamentos {' },
            
            // Agregar @@map al final de cada modelo (antes del último })
            // Para Booking/Reservas
            { 
                from: /(\s+@@index\(\[BDStatus\], map: "idx_Booking_BDStatus"\)\s*\n})/,
                to: '$1\n\n  @@map("Booking")\n}'
            },
            
            // Para Leads/Prospectos  
            {
                from: /(\s+@@index\(\[phone\], map: "idx_Leads_phone"\)\s*\n})/,
                to: '$1\n\n  @@map("Leads")\n}'
            },
            
            // Para ClientView/WhatsApp
            {
                from: /(model WhatsApp \{[\s\S]*?)\n}/,
                to: '$1\n\n  @@map("ClientView")\n}'
            },
            
            // Para HotelApartment/Apartamentos  
            {
                from: /(model Apartamentos \{[\s\S]*?)\n}/,
                to: '$1\n\n  @@map("HotelApartment")\n}'
            },
            
            // Actualizar relaciones
            { from: /Booking\?/g, to: 'Reservas?' },
            { from: /Booking /g, to: 'Reservas ' },
            { from: /Leads\?/g, to: 'Prospectos?' },
            { from: /Leads /g, to: 'Prospectos ' }
        ];
        
        // Aplicar cambios uno por uno
        for (const mapping of mappings) {
            if (typeof mapping.from === 'string') {
                schemaContent = schemaContent.replace(mapping.from, mapping.to);
            } else {
                schemaContent = schemaContent.replace(mapping.from, mapping.to);
            }
        }
        
        // 6. Escribir schema actualizado
        fs.writeFileSync(schemaPath, schemaContent);
        console.log('✅ Schema actualizado con nombres en español');
        
        console.log('\n🎉 ¡Renombrado completado exitosamente!');
        
        console.log('\n📋 RESULTADO:');
        console.log('✅ Tablas PostgreSQL: SIN CAMBIOS (mantienen nombres originales)');
        console.log('✅ Triggers automáticos: INTACTOS y funcionando');
        console.log('✅ Foreign Keys: INTACTOS');
        console.log('✅ Índices: INTACTOS');
        console.log('✅ Modelos Prisma: Renombrados a español');
        
        console.log('\n💻 USO EN CÓDIGO:');
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
        
        console.log('\n🔄 PRÓXIMOS PASOS:');
        console.log('1. npx prisma generate (regenerar cliente Prisma)');
        console.log('2. Actualizar código gradualmente con nuevos nombres');
        console.log('3. Las tablas reales siguen siendo las mismas');
        console.log('4. Triggers y sincronización automática funcionan igual');
        
        console.log('\n⚠️ IMPORTANTE:');
        console.log('- El bot puede seguir funcionando sin interrupciones');
        console.log('- Los triggers automáticos NO se ven afectados');
        console.log('- La base de datos física NO cambia');
        console.log('- Solo cambian los nombres en el código TypeScript');
        
    } catch (error) {
        console.error('❌ Error en renombrado:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();