import { PrismaClient } from '@prisma/client';
import { getBeds24Config } from './src/config/integrations/beds24.config';
import { getBeds24Service } from './src/plugins/hotel/services/beds24/beds24.service';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Verificando que los PropertyIds sean REALES de Beds24...');
        
        // 1. Verificar PropertyIds desde API de Beds24
        console.log('\n📡 Consultando propiedades desde API Beds24...');
        const config = getBeds24Config();
        const beds24Service = getBeds24Service(config);
        
        const apiProperties = await beds24Service.getProperties();
        console.log(`✅ API Beds24 devolvió ${apiProperties.length} propiedades:`);
        
        apiProperties.forEach(prop => {
            console.log(`- PropertyId: ${prop.id} | Nombre: "${prop.name}"`);
        });
        
        // 2. Verificar PropertyIds desde reservas
        console.log('\n📊 Verificando PropertyIds desde reservas...');
        
        const bookings = await prisma.booking.findMany({
            where: {
                raw: { not: null }
            },
            select: {
                propertyName: true,
                raw: true
            },
            take: 50 // Solo una muestra
        });
        
        const propertyIdsFromBookings = new Map();
        
        bookings.forEach(booking => {
            try {
                const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
                
                if (rawData.propertyId && booking.propertyName) {
                    const key = booking.propertyName.trim();
                    
                    if (!propertyIdsFromBookings.has(key)) {
                        propertyIdsFromBookings.set(key, new Set());
                    }
                    
                    propertyIdsFromBookings.get(key).add(rawData.propertyId);
                }
            } catch (error) {
                // Continuar
            }
        });
        
        console.log('✅ PropertyIds encontrados en reservas:');
        Array.from(propertyIdsFromBookings.entries()).forEach(([propName, ids]) => {
            console.log(`- ${propName}: [${Array.from(ids).join(', ')}]`);
        });
        
        // 3. Verificar nuestra tabla actual
        console.log('\n🏨 PropertyIds en nuestra tabla actual:');
        
        const ourTable = await prisma.hotelApartment.findMany({
            orderBy: { propertyId: 'asc' }
        });
        
        ourTable.forEach(apt => {
            console.log(`- PropertyId: ${apt.propertyId} | RoomId: ${apt.roomId} | "${apt.roomName}"`);
        });
        
        // 4. Validación cruzada
        console.log('\n✅ Validación cruzada:');
        
        const apiPropertyIds = new Set(apiProperties.map(p => p.id));
        const ourPropertyIds = new Set(ourTable.map(t => t.propertyId));
        
        console.log('\n📋 Comparación:');
        console.log(`- PropertyIds de API Beds24: [${Array.from(apiPropertyIds).sort().join(', ')}]`);
        console.log(`- PropertyIds en nuestra tabla: [${Array.from(ourPropertyIds).sort().join(', ')}]`);
        
        const allMatch = Array.from(ourPropertyIds).every(id => apiPropertyIds.has(id));
        console.log(`\n🎯 ¿Todos nuestros PropertyIds existen en Beds24? ${allMatch ? '✅ SÍ' : '❌ NO'}`);
        
        // 5. Validar con nombres de propiedades
        console.log('\n🔗 Validación por nombres:');
        
        const apiPropertyNames = new Map();
        apiProperties.forEach(prop => {
            apiPropertyNames.set(prop.id, prop.name);
        });
        
        ourTable.forEach(apt => {
            const apiName = apiPropertyNames.get(apt.propertyId);
            const ourName = apt.roomName.replace('Apartamento 1 Alcoba ', '').replace('Aparta Estudio ', '');
            
            console.log(`- PropertyId ${apt.propertyId}:`);
            console.log(`  API Beds24: "${apiName}"`);
            console.log(`  Nuestra tabla: "${ourName}"`);
            console.log(`  ✅ Coincide: ${apiName?.trim() === ourName?.trim() ? 'SÍ' : 'NO'}`);
        });
        
        console.log('\n🎉 Verificación completada');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);