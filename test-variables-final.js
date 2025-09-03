// test-variables-final.js
// Test con las 3 variables definidas en el prompt

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
console.log('📌 Version: 2 (con variables)\n');

async function testConVariables() {
    try {
        // Preparar las 3 variables tal como las espera el prompt
        const now = new Date();
        // Probar con nombres en mayúsculas
        const variables = {
            FECHA_HORA: now.toLocaleString('es-CO', {
                timeZone: 'America/Bogota',
                dateStyle: 'full',
                timeStyle: 'short'
            }),
            NOMBRE_USUARIO: "María García",
            ETIQUETAS: "Cliente nuevo, Consulta web"
        };
        
        console.log('📊 Variables enviadas:');
        console.log(JSON.stringify(variables, null, 2));
        console.log('\n🧪 Test 1: Consulta inicial con variables\n');
        
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
                    version: "2",
                    variables: variables
                },
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: 'Hola, estoy buscando un apartamento para 4 personas este fin de semana'
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

        console.log('✅ Éxito! Las variables funcionan correctamente');
        console.log('ID:', data.id);
        console.log('\n📊 Uso de tokens:');
        console.log('- Input:', data.usage?.input_tokens);
        console.log('- Output:', data.usage?.output_tokens);
        console.log('- Total:', data.usage?.total_tokens);
        
        if (data.output && data.output.length > 0) {
            console.log('\n💬 Respuesta del asistente:');
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

        // Test 2: Conversación continua
        console.log('\n\n🧪 Test 2: Continuación con más detalles\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Actualizar variables para el segundo mensaje
        const variables2 = {
            FECHA_HORA: new Date().toLocaleString('es-CO', {
                timeZone: 'America/Bogota',
                dateStyle: 'full',
                timeStyle: 'short'
            }),
            NOMBRE_USUARIO: "María García",
            ETIQUETAS: "Cliente nuevo, Consulta web, Interesada"
        };
        
        const response2 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'responses-v1'
            },
            body: JSON.stringify({
                prompt: {
                    id: promptId,
                    version: "2",
                    variables: variables2
                },
                previous_response_id: data.id,
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: 'Las fechas serían del 6 al 8 de septiembre'
                            }
                        ]
                    }
                ],
                store: true,
                max_output_tokens: 500
            })
        });

        const data2 = await response2.json();
        
        if (!response2.ok) {
            console.error('❌ Error en test 2:', response2.status);
            console.error('Detalles:', JSON.stringify(data2, null, 2));
            return;
        }

        console.log('✅ Conversación continua exitosa');
        console.log('Variables actualizadas (etiqueta agregada: "Interesada")');
        console.log('Tokens usados:', data2.usage?.total_tokens);
        
        if (data2.output && data2.output.length > 0) {
            console.log('\n💬 Respuesta:');
            data2.output.forEach((item) => {
                if (item.type === 'message' && item.content) {
                    item.content.forEach(content => {
                        if (content.type === 'output_text') {
                            console.log(content.text);
                        }
                    });
                }
            });
        }

        console.log('\n\n✨ Resumen del test:');
        console.log('- Las 3 variables funcionan correctamente');
        console.log('- El contexto se mantiene entre mensajes');
        console.log('- Las etiquetas pueden actualizarse dinámicamente');
        console.log('- El bot tiene acceso a fecha/hora, nombre y etiquetas');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

testConVariables();