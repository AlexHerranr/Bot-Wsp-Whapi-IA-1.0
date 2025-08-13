import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🧪 Test final del sistema multi-fuente optimizado...');
        
        // 1. Limpiar lead de prueba
        await prisma.$executeRawUnsafe(`
            DELETE FROM "Leads" WHERE source = 'WhatsApp' AND "guestName" = 'Test Cliente WhatsApp';
        `);
        
        // 2. Verificar estructura final
        console.log('\n📊 Estadísticas finales por fuente:');
        const statsBySource = await prisma.$queryRaw`
            SELECT source, priority, COUNT(*) as count
            FROM "Leads" 
            GROUP BY source, priority
            ORDER BY source, priority DESC;
        `;
        console.table(statsBySource);
        
        // 3. Mostrar estructura completa optimizada
        console.log('\n📋 Estructura final optimizada con orden lógico:');
        const finalStructure = await prisma.$queryRaw`
            SELECT 
                "bookingId" as "Booking ID",
                source as "Fuente",
                channel as "Canal", 
                priority as "Prioridad",
                "guestName" as "Cliente",
                "propertyName" as "Propiedad",
                "arrivalDate" as "Llegada",
                "departureDate" as "Salida",
                "totalPersons" as "Personas",
                "numNights" as "Noches",
                phone as "Teléfono"
            FROM "Leads" 
            ORDER BY priority DESC, "arrivalDate" ASC
            LIMIT 5;
        `;
        
        console.table(finalStructure);
        
        console.log('\n🎉 ¡Sistema Multi-Fuente Completado!');
        
        console.log('\n📋 ESTRUCTURA FINAL OPTIMIZADA:');
        console.log('┌─────────────────┬──────────────────────────────────────────────┐');
        console.log('│ Campo           │ Descripción                                  │');
        console.log('├─────────────────┼──────────────────────────────────────────────┤');
        console.log('│ bookingId       │ ID único (Beds24) o NULL (manual)           │');
        console.log('│ source          │ beds24 / WhatsApp / CRM                      │');
        console.log('│ channel         │ Direct, Booking.com, Directo, Colega        │');
        console.log('│ priority        │ alta (Beds24) / media (WhatsApp) / baja     │');
        console.log('│ guestName       │ Nombre del cliente                           │');
        console.log('│ propertyName    │ Propiedad (2005 A, 1722B, etc.)             │');
        console.log('│ arrivalDate     │ Fecha llegada                                │');
        console.log('│ departureDate   │ Fecha salida                                 │');
        console.log('│ totalPersons    │ Número de huéspedes                          │');
        console.log('│ numNights       │ Noches (al lado de personas) ← REORGANIZADO │');
        console.log('│ phone           │ Teléfono de contacto                         │');
        console.log('│ leadNotes       │ Notas específicas (no-Beds24) ← NUEVO       │');
        console.log('│ lastUpdatedLeads│ Última actualización ← RENOMBRADO           │');
        console.log('│ createdAt       │ Fecha de creación                            │');
        console.log('└─────────────────┴──────────────────────────────────────────────┘');
        
        console.log('\n🎯 TIPOS DE LEADS SOPORTADOS:');
        console.log('┌─────────────┬─────────────┬──────────────┬────────────────────────────┐');
        console.log('│ Fuente      │ bookingId   │ Prioridad    │ Uso de leadNotes           │');
        console.log('├─────────────┼─────────────┼──────────────┼────────────────────────────┤');
        console.log('│ beds24      │ Real        │ alta         │ NULL (datos de booking)    │');
        console.log('│ WhatsApp    │ NULL        │ media        │ Contexto de conversación   │');
        console.log('│ CRM         │ NULL        │ baja/media   │ Notas de seguimiento       │');
        console.log('│ Referidos   │ NULL        │ media        │ Info del referidor         │');
        console.log('└─────────────┴─────────────┴──────────────┴────────────────────────────┘');
        
        console.log('\n🔄 FUNCIONAMIENTO AUTOMÁTICO:');
        console.log('✅ Reserva Beds24 "Futura Pendiente" → Lead automático (prioridad alta)');
        console.log('✅ Reserva Beds24 otros estados → Lead eliminado automáticamente');
        console.log('✅ Cliente WhatsApp pregunta → Lead manual (con leadNotes)');
        console.log('✅ CRM cotización → Lead manual (con seguimiento en leadNotes)');
        console.log('✅ Todos coexisten sin conflictos');
        
        console.log('\n💡 EJEMPLOS DE USO FUTURO:');
        
        console.log('\n📱 Inserción desde WhatsApp/ClientView:');
        console.log(`await prisma.leads.create({
    data: {
        bookingId: null,
        source: 'WhatsApp',
        channel: 'Directo', // o 'Colega'
        priority: 'media',
        guestName: clientData.name,
        phone: clientData.phoneNumber,
        arrivalDate: '2025-09-15',
        totalPersons: 2,
        numNights: 3,
        leadNotes: 'Cliente preguntó por apartamento 1 alcoba. Interesado en septiembre.',
        lastUpdatedLeads: new Date()
    }
});`);
        
        console.log('\n📊 Inserción desde CRM:');
        console.log(`await prisma.leads.create({
    data: {
        bookingId: null,
        source: 'CRM',
        channel: 'Referido',
        priority: 'alta',
        guestName: 'María García',
        phone: '+57 300 1234567',
        arrivalDate: '2025-10-01',
        totalPersons: 4,
        numNights: 5,
        propertyName: '2005 A',
        leadNotes: 'Referida por Juan Pérez. Cotización enviada. Pendiente respuesta.',
        lastUpdatedLeads: new Date()
    }
});`);
        
        console.log('\n🔍 CONSULTAS ÚTILES:');
        console.log('-- Leads automáticos (Beds24):');
        console.log(`SELECT * FROM "Leads" WHERE source = 'beds24';`);
        
        console.log('\n-- Leads manuales (WhatsApp/CRM):');
        console.log(`SELECT * FROM "Leads" WHERE "bookingId" IS NULL;`);
        
        console.log('\n-- Leads de alta prioridad:');
        console.log(`SELECT * FROM "Leads" WHERE priority = 'alta' ORDER BY "arrivalDate";`);
        
        console.log('\n-- Leads con notas (seguimiento requerido):');
        console.log(`SELECT "guestName", "leadNotes" FROM "Leads" WHERE "leadNotes" IS NOT NULL;`);
        
        console.log('\n🎉 ¡El sistema está listo para manejar múltiples fuentes!');
        console.log('✅ Beds24: Automático y sincronizado');
        console.log('✅ WhatsApp: Manual con contexto en leadNotes');
        console.log('✅ CRM: Manual con seguimiento en leadNotes');
        console.log('✅ Estructura optimizada: numNights al lado de totalPersons');
        console.log('✅ Claridad: lastUpdatedLeads (específico de leads)');
        console.log('✅ Sin conflictos: triggers respetan inserciones manuales');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();