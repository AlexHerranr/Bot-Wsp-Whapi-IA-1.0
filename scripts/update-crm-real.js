// scripts/update-crm-real.js
// Script para prueba real: ACTUALIZAR DATOS IA-CRM SQL para usuario 573003913251

require('dotenv').config();
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuración de la prueba
const PHONE_NUMBER = '573003913251';
const CHAT_ID = `${PHONE_NUMBER}@s.whatsapp.net`;  // Formato completo WHAPI
const MESSAGE_COUNT = 200;  // Últimos 200 mensajes


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

console.log('🚀 INICIANDO PRUEBA REAL: ACTUALIZAR DATOS IA-CRM SQL');
console.log('═'.repeat(60));
console.log(`📞 Usuario: ${PHONE_NUMBER}`);
console.log(`💬 Chat ID: ${CHAT_ID}`);
console.log(`📜 Mensajes a obtener: ${MESSAGE_COUNT}`);
console.log('═'.repeat(60));

// Función con retry para WHAPI
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Intento ${i + 1}/${retries}: ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      return response;
    } catch (error) {
      console.warn(`⚠️ Intento ${i + 1} falló: ${error.message}`);
      
      if (i === retries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Paso 1: Obtener historial de WHAPI
async function fetchConversationHistory() {
  console.log('\n📡 PASO 1: Obteniendo historial de WHAPI...');
  
  try {
    // Construir URL con parámetros
    const url = `${process.env.WHAPI_API_URL}/messages/list?chat_id=${encodeURIComponent(CHAT_ID)}&count=${MESSAGE_COUNT}`;
    console.log(`🌐 URL: ${url}`);
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!data.messages) {
      console.warn('⚠️ No se encontró campo "messages" en la respuesta');
      console.log('📄 Respuesta completa:', JSON.stringify(data, null, 2));
      return [];
    }

    console.log(`✅ ${data.messages.length} mensajes obtenidos de WHAPI`);
    
    // Log de algunos mensajes para debug
    if (data.messages.length > 0) {
      console.log('\n📋 Muestra de mensajes:');
      data.messages.slice(0, 3).forEach((msg, i) => {
        const sender = msg.from_name || (msg.from_me ? 'Bot' : 'Cliente');
        const content = msg.text?.body || msg.body || '[Media/Non-text]';
        const time = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString() : 'Sin timestamp';
        console.log(`  ${i + 1}. ${sender} (${time}): ${content.substring(0, 100)}...`);
      });
    }
    
    return data.messages || [];
    
  } catch (error) {
    console.error('❌ Error obteniendo historial de WHAPI:', error.message);
    
    // Información adicional para debug
    console.log('\n🔍 Debug Information:');
    console.log(`- WHAPI_API_URL: ${process.env.WHAPI_API_URL ? 'SET' : 'NOT SET'}`);
    console.log(`- WHAPI_TOKEN: ${process.env.WHAPI_TOKEN ? 'SET (length: ' + process.env.WHAPI_TOKEN.length + ')' : 'NOT SET'}`);
    
    return [];
  }
}

// Paso 2: Obtener información del cliente (perfil y etiquetas)
async function getClientProfile(chatId) {
  console.log('\n👤 PASO 2: Obteniendo perfil del cliente desde BD (fuente de verdad)...');
  
  try {
    // FUENTE DE VERDAD: Buscar primero en la base de datos
    console.log('🔍 Buscando cliente en base de datos...');
    const clientFromDB = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER },
      select: {
        name: true,
        userName: true,
        label1: true,
        label2: true,
        label3: true,
        phoneNumber: true,
        chatId: true
      }
    });

    if (clientFromDB) {
      console.log('✅ Cliente encontrado en BD (fuente de verdad)');
      
      // Procesar etiquetas desde los campos label1, label2, label3
      const labels = [clientFromDB.label1, clientFromDB.label2, clientFromDB.label3]
        .filter(label => label && label.trim() !== '')
        .map(label => ({ name: label }));

      const profile = {
        name: clientFromDB.name || clientFromDB.userName || 'Cliente',
        labels: labels,
        type: 'contact',
        isContact: true,
        phone: PHONE_NUMBER,
        source: 'database'
      };

      console.log('✅ Perfil del cliente obtenido desde BD:');
      console.log(`  📱 Nombre: ${profile.name}`);
      console.log(`  🏷️ Etiquetas: ${profile.labels.length > 0 ? profile.labels.map(l => l.name).join(', ') : 'Sin etiquetas'}`);
      console.log(`  📞 Teléfono: ${profile.phone}`);
      console.log(`  🗃️ Fuente: Base de Datos (fuente de verdad)`);

      return profile;
    }

    // FALLBACK: Si no existe en BD, obtener desde WHAPI
    console.log('⚠️ Cliente no encontrado en BD, usando WHAPI como fallback...');
    
    const chatResponse = await fetchWithRetry(`${process.env.WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const chatData = await chatResponse.json();
    
    // Obtener información del contacto
    let contactInfo = null;
    if (chatData.contact_id) {
      try {
        const contactResponse = await fetchWithRetry(`${process.env.WHAPI_API_URL}/contacts/${chatData.contact_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        contactInfo = await contactResponse.json();
      } catch (error) {
        console.warn('⚠️ No se pudo obtener info del contacto:', error.message);
      }
    }

    const profile = {
      name: chatData.name || contactInfo?.name || 'Cliente',
      labels: chatData.labels || [],
      type: chatData.type || 'contact',
      isContact: !!contactInfo,
      phone: PHONE_NUMBER,
      source: 'whapi_fallback'
    };

    console.log('✅ Perfil del cliente obtenido desde WHAPI (fallback):');
    console.log(`  📱 Nombre: ${profile.name}`);
    console.log(`  🏷️ Etiquetas: ${profile.labels.length > 0 ? profile.labels.map(l => l.name || l).join(', ') : 'Sin etiquetas'}`);
    console.log(`  📞 Teléfono: ${profile.phone}`);
    console.log(`  🗃️ Fuente: WHAPI (fallback)`);

    return profile;
    
  } catch (error) {
    console.error('❌ Error obteniendo perfil del cliente:', error.message);
    return {
      name: 'Cliente',
      labels: [],
      type: 'contact',
      isContact: false,
      phone: PHONE_NUMBER,
      source: 'default'
    };
  }
}

// Paso 3: Formatear conversación con contexto del cliente
function formatConversationWithContext(messages, clientProfile) {
  console.log('\n📝 PASO 3: Formateando conversación con contexto...');
  
  if (messages.length === 0) {
    console.log('⚠️ No hay mensajes para formatear');
    return 'Sin historial de conversación disponible.';
  }
  // Crear header con información del cliente
  const labelsText = clientProfile.labels.length > 0 
    ? clientProfile.labels.map(l => l.name || l).join(', ')
    : 'Sin etiquetas';
  
  const clientHeader = `=== INFORMACIÓN DEL CLIENTE ===
Nombre: ${clientProfile.name}
Teléfono: ${clientProfile.phone}
Etiquetas actuales: ${labelsText}
Tipo de contacto: ${clientProfile.isContact ? 'En agenda' : 'No guardado'}

=== HISTORIAL DE CONVERSACIÓN ===`;

  // Ordenar por timestamp (más antiguos primero)
  const sortedMessages = messages.sort((a, b) => {
    const timestampA = a.timestamp || 0;
    const timestampB = b.timestamp || 0;
    return timestampA - timestampB;
  });
  
  const conversationHistory = sortedMessages.map((msg, index) => {
    const sender = msg.from_name || (msg.from_me ? 'Bot TeAlquilamos' : clientProfile.name);
    const timestamp = msg.timestamp ? 
      new Date(msg.timestamp * 1000).toLocaleString('es-CO', { 
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Sin fecha';
    
    let content = '';
    if (msg.text?.body) {
      content = msg.text.body;
    } else if (msg.body) {
      content = msg.body;
    } else if (msg.type === 'image') {
      content = '[Imagen enviada]';
    } else if (msg.type === 'voice' || msg.type === 'audio') {
      content = '[Audio/Voz enviada]';
    } else if (msg.type === 'document') {
      content = '[Documento enviado]';
    } else {
      content = `[${msg.type || 'Mensaje multimedia'}]`;
    }
    
    return `${sender} (${timestamp}): ${content}`;
  }).join('\n\n');
  
  const fullContext = `${clientHeader}\n\n${conversationHistory}`;
  
  console.log(`✅ Contexto completo generado: ${fullContext.length} caracteres`);
  console.log(`📄 Header del cliente: ${clientProfile.name} - Etiquetas: ${labelsText}`);
  console.log(`📄 Preview conversación: ${conversationHistory.substring(0, 200)}...`);
  
  return fullContext;
}

// Paso 4: Análisis con OpenAI Assistant
async function analyzeWithOpenAI(conversation) {
  console.log('\n🤖 PASO 4: Analizando con OpenAI Assistant...');
  
  try {
    console.log(`🎯 Assistant ID: ${process.env.CRM_ASSISTANT_ID}`);
    console.log(`📊 Longitud de conversación: ${conversation.length} caracteres`);
    
    // Crear thread
    const thread = await openai.beta.threads.create();
    console.log(`🧵 Thread creado: ${thread.id}`);
    
    // Agregar mensaje
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: conversation
    });
    console.log('📩 Mensaje agregado al thread');
    
    // Ejecutar Assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.CRM_ASSISTANT_ID
    });
    console.log(`🏃 Run iniciado: ${run.id}`);
    
    // Esperar a que termine
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    const maxAttempts = 30; // 30 segundos máximo
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      if (attempts >= maxAttempts) {
        throw new Error('Timeout esperando respuesta del Assistant');
      }
      
      console.log(`⏳ Estado: ${runStatus.status} (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
    }
    
    if (runStatus.status !== 'completed') {
      throw new Error(`Assistant run falló con estado: ${runStatus.status}`);
    }
    
    console.log('✅ Assistant run completado');
    
    // Obtener respuesta
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];
    
    if (!lastMessage || !lastMessage.content[0] || lastMessage.content[0].type !== 'text') {
      throw new Error('No se recibió respuesta de texto del Assistant');
    }
    
    const responseText = lastMessage.content[0].text.value;
    console.log('📄 Respuesta cruda del Assistant:');
    console.log(responseText);
    
    // Parsear JSON
    const result = JSON.parse(responseText);
    
    // Validar estructura
    const requiredFields = ['profileStatus', 'proximaAccion', 'fechaProximaAccion', 'prioridad'];
    const missingFields = requiredFields.filter(field => !result.hasOwnProperty(field));
    
    if (missingFields.length > 0) {
      throw new Error(`Campos faltantes en respuesta: ${missingFields.join(', ')}`);
    }
    
    // Validar tipos y rangos
    if (typeof result.prioridad !== 'number' || result.prioridad < 1 || result.prioridad > 3) {
      throw new Error(`Prioridad inválida: ${result.prioridad}. Debe ser 1, 2 o 3`);
    }
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.fechaProximaAccion)) {
      throw new Error(`Fecha inválida: ${result.fechaProximaAccion}. Debe ser YYYY-MM-DD`);
    }
    
    console.log('✅ Análisis CRM completado y validado');
    console.log('📊 Resultado:', JSON.stringify(result, null, 2));
    
    // Guardar threadId antes de limpiar
    result.threadId = thread.id;
    
    // Limpiar thread
    await openai.beta.threads.del(thread.id);
    console.log('🧹 Thread limpiado');
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en análisis OpenAI:', error.message);
    
    // Debug adicional
    console.log('\n🔍 Debug OpenAI:');
    console.log(`- API Key: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`- Assistant ID: ${process.env.CRM_ASSISTANT_ID || 'NOT SET'}`);
    
    return null;
  }
}

// Paso 5: Actualizar base de datos
async function updateDatabase(result, additionalThreadId = null) {
  console.log('\n💾 PASO 5: Actualizando base de datos...');
  
  if (!result) {
    console.log('⚠️ No hay resultado para actualizar en BD');
    return false;
  }
  
  try {
    // Verificar si el cliente existe
    const existingClient = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER }
    });
    
    if (!existingClient) {
      console.log('⚠️ Cliente no encontrado en BD, creando registro...');
      
      await prisma.clientView.create({
        data: {
          phoneNumber: PHONE_NUMBER,
          chatId: CHAT_ID,
          profileStatus: result.profileStatus,
          proximaAccion: result.proximaAccion,
          fechaProximaAccion: new Date(result.fechaProximaAccion),
          prioridad: result.prioridad,
          threadId: result.threadId || additionalThreadId,
          lastActivity: new Date()
        }
      });
      
      console.log('✅ Cliente creado en BD');
    } else {
      console.log('👤 Cliente encontrado, actualizando...');
      
      await prisma.clientView.update({
        where: { phoneNumber: PHONE_NUMBER },
        data: {
          profileStatus: result.profileStatus,
          proximaAccion: result.proximaAccion,
          fechaProximaAccion: new Date(result.fechaProximaAccion),
          prioridad: result.prioridad,
          threadId: result.threadId || additionalThreadId,
          lastActivity: new Date()
        }
      });
      
      console.log('✅ Cliente actualizado en BD');
    }
    
    // Verificar la actualización
    const updatedClient = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER },
      select: {
        phoneNumber: true,
        userName: true,
        profileStatus: true,
        proximaAccion: true,
        fechaProximaAccion: true,
        prioridad: true,
        lastActivity: true
      }
    });
    
    console.log('\n📋 Estado final en BD:');
    console.log(JSON.stringify(updatedClient, null, 2));
    
    return true;
    
  } catch (error) {
    console.error('❌ Error actualizando BD:', error.message);
    return false;
  }
}

// Función principal
async function main() {
  const startTime = Date.now();
  
  try {
    // Verificar variables de entorno
    const requiredEnvs = ['WHAPI_API_URL', 'WHAPI_TOKEN', 'OPENAI_API_KEY', 'CRM_ASSISTANT_ID'];
    const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
    
    if (missingEnvs.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingEnvs.join(', ')}`);
    }
    
    // Paso 1: Obtener historial
    const messages = await fetchConversationHistory();
    
    if (messages.length === 0) {
      console.log('⚠️ No se encontraron mensajes. Terminando prueba.');
      return;
    }
    
    // Paso 2: Obtener perfil del cliente
    const clientProfile = await getClientProfile(CHAT_ID);
    
    // Paso 3: Formatear conversación con contexto
    const formattedConversation = formatConversationWithContext(messages, clientProfile);
    
    // Paso 4: Análisis OpenAI
    const analysisResult = await analyzeWithOpenAI(formattedConversation);
    
    if (!analysisResult) {
      console.log('⚠️ El análisis falló. Terminando prueba.');
      return;
    }
    
    // Paso 5: Actualizar BD
    const dbSuccess = await updateDatabase(analysisResult);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 PRUEBA COMPLETADA');
    console.log('═'.repeat(60));
    console.log(`⏱️ Duración total: ${duration} segundos`);
    console.log(`📱 Usuario procesado: ${PHONE_NUMBER}`);
    console.log(`💬 Mensajes analizados: ${messages.length}`);
    console.log(`💾 BD actualizada: ${dbSuccess ? '✅ SÍ' : '❌ NO'}`);
    console.log('═'.repeat(60));
    
    if (dbSuccess) {
      console.log('\n🚀 PRÓXIMOS PASOS:');
      console.log('1. Verificar datos en Prisma Studio o BD directamente');
      console.log('2. Revisar que los campos CRM tengan sentido');
      console.log('3. Ejecutar el cron diario para probar seguimiento');
      console.log('4. Revisar logs de OpenAI Assistant en dashboard');
    }
    
  } catch (error) {
    console.error('\n💥 ERROR CRÍTICO:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión a BD cerrada');
  }
}

// Manejo de errores globales
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Ejecutar script
if (require.main === module) {
  main();
}