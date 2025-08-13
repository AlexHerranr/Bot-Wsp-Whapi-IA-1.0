import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Verificando tablas reales en la base de datos...');
        
        // Verificar qué tablas existen realmente
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        
        console.log('📋 Tablas existentes en PostgreSQL:');
        console.table(tables);
        
        // Verificar registros en cada tabla existente
        const tableNames = (tables as any).map((t: any) => t.table_name);
        
        console.log('\n📊 Conteo de registros por tabla:');
        
        for (const tableName of tableNames) {
            try {
                const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}";`);
                const tableCount = (count as any)[0].count;
                console.log(`📋 ${tableName}: ${tableCount} registros`);
            } catch (e) {
                console.log(`⚠️ ${tableName}: Error accediendo (${(e as Error).message.substring(0, 50)}...)`);
            }
        }
        
        // Verificar estructura del schema.prisma actual
        console.log('\n📄 Verificando modelos en schema.prisma...');
        
        const fs = require('fs');
        const schemaPath = 'C:\\Users\\alex-\\Bot-Wsp-Whapi-IA\\prisma\\schema.prisma';
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        const modelMatches = schemaContent.match(/model\s+(\w+)\s*\{/g);
        const models = modelMatches ? modelMatches.map((m: string) => m.match(/model\s+(\w+)/)?.[1]).filter(Boolean) : [];
        
        console.log('📋 Modelos en schema.prisma:', models);
        
        // Preparar plan de renombrado basado en tablas reales
        console.log('\n🎯 PLAN DE RENOMBRADO AJUSTADO:');
        console.log('┌─────────────────┬─────────────────┬─────────────────┐');
        console.log('│ Tabla Real      │ Modelo Actual   │ Nuevo Nombre    │');
        console.log('├─────────────────┼─────────────────┼─────────────────┤');
        
        if (tableNames.includes('Booking')) {
            console.log('│ Booking         │ Booking         │ Reservas        │');
        }
        if (tableNames.includes('Leads')) {
            console.log('│ Leads           │ Leads           │ Prospectos      │');
        }
        if (tableNames.includes('ClientView')) {
            console.log('│ ClientView      │ ClientView      │ WhatsApp        │');
        }
        if (tableNames.includes('HotelApartment')) {
            console.log('│ HotelApartment  │ HotelApartment  │ Apartamentos    │');
        }
        
        console.log('└─────────────────┴─────────────────┴─────────────────┘');
        
        console.log('\n✅ Verificación completada');
        console.log('🔄 Ahora podemos proceder con el renombrado seguro solo de las tablas que existen');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();