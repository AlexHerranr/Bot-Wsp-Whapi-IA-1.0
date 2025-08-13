import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Analizando qué ve Prisma Studio vs Base de Datos real...');
        
        // 1. Lo que Prisma "conoce" (según schema.prisma)
        console.log('\n📋 Modelos en Prisma Schema:');
        console.log('- ClientView');
        console.log('- HotelApartment'); 
        console.log('- Booking');
        console.log('- Leads');
        console.log('Total: 4 modelos');
        
        // 2. Lo que realmente existe en la BD
        console.log('\n📊 Tablas/Views REALES en PostgreSQL:');
        
        const realTables = await prisma.$queryRawUnsafe(`
            SELECT 
                schemaname,
                tablename as name,
                'TABLE' as type
            FROM pg_tables 
            WHERE schemaname = 'public'
            
            UNION ALL
            
            SELECT 
                schemaname,
                viewname as name,
                'VIEW' as type
            FROM pg_views 
            WHERE schemaname = 'public'
            
            ORDER BY type, name;
        `);
        
        (realTables as any[]).forEach(table => {
            console.log(`- ${table.name} (${table.type})`);
        });
        
        console.log(`Total: ${(realTables as any[]).length} objetos`);
        
        // 3. Verificar acceso a BookingWithStatus
        console.log('\n🔍 Verificando acceso a BookingWithStatus:');
        
        try {
            // Prisma NO puede acceder a BookingWithStatus porque no está en el schema
            const testQuery = await prisma.$queryRawUnsafe(`
                SELECT COUNT(*) as count FROM "BookingWithStatus" LIMIT 1
            `);
            console.log(`✅ BookingWithStatus existe: ${(testQuery as any)[0].count} registros`);
            
            // Pero no podemos usar: prisma.bookingWithStatus.findMany()
            // Porque no está definido en schema.prisma
            
        } catch (error) {
            console.log('❌ BookingWithStatus no accesible');
        }
        
        // 4. Verificar qué tabla usa realmente Prisma para "Booking"
        console.log('\n📊 Datos de tabla Booking (que usa Prisma):');
        
        const bookingCount = await prisma.booking.count();
        console.log(`- Registros en tabla Booking: ${bookingCount}`);
        
        const sampleBooking = await prisma.booking.findFirst({
            select: {
                bookingId: true,
                propertyName: true,
                BDStatus: true,
                status: true
            }
        });
        
        console.log('- Muestra:', sampleBooking);
        
        // 5. Comparar con datos de BookingWithStatus
        console.log('\n🔍 Comparando datos:');
        
        const viewSample = await prisma.$queryRawUnsafe(`
            SELECT "bookingId", "propertyName", "BDStatus", status 
            FROM "BookingWithStatus" 
            WHERE "bookingId" = '${sampleBooking?.bookingId}'
        `);
        
        console.log('- Mismo registro en BookingWithStatus:', (viewSample as any)[0]);
        
        console.log('\n🎯 Conclusión:');
        console.log('Prisma Studio muestra solo lo que está en schema.prisma');
        console.log('BookingWithStatus existe en BD pero no está en el schema');
        console.log('Por eso ves "dos tablas" cuando accedes directamente a la BD');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);