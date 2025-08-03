// scripts/restore-client-action.js
// Script para restaurar la próxima acción del cliente

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHONE_NUMBER = '573003913251';

async function restoreClientAction() {
  console.log('🔄 Restaurando próxima acción del cliente...');
  console.log(`📞 Cliente: ${PHONE_NUMBER}`);
  
  try {
    const today = new Date();
    
    const result = await prisma.clientView.update({
      where: { phoneNumber: PHONE_NUMBER },
      data: {
        proximaAccion: 'Hacer seguimiento para preguntar si todavía está interesado en los apartamentos disponibles y ofrecer más opciones o ayuda con la reserva.',
        fechaProximaAccion: today
      }
    });
    
    console.log('✅ Acción restaurada exitosamente');
    console.log('📋 Datos actualizados:');
    console.log(`  - Próxima acción: ${result.proximaAccion}`);
    console.log(`  - Fecha: ${result.fechaProximaAccion?.toISOString().split('T')[0]}`);
    
  } catch (error) {
    console.error('❌ Error restaurando acción:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('👋 Conexión cerrada');
  }
}

if (require.main === module) {
  restoreClientAction();
}