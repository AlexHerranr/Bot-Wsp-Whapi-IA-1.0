import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.ASSISTANT_ID;

const functions = [{
  "name": "check_availability",
  "description": "Consulta disponibilidad en tiempo real de propiedades en Beds24",
  "parameters": {
    "type": "object",
    "properties": {
      "startDate": { 
        "type": "string", 
        "description": "Fecha de inicio en formato YYYY-MM-DD" 
      },
      "endDate": { 
        "type": "string", 
        "description": "Fecha de fin en formato YYYY-MM-DD" 
      },
      "propertyId": { 
        "type": "number", 
        "description": "ID específico de la propiedad (opcional)" 
      },
      "roomId": { 
        "type": "number", 
        "description": "ID específico de la habitación (opcional)" 
      }
    },
    "required": ["startDate", "endDate"]
  }
}];

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
