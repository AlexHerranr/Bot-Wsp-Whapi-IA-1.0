// Script para agregar la columna property_name a la tabla hotel_apartments
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addPropertyNameColumn() {
  try {
    console.log('🚀 Agregando columna property_name a hotel_apartments...');
    
    // Ejecutar el ALTER TABLE
    await prisma.$executeRaw`
      ALTER TABLE hotel_apartments 
      ADD COLUMN IF NOT EXISTS property_name VARCHAR(255) DEFAULT 'TeAlquilamos'
    `;
    
    console.log('✅ Columna agregada exitosamente');
    
    // Verificar que la columna existe
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'hotel_apartments' 
      AND column_name = 'property_name'
    `;
    
    if (result && result.length > 0) {
      console.log('✅ Verificación exitosa:', result[0]);
    } else {
      console.log('⚠️ La columna no se pudo verificar');
    }
    
    // Mostrar algunos apartamentos para confirmar
    const apartments = await prisma.apartamentos.findMany({
      take: 5,
      select: {
        roomId: true,
        roomName: true,
        propertyName: true
      }
    });
    
    console.log('\n📊 Primeros 5 apartamentos:');
    apartments.forEach(apt => {
      console.log(`  Room ${apt.roomId}: ${apt.roomName} - Propiedad: ${apt.propertyName || 'No definida'}`);
    });
    
  } catch (error) {
    if (error.code === 'P2010' && error.message.includes('column "property_name" of relation "hotel_apartments" already exists')) {
      console.log('ℹ️ La columna property_name ya existe');
      
      // Mostrar algunos apartamentos
      const apartments = await prisma.apartamentos.findMany({
        take: 5,
        select: {
          roomId: true,
          roomName: true,
          propertyName: true
        }
      });
      
      console.log('\n📊 Primeros 5 apartamentos:');
      apartments.forEach(apt => {
        console.log(`  Room ${apt.roomId}: ${apt.roomName} - Propiedad: ${apt.propertyName || 'No definida'}`);
      });
    } else {
      console.error('❌ Error:', error.message);
      console.error('Detalles:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
addPropertyNameColumn();