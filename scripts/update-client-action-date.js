// scripts/update-client-action-date.js
// Script para actualizar la fecha de próxima acción del cliente a hoy

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHONE_NUMBER = '573003913251';

async function updateClientActionDate() {
  console.log('🔄 Actualizando fecha de próxima acción para hoy...');
  console.log(`📞 Cliente: ${PHONE_NUMBER}`);
  
  try {
    const today = new Date();
    console.log(`📅 Nueva fecha: ${today.toISOString().split('T')[0]}`);
    
    const result = await prisma.clientView.update({
      where: { phoneNumber: PHONE_NUMBER },
      data: {
        fechaProximaAccion: today
      }
    });
    
    console.log('✅ Fecha actualizada exitosamente');
    console.log('📋 Datos actualizados:');
    console.log(`  - Próxima acción: ${result.proximaAccion}`);
    console.log(`  - Fecha: ${result.fechaProximaAccion?.toISOString().split('T')[0]}`);
    console.log(`  - Prioridad: ${result.prioridad}`);
    
  } catch (error) {
    console.error('❌ Error actualizando fecha:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('👋 Conexión cerrada');
  }
}

if (require.main === module) {
  updateClientActionDate();
}