// Test de flujo de conversación con la API de Responses
const https = require('https');

// Configuración
const API_KEY = process.env.OPENAI_API_KEY || 'tu-api-key-aqui';
const PROMPT_ID = 'pmpt_68b7dbd8b694819386644f198b2165880410e06c7884ad66';

// Función para hacer llamadas a la API
function callResponsesAPI(messages, previousResponseId = null) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            prompt: {
                id: PROMPT_ID
            },
            input: messages,
            max_output_tokens: 4096,
            store: true,
            ...(previousResponseId && { previous_response_id: previousResponseId })
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/responses',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode !== 200) {
                        reject(new Error(`API Error ${res.statusCode}: ${responseData}`));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

// Función para extraer el texto de la respuesta
function extractText(response) {
    if (response.output && response.output.length > 0) {
        const item = response.output[0];
        if (item.type === 'message' && item.content && item.content.length > 0) {
            const textContent = item.content.find(c => c.type === 'text');
            return textContent ? textContent.text : 'No text found';
        }
    }
    return 'No output found';
}

// Test de conversación
async function testConversation() {
    console.log('=== TEST DE CONVERSACIÓN CON RESPONSES API ===\n');
    
    try {
        // Mensaje 1: Saludo inicial
        console.log('1. Enviando primer mensaje: "Hola, necesito información sobre habitaciones"');
        const response1 = await callResponsesAPI([{
            type: 'message',
            role: 'user',
            content: [{
                type: 'input_text',
                text: 'Hola, necesito información sobre habitaciones disponibles para este fin de semana'
            }]
        }]);
        
        console.log('   Response ID:', response1.id);
        console.log('   Assistant:', extractText(response1));
        console.log('   Tokens:', response1.usage);
        console.log('');

        // Mensaje 2: Seguimiento con contexto
        console.log('2. Enviando segundo mensaje con contexto: "Para 2 adultos"');
        const response2 = await callResponsesAPI([{
            type: 'message',
            role: 'user',
            content: [{
                type: 'input_text',
                text: 'Para 2 adultos, del viernes al domingo'
            }]
        }], response1.id); // Usar el ID de la respuesta anterior
        
        console.log('   Response ID:', response2.id);
        console.log('   Previous Response ID:', response1.id);
        console.log('   Assistant:', extractText(response2));
        console.log('   Tokens:', response2.usage);
        console.log('');

        // Mensaje 3: Pregunta específica
        console.log('3. Enviando tercer mensaje: "¿Cuál es el precio?"');
        const response3 = await callResponsesAPI([{
            type: 'message',
            role: 'user',
            content: [{
                type: 'input_text',
                text: '¿Cuál es el precio total?'
            }]
        }], response2.id); // Usar el ID de la respuesta anterior
        
        console.log('   Response ID:', response3.id);
        console.log('   Previous Response ID:', response2.id);
        console.log('   Assistant:', extractText(response3));
        console.log('   Tokens:', response3.usage);
        console.log('');

        // Resumen
        console.log('=== RESUMEN DE LA CONVERSACIÓN ===');
        console.log('Total de mensajes: 3');
        console.log('Cadena de IDs:');
        console.log('  1. null -> ' + response1.id);
        console.log('  2. ' + response1.id + ' -> ' + response2.id);
        console.log('  3. ' + response2.id + ' -> ' + response3.id);
        console.log('\nTokens totales usados:');
        console.log('  Input:', (response1.usage?.input_tokens || 0) + (response2.usage?.input_tokens || 0) + (response3.usage?.input_tokens || 0));
        console.log('  Output:', (response1.usage?.output_tokens || 0) + (response2.usage?.output_tokens || 0) + (response3.usage?.output_tokens || 0));
        
    } catch (error) {
        console.error('ERROR:', error.message);
        if (error.message.includes('API Error')) {
            console.error('Detalles del error de API:', error.message);
        }
    }
}

// Ejecutar el test
testConversation();