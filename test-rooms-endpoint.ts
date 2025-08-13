import { getBeds24Config } from './src/config/integrations/beds24.config';
import axios from 'axios';

async function main() {
    try {
        console.log('🧪 Probando endpoint /properties/rooms con propertyIds conocidos...');
        
        const config = getBeds24Config();
        
        // PropertyIds que conocemos
        const knownPropertyIds = [173207, 173311, 173307, 173308, 173309, 173312, 240061];
        
        console.log('🏨 PropertyIds a probar:', knownPropertyIds);
        
        // Crear cliente HTTP
        const apiClient = axios.create({
            baseURL: config.apiUrl,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'token': config.apiToken
            }
        });

        // Probar con un propertyId específico primero
        const testPropertyId = 173207; // 2005 A
        
        console.log(`\n🔍 Probando con propertyId: ${testPropertyId}`);
        
        try {
            const response = await apiClient.get('/properties/rooms', {
                params: {
                    propertyId: [testPropertyId]
                }
            });
            
            console.log('✅ Response Status:', response.status);
            console.log('✅ Response Success:', response.data?.success);
            console.log('✅ Data Count:', response.data?.data?.length || 0);
            
            if (response.data?.data && response.data.data.length > 0) {
                console.log('\n📋 Habitaciones encontradas:');
                response.data.data.forEach((room, index) => {
                    console.log(`\n--- Habitación ${index + 1} ---`);
                    console.log('ID:', room.id);
                    console.log('Property ID:', room.propertyId);
                    console.log('Name:', room.name);
                    console.log('Room Type:', room.roomType);
                    console.log('Max People:', room.maxPeople);
                    console.log('Qty:', room.qty);
                    
                    if (room.units && room.units.length > 0) {
                        console.log('Units:');
                        room.units.forEach((unit, unitIndex) => {
                            console.log(`  Unit ${unitIndex + 1}: ID=${unit.id}, Name="${unit.name}"`);
                        });
                    }
                });
            } else {
                console.log('⚠️ No se encontraron habitaciones para esta propiedad');
            }
            
            // Si funcionó, probar con todos los propertyIds
            if (response.data?.success) {
                console.log('\n🚀 Probando con todos los propertyIds...');
                
                const allResponse = await apiClient.get('/properties/rooms', {
                    params: {
                        propertyId: knownPropertyIds
                    }
                });
                
                console.log('✅ All Properties Response Status:', allResponse.status);
                console.log('✅ All Properties Data Count:', allResponse.data?.data?.length || 0);
                
                if (allResponse.data?.data && allResponse.data.data.length > 0) {
                    console.log('\n📊 Resumen de todas las habitaciones:');
                    
                    const roomsByProperty = new Map();
                    
                    allResponse.data.data.forEach(room => {
                        if (!roomsByProperty.has(room.propertyId)) {
                            roomsByProperty.set(room.propertyId, []);
                        }
                        roomsByProperty.get(room.propertyId).push(room);
                    });
                    
                    Array.from(roomsByProperty.entries()).forEach(([propertyId, rooms]) => {
                        console.log(`\n🏨 Propiedad ${propertyId}:`);
                        rooms.forEach(room => {
                            console.log(`  - ID: ${room.id} | Name: "${room.name}" | Type: ${room.roomType} | Max People: ${room.maxPeople}`);
                            
                            if (room.units && room.units.length > 0) {
                                room.units.forEach(unit => {
                                    console.log(`    Unit: ID=${unit.id}, Name="${unit.name}"`);
                                });
                            }
                        });
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error:', error.response?.status || error.message);
            if (error.response?.data) {
                console.error('📄 Error Data:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

main().catch(console.error);