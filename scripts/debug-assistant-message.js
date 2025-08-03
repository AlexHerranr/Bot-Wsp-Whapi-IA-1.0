// scripts/debug-assistant-message.js
// Script para mostrar exactamente qué mensaje se envía al Assistant de Reservas

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHONE_NUMBER = '573003913251';

async function debugAssistantMessage() {
  console.log('🔍 MOSTRANDO MENSAJE ENVIADO AL ASSISTANT DE RESERVAS');
  console.log('═'.repeat(70));
  
  try {
    // Obtener datos del cliente
    const client = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER },
      select: {
        phoneNumber: true,
        name: true,
        userName: true,
        label1: true,
        label2: true,
        label3: true,
        profileStatus: true,
        proximaAccion: true,
        fechaProximaAccion: true,
        prioridad: true
      }
    });
    
    if (!client) {
      console.log('❌ Cliente no encontrado');
      return;
    }
    
    console.log('📋 DATOS DEL CLIENTE EN LA BD:');
    console.log(JSON.stringify(client, null, 2));
    
    console.log('\n🎯 GENERANDO MENSAJE PARA ASSISTANT DE RESERVAS...');
    
    // Recrear exactamente la misma lógica del script
    const clientName = client.name || client.userName || 'Cliente';
    
    // Obtener etiquetas del cliente si están disponibles
    const clientLabels = [];
    if (client.label1) clientLabels.push(client.label1);
    if (client.label2) clientLabels.push(client.label2);
    if (client.label3) clientLabels.push(client.label3);
    
    const labelsText = clientLabels.length > 0 ? clientLabels.join(' y ') : 'sin etiquetas específicas';
    
    const prompt = `(Disparador Interno para Hacer Seguimiento)

El cliente ${clientName} con etiquetas "${labelsText}". 

Análisis del cliente: ${client.profileStatus}

Próxima acción requerida: ${client.proximaAccion}

Genera un mensaje de seguimiento natural para WhatsApp dirigido al cliente.`;
    
    console.log('\n' + '═'.repeat(70));
    console.log('📤 MENSAJE EXACTO ENVIADO AL ASSISTANT DE RESERVAS:');
    console.log('   Assistant ID: asst_SRqZsLGTOwLCXxOADo7beQuM');
    console.log('═'.repeat(70));
    console.log(prompt);
    console.log('═'.repeat(70));
    
    console.log('\n📊 DESGLOSE DEL MENSAJE:');
    console.log(`- Nombre del cliente: "${clientName}"`);
    console.log(`- Etiquetas procesadas: "${labelsText}"`);
    console.log(`- Longitud análisis: ${client.profileStatus?.length || 0} caracteres`);
    console.log(`- Longitud próxima acción: ${client.proximaAccion?.length || 0} caracteres`);
    console.log(`- Longitud total del prompt: ${prompt.length} caracteres`);
    
    console.log('\n🎯 COMPONENTES INDIVIDUALES:');
    console.log('1. Header:', '"(Disparador Interno para Hacer Seguimiento)"');
    console.log('2. Cliente y etiquetas:', `"El cliente ${clientName} con etiquetas \\"${labelsText}\\"."`);
    console.log('3. Análisis:', `"${client.profileStatus?.substring(0, 100)}..."`);
    console.log('4. Acción:', `"${client.proximaAccion?.substring(0, 100)}..."`);
    console.log('5. Instrucción:', '"Genera un mensaje de seguimiento natural para WhatsApp dirigido al cliente."');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión cerrada');
  }
}

if (require.main === module) {
  debugAssistantMessage();
}