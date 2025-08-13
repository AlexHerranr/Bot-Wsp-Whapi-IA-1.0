import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Analizando tablas de Booking en la base de datos...');
        
        // Verificar qué tablas existen
        const tablesQuery = `
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%booking%' OR table_name LIKE '%Booking%')
            ORDER BY table_name;
        `;
        
        const tables = await prisma.$queryRawUnsafe(tablesQuery);
        
        console.log('\n📊 Tablas relacionadas con Booking:');
        tables.forEach((table: any) => {
            console.log(`- ${table.table_name} (${table.table_type})`);
        });
        
        // Verificar si BookingWithStatus existe
        try {
            const bookingWithStatusCount = await prisma.$queryRawUnsafe(`
                SELECT COUNT(*) as count FROM "BookingWithStatus" LIMIT 1;
            `);
            
            console.log('\n✅ BookingWithStatus existe y tiene datos');
            
            // Obtener muestra de BookingWithStatus
            const sampleWithStatus = await prisma.$queryRawUnsafe(`
                SELECT "bookingId", "propertyName", "BDStatus", "arrivalDate", "status"
                FROM "BookingWithStatus" 
                LIMIT 5;
            `);
            
            console.log('\n📋 Muestra de BookingWithStatus:');
            sampleWithStatus.forEach((booking: any) => {
                console.log(`- ${booking.bookingId} | ${booking.propertyName} | ${booking.BDStatus} | ${booking.arrivalDate}`);
            });
            
        } catch (error) {
            console.log('\n❌ BookingWithStatus no existe o no es accesible');
        }
        
        // Verificar tabla Booking normal
        const bookingCount = await prisma.booking.count();
        console.log(`\n📊 Tabla Booking: ${bookingCount} registros`);
        
        // Obtener muestra de Booking
        const sampleBooking = await prisma.booking.findMany({
            take: 5,
            select: {
                bookingId: true,
                propertyName: true,
                BDStatus: true,
                arrivalDate: true,
                status: true
            }
        });
        
        console.log('\n📋 Muestra de Booking:');
        sampleBooking.forEach(booking => {
            console.log(`- ${booking.bookingId} | ${booking.propertyName} | ${booking.BDStatus} | ${booking.arrivalDate}`);
        });
        
        // Verificar diferencias en BDStatus
        console.log('\n🔍 Comparando BDStatus...');
        
        try {
            const statusComparison = await prisma.$queryRawUnsafe(`
                SELECT 
                    b."bookingId",
                    b."BDStatus" as booking_status,
                    bws."BDStatus" as view_status
                FROM "Booking" b
                LEFT JOIN "BookingWithStatus" bws ON b."bookingId" = bws."bookingId"
                WHERE b."BDStatus" != bws."BDStatus" OR b."BDStatus" IS NULL
                LIMIT 10;
            `);
            
            if (statusComparison.length > 0) {
                console.log('\n⚠️ Diferencias encontradas entre Booking y BookingWithStatus:');
                statusComparison.forEach((diff: any) => {
                    console.log(`- ${diff.bookingId}: Booking="${diff.booking_status}" vs View="${diff.view_status}"`);
                });
            } else {
                console.log('\n✅ No hay diferencias en BDStatus entre ambas');
            }
            
        } catch (error) {
            console.log('\n❌ No se pudo comparar (BookingWithStatus probablemente no existe)');
        }
        
        console.log('\n🎯 Recomendación:');
        console.log('Si BookingWithStatus es una VIEW con BDStatus automático,');
        console.log('entonces SÍ se debería eliminar la tabla Booking y renombrar la VIEW.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);