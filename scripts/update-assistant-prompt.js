// scripts/update-assistant-prompt.js
// Script para actualizar el prompt del OpenAI Assistant CRM

require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ENHANCED_PROMPT = `Eres un asistente CRM para TeAlquilamos, empresa de turismo hotelero en Colombia. 

Recibirás información estructurada del cliente que incluye:
- Nombre del cliente
- Etiquetas actuales (estado del proceso comercial)
- Historial completo de conversación

Analiza toda la información y responde SOLO con JSON válido (sin texto adicional):

{
  "profileStatus": "Análisis personalizado empezando por el nombre del cliente. Ejemplo: 'El cliente Antonio, según sus etiquetas está cotizando. Analizando el historial veo que estuvo preguntando por apartamentos en Cartagena para 5 personas del 15-20 diciembre. Se le ofrecieron opciones desde $280,000/noche pero consideró el precio alto. Mostró interés en apartamentos de 3 habitaciones con vista al mar. Al final no se ha decidido y mencionó consultar con su familia.' (máx 300 caracteres)",
  "proximaAccion": "Acción específica de seguimiento basada en el análisis. Ejemplo: 'Preguntarle cómo va todo, qué ha pensado de las opciones mostradas y si necesita ver otro tipo de apartamentos' o 'Hacer seguimiento sobre su decisión de reserva y ofrecer asistencia adicional'",
  "fechaProximaAccion": "YYYY-MM-DD (fecha sugerida para la acción, basada en la urgencia del cliente y las fechas mencionadas)",
  "prioridad": 1-3  // 1=Alta (reserva urgente, fechas próximas, cliente decidido), 2=Media (cotizando, explorando opciones), 3=Baja (consulta general, fechas lejanas)
}

INSTRUCCIONES ESPECÍFICAS:
1. SIEMPRE menciona el nombre del cliente al inicio del profileStatus
2. Usa las etiquetas para entender en qué etapa está el proceso comercial
3. El análisis debe ser narrativo y contextual, no un resumen mecánico
4. La próxima acción debe ser específica y accionable
5. La prioridad debe reflejar la urgencia real del cliente
6. Interpreta correctamente las etiquetas: "cotización" = explorando opciones, "reserva" = listo para reservar, etc.

CONTEXTO EMPRESA:
- TeAlquilamos: apartamentos turísticos en Colombia (Cartagena, Santa Marta, etc.)
- Precios típicos: $150,000-$500,000 COP por noche
- Productos: estudios, apartamentos 1-4 habitaciones
- Temporadas altas: diciembre, enero, Semana Santa, vacaciones`;

async function updateAssistantPrompt() {
  console.log('🤖 Actualizando prompt del OpenAI Assistant CRM...');
  console.log('═'.repeat(60));
  
  try {
    // Obtener info actual del Assistant
    console.log('\n📋 Obteniendo información actual del Assistant...');
    const currentAssistant = await openai.beta.assistants.retrieve(process.env.CRM_ASSISTANT_ID);
    
    console.log(`✅ Assistant encontrado: ${currentAssistant.name || 'Sin nombre'}`);
    console.log(`📝 Modelo: ${currentAssistant.model}`);
    console.log(`📏 Prompt actual: ${currentAssistant.instructions?.length || 0} caracteres`);
    
    // Actualizar el prompt
    console.log('\n🔄 Actualizando prompt...');
    const updatedAssistant = await openai.beta.assistants.update(process.env.CRM_ASSISTANT_ID, {
      instructions: ENHANCED_PROMPT,
      name: "CRM Assistant TeAlquilamos - Enhanced",
      description: "Asistente CRM mejorado con contexto de cliente y etiquetas para análisis personalizado"
    });
    
    console.log('✅ Prompt actualizado exitosamente!');
    console.log(`📏 Nuevo prompt: ${updatedAssistant.instructions.length} caracteres`);
    
    // Mostrar diferencias clave
    console.log('\n🆕 Mejoras del nuevo prompt:');
    console.log('- ✅ Incluye contexto de nombre del cliente');
    console.log('- ✅ Interpreta etiquetas comerciales');
    console.log('- ✅ Análisis narrativo y contextual');
    console.log('- ✅ Acciones más específicas');
    console.log('- ✅ Priorización inteligente');
    
    console.log('\n🎯 Ejemplos de mejora esperada:');
    console.log('ANTES: "Cliente interesado en hotel boutique"');  
    console.log('AHORA: "El Sr. Antonio, según sus etiquetas está cotizando..."');
    
    console.log('\n🚀 ¡Listo! Puedes ejecutar la prueba CRM nuevamente para ver las mejoras.');
    
  } catch (error) {
    console.error('❌ Error actualizando Assistant:', error.message);
    
    // Debug info
    console.log('\n🔍 Debug Info:');
    console.log(`- Assistant ID: ${process.env.CRM_ASSISTANT_ID}`);
    console.log(`- API Key: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
    
    if (error.code === 'invalid_request_error') {
      console.log('\n💡 Posibles soluciones:');
      console.log('- Verifica que el Assistant ID sea correcto');
      console.log('- Asegúrate de tener permisos para modificar el Assistant');
      console.log('- Revisa que la API Key tenga acceso a Assistants API');
    }
  }
}

// Función para probar el Assistant actualizado
async function testUpdatedAssistant() {
  console.log('\n🧪 Probando Assistant actualizado...');
  
  const testInput = `=== INFORMACIÓN DEL CLIENTE ===
Nombre: Antonio García
Teléfono: 573001234567
Etiquetas actuales: cotización, cliente potencial
Tipo de contacto: En agenda

=== HISTORIAL DE CONVERSACIÓN ===

Antonio García (01/08/2025, 10:00 a. m.): Hola, necesito apartamento para 4 personas en Cartagena del 15 al 20 de diciembre

Bot TeAlquilamos (01/08/2025, 10:05 a. m.): ¡Hola Antonio! Perfecto, tenemos excelentes opciones para 4 personas en Cartagena. Para esas fechas (15-20 dic) te recomiendo apartamentos de 2 habitaciones. Los precios van desde $280,000 hasta $450,000 por noche dependiendo de la ubicación y amenidades.

Antonio García (01/08/2025, 10:15 a. m.): Los precios están un poco altos para mi presupuesto. ¿Tienen algo más económico?

Bot TeAlquilamos (01/08/2025, 10:20 a. m.): Entiendo Antonio. Tenemos opciones más económicas desde $220,000/noche. También podrías considerar fechas alternativas en enero que son más económicas.

Antonio García (01/08/2025, 10:30 a. m.): Déjame consultar con mi familia y te confirmo. ¿Podrías enviarme las opciones por favor?`;

  try {
    const thread = await openai.beta.threads.create();
    
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: testInput
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.CRM_ASSISTANT_ID
    });
    
    // Esperar resultado
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      if (attempts >= 20) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
    }
    
    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const responseText = messages.data[0].content[0].text.value;
      const result = JSON.parse(responseText);
      
      console.log('✅ Test exitoso! Usuario:', result);
      console.log('\n📊 Calidad del análisis:');
      console.log(`- Menciona nombre: ${result.profileStatus.includes('Antonio') ? '✅' : '❌'}`);
      console.log(`- Usa etiquetas: ${result.profileStatus.includes('cotización') || result.profileStatus.includes('cotizando') ? '✅' : '❌'}`);
      console.log(`- Análisis contextual: ${result.profileStatus.length > 100 ? '✅' : '❌'}`);
      console.log(`- Acción específica: ${result.proximaAccion.includes('opciones') || result.proximaAccion.includes('económic') ? '✅' : '❌'}`);
      
    } else {
      console.log(`⚠️ Test falló: ${runStatus.status}`);
    }
    
    await openai.beta.threads.del(thread.id);
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
  }
}

async function main() {
  await updateAssistantPrompt();
  await testUpdatedAssistant();
}

main().catch(console.error);