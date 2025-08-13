import { getBeds24Config } from './src/config/integrations/beds24.config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🏨 Obteniendo habitaciones reales desde Beds24 API...');
        
        const config = getBeds24Config();
        
        // Crear cliente HTTP directo
        const apiClient = axios.create({
            baseURL: config.apiUrl,
            timeout: 30000, // Aumentar timeout
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'token': config.apiToken
            }
        });

        // Primero intentar obtener propiedades
        console.log('📋 Obteniendo propiedades...');
        const propertiesResponse = await apiClient.get('/properties');
        const properties = propertiesResponse.data.data || [];
        console.log(`✅ Encontradas ${properties.length} propiedades`);

        // Intentar diferentes endpoints para habitaciones
        console.log('\n🔍 Intentando diferentes endpoints de habitaciones...');
        
        const roomEndpoints = [
            '/properties/rooms',
            '/rooms',
            '/inventory/rooms',
            '/properties/inventory'
        ];

        let rooms = [];
        let successEndpoint = null;

        for (const endpoint of roomEndpoints) {
            try {
                console.log(`🌐 Probando: ${endpoint}`);
                const response = await apiClient.get(endpoint);
                
                if (response.status === 200 && response.data.success !== false) {
                    rooms = response.data.data || response.data || [];
                    successEndpoint = endpoint;
                    console.log(`✅ Éxito con ${endpoint}: ${rooms.length} habitaciones`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Error en ${endpoint}: ${error.response?.status || error.message}`);
            }
        }

        if (rooms.length === 0) {
            console.log('\n⚠️ No se pudieron obtener habitaciones. Probando con parámetros específicos...');
            
            // Intentar con cada propiedad individualmente
            for (const property of properties.slice(0, 2)) { // Solo las primeras 2 para no saturar
                try {
                    console.log(`🏢 Probando habitaciones para propiedad ${property.id} (${property.name})`);
                    
                    const roomsForProperty = await apiClient.get('/properties/rooms', {
                        params: { propertyId: property.id }
                    });
                    
                    if (roomsForProperty.data.data) {
                        rooms = rooms.concat(roomsForProperty.data.data);
                        console.log(`✅ Encontradas ${roomsForProperty.data.data.length} habitaciones para ${property.name}`);
                    }
                } catch (error) {
                    console.log(`❌ Error con propiedad ${property.id}: ${error.response?.status || error.message}`);
                }
            }
        }

        if (rooms.length > 0) {
            console.log(`\n📊 Total de habitaciones encontradas: ${rooms.length}`);
            console.log(`🔗 Endpoint exitoso: ${successEndpoint}`);
            
            // Mostrar estructura de datos
            const sample = rooms[0];
            console.log('\n📋 Estructura de habitación de ejemplo:');
            console.log(JSON.stringify(sample, null, 2));
            
            // Función para determinar capacidad
            function getCapacity(roomName: string, roomDescription?: string): number {
                const name = (roomName || '').toLowerCase();
                const desc = (roomDescription || '').toLowerCase();
                const fullText = `${name} ${desc}`;
                
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
                
                // Default: estudios
                return 4;
            }
            
            // Limpiar tabla existente
            await prisma.hotelApartment.deleteMany();
            console.log('\n🧹 Tabla HotelApartment limpiada');
            
            // Preparar datos para insertar
            const insertData = rooms.map(room => {
                const roomName = room.name || room.roomName || `Habitación ${room.id}`;
                const capacity = getCapacity(roomName, room.description);
                
                return {
                    propertyId: room.propertyId || room.property_id || 0,
                    roomId: room.id || room.roomId,
                    roomName: roomName,
                    capacity: capacity,
                    extraCharge: {
                        description: "Cargo adicional:",
                        amount: 70000
                    }
                };
            });
            
            await prisma.hotelApartment.createMany({
                data: insertData
            });
            
            console.log(`✅ Insertadas ${insertData.length} habitaciones reales`);
            
            // Estadísticas
            const stats = await prisma.hotelApartment.groupBy({
                by: ['capacity'],
                _count: { capacity: true }
            });
            
            console.log('\n📊 Estadísticas de capacidades:');
            stats.forEach(stat => {
                const tipo = stat.capacity === 4 ? 'Estudios' : 
                            stat.capacity === 6 ? '1 Alcoba' :
                            stat.capacity === 8 ? '2 Alcobas' :
                            stat.capacity === 10 ? '3 Alcobas' : 'Otros';
                
                console.log(`- ${tipo}: ${stat._count.capacity} habitaciones (${stat.capacity} personas c/u)`);
            });
            
            // Muestra
            const sampleRooms = await prisma.hotelApartment.findMany({ take: 5 });
            console.log('\n📋 Muestra de habitaciones insertadas:');
            sampleRooms.forEach(room => {
                console.log(`- ID: ${room.roomId} | Propiedad: ${room.propertyId} | Nombre: "${room.roomName}" | Capacidad: ${room.capacity}`);
            });
            
        } else {
            console.log('\n❌ No se pudieron obtener habitaciones de ningún endpoint');
            console.log('📋 Endpoints probados:', roomEndpoints);
        }
        
        console.log('\n🎉 Proceso completado');
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
        if (error.response) {
            console.error('📄 Response data:', error.response.data);
            console.error('📊 Status:', error.response.status);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);