// Script para actualizar los nombres de propiedades en la tabla hotel_apartments
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mapeo de propertyId a propertyName
// Estos valores deberían venir de la API de Beds24 o ser configurados manualmente
const propertyNames = {
  // PropertyId 1: Edificio principal
  1: 'TeAlquilamos - Edificio Principal',
  
  // PropertyId 2: Edificio secundario (si existe)
  2: 'TeAlquilamos - Edificio Norte',
  
  // PropertyId 3: Anexo (si existe)
  3: 'TeAlquilamos - Anexo Sur',
  
  // Agregar más mappings según sea necesario
  // Por defecto todos serán 'TeAlquilamos'
};

async function updatePropertyNames() {
  try {
    console.log('🔄 Iniciando actualización de nombres de propiedades...');
    
    // Obtener todos los apartamentos
    const apartments = await prisma.apartamentos.findMany();
    console.log(`📊 Encontrados ${apartments.length} apartamentos`);
    
    let updatedCount = 0;
    
    for (const apt of apartments) {
      const propertyName = propertyNames[apt.propertyId] || 'TeAlquilamos';
      
      // Solo actualizar si es diferente
      if (apt.propertyName !== propertyName) {
        await prisma.apartamentos.update({
          where: { roomId: apt.roomId },
          data: { propertyName }
        });
        
        console.log(`✅ Actualizado: Apartamento ${apt.roomId} (Property ${apt.propertyId}) -> ${propertyName}`);
        updatedCount++;
      }
    }
    
    console.log(`\n✨ Actualización completada: ${updatedCount} apartamentos actualizados`);
    
    // Mostrar resumen
    const summary = await prisma.apartamentos.groupBy({
      by: ['propertyName'],
      _count: true
    });
    
    console.log('\n📈 Resumen por propiedad:');
    summary.forEach(s => {
      console.log(`   ${s.propertyName}: ${s._count} apartamentos`);
    });
    
  } catch (error) {
    console.error('❌ Error actualizando nombres de propiedades:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
updatePropertyNames();