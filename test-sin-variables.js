// test-sin-variables.js
// Test SIN variables - mensaje directo

const fs = require('fs');
const path = require('path');

// Leer .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').replace(/^"|"$/g, '');
        }
    }
});

const apiKey = envVars.OPENAI_API_KEY;
const promptId = envVars.OPENAI_PROMPT_ID;

console.log('🔑 API Key:', apiKey?.substring(0, 30) + '...');
console.log('📝 Prompt ID:', promptId);
console.log('\n🚀 Test SIN variables - mensaje directo\n');

async function testSinVariables() {
    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'responses-v1'
            },
            body: JSON.stringify({
                prompt: {
                    id: promptId
                    // NO variables!
                },
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: 'Hola, ¿qué apartamentos tienen disponibles para este fin de semana?'
                            }
                        ]
                    }
                ],
                store: true,
                max_output_tokens: 500
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Error:', response.status);
            console.error('Detalles:', JSON.stringify(data, null, 2));
            
            // Si falla por falta de variables, el prompt las requiere
            if (data.error?.code === 'prompt_variable_missing') {
                console.error('\n⚠️  El prompt REQUIERE variables obligatorias.');
                console.error('Variables faltantes:', data.error.message);
            }
            return;
        }

        console.log('✅ Respuesta exitosa SIN variables!');
        console.log('ID:', data.id);
        console.log('\n📊 Uso de tokens:');
        console.log('- Input:', data.usage?.input_tokens);
        console.log('- Output:', data.usage?.output_tokens);
        console.log('- Total:', data.usage?.total_tokens);
        
        if (data.output && data.output.length > 0) {
            console.log('\n💬 Respuesta:');
            data.output.forEach((item) => {
                if (item.type === 'message' && item.content) {
                    item.content.forEach(content => {
                        if (content.type === 'output_text') {
                            console.log(content.text);
                        }
                    });
                }
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSinVariables();