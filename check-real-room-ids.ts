import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Verificando roomIds REALES desde reservas de Beds24...');
        
        // Obtener todas las reservas con datos raw
        const bookings = await prisma.booking.findMany({
            where: {
                raw: { not: null }
            },
            select: {
                propertyName: true,
                raw: true
            }
        });
        
        console.log(`📋 Analizando ${bookings.length} reservas...`);
        
        // Extraer roomIds y unitIds reales por propiedad
        const realRoomData = new Map();
        
        bookings.forEach((booking) => {
            try {
                const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
                
                if (rawData.roomId && booking.propertyName) {
                    const key = booking.propertyName.trim();
                    
                    if (!realRoomData.has(key)) {
                        realRoomData.set(key, {
                            propertyName: key,
                            roomIds: new Set(),
                            unitIds: new Set(),
                            samples: []
                        });
                    }
                    
                    const data = realRoomData.get(key);
                    data.roomIds.add(rawData.roomId);
                    
                    if (rawData.unitId) {
                        data.unitIds.add(rawData.unitId);
                    }
                    
                    // Guardar algunas muestras para análisis
                    if (data.samples.length < 3) {
                        data.samples.push({
                            roomId: rawData.roomId,
                            unitId: rawData.unitId,
                            propertyId: rawData.propertyId
                        });
                    }
                }
            } catch (error) {
                // Continuar con la siguiente reserva
            }
        });
        
        console.log('\n📊 RoomIds REALES encontrados por propiedad:');
        
        Array.from(realRoomData.entries()).forEach(([propertyName, data]) => {
            console.log(`\n🏨 ${propertyName}:`);
            console.log(`  - RoomIds: [${Array.from(data.roomIds).join(', ')}]`);
            console.log(`  - UnitIds: [${Array.from(data.unitIds).join(', ')}]`);
            
            console.log(`  - Muestras:`);
            data.samples.forEach((sample, i) => {
                console.log(`    ${i + 1}. PropertyId: ${sample.propertyId}, RoomId: ${sample.roomId}, UnitId: ${sample.unitId}`);
            });
        });
        
        // Comparar con lo que tenemos en la tabla actual
        console.log('\n🔍 Comparación con tabla actual:');
        
        const currentApartments = await prisma.hotelApartment.findMany({
            orderBy: { propertyId: 'asc' }
        });
        
        console.log('\n📋 Tabla actual vs RoomIds reales:');
        
        currentApartments.forEach(apt => {
            // Buscar el nombre de propiedad correspondiente
            let propertyName = '';
            const propertyMapping = {
                173207: '2005 A',
                173311: '2005 B', 
                173307: '1820',
                173308: '1317',
                173309: '1722B',
                173312: '1722 A',
                240061: '0715'
            };
            
            propertyName = propertyMapping[apt.propertyId] || 'Unknown';
            
            const realData = realRoomData.get(propertyName);
            const realRoomIds = realData ? Array.from(realData.roomIds) : [];
            const realUnitIds = realData ? Array.from(realData.unitIds) : [];
            
            console.log(`\n- ${propertyName} (PropertyId: ${apt.propertyId}):`);
            console.log(`  Actual RoomId en tabla: ${apt.roomId}`);
            console.log(`  RoomIds reales en reservas: [${realRoomIds.join(', ')}]`);
            console.log(`  UnitIds reales en reservas: [${realUnitIds.join(', ')}]`);
            
            const isCorrect = realRoomIds.includes(apt.roomId) || realUnitIds.includes(apt.roomId);
            console.log(`  ✅ Correcto: ${isCorrect ? 'SÍ' : 'NO'}`);
        });
        
        console.log('\n🎯 Recomendación: Usar los RoomIds o UnitIds REALES de las reservas');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);