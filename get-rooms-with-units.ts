import { getBeds24Config } from './src/config/integrations/beds24.config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🏨 Obteniendo habitaciones y unidades reales desde Beds24 API...');
        
        const config = getBeds24Config();
        
        // Crear cliente HTTP directo
        const apiClient = axios.create({
            baseURL: config.apiUrl,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'token': config.apiToken
            }
        });

        // Primero obtener propiedades para usar sus IDs
        console.log('📋 Obteniendo propiedades...');
        const propertiesResponse = await apiClient.get('/properties');
        const properties = propertiesResponse.data.data || [];
        console.log(`✅ Encontradas ${properties.length} propiedades`);

        // Ahora usar el endpoint correcto con parámetros específicos
        console.log('\n🔍 Obteniendo habitaciones con unidades...');
        
        try {
            const response = await apiClient.get('/properties/rooms', {
                params: {
                    includeUnitDetails: true,  // Para obtener nombres de unidades
                    includeTexts: ['all'],     // Para obtener descripciones
                    propertyId: properties.map(p => p.id) // Todas las propiedades
                }
            });

            if (response.data.success === false) {
                throw new Error(`API Error: ${response.data.error || 'Unknown error'}`);
            }

            const rooms = response.data.data || [];
            console.log(`✅ Encontradas ${rooms.length} habitaciones`);

            if (rooms.length === 0) {
                console.log('⚠️ No se encontraron habitaciones. Probando sin filtros...');
                
                const responseAll = await apiClient.get('/properties/rooms', {
                    params: {
                        includeUnitDetails: true
                    }
                });
                
                const allRooms = responseAll.data.data || [];
                console.log(`✅ Sin filtros: ${allRooms.length} habitaciones`);
                
                if (allRooms.length > 0) {
                    rooms.push(...allRooms);
                }
            }

            if (rooms.length > 0) {
                console.log('\n📊 Análisis de habitaciones encontradas:');
                
                // Mostrar estructura de una habitación de ejemplo
                const sampleRoom = rooms[0];
                console.log('\n📋 Estructura de habitación de ejemplo:');
                console.log('- ID:', sampleRoom.id);
                console.log('- Property ID:', sampleRoom.propertyId);
                console.log('- Name:', sampleRoom.name);
                console.log('- Room Type:', sampleRoom.roomType);
                console.log('- Max People:', sampleRoom.maxPeople);
                console.log('- Units:', sampleRoom.units?.length || 0);
                
                if (sampleRoom.units && sampleRoom.units.length > 0) {
                    console.log('\n🏠 Unidades de ejemplo:');
                    sampleRoom.units.slice(0, 3).forEach((unit, i) => {
                        console.log(`  ${i + 1}. ID: ${unit.id}, Name: "${unit.name}"`);
                    });
                }

                // Función para determinar capacidad
                function getCapacity(roomName: string, roomType?: string, maxPeople?: number): number {
                    // Priorizar maxPeople si está disponible y es razonable
                    if (maxPeople && maxPeople > 0 && maxPeople <= 12) {
                        return maxPeople;
                    }
                    
                    const name = (roomName || '').toLowerCase();
                    const type = (roomType || '').toLowerCase();
                    const fullText = `${name} ${type}`;
                    
                    if (fullText.includes('estudio') || fullText.includes('studio')) {
                        return 4;
                    }
                    if (fullText.includes('1 alcoba') || fullText.includes('1 bedroom') || fullText.includes('one bedroom')) {
                        return 6;
                    }
                    if (fullText.includes('2 alcoba') || fullText.includes('2 bedroom') || fullText.includes('two bedroom')) {
                        return 8;
                    }
                    if (fullText.includes('3 alcoba') || fullText.includes('3 bedroom') || fullText.includes('three bedroom')) {
                        return 10;
                    }
                    
                    // Default basado en maxPeople o estudios
                    return maxPeople || 4;
                }

                // Limpiar tabla existente
                await prisma.hotelApartment.deleteMany();
                console.log('\n🧹 Tabla HotelApartment limpiada');

                // Preparar datos para insertar
                const insertData: any[] = [];
                
                rooms.forEach(room => {
                    if (room.units && room.units.length > 0) {
                        // Si tiene unidades específicas, crear entrada para cada unidad
                        room.units.forEach(unit => {
                            const roomName = unit.name || room.name || `Habitación ${room.id}`;
                            const capacity = getCapacity(roomName, room.roomType, room.maxPeople);
                            
                            insertData.push({
                                propertyId: room.propertyId,
                                roomId: unit.id,
                                roomName: roomName,
                                capacity: capacity,
                                extraCharge: {
                                    description: "Cargo adicional:",
                                    amount: 70000
                                }
                            });
                        });
                    } else {
                        // Si no tiene unidades, crear entrada para la habitación principal
                        const roomName = room.name || `Habitación ${room.id}`;
                        const capacity = getCapacity(roomName, room.roomType, room.maxPeople);
                        
                        insertData.push({
                            propertyId: room.propertyId,
                            roomId: room.id,
                            roomName: roomName,
                            capacity: capacity,
                            extraCharge: {
                                description: "Cargo adicional:",
                                amount: 70000
                            }
                        });
                    }
                });

                // Eliminar duplicados por roomId
                const uniqueData = insertData.filter((item, index, self) => 
                    index === self.findIndex(t => t.roomId === item.roomId)
                );

                await prisma.hotelApartment.createMany({
                    data: uniqueData
                });

                console.log(`✅ Insertadas ${uniqueData.length} habitaciones/unidades reales`);

                // Estadísticas por propiedad
                const propertyStats = await prisma.hotelApartment.groupBy({
                    by: ['propertyId'],
                    _count: { roomId: true }
                });

                console.log('\n📊 Estadísticas por propiedad:');
                propertyStats.forEach(stat => {
                    const property = properties.find(p => p.id === stat.propertyId);
                    console.log(`- Propiedad ${stat.propertyId} (${property?.name || 'Sin nombre'}): ${stat._count.roomId} habitaciones`);
                });

                // Estadísticas de capacidades
                const capacityStats = await prisma.hotelApartment.groupBy({
                    by: ['capacity'],
                    _count: { capacity: true }
                });

                console.log('\n📊 Estadísticas de capacidades:');
                capacityStats.forEach(stat => {
                    console.log(`- Capacidad ${stat.capacity} personas: ${stat._count.capacity} habitaciones`);
                });

                // Muestra de habitaciones insertadas
                const sampleRooms = await prisma.hotelApartment.findMany({ 
                    take: 10,
                    orderBy: { propertyId: 'asc' }
                });
                
                console.log('\n📋 Muestra de habitaciones insertadas:');
                sampleRooms.forEach(room => {
                    const property = properties.find(p => p.id === room.propertyId);
                    console.log(`- ID: ${room.roomId} | ${property?.name || room.propertyId} | "${room.roomName}" | ${room.capacity} personas`);
                });

            } else {
                console.log('❌ No se pudieron obtener habitaciones de la API');
            }

        } catch (error) {
            console.error('❌ Error obteniendo habitaciones:', error.response?.status || error.message);
            if (error.response?.data) {
                console.error('📄 Response data:', error.response.data);
            }
        }

        console.log('\n🎉 Proceso completado');

    } catch (error) {
        console.error('❌ Error general:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);