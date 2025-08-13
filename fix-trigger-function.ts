import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Corrigiendo función de trigger...');
        
        // 1. Ver función actual
        const currentFunction = await prisma.$queryRaw`
            SELECT pg_get_functiondef(oid) as definition
            FROM pg_proc 
            WHERE proname = 'booking_sync_leads';
        `;
        
        console.log('📋 Función actual:');
        console.log((currentFunction as any)[0]?.definition);
        
        // 2. Corregir función - mejor lógica
        const fixedFunction = `
            CREATE OR REPLACE FUNCTION public.booking_sync_leads()
            RETURNS TRIGGER
            LANGUAGE plpgsql
            AS $$
            BEGIN
              -- Debug log
              RAISE NOTICE 'Trigger ejecutado: TG_OP=%, NEW.BDStatus=%', TG_OP, 
                           CASE WHEN TG_OP = 'DELETE' THEN OLD."BDStatus" ELSE NEW."BDStatus" END;
              
              IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE') THEN
                -- Si el nuevo estado es "Futura Pendiente": crear/actualizar lead
                IF NEW."BDStatus" = 'Futura Pendiente' THEN
                  INSERT INTO "Leads" (
                    "bookingId", "phone", "guestName", "propertyName",
                    "arrivalDate", "departureDate", "totalPersons",
                    "source", "channel", "lastUpdated", "leadType"
                  )
                  VALUES (
                    NEW."bookingId",
                    COALESCE(NEW."phone",'N/A'),
                    NEW."guestName",
                    NEW."propertyName",
                    NEW."arrivalDate",
                    NEW."departureDate",
                    NEW."totalPersons",
                    'beds24',
                    NEW."channel",
                    NEW."lastUpdatedBD",
                    'reserva_pendiente'
                  )
                  ON CONFLICT ("bookingId") DO UPDATE SET
                    "phone"        = COALESCE(EXCLUDED."phone",'N/A'),
                    "guestName"    = EXCLUDED."guestName",
                    "propertyName" = EXCLUDED."propertyName",
                    "arrivalDate"  = EXCLUDED."arrivalDate",
                    "departureDate"= EXCLUDED."departureDate",
                    "totalPersons" = EXCLUDED."totalPersons",
                    "channel"      = EXCLUDED."channel",
                    "lastUpdated"  = EXCLUDED."lastUpdated";
                  
                  RAISE NOTICE 'Lead UPSERTADO para booking %', NEW."bookingId";
                ELSE
                  -- Cualquier otro estado: eliminar de leads
                  DELETE FROM "Leads" WHERE "bookingId" = NEW."bookingId";
                  RAISE NOTICE 'Lead ELIMINADO para booking % (estado: %)', NEW."bookingId", NEW."BDStatus";
                END IF;
                
                RETURN NEW;
              ELSIF (TG_OP = 'DELETE') THEN
                DELETE FROM "Leads" WHERE "bookingId" = OLD."bookingId";
                RAISE NOTICE 'Lead ELIMINADO para booking % (DELETE)', OLD."bookingId";
                RETURN OLD;
              END IF;
              
              RETURN NULL;
            END $$;
        `;
        
        await prisma.$executeRawUnsafe(fixedFunction);
        console.log('✅ Función corregida con debug logs');
        
        // 3. Test inmediato
        console.log('\n🧪 Test inmediato...');
        
        const testBookingId = '73842286';
        
        // Verificar estado inicial
        const initialBooking = await prisma.booking.findUnique({
            where: { bookingId: testBookingId },
            select: { BDStatus: true }
        });
        
        const initialLead = await prisma.leads.findFirst({
            where: { bookingId: testBookingId }
        });
        
        console.log(`📊 Estado inicial: Booking=${initialBooking?.BDStatus}, Lead=${initialLead ? 'Existe' : 'No existe'}`);
        
        // Test 1: Cambiar a "Cancelada Futura"
        console.log('\n🔄 Cambiando a "Cancelada Futura"...');
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Cancelada Futura' }
        });
        
        const leadAfterCancel = await prisma.leads.findFirst({
            where: { bookingId: testBookingId }
        });
        
        console.log(`📊 Después de cancelar: Lead=${leadAfterCancel ? '❌ EXISTE (ERROR)' : '✅ NO EXISTE (CORRECTO)'}`);
        
        // Test 2: Cambiar de vuelta a "Futura Pendiente"
        console.log('\n🔄 Cambiando de vuelta a "Futura Pendiente"...');
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Futura Pendiente' }
        });
        
        const leadAfterRestore = await prisma.leads.findFirst({
            where: { bookingId: testBookingId }
        });
        
        console.log(`📊 Después de restaurar: Lead=${leadAfterRestore ? '✅ EXISTE (CORRECTO)' : '❌ NO EXISTE (ERROR)'}`);
        
        console.log('\n✅ Test de corrección completado');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();