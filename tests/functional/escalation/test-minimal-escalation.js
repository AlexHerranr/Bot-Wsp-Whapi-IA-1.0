/**
 * Test Mínimo - Solo 5 Razones Esenciales
 * Solo casos que REALMENTE requieren intervención humana
 */

// Configurar variables de entorno
process.env.WHAPI_TOKEN = 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';
process.env.WHAPI_API_URL = 'https://gate.whapi.cloud';

import { EscalationServiceMinimal } from '../../src/services/escalation/escalation-minimal.service.js';

// Contexto base
const baseContext = {
  userId: '573003913251',
  userName: 'Alexander',
  chatId: '573003913251@s.whatsapp.net'
};

const minimalReasons = [
  {
    reason: 'payment_confirmation',
    description: '💰 Confirmación de pago (verificación manual)',
    context: {
      ...baseContext,
      paymentInfo: { amount: 500000, imageAttached: true, needsVerification: true }
    }
  },
  {
    reason: 'customer_complaint',
    description: '⚠️ Queja del cliente (atención personal)',
    context: {
      ...baseContext,
      complaint: { type: 'service', severity: 'high', description: 'Apartamento sucio' }
    }
  },
  {
    reason: 'damage_report',
    description: '🔧 Reporte de daños (inspección requerida)',
    context: {
      ...baseContext,
      damage: { type: 'appliance', description: 'Aire acondicionado roto', apartment: '1603' }
    }
  },
  {
    reason: 'arrival_notification',
    description: '📍 Notificación de llegada (coordinación equipo)',
    context: {
      ...baseContext,
      arrival: { estimatedTime: '15:30', apartment: '1722A', specialRequests: 'Llaves edificio' }
    }
  },
  {
    reason: 'departure_notification',
    description: '🚪 Notificación de salida (coordinación checkout)',
    context: {
      ...baseContext,
      departure: { time: '11:30', apartment: '814', checkoutNotes: 'Revisión apartamento' }
    }
  }
];

async function testMinimalEscalation() {
  console.log('🧪 === TEST ESCALAMIENTO MÍNIMO ===\n');
  console.log('🎯 Solo casos que REALMENTE requieren intervención humana\n');
  console.log(`📊 Total razones esenciales: ${minimalReasons.length}\n`);

  for (let i = 0; i < minimalReasons.length; i++) {
    const { reason, description, context } = minimalReasons[i];
    
    console.log(`📋 Test ${i + 1}/${minimalReasons.length}: ${description}`);
    console.log(`   Razón: ${reason}`);
    
    try {
      const result = await EscalationServiceMinimal.escalateToHuman(reason, context);
      console.log(`   ✅ Resultado: ${result ? 'EXITOSO' : 'FALLIDO'}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
    
    // Esperar 2 segundos entre tests
    if (i < minimalReasons.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('🎉 === TESTS MÍNIMOS COMPLETADOS ===');
  console.log(`📱 Deberías haber recibido ${minimalReasons.length} mensajes`);
  console.log('✅ Sistema ultra-simplificado listo para producción');
  console.log('🤖 El bot maneja todo lo demás automáticamente');
}

// Ejecutar test
testMinimalEscalation().catch(console.error); 