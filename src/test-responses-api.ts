// src/test-responses-api.ts
// Script de prueba para verificar la integración con Responses API

import OpenAI from 'openai';

// Configuración
const OPENAI_API_KEY = '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';
const PROMPT_ID = 'pmpt_68b77888dee08196b8eda3b7dd55710c010ad598dbee3811';

// Inicializar cliente
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// Función principal de prueba
async function testResponsesAPI() {
    console.log('🧪 Iniciando prueba de Responses API...\n');
    
    try {
        // Simular mensaje de cliente
        const userMessage = "Hola, quisiera información sobre disponibilidad para este fin de semana. ¿Tienen habitaciones disponibles?";
        
        console.log('📤 Mensaje del cliente:', userMessage);
        console.log('🔑 Usando Prompt ID:', PROMPT_ID);
        console.log('\n⏳ Enviando a OpenAI Responses API...\n');
        
        // Llamar a Responses API
        const response = await openai.responses.create({
            model: 'gpt-4o',
            prompt: {
                id: PROMPT_ID,
                version: '1'
            },
            input: [{
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: userMessage
                }]
            }],
            max_output_tokens: 500,
            temperature: 0.7
        });
        
        console.log('✅ Respuesta recibida!\n');
        console.log('📋 Detalles de la respuesta:');
        console.log('- ID:', response.id);
        console.log('- Modelo:', response.model);
        console.log('- Estado:', response.status);
        console.log('- Tokens usados:', response.usage?.total_tokens || 'N/A');
        
        // Extraer el contenido de la respuesta
        let assistantResponse = '';
        if (response.output && Array.isArray(response.output)) {
            for (const output of response.output) {
                if (output.type === 'message' && output.content) {
                    for (const contentItem of output.content) {
                        if (contentItem.type === 'output_text') {
                            assistantResponse += contentItem.text;
                        }
                    }
                }
            }
        }
        
        console.log('\n🤖 Respuesta del asistente:');
        console.log('---');
        console.log(assistantResponse);
        console.log('---\n');
        
        // Prueba de conversación continua
        console.log('🔄 Probando conversación continua...\n');
        
        const followUpMessage = "¿Cuáles son los precios?";
        console.log('📤 Mensaje de seguimiento:', followUpMessage);
        
        const followUpResponse = await openai.responses.create({
            model: 'gpt-4o',
            prompt: {
                id: PROMPT_ID,
                version: '1'
            },
            input: [{
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: followUpMessage
                }]
            }],
            previous_response_id: response.id, // Mantener contexto
            max_output_tokens: 500,
            temperature: 0.7
        });
        
        // Extraer respuesta de seguimiento
        let followUpAssistantResponse = '';
        if (followUpResponse.output && Array.isArray(followUpResponse.output)) {
            for (const output of followUpResponse.output) {
                if (output.type === 'message' && output.content) {
                    for (const contentItem of output.content) {
                        if (contentItem.type === 'output_text') {
                            followUpAssistantResponse += contentItem.text;
                        }
                    }
                }
            }
        }
        
        console.log('\n🤖 Respuesta de seguimiento:');
        console.log('---');
        console.log(followUpAssistantResponse);
        console.log('---\n');
        
        console.log('✅ ¡Prueba completada exitosamente!');
        console.log('\n📊 Resumen:');
        console.log('- Primera respuesta ID:', response.id);
        console.log('- Segunda respuesta ID:', followUpResponse.id);
        console.log('- Contexto mantenido:', followUpResponse.previous_response_id === response.id ? 'Sí' : 'No');
        
    } catch (error: any) {
        console.error('❌ Error durante la prueba:');
        console.error('Tipo:', error.constructor.name);
        console.error('Mensaje:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
    }
}

// Ejecutar prueba
console.log('====================================');
console.log('  TEST DE OPENAI RESPONSES API');
console.log('====================================\n');

testResponsesAPI()
    .then(() => {
        console.log('\n✅ Script finalizado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });