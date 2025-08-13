import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Extrayendo nombres REALES de habitaciones desde datos raw de reservas...');
        
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
        
        // Buscar todos los campos posibles que podrían contener nombres de habitaciones
        const roomNameFields = [
            'name', 'roomName', 'room_name', 'roomType', 'room_type',
            'unitName', 'unit_name', 'accommodationType', 'accommodation_type',
            'description', 'title', 'category', 'type'
        ];
        
        const foundRoomNames = new Map();
        
        bookings.forEach((booking, index) => {
            try {
                const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
                
                // Buscar en todos los campos posibles
                for (const field of roomNameFields) {
                    if (rawData[field] && typeof rawData[field] === 'string') {
                        const value = rawData[field].trim();
                        if (value && value !== '' && value.length > 1) {
                            const key = `${booking.propertyName}-${field}-${value}`;
                            
                            if (!foundRoomNames.has(key)) {
                                foundRoomNames.set(key, {
                                    propertyName: booking.propertyName,
                                    fieldName: field,
                                    roomName: value,
                                    count: 1,
                                    sampleRaw: rawData
                                });
                            } else {
                                foundRoomNames.get(key).count++;
                            }
                        }
                    }
                }
                
                // También buscar en arrays si existen
                if (Array.isArray(rawData.rooms)) {
                    rawData.rooms.forEach(room => {
                        for (const field of roomNameFields) {
                            if (room[field] && typeof room[field] === 'string') {
                                const value = room[field].trim();
                                if (value && value !== '' && value.length > 1) {
                                    const key = `${booking.propertyName}-rooms.${field}-${value}`;
                                    
                                    if (!foundRoomNames.has(key)) {
                                        foundRoomNames.set(key, {
                                            propertyName: booking.propertyName,
                                            fieldName: `rooms.${field}`,
                                            roomName: value,
                                            count: 1,
                                            sampleRaw: room
                                        });
                                    } else {
                                        foundRoomNames.get(key).count++;
                                    }
                                }
                            }
                        }
                    });
                }
                
                // Mostrar progreso cada 200 reservas
                if (index % 200 === 0) {
                    console.log(`📊 Procesadas ${index} reservas...`);
                }
                
            } catch (error) {
                // Continuar con la siguiente reserva
            }
        });
        
        console.log(`✅ Encontrados ${foundRoomNames.size} nombres de habitaciones únicos`);
        
        if (foundRoomNames.size === 0) {
            console.log('❌ No se encontraron nombres de habitaciones en los datos raw');
            
            // Mostrar estructura de algunos datos raw para debugging
            const sampleBookings = await prisma.booking.findMany({
                where: { raw: { not: null } },
                take: 3,
                select: { raw: true, propertyName: true }
            });
            
            console.log('\n📄 Muestra de estructura raw:');
            sampleBookings.forEach((booking, i) => {
                console.log(`\n--- Reserva ${i + 1} (${booking.propertyName}) ---`);
                try {
                    const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
                    console.log('Campos disponibles:', Object.keys(rawData));
                    
                    // Mostrar valores de campos que podrían contener nombres
                    roomNameFields.forEach(field => {
                        if (rawData[field]) {
                            console.log(`${field}:`, rawData[field]);
                        }
                    });
                } catch (error) {
                    console.log('Error parseando raw data');
                }
            });
            
            return;
        }
        
        // Agrupar por propiedad para análisis
        const byProperty = new Map();
        
        Array.from(foundRoomNames.values()).forEach(room => {
            if (!byProperty.has(room.propertyName)) {
                byProperty.set(room.propertyName, []);
            }
            byProperty.get(room.propertyName).push(room);
        });
        
        console.log('\n📊 Nombres de habitaciones encontrados por propiedad:');
        
        Array.from(byProperty.entries()).forEach(([propertyName, rooms]) => {
            console.log(`\n🏨 ${propertyName}:`);
            
            // Ordenar por frecuencia (más común primero)
            rooms.sort((a, b) => b.count - a.count);
            
            rooms.forEach(room => {
                console.log(`  - Campo "${room.fieldName}": "${room.roomName}" (${room.count} veces)`);
            });
        });
        
        // Intentar identificar los nombres más probables
        console.log('\n🎯 Análisis de nombres más probables:');
        
        Array.from(byProperty.entries()).forEach(([propertyName, rooms]) => {
            console.log(`\n🏨 ${propertyName}:`);
            
            // Buscar el campo "name" específicamente
            const nameFields = rooms.filter(r => r.fieldName === 'name' || r.fieldName === 'roomName');
            if (nameFields.length > 0) {
                console.log(`  ✅ Campo "name/roomName" encontrado:`);
                nameFields.forEach(room => {
                    console.log(`    - "${room.roomName}" (${room.count} veces)`);
                });
            } else {
                console.log(`  ⚠️ No se encontró campo "name", candidatos:`);
                rooms.slice(0, 3).forEach(room => {
                    console.log(`    - ${room.fieldName}: "${room.roomName}" (${room.count} veces)`);
                });
            }
        });
        
        console.log('\n🎉 Análisis completado');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);