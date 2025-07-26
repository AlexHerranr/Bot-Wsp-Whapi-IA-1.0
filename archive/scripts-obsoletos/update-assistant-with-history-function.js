/**
 * Script para actualizar el asistente de OpenAI con la nueva función de inyección de historial
 */

import OpenAI from 'openai';
import { getConfig } from '../src/config/environment.js';
import { generateOpenAISchemas } from '../src/functions/registry/function-registry.js';

const config = getConfig();

// Crear cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.openaiTimeout,
  maxRetries: config.openaiRetries
});

async function updateAssistant() {
  try {
    console.log('🔄 Actualizando asistente de OpenAI con nueva función de inyección de historial...\n');
    
    // Obtener el ID del asistente desde las variables de entorno
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    
    if (!assistantId) {
      throw new Error('OPENAI_ASSISTANT_ID no está configurado en las variables de entorno');
    }
    
    console.log(`📋 ID del asistente: ${assistantId}`);
    
    // Obtener esquemas de funciones actualizados
    const functionSchemas = generateOpenAISchemas();
    
    console.log('📊 Funciones disponibles:');
    functionSchemas.forEach(fn => {
      console.log(`  - ${fn.name}: ${fn.description}`);
    });
    
    // Verificar que la nueva función esté incluida
    const hasInjectHistory = functionSchemas.some(fn => fn.name === 'inject_history');
    
    if (!hasInjectHistory) {
      throw new Error('La función inject_history no está disponible en el registro');
    }
    
    console.log('\n✅ Función inject_history encontrada en el registro');
    
    // Actualizar el asistente
    console.log('\n🔄 Actualizando asistente...');
    
    const updatedAssistant = await openai.beta.assistants.update(assistantId, {
      tools: functionSchemas.map(schema => ({
        type: 'function',
        function: schema
      }))
    });
    
    console.log('✅ Asistente actualizado exitosamente!');
    console.log(`📋 ID: ${updatedAssistant.id}`);
    console.log(`📝 Nombre: ${updatedAssistant.name}`);
    console.log(`🔧 Herramientas: ${updatedAssistant.tools.length}`);
    
    // Mostrar herramientas actualizadas
    console.log('\n📋 Herramientas configuradas:');
    updatedAssistant.tools.forEach((tool, index) => {
      if (tool.type === 'function') {
        console.log(`  ${index + 1}. ${tool.function.name}: ${tool.function.description}`);
      }
    });
    
    console.log('\n🎯 Función de inyección de historial configurada exitosamente!');
    console.log('\n📝 Notas importantes:');
    console.log('- La función inject_history está ahora disponible para el asistente');
    console.log('- El asistente puede llamar esta función cuando necesite inyectar historial');
    console.log('- La función incluye validaciones y optimizaciones automáticas');
    console.log('- Se aplica compresión automática para historiales largos');
    console.log('- Se evitan duplicados mediante cache inteligente');
    
  } catch (error) {
    console.error('❌ Error actualizando asistente:', error.message);
    
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  updateAssistant();
}

export { updateAssistant }; 