// scripts/update-assistant.js
require('dotenv').config({ path: '../.env' }); // Asegúrate de que cargue el .env correcto
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID;

const functionSpec = {
  type: "function",
  function: {
    name: "check_availability",
    description: "Consulta disponibilidad de habitaciones para un hotel. Responde sobre tipos de habitación, cantidad disponible para un rango de fechas y número de huéspedes.",
    parameters: {
      type: "object",
      properties: {
        check_in: { type: "string", description: "Fecha de check-in en formato YYYY-MM-DD. Obligatorio." },
        check_out: { type: "string", description: "Fecha de check-out en formato YYYY-MM-DD. Obligatorio." },
        guests: { type: "integer", description: "Número de huéspedes. Mínimo 1. Obligatorio." },
        room_type: { type: "string", enum: ["standard", "suite", "deluxe"], description: "Tipo de habitación a consultar." }
      },
      required: ["check_in", "check_out", "guests"]
    }
  }
};

async function updateAssistant() {
  if (!ASSISTANT_ID) {
    return console.error('Error: ASSISTANT_ID no está definido en tu archivo .env');
  }
  
  try {
    await openai.beta.assistants.update(ASSISTANT_ID, {
      tools: [functionSpec]
    });
    console.log('Asistente actualizado con la función "check_availability" exitosamente.');
  } catch(e) {
    console.error('Error actualizando el asistente:', e.message);
  }
}

updateAssistant();
