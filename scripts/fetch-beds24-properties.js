// Script para obtener los nombres de propiedades desde Beds24 API
require('dotenv').config();
const fetch = require('node-fetch');

async function fetchBeds24Properties() {
  const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';
  const BEDS24_API_URL = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';
  
  console.log('🔍 Obteniendo propiedades desde Beds24 API...');
  
  // Los property IDs que tenemos en la base de datos
  const propertyIds = [173207, 173307, 173308, 173309, 173311, 173312, 240061];
  
  try {
    // Llamar al endpoint /properties con los IDs específicos
    const params = new URLSearchParams();
    propertyIds.forEach(id => params.append('id', id));
    
    const url = `${BEDS24_API_URL}/properties?${params.toString()}`;
    console.log('📡 URL:', url.replace(BEDS24_TOKEN, '***'));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEDS24_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Error en API:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Detalles:', errorText);
      return null;
    }
    
    const result = await response.json();
    console.log('✅ Respuesta recibida');
    
    if (result.success && result.data) {
      console.log('\n📋 Propiedades encontradas:');
      const propertyMap = {};
      
      result.data.forEach(prop => {
        console.log(`\nProperty ID: ${prop.id}`);
        console.log(`Nombre: ${prop.name}`);
        console.log(`Tipo: ${prop.propertyType || 'N/A'}`);
        console.log(`Dirección: ${prop.address || 'N/A'}`);
        console.log(`Ciudad: ${prop.city || 'N/A'}`);
        
        propertyMap[prop.id] = prop.name;
      });
      
      return propertyMap;
    } else {
      console.log('⚠️ No se encontraron propiedades');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function updatePropertyNamesInDB() {
  const { PrismaClient } = require('@prisma/client');
  const DATABASE_URL = "postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway";
  
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } }
  });
  
  try {
    // Obtener nombres desde Beds24
    const propertyNames = await fetchBeds24Properties();
    
    if (propertyNames && Object.keys(propertyNames).length > 0) {
      console.log('\n🔄 Actualizando base de datos...');
      
      for (const [propertyId, propertyName] of Object.entries(propertyNames)) {
        const updated = await prisma.$executeRaw`
          UPDATE "Propiedades" 
          SET property_name = ${propertyName}
          WHERE property_id = ${parseInt(propertyId)}
        `;
        
        console.log(`✅ Property ${propertyId} actualizada: "${propertyName}" (${updated} registros)`);
      }
      
      // Mostrar resultado final
      const result = await prisma.$queryRaw`
        SELECT DISTINCT property_id, property_name, COUNT(*) as total
        FROM "Propiedades"
        GROUP BY property_id, property_name
        ORDER BY property_id
      `;
      
      console.log('\n📊 Estado final:');
      result.forEach(r => {
        console.log(`  Property ${r.property_id}: ${r.property_name} (${r.total} apartamentos)`);
      });
      
    } else {
      console.log('\n⚠️ No se pudieron obtener nombres desde Beds24');
      console.log('Los apartamentos mantendrán el nombre "TeAlquilamos"');
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
updatePropertyNamesInDB();