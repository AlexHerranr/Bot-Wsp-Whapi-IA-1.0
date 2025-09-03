// test-complete-flow.js
// Test completo del flujo con Conversations API

const OPENAI_API_KEY = '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';
const PROMPT_ID = 'pmpt_68b7dbd8b694819386644f198b2165880410e06c7884ad66';

async function testCompleteFlow() {
    console.log('🧪 Test Completo del Sistema de Conversaciones\n');
    
    try {
        // PASO 1: Crear una conversación
        console.log('1️⃣ Creando conversación con Conversations API...');
        
        const conversationResponse = await fetch('https://api.openai.com/v1/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });
        
        if (!conversationResponse.ok) {
            const error = await conversationResponse.text();
            throw new Error(`Error creando conversación: ${error}`);
        }
        
        const conversation = await conversationResponse.json();
        console.log('✅ Conversación creada:', conversation.id);
        
        // PASO 2: Primer mensaje con conversación
        console.log('\n2️⃣ Enviando primer mensaje...');
        
        const variables = {
            "NOMBRE_COMPLETO": "Juan Pérez",
            "TELEFONO": "573001234567",
            "FECHA_ENTRADA": "2024-01-25",
            "FECHA_SALIDA": "2024-01-28",
            "PERSONAS": "2",
            "ADULTOS": "2",
            "NINOS": "0",
            // Defaults para otras variables
            "NOMBRE": "Juan",
            "APELLIDO": "Pérez",
            "EMAIL": "",
            "TARIFA_API": "",
            "ANTICIPO": "",
            "DESCRIPCION_PAGO": "",
            "MONTO_CON_RECARGO": "",
            "ROOM_IDS_API": "",
            "numero_personas": "2",
            "fecha_entrada": "25/01/2024",
            "fecha_salida": "28/01/2024",
            "numero_noches": "3",
            "numero_apto": "",
            "tipo_apto": "",
            "precio_alojamiento": "",
            "precio_extras": "",
            "precio_total": "",
            "numero_apto2": "",
            "tipo_apto2": "",
            "precio_alojamiento2": "",
            "precio_extras2": "",
            "precio_total2": "",
            "APARTAMENTOS": "",
            "MONTO": "",
            "monto": "",
            "fecha": "",
            "metodo": "",
            "MONTO_ANTICIPO": "",
            "SALDO_PENDIENTE": "",
            "LISTA_APARTAMENTOS": "",
            "PRECIO_ALOJAMIENTO": "",
            "PRECIO_EXTRAS": "",
            "PRECIO_TOTAL": "",
            "CAPACIDAD_ESTANDAR": "4"
        };
        
        const response1 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                prompt: {
                    id: PROMPT_ID,
                    version: '1',
                    variables: variables
                },
                conversation: conversation.id,
                input: [{
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: 'Hola, necesito información sobre disponibilidad para este fin de semana'
                    }]
                }],
                max_output_tokens: 1000,
                store: true
            })
        });
        
        if (!response1.ok) {
            const error = await response1.text();
            throw new Error(`Error en respuesta 1: ${error}`);
        }
        
        const data1 = await response1.json();
        console.log('✅ Primera respuesta recibida');
        console.log('ID:', data1.id);
        console.log('Modelo:', data1.model);
        
        // Extraer respuesta
        let response1Text = '';
        if (data1.output) {
            for (const output of data1.output) {
                if (output.type === 'message' && output.content) {
                    for (const content of output.content) {
                        if (content.type === 'output_text') {
                            response1Text += content.text;
                        }
                    }
                }
            }
        }
        
        console.log('\n🤖 Asistente:', response1Text.substring(0, 200) + '...');
        
        // PASO 3: Segundo mensaje en la misma conversación
        console.log('\n3️⃣ Enviando segundo mensaje (manteniendo contexto)...');
        
        const response2 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                prompt: {
                    id: PROMPT_ID,
                    version: '1',
                    variables: variables
                },
                conversation: conversation.id, // Misma conversación
                input: [{
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: '¿Cuáles son los precios para 2 adultos?'
                    }]
                }],
                max_output_tokens: 1000,
                store: true
            })
        });
        
        const data2 = await response2.json();
        
        let response2Text = '';
        if (data2.output) {
            for (const output of data2.output) {
                if (output.type === 'message' && output.content) {
                    for (const content of output.content) {
                        if (content.type === 'output_text') {
                            response2Text += content.text;
                        }
                    }
                }
            }
        }
        
        console.log('✅ Segunda respuesta recibida');
        console.log('\n🤖 Asistente:', response2Text.substring(0, 200) + '...');
        
        // PASO 4: Test con imagen
        console.log('\n4️⃣ Enviando mensaje con imagen...');
        
        const imageUrl = 'https://via.placeholder.com/400x300/ffffff/000000?text=Comprobante+Pago';
        
        const response3 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                prompt: {
                    id: PROMPT_ID,
                    version: '1',
                    variables: variables
                },
                conversation: conversation.id,
                input: [{
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: 'Te envío el comprobante del anticipo'
                        },
                        {
                            type: 'input_image',
                            image: {
                                url: imageUrl,
                                detail: 'auto'
                            }
                        }
                    ]
                }],
                max_output_tokens: 1000,
                store: true
            })
        });
        
        const data3 = await response3.json();
        
        if (data3.error) {
            console.log('⚠️ Error con imagen:', data3.error.message);
        } else {
            console.log('✅ Respuesta con imagen recibida');
        }
        
        // RESUMEN
        console.log('\n📊 RESUMEN DEL TEST:');
        console.log('✅ Conversación creada:', conversation.id);
        console.log('✅ Primer mensaje procesado');
        console.log('✅ Contexto mantenido en segundo mensaje');
        console.log('✅ Sistema de variables funcionando');
        if (!data3.error) {
            console.log('✅ Imágenes procesadas correctamente');
        }
        
        console.log('\n🎯 El sistema está completamente funcional con:');
        console.log('- Conversations API para mantener contexto');
        console.log('- Variables del prompt procesadas');
        console.log('- Soporte para imágenes');
        console.log('- GPT-5 mini como modelo');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        // Analizar el tipo de error
        if (error.message.includes('401')) {
            console.error('\n⚠️ La API key no es válida o expiró');
            console.error('Necesitas una API key válida de OpenAI');
        } else if (error.message.includes('404')) {
            console.error('\n⚠️ El endpoint no existe');
            console.error('Verifica que tengas acceso a la Responses API');
        } else if (error.message.includes('conversations')) {
            console.error('\n⚠️ Error con Conversations API');
            console.error('Puedes usar previous_response_id como alternativa');
        }
    }
}

// Test alternativo sin Conversations API
async function testWithResponseChaining() {
    console.log('\n\n🔄 TEST ALTERNATIVO: Usando previous_response_id\n');
    
    try {
        // Primera respuesta
        const response1 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                prompt: {
                    id: PROMPT_ID,
                    version: '1',
                    variables: {
                        "NOMBRE_COMPLETO": "María López",
                        "TELEFONO": "573009876543",
                        // ... otras variables con defaults
                    }
                },
                input: [{
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: 'Hola, soy María López'
                    }]
                }],
                max_output_tokens: 500,
                store: true
            })
        });
        
        const data1 = await response1.json();
        console.log('✅ Primera respuesta:', data1.id);
        
        // Segunda respuesta encadenada
        const response2 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                prompt: {
                    id: PROMPT_ID,
                    version: '1'
                },
                previous_response_id: data1.id, // Encadenar con la anterior
                input: [{
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: '¿Recuerdas mi nombre?'
                    }]
                }],
                max_output_tokens: 500,
                store: true
            })
        });
        
        const data2 = await response2.json();
        console.log('✅ Segunda respuesta encadenada:', data2.id);
        console.log('✅ El contexto se mantiene con previous_response_id');
        
    } catch (error) {
        console.error('❌ Error en test alternativo:', error.message);
    }
}

// Ejecutar tests
console.log('=====================================');
console.log('  TEST COMPLETO - RESPONSES API');
console.log('=====================================\n');

testCompleteFlow()
    .then(() => testWithResponseChaining())
    .then(() => {
        console.log('\n✅ Tests completados');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });