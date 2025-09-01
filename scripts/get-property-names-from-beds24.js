// Script para obtener los nombres reales de las propiedades desde Beds24 API
require('dotenv').config();

async function getPropertyNames() {
  const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
  const BEDS24_API_URL = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';
  
  if (!BEDS24_TOKEN) {
    console.error('❌ Error: BEDS24_TOKEN no está configurado');
    return;
  }
  
  console.log('🔍 Obteniendo nombres de propiedades desde Beds24...');
  
  try {
    // Obtener lista de propiedades
    const response = await fetch(`${BEDS24_API_URL}/properties`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEDS24_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Error en API:', response.status, response.statusText);
      
      // Intentar con el endpoint de inventory
      console.log('🔄 Intentando con endpoint de inventory...');
      const inventoryResponse = await fetch(`${BEDS24_API_URL}/inventory/rooms`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${BEDS24_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (inventoryResponse.ok) {
        const rooms = await inventoryResponse.json();
        console.log('📊 Rooms encontrados:', rooms.length);
        
        // Agrupar por propertyId
        const properties = {};
        rooms.forEach(room => {
          if (!properties[room.propertyId]) {
            properties[room.propertyId] = {
              propertyId: room.propertyId,
              propertyName: room.propertyName || `Property ${room.propertyId}`,
              rooms: []
            };
          }
          properties[room.propertyId].rooms.push({
            roomId: room.roomId,
            roomName: room.name
          });
        });
        
        console.log('\n📋 Propiedades encontradas:');
        Object.values(properties).forEach(prop => {
          console.log(`\nProperty ID: ${prop.propertyId}`);
          console.log(`Property Name: ${prop.propertyName}`);
          console.log(`Rooms: ${prop.rooms.length}`);
          prop.rooms.forEach(room => {
            console.log(`  - Room ${room.roomId}: ${room.roomName}`);
          });
        });
      }
      return;
    }
    
    const properties = await response.json();
    console.log('✅ Propiedades obtenidas:', properties);
    
    // Mostrar los nombres reales
    if (Array.isArray(properties)) {
      console.log('\n📋 Nombres de propiedades desde Beds24:');
      properties.forEach(prop => {
        console.log(`Property ID ${prop.id || prop.propertyId}: ${prop.name || prop.propertyName}`);
      });
    }
    
    // Generar SQL para actualizar
    console.log('\n📝 SQL para actualizar nombres en Railway:');
    console.log('```sql');
    if (Array.isArray(properties)) {
      properties.forEach(prop => {
        const propId = prop.id || prop.propertyId;
        const propName = prop.name || prop.propertyName || `Property ${propId}`;
        console.log(`UPDATE "Propiedades" SET property_name = '${propName}' WHERE property_id = ${propId};`);
      });
    }
    console.log('```');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Si no podemos obtener de la API, usar los property_id que conocemos
    console.log('\n📝 Property IDs conocidos de la base de datos:');
    const knownProperties = {
      173307: 'Property 173307',
      173308: 'Property 173308', 
      173309: 'Property 173309',
      173312: 'Property 173312',
      240061: 'Property 240061',
      173311: 'Property 173311',
      173207: 'Property 173207'
    };
    
    console.log('\nSQL para actualizar con nombres genéricos:');
    console.log('```sql');
    Object.entries(knownProperties).forEach(([id, name]) => {
      console.log(`UPDATE "Propiedades" SET property_name = '${name}' WHERE property_id = ${id};`);
    });
    console.log('```');
  }
}

getPropertyNames();