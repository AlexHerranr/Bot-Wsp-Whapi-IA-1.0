import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.ASSISTANT_ID;

const functions = [{
  "name": "check_availability",
  "description": "Consulta disponibilidad de habitaciones para un hotel. Permite saber qué tipo de habitaciones y cuántas hay para un rango de fechas y un número de huéspedes.",
  "parameters": {
    "type": "object",
    "properties": {
      "check_in": { 
        "type": "string", 
        "description": "Fecha de check-in en formato YYYY-MM-DD. Obligatorio." 
      },
      "check_out": { 
        "type": "string", 
        "description": "Fecha de check-out en formato YYYY-MM-DD. Obligatorio." 
      },
      "guests": { 
        "type": "integer", 
        "description": "Número de huéspedes. Obligatorio." 
      },
      "room_type": { 
        "type": "string", 
        "enum": ["standard", "suite", "deluxe", "familiar"],
        "description": "Tipo de habitación a consultar. Si no se especifica, se buscan todos los tipos." 
      }
    },
    "required": ["check_in", "check_out", "guests"]
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
