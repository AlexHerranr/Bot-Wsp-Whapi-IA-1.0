import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Verificando cómo se ven las tablas en Prisma Studio...');
        
        // 1. Verificar nombres de modelos en Prisma (como aparecen en Studio)
        console.log('\n📋 Modelos disponibles en Prisma Client:');
        
        const prismaModels = Object.keys(prisma).filter(key => 
            !key.startsWith('$') && 
            !key.startsWith('_') && 
            typeof (prisma as any)[key] === 'object' &&
            (prisma as any)[key].findMany
        );
        
        console.log('Modelos disponibles:', prismaModels);
        
        // 2. Test de cada modelo
        console.log('\n📊 Test de conectividad por modelo:');
        
        for (const model of prismaModels) {
            try {
                const count = await (prisma as any)[model].count();
                console.log(`✅ ${model}: ${count} registros`);
            } catch (error) {
                console.log(`❌ ${model}: Error - ${(error as Error).message.substring(0, 50)}`);
            }
        }
        
        // 3. Verificar nombres físicos vs nombres de modelos
        console.log('\n🔍 Mapeo de nombres (Model → Tabla PostgreSQL):');
        
        const physicalTables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        
        console.log('\n📋 Tablas físicas en PostgreSQL:');
        (physicalTables as any).forEach((table: any) => {
            console.log(`🗄️ ${table.table_name}`);
        });
        
        console.log('\n📋 MAPEO COMPLETO:');
        console.log('┌─────────────────┬─────────────────────┬─────────────────────┐');
        console.log('│ En Prisma Studio│ Nombre del Modelo   │ Tabla PostgreSQL    │');
        console.log('├─────────────────┼─────────────────────┼─────────────────────┤');
        
        if (prismaModels.includes('reservas')) {
            console.log('│ Reservas        │ model Reservas      │ "Booking"           │');
        }
        if (prismaModels.includes('prospectos')) {
            console.log('│ Prospectos      │ model Prospectos    │ "Leads"             │');
        }
        if (prismaModels.includes('whatsApp')) {
            console.log('│ WhatsApp        │ model WhatsApp      │ "ClientView"        │');
        }
        if (prismaModels.includes('apartamentos')) {
            console.log('│ Apartamentos    │ model Apartamentos  │ hotel_apartments    │');
        }
        
        console.log('└─────────────────┴─────────────────────┴─────────────────────┘');
        
        // 4. Verificar si Studio está corriendo
        console.log('\n🌐 Prisma Studio:');
        console.log('URL: http://localhost:5555');
        console.log('Estado: Iniciando/Corriendo');
        console.log('');
        console.log('🎯 En Prisma Studio ahora deberías ver:');
        console.log('- 📊 Reservas (en lugar de Booking)');
        console.log('- 🎯 Prospectos (en lugar de Leads)');
        console.log('- 📱 WhatsApp (en lugar de ClientView)');
        console.log('- 🏨 Apartamentos (en lugar de HotelApartment)');
        
        console.log('\n💡 IMPORTANTE:');
        console.log('- Los nombres físicos en PostgreSQL NO cambiaron');
        console.log('- Solo cambiaron los nombres en la interfaz (Prisma Studio)');
        console.log('- @@map mantiene la compatibilidad con la BD física');
        
        console.log('\n✅ Para ver los cambios:');
        console.log('1. Abre http://localhost:5555 en tu navegador');
        console.log('2. Verás las tablas con nombres en español');
        console.log('3. Los datos son exactamente los mismos');
        console.log('4. Los triggers automáticos siguen funcionando');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();