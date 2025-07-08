import 'dotenv/config';
import OpenAI from 'openai';
import { generateOpenAISchemas } from '../../src/functions/registry/function-registry.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.ASSISTANT_ID;

// Obtener funciones desde el registro central
const functions = generateOpenAISchemas();

async function updateAssistant() {
  if (!assistantId) {
    console.error('La variable de entorno ASSISTANT_ID no está definida.');
    return;
  }
  
  console.log(`Actualizando Assistant ${assistantId} con nuevas funciones...`);

  try {
    const updatedAssistant = await openai.beta.assistants.update(assistantId, {
      tools: [
        ...functions.map(f => ({ type: 'function', function: f }))
      ],
    });
    console.log('Assistant actualizado exitosamente:', updatedAssistant);
  } catch (error) {
    console.error('Error al actualizar el Assistant:', error);
  }
}

updateAssistant();
