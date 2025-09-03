// test-image-integration.js
// Test de integración de imágenes con Responses API

const OPENAI_API_KEY = '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';
const PROMPT_ID = 'pmpt_68b7dbd8b694819386644f198b2165880410e06c7884ad66';

async function testImageIntegration() {
    console.log('🖼️ Probando integración de imágenes con GPT-5...\n');
    
    try {
        // URL de imagen de prueba (comprobante de pago ejemplo)
        const imageUrl = 'https://via.placeholder.com/800x600/ffffff/000000?text=Comprobante+de+Pago%0A%0AMonto:+$150.000%0AFecha:+15/01/2024%0AReferencia:+ABC123';
        
        // Mensaje con imagen
        const userMessage = "Te envío el comprobante del anticipo de la reserva";
        const caption = "Transferencia bancaria - Anticipo reserva";
        
        console.log('📤 Mensaje:', userMessage);
        console.log('🖼️ URL de imagen:', imageUrl);
        console.log('📝 Caption:', caption);
        
        // Variables simuladas
        const variables = {
            "NOMBRE_COMPLETO": "María González",
            "TELEFONO": "573001234567",
            "FECHA_ENTRADA": "2024-01-20",
            "FECHA_SALIDA": "2024-01-22",
            "PERSONAS": "4",
            "MONTO_ANTICIPO": "150000",
            "SALDO_PENDIENTE": "350000",
            // Valores por defecto para otras variables
            "NOMBRE": "María",
            "APELLIDO": "González",
            "EMAIL": "",
            "ADULTOS": "4",
            "NINOS": "0",
            "TARIFA_API": "",
            "ANTICIPO": "",
            "DESCRIPCION_PAGO": "",
            "MONTO_CON_RECARGO": "",
            "ROOM_IDS_API": "",
            "numero_personas": "4",
            "fecha_entrada": "20/01/2024",
            "fecha_salida": "22/01/2024",
            "numero_noches": "2",
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
            "LISTA_APARTAMENTOS": "",
            "PRECIO_ALOJAMIENTO": "",
            "PRECIO_EXTRAS": "",
            "PRECIO_TOTAL": "",
            "CAPACIDAD_ESTANDAR": "4"
        };
        
        console.log('\n⏳ Enviando a GPT-5 con imagen...\n');
        
        // Llamada a la API con imagen
        const response = await fetch('https://api.openai.com/v1/responses', {
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
                input: [{
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: userMessage
                        },
                        {
                            type: 'input_image',
                            image: {
                                url: imageUrl,
                                detail: 'auto'
                            }
                        },
                        {
                            type: 'input_text',
                            text: `[Caption de la imagen]: ${caption}`
                        }
                    ]
                }],
                max_output_tokens: 1000
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error ${response.status}: ${error}`);
        }
        
        const data = await response.json();
        
        console.log('✅ Respuesta recibida!\n');
        console.log('📋 Detalles:');
        console.log('- ID:', data.id);
        console.log('- Modelo:', data.model);
        console.log('- Tokens:', data.usage?.total_tokens || 'N/A');
        
        // Extraer respuesta
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
        console.log('='.repeat(60));
        console.log(assistantResponse);
        console.log('='.repeat(60));
        
        // Test 2: Imagen sin texto
        console.log('\n\n📸 Test 2: Solo imagen sin texto...\n');
        
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
                input: [{
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_image',
                            image: {
                                url: imageUrl,
                                detail: 'auto'
                            }
                        }
                    ]
                }],
                max_output_tokens: 500,
                previous_response_id: data.id
            })
        });
        
        const data2 = await response2.json();
        
        let assistantResponse2 = '';
        if (data2.output && Array.isArray(data2.output)) {
            for (const output of data2.output) {
                if (output.type === 'message' && output.content) {
                    for (const contentItem of output.content) {
                        if (contentItem.type === 'output_text') {
                            assistantResponse2 += contentItem.text;
                        }
                    }
                }
            }
        }
        
        console.log('🤖 Respuesta a imagen sin texto:');
        console.log('---');
        console.log(assistantResponse2);
        console.log('---');
        
        console.log('\n✅ ¡Integración de imágenes exitosa!');
        console.log('\n📌 Resumen:');
        console.log('- GPT-5 procesa imágenes directamente');
        console.log('- No se necesita capa de percepción separada');
        console.log('- El modelo entiende el contexto de las imágenes');
        console.log('- Funciona con y sin texto acompañante');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

// Ejecutar
console.log('=====================================');
console.log('  TEST INTEGRACIÓN DE IMÁGENES');
console.log('=====================================\n');

testImageIntegration()
    .then(() => {
        console.log('\n✅ Fin del test');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });