/**
 * Script para actualizar las funciones del assistant
 */

const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!ASSISTANT_ID) {
    console.error('❌ ASSISTANT_ID no encontrado en variables de entorno');
    process.exit(1);
}

// Definición de la función get_conversation_context
const getConversationContextFunction = {
    name: 'get_conversation_context',
    description: 'Obtiene contexto histórico de conversaciones anteriores con diferentes niveles de profundidad según lo necesite el assistant',
    parameters: {
        type: 'object',
        properties: {
            context_level: {
                type: 'string',
                enum: ['recent_30', 'recent_60', 'recent_100', 'recent_200'],
                description: 'Nivel de contexto: 30, 60, 100 o 200 mensajes recientes. OpenAI determinará cuánto contexto necesita para responder correctamente.'
            }
        },
        required: ['context_level']
    }
};

// Definición de la función check_availability
const checkAvailabilityFunction = {
    name: 'check_availability',
    description: 'Consulta disponibilidad en tiempo real de propiedades en Beds24',
    parameters: {
        type: 'object',
        properties: {
            startDate: {
                type: 'string',
                description: 'Fecha de inicio en formato YYYY-MM-DD'
            },
            endDate: {
                type: 'string',
                description: 'Fecha de fin en formato YYYY-MM-DD'
            }
        },
        required: ['startDate', 'endDate']
    }
};

// Definición de la función escalate_to_human
const escalateToHumanFunction = {
    name: 'escalate_to_human',
    description: 'Transfiere conversación a agente humano cuando se requiere intervención manual',
    parameters: {
        type: 'object',
        properties: {
            reason: {
                type: 'string',
                description: 'Razón del escalamiento'
            },
            urgency: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Nivel de urgencia'
            }
        },
        required: ['reason', 'urgency']
    }
};

async function updateAssistantFunctions() {
    try {
        console.log('🔄 Actualizando funciones del assistant...');
        
        // Obtener el assistant actual
        const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
        console.log(`📋 Assistant actual: ${assistant.name}`);
        
        // Preparar todas las funciones
        const functions = [
            checkAvailabilityFunction,
            escalateToHumanFunction,
            getConversationContextFunction
        ];
        
        // Convertir a formato de herramientas de OpenAI
        const tools = functions.map(func => ({
            type: 'function',
            function: func
        }));
        
        // Actualizar el assistant
        const updatedAssistant = await openai.beta.assistants.update(ASSISTANT_ID, {
            tools: tools
        });
        
        console.log('✅ Assistant actualizado exitosamente');
        console.log(`📊 Funciones configuradas: ${updatedAssistant.tools.length}`);
        
        // Mostrar las funciones actuales
        console.log('\n🔧 Funciones configuradas:');
        updatedAssistant.tools.forEach((tool, index) => {
            if (tool.type === 'function') {
                console.log(`  ${index + 1}. ${tool.function.name} - ${tool.function.description}`);
            }
        });
        
        console.log('\n🎉 Actualización completada exitosamente!');
        console.log('🤖 El assistant ahora tiene todas las funciones necesarias');
        
    } catch (error) {
        console.error('❌ Error actualizando assistant:', error.message);
        if (error.response) {
            console.error('Detalles:', error.response.data);
        }
        process.exit(1);
    }
}

// Ejecutar la actualización
updateAssistantFunctions(); 