// test-gpt5.js
// Test de la API Responses con GPT-5

const OPENAI_API_KEY = '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';
const PROMPT_ID = 'pmpt_68b77888dee08196b8eda3b7dd55710c010ad598dbee3811';

async function testGPT5() {
    console.log('🧪 Iniciando prueba con GPT-5...\n');
    
    try {
        const userMessage = "Hola, quisiera información sobre disponibilidad para este fin de semana. ¿Tienen habitaciones disponibles?";
        
        console.log('📤 Mensaje del cliente:', userMessage);
        console.log('🤖 Modelo: GPT-5');
        console.log('🔑 Prompt ID:', PROMPT_ID);
        console.log('\n⏳ Enviando a OpenAI Responses API...\n');
        
        // Llamada con GPT-5
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-5',
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
        
        console.log('\n🤖 Respuesta del asistente (GPT-5):');
        console.log('---');
        console.log(assistantResponse);
        console.log('---\n');
        
        console.log('✅ ¡GPT-5 funciona correctamente!');
        
    } catch (error) {
        console.error('❌ Error durante la prueba:');
        console.error('Mensaje:', error.message);
        
        // Si el error es por reasoning.effort, intentar sin prompt ID
        if (error.message.includes('reasoning.effort')) {
            console.log('\n🔄 Reintentando sin prompt ID...\n');
            await testGPT5WithoutPrompt();
        }
    }
}

async function testGPT5WithoutPrompt() {
    try {
        const userMessage = "Hola, quisiera información sobre disponibilidad para este fin de semana.";
        
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-5',
                instructions: "Eres un asistente de reservas hoteleras para TeAlquilamos. Sé amable y profesional.",
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
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(JSON.stringify(data.error));
        }
        
        console.log('✅ Respuesta con instrucciones inline:');
        console.log('- Modelo:', data.model);
        
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
        
        console.log('\n🤖 Respuesta:');
        console.log('---');
        console.log(assistantResponse);
        console.log('---');
        
    } catch (error) {
        console.error('\n❌ Error con instrucciones inline:', error.message);
    }
}

// Ejecutar
console.log('====================================');
console.log('  TEST DE GPT-5 CON RESPONSES API');
console.log('====================================\n');

testGPT5()
    .then(() => {
        console.log('\n✅ Script finalizado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });