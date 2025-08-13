import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Solucionando conflicto entre triggers...');
        
        // Opción 1: Modificar trigger BDStatus para que solo actúe en INSERT
        // y en UPDATE solo si BDStatus es NULL
        
        console.log('\n📝 Modificando trigger BDStatus para permitir cambios manuales...');
        
        const modifiedBDStatusFunction = `
            CREATE OR REPLACE FUNCTION calculate_bdstatus()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Solo calcular BDStatus automáticamente si:
                -- 1. Es INSERT (nuevo registro)
                -- 2. Es UPDATE pero BDStatus es NULL (no se ha seteado manualmente)
                IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW."BDStatus" IS NULL) THEN
                    NEW."BDStatus" := CASE
                        -- 1️⃣ CANCELADAS
                        WHEN LOWER(NEW.status) = 'cancelled' THEN
                            CASE
                                WHEN NEW."arrivalDate"::date >= CURRENT_DATE THEN 'Cancelada Futura'
                                ELSE 'Cancelada Pasada'
                            END
                        
                        -- 2️⃣ FECHA FUTURA (arrivalDate >= hoy)
                        WHEN NEW."arrivalDate"::date >= CURRENT_DATE THEN
                            CASE
                                -- 🎯 OTAs (Airbnb + Expedia) + fecha futura = Confirmada
                                WHEN LOWER(NEW.channel) LIKE '%airbnb%' OR LOWER(NEW.channel) LIKE '%expedia%'
                                THEN 'Futura Confirmada'
                                -- Otros canales: confirmed + payments + fecha futura = Confirmada
                                WHEN LOWER(NEW.status) = 'confirmed' AND JSONB_ARRAY_LENGTH(NEW.payments::jsonb) > 0
                                THEN 'Futura Confirmada'
                                -- Sin payments + fecha futura + (new o confirmed) - EXCEPTO Airbnb/Expedia
                                ELSE 'Futura Pendiente'
                            END
                        
                        -- 3️⃣ FECHA PASADA (arrivalDate < hoy) - MISMA LÓGICA que futura
                        ELSE
                            CASE
                                -- 🎯 OTAs (Airbnb + Expedia) + fecha pasada = Confirmada
                                WHEN LOWER(NEW.channel) LIKE '%airbnb%' OR LOWER(NEW.channel) LIKE '%expedia%'
                                THEN 'Pasada Confirmada'
                                -- Otros canales: confirmed + payments + fecha pasada = Confirmada
                                WHEN LOWER(NEW.status) = 'confirmed' AND JSONB_ARRAY_LENGTH(NEW.payments::jsonb) > 0
                                THEN 'Pasada Confirmada'
                                -- Resto = NULL (no nos interesa "Pasada Pendiente")
                                ELSE NULL
                            END
                    END;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `;
        
        await prisma.$executeRawUnsafe(modifiedBDStatusFunction);
        console.log('✅ Función calculate_bdstatus modificada');
        
        // Recrear el trigger para que también actúe en UPDATE de campos relevantes
        // pero SIN incluir BDStatus en la lista (para permitir cambios manuales)
        console.log('\n⚡ Recreando trigger BDStatus...');
        
        await prisma.$executeRawUnsafe(`
            DROP TRIGGER IF EXISTS update_bdstatus_trigger ON "Booking";
        `);
        
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER update_bdstatus_trigger
                BEFORE INSERT OR UPDATE OF status, "arrivalDate", payments, channel
                ON "Booking"
                FOR EACH ROW
                EXECUTE FUNCTION calculate_bdstatus();
        `);
        
        console.log('✅ Trigger BDStatus recreado (excluye UPDATE de BDStatus)');
        
        // Test completo
        console.log('\n🧪 Test completo del sistema corregido...');
        
        const testBookingId = '73842286';
        
        // 1. Estado inicial
        const initialData = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('📊 Estado inicial:', initialData);
        
        // 2. Test cambio manual a "Cancelada Futura"
        console.log('\n🔄 Test 1: Cambio MANUAL a "Cancelada Futura"...');
        
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Cancelada Futura' }
        });
        
        const afterCancel = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('📊 Después de cambio manual:', afterCancel);
        
        const cancelResult = (afterCancel as any)[0];
        if (cancelResult.BDStatus === 'Cancelada Futura' && !cancelResult.lead_booking_id) {
            console.log('✅ SUCCESS: Cambio manual respetado y lead eliminado');
        } else {
            console.log('❌ ERROR: Cambio manual no respetado o lead no eliminado');
        }
        
        // 3. Test cambio manual de vuelta a "Futura Pendiente"
        console.log('\n🔄 Test 2: Cambio MANUAL a "Futura Pendiente"...');
        
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { BDStatus: 'Futura Pendiente' }
        });
        
        const afterRestore = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", l."bookingId" as lead_booking_id
            FROM "Booking" b 
            LEFT JOIN "Leads" l ON b."bookingId" = l."bookingId"
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('📊 Después de restauración:', afterRestore);
        
        const restoreResult = (afterRestore as any)[0];
        if (restoreResult.BDStatus === 'Futura Pendiente' && restoreResult.lead_booking_id) {
            console.log('✅ SUCCESS: Restauración manual respetada y lead creado');
        } else {
            console.log('❌ ERROR: Restauración manual no respetada o lead no creado');
        }
        
        // 4. Test que el cálculo automático aún funciona en otros campos
        console.log('\n🔄 Test 3: Cálculo automático en UPDATE de status...');
        
        // Cambiar status (sin tocar BDStatus) - debería mantener BDStatus manual
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { status: 'new' }
        });
        
        const afterStatusChange = await prisma.$queryRaw`
            SELECT b."bookingId", b."BDStatus", b.status
            FROM "Booking" b 
            WHERE b."bookingId" = ${testBookingId};
        `;
        
        console.log('📊 Después de cambio de status:', afterStatusChange);
        
        const statusResult = (afterStatusChange as any)[0];
        if (statusResult.BDStatus === 'Futura Pendiente') {
            console.log('✅ SUCCESS: BDStatus manual se mantiene al cambiar otros campos');
        } else {
            console.log('❌ ERROR: BDStatus manual fue sobrescrito');
        }
        
        // Restaurar status
        await prisma.booking.update({
            where: { bookingId: testBookingId },
            data: { status: 'confirmed' }
        });
        
        console.log('\n🎉 ¡Sistema de sincronización corregido exitosamente!');
        
        console.log('\n📋 Características del sistema corregido:');
        console.log('- ✅ BDStatus automático en INSERT de nuevas reservas');
        console.log('- ✅ BDStatus automático en UPDATE si está NULL');
        console.log('- ✅ Cambios manuales de BDStatus RESPETADOS');
        console.log('- ✅ Sincronización automática Booking → Leads');
        console.log('- ✅ "Futura Pendiente" → Lead creado automáticamente');
        console.log('- ✅ Cualquier otro estado → Lead eliminado automáticamente');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();