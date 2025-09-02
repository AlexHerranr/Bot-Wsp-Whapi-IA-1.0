// test-responses-direct.js
// Test directo de la API Responses usando fetch

const OPENAI_API_KEY = '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';
const PROMPT_ID = 'pmpt_68b77888dee08196b8eda3b7dd55710c010ad598dbee3811';

async function testResponsesAPI() {
    console.log('🧪 Iniciando prueba de Responses API...\n');
    
    try {
        const userMessage = "Hola, quisiera información sobre disponibilidad para este fin de semana. ¿Tienen habitaciones disponibles?";
        
        console.log('📤 Mensaje del cliente:', userMessage);
        console.log('🔑 Usando Prompt ID:', PROMPT_ID);
        console.log('\n⏳ Enviando a OpenAI Responses API...\n');
        
        // Primera llamada
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
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
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error ${response.status}: ${error}`);
        }
        
        const data = await response.json();
        
        console.log('✅ Respuesta recibida!\n');
        console.log('📋 Detalles de la respuesta:');
        console.log('- ID:', data.id);
        console.log('- Modelo:', data.model);
        console.log('- Estado:', data.status);
        console.log('- Tokens usados:', data.usage?.total_tokens || 'N/A');
        
        // Extraer contenido
        let assistantResponse = '';
        if (data.output && Array.isArray(data.output)) {
            for (const output of data.output) {
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
        
        const followUpResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
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
                previous_response_id: data.id,
                max_output_tokens: 500,
                temperature: 0.7
            })
        });
        
        const followUpData = await followUpResponse.json();
        
        // Extraer respuesta
        let followUpAssistantResponse = '';
        if (followUpData.output && Array.isArray(followUpData.output)) {
            for (const output of followUpData.output) {
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
        console.log('- Primera respuesta ID:', data.id);
        console.log('- Segunda respuesta ID:', followUpData.id);
        console.log('- Contexto mantenido:', followUpData.previous_response_id === data.id ? 'Sí' : 'No');
        
    } catch (error) {
        console.error('❌ Error durante la prueba:');
        console.error('Mensaje:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
    }
}

// Ejecutar
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