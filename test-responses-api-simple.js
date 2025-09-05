// Test simple y directo de la API de Responses
require('dotenv').config();
const https = require('https');

// Configuración
const API_KEY = process.env.OPENAI_API_KEY;
const PROMPT_ID = process.env.OPENAI_PROMPT_ID || 'pmpt_68b7dbd8b694819386644f198b2165880410e06c7884ad66';

console.log('=== TEST SIMPLE DE RESPONSES API ===\n');
console.log('API Key presente:', !!API_KEY);
console.log('Prompt ID:', PROMPT_ID);

// Función para llamar a la API
function callAPI(message, previousResponseId = null) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            prompt: {
                id: PROMPT_ID
                // NO incluir version para usar la default
            },
            input: [{
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: message
                }]
            }],
            max_output_tokens: 4096,
            store: true,
            ...(previousResponseId && { previous_response_id: previousResponseId })
        });

        console.log('\n📤 Enviando request...');
        console.log('Previous Response ID:', previousResponseId || 'ninguno (primera mensaje)');

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
                console.log('📥 Status:', res.statusCode);
                
                try {
                    const parsed = JSON.parse(responseData);
                    
                    if (res.statusCode !== 200) {
                        console.error('❌ Error de API:', responseData);
                        reject(new Error(`API Error ${res.statusCode}: ${responseData}`));
                    } else {
                        console.log('✅ Respuesta recibida');
                        console.log('Response ID:', parsed.id);
                        
                        // Extraer texto de la respuesta
                        if (parsed.output && parsed.output[0] && parsed.output[0].content) {
                            const textContent = parsed.output[0].content.find(c => c.type === 'text');
                            if (textContent) {
                                console.log('💬 Asistente:', textContent.text.substring(0, 200) + '...');
                            }
                        }
                        
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ Error de conexión:', e.message);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

// Test
async function test() {
    try {
        console.log('\n1️⃣ Primer mensaje: "Hola, necesito información sobre habitaciones"');
        const response1 = await callAPI('Hola, necesito información sobre habitaciones disponibles para este fin de semana');
        
        console.log('\n2️⃣ Segundo mensaje: "Para 2 adultos"');
        const response2 = await callAPI('Para 2 adultos, del viernes al domingo', response1.id);
        
        console.log('\n3️⃣ Tercer mensaje: "¿Cuál es el precio?"');
        const response3 = await callAPI('¿Cuál es el precio total?', response2.id);
        
        console.log('\n✅ Test completado exitosamente');
        console.log('Cadena de conversación:', response1.id, '->', response2.id, '->', response3.id);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

test();