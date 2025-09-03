// test-sin-vars-confirmacion.js
// Test para confirmar que el prompt funciona sin variables

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
console.log('📌 Version: 2\n');

async function testSinVariables() {
    try {
        console.log('🧪 Test SIN variables para confirmar funcionamiento\n');
        
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'responses-v1'
            },
            body: JSON.stringify({
                prompt: {
                    id: promptId,
                    version: "2"
                    // NO variables
                },
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: '[miércoles, 3 de septiembre de 2025, 2:18 p.m.] (Usuario: María García) [Cliente nuevo]\nHola, busco apartamento para 4 personas este fin de semana'
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
            return;
        }

        console.log('✅ Funciona sin variables (contexto en el mensaje)');
        console.log('ID:', data.id);
        console.log('Tokens usados:', data.usage?.total_tokens);
        
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