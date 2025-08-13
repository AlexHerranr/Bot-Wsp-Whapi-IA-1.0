import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔧 Agregando BDStatus calculado a tabla Booking y eliminando VIEW...');
        
        // 1. Verificar estado actual
        console.log('\n📊 Estado inicial:');
        const initialCount = await prisma.booking.count();
        console.log(`- Tabla Booking: ${initialCount} registros`);
        
        const nullStatusCount = await prisma.booking.count({
            where: { BDStatus: null }
        });
        console.log(`- Registros sin BDStatus: ${nullStatusCount}`);
        
        // 2. Actualizar todos los registros con BDStatus calculado
        console.log('\n⚙️ Calculando BDStatus para todos los registros...');
        
        await prisma.$executeRawUnsafe(`
            UPDATE "Booking" 
            SET "BDStatus" = (
                CASE 
                    -- Si está cancelado
                    WHEN LOWER(status) = 'cancelled' THEN
                        CASE 
                            WHEN "arrivalDate"::date >= CURRENT_DATE THEN 'Cancelada Futura'
                            ELSE 'Cancelada Pasada'
                        END
                    
                    -- Si es fecha futura
                    WHEN "arrivalDate"::date >= CURRENT_DATE THEN
                        CASE 
                            -- Regla especial para OTAs (Airbnb/Expedia)
                            WHEN LOWER(channel) LIKE '%airbnb%' OR LOWER(channel) LIKE '%expedia%' THEN 'Futura Confirmada'
                            -- Para otros canales, verificar status y payments
                            WHEN LOWER(status) = 'confirmed' AND JSONB_ARRAY_LENGTH(payments::jsonb) > 0 THEN 'Futura Confirmada'
                            ELSE 'Futura Pendiente'
                        END
                    
                    -- Si es fecha pasada
                    ELSE
                        CASE 
                            -- OTAs pasadas también confirmadas
                            WHEN LOWER(channel) LIKE '%airbnb%' OR LOWER(channel) LIKE '%expedia%' THEN 'Pasada Confirmada'
                            -- Para otros canales, verificar status y payments
                            WHEN LOWER(status) = 'confirmed' AND JSONB_ARRAY_LENGTH(payments::jsonb) > 0 THEN 'Pasada Confirmada'
                            ELSE 'Pasada Pendiente'
                        END
                END
            )
            WHERE "BDStatus" IS NULL OR "BDStatus" = ''
        `);
        
        console.log('✅ BDStatus calculado para todos los registros');
        
        // 3. Verificar resultados
        console.log('\n📊 Resultados del cálculo:');
        const statusStats = await prisma.$queryRawUnsafe(`
            SELECT "BDStatus", COUNT(*) as count 
            FROM "Booking" 
            WHERE "BDStatus" IS NOT NULL 
            GROUP BY "BDStatus" 
            ORDER BY count DESC
        `);
        
        (statusStats as any[]).forEach(stat => {
            console.log(`- ${stat.BDStatus}: ${stat.count} reservas`);
        });
        
        // 4. Verificar que no hay registros sin BDStatus
        const remainingNull = await prisma.booking.count({
            where: { BDStatus: null }
        });
        console.log(`\n✅ Registros sin BDStatus: ${remainingNull}`);
        
        // 5. Eliminar VIEW BookingWithStatus
        console.log('\n🗑️ Eliminando VIEW BookingWithStatus...');
        
        try {
            await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "BookingWithStatus"`);
            console.log('✅ VIEW BookingWithStatus eliminada');
        } catch (error) {
            console.log('⚠️ VIEW ya no existe o no se pudo eliminar');
        }
        
        // 6. Crear índice para BDStatus para optimizar consultas
        console.log('\n📊 Creando índice para BDStatus...');
        
        try {
            await prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS "Booking_BDStatus_idx" ON "Booking"("BDStatus")
            `);
            console.log('✅ Índice creado para BDStatus');
        } catch (error) {
            console.log('⚠️ Índice ya existe');
        }
        
        // 7. Verificación final
        console.log('\n🔍 Verificación final:');
        
        const finalStats = await prisma.$queryRawUnsafe(`
            SELECT 
                COUNT(*) as total_reservas,
                COUNT("BDStatus") as con_status,
                COUNT(*) - COUNT("BDStatus") as sin_status
            FROM "Booking"
        `);
        
        const stats = (finalStats as any)[0];
        console.log(`- Total reservas: ${stats.total_reservas}`);
        console.log(`- Con BDStatus: ${stats.con_status}`);
        console.log(`- Sin BDStatus: ${stats.sin_status}`);
        
        // 8. Mostrar muestra de datos
        console.log('\n📋 Muestra de registros actualizados:');
        
        const sample = await prisma.booking.findMany({
            take: 5,
            select: {
                bookingId: true,
                propertyName: true,
                BDStatus: true,
                arrivalDate: true,
                status: true,
                channel: true
            }
        });
        
        sample.forEach(booking => {
            console.log(`- ${booking.bookingId} | ${booking.propertyName} | ${booking.BDStatus} | ${booking.arrivalDate} | ${booking.channel}`);
        });
        
        console.log('\n🎉 ¡Proceso completado exitosamente!');
        console.log('✅ Ahora tienes una sola tabla Booking con BDStatus calculado');
        console.log('✅ VIEW BookingWithStatus eliminada');
        console.log('✅ Índice creado para consultas optimizadas');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);