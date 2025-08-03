// scripts/execute-daily-actions-simple.js
// Script simple para ejecutar daily actions sin compilar TypeScript

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


// ✅ RAILWAY BD VERIFICATION
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no encontrada en .env');
    process.exit(1);
}
if (process.env.DATABASE_URL.includes('railway') || process.env.DATABASE_URL.includes('rlwy.net')) {
    console.log('🚂 Conectando a Railway PostgreSQL...');
} else {
    console.warn('⚠️  DATABASE_URL no parece ser de Railway');
}

console.log('🚀 EJECUTANDO DAILY ACTIONS - VERSION SIMPLE');
console.log('═'.repeat(60));

// Función para obtener clientes con acciones para hoy
async function getClientsWithActionToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return await prisma.clientView.findMany({
    where: {
      fechaProximaAccion: {
        gte: today,
        lt: tomorrow
      },
      proximaAccion: {
        not: null
      }
    },
    select: {
      phoneNumber: true,
      chatId: true,
      name: true,
      userName: true,
      profileStatus: true,
      proximaAccion: true,
      fechaProximaAccion: true,
      prioridad: true
    }
  });
}

// Función para generar mensaje personalizado usando Assistant de reservas
async function generateFollowUpMessage(client) {
  const clientName = client.name || client.userName || 'Cliente';
  
  // ID del Assistant asesor de reservas (NO modificar su prompt)
  const RESERVAS_ASSISTANT_ID = 'asst_SRqZsLGTOwLCXxOADo7beQuM';
  
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

  try {
    console.log(`  🎯 Usando Assistant de reservas: ${RESERVAS_ASSISTANT_ID}`);
    
    // Crear thread
    const thread = await openai.beta.threads.create();
    
    // Agregar mensaje
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: prompt
    });
    
    // Ejecutar Assistant de reservas
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: RESERVAS_ASSISTANT_ID
    });
    
    // Esperar respuesta
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    const maxAttempts = 15;
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      if (attempts >= maxAttempts) {
        throw new Error('Timeout esperando respuesta del Assistant de reservas');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
    }
    
    if (runStatus.status !== 'completed') {
      throw new Error(`Assistant run falló con estado: ${runStatus.status}`);
    }
    
    // Obtener respuesta
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    
    if (!lastMessage || !lastMessage.content[0] || lastMessage.content[0].type !== 'text') {
      throw new Error('No se recibió respuesta de texto del Assistant');
    }
    
    const responseText = lastMessage.content[0].text.value;
    
    // Limpiar thread
    await openai.beta.threads.del(thread.id);
    
    console.log(`  ✅ Mensaje generado por Assistant de reservas`);
    return responseText;
    
  } catch (error) {
    console.error(`❌ Error generando mensaje para ${client.phoneNumber}:`, error.message);
    return null;
  }
}

// Función para enviar mensaje por WhatsApp
async function sendWhatsAppMessage(chatId, message) {
  try {
    const response = await fetch(`${process.env.WHAPI_API_URL}/messages/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: chatId,
        body: message
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WHAPI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`📤 Mensaje enviado a ${chatId}:`, result);
    return true;
  } catch (error) {
    console.error(`❌ Error enviando mensaje a ${chatId}:`, error.message);
    return false;
  }
}

// Función para limpiar acción completada
async function clearCompletedAction(phoneNumber) {
  try {
    await prisma.clientView.update({
      where: { phoneNumber },
      data: {
        proximaAccion: null,
        fechaProximaAccion: null
      }
    });
    console.log(`✅ Acción limpiada para ${phoneNumber}`);
  } catch (error) {
    console.error(`❌ Error limpiando acción para ${phoneNumber}:`, error.message);
  }
}

// Función principal
async function executeDailyActions() {
  try {
    console.log('🔍 Buscando clientes con acciones programadas para hoy...');
    
    const clients = await getClientsWithActionToday();
    
    if (clients.length === 0) {
      console.log('ℹ️ No hay clientes con acciones programadas para hoy');
      return;
    }

    console.log(`📋 Encontrados ${clients.length} clientes con acciones programadas:`);
    clients.forEach((client, i) => {
      const clientName = client.name || client.userName || 'Sin nombre';
      console.log(`  ${i + 1}. ${clientName} (${client.phoneNumber}) - ${client.proximaAccion}`);
    });

    console.log('\n📤 Procesando clientes...');

    for (const client of clients) {
      try {
        const clientName = client.name || client.userName || 'Cliente';
        console.log(`\n🔄 Procesando: ${clientName} (${client.phoneNumber})`);
        
        // Generar mensaje personalizado
        console.log('  🤖 Generando mensaje personalizado...');
        const message = await generateFollowUpMessage(client);
        
        if (!message) {
          console.log('  ⚠️ No se pudo generar mensaje, saltando...');
          continue;
        }

        console.log('  📝 Mensaje generado:');
        console.log(`    "${message.substring(0, 100)}..."`);
        
        // Enviar mensaje
        console.log('  📤 Enviando mensaje por WhatsApp...');
        const sent = await sendWhatsAppMessage(client.chatId, message);
        
        if (sent) {
          // Limpiar acción completada
          console.log('  🧹 Limpiando acción completada...');
          await clearCompletedAction(client.phoneNumber);
          
          console.log(`  ✅ Seguimiento completado para ${clientName}`);
        } else {
          console.log(`  ❌ No se pudo enviar mensaje a ${clientName}`);
        }
        
        // Pausa entre clientes
        console.log('  ⏳ Pausa de 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error procesando cliente ${client.phoneNumber}:`, error.message);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 DAILY ACTIONS COMPLETADO');
    console.log('═'.repeat(60));
    console.log('📱 Verifica tu WhatsApp para ver si llegaron los mensajes');
    
  } catch (error) {
    console.error('\n💥 ERROR EJECUTANDO DAILY ACTIONS:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión a BD cerrada');
  }
}

// Ejecutar script
if (require.main === module) {
  executeDailyActions();
}