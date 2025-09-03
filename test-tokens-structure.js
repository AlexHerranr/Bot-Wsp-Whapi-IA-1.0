const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.test' });

async function testTokenStructure() {
    const apiKey = process.env.OPENAI_API_KEY;
    const promptId = process.env.OPENAI_PROMPT_ID;
    
    console.log('🔍 ANALIZANDO ESTRUCTURA DE RESPUESTA GPT-5 MINI\n');
    
    try {
        // Test 1: Con instrucciones inline
        console.log('1️⃣ Test con instrucciones inline:');
        const response1 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-5-mini-2025-08-07',
                instructions: 'Eres un asistente de hotel. Responde brevemente.',
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: '¿Cuál es el precio?' }]
                    }
                ],
                max_output_tokens: 50,
                store: true
            })
        });

        const data1 = await response1.json();
        
        console.log('\nRespuesta completa:');
        console.log(JSON.stringify(data1, null, 2));
        
        // Test 2: Con Prompt ID
        console.log('\n\n2️⃣ Test con Prompt ID:');
        const response2 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: {
                    id: promptId,
                    version: "1",
                    variables: {
                        // Todas las variables con valores por defecto
                        FECHA_ENTRADA: "15/01/2024",
                        FECHA_SALIDA: "20/01/2024",
                        NOMBRE: "Juan",
                        APELLIDO: "Pérez",
                        EMAIL: "juan@example.com",
                        TELEFONO: "573001234567",
                        ADULTOS: "2",
                        TARIFA_API: "150",
                        ANTICIPO: "75",
                        DESCRIPCION_PAGO: "Transferencia bancaria",
                        MONTO_CON_RECARGO: "155",
                        ROOM_IDS_API: "101,102",
                        NINOS: "0",
                        numero_personas: "2",
                        fecha_entrada: "15/01/2024",
                        fecha_salida: "20/01/2024",
                        numero_noches: "5",
                        numero_apto: "101",
                        tipo_apto: "Estándar",
                        precio_alojamiento: "750",
                        precio_extras: "0",
                        precio_total: "750",
                        numero_apto2: "",
                        tipo_apto2: "",
                        precio_alojamiento2: "0",
                        precio_extras2: "0",
                        precio_total2: "0",
                        PERSONAS: "2",
                        APARTAMENTOS: "101",
                        MONTO: "750",
                        monto: "750",
                        fecha: "15/01/2024",
                        metodo: "Transferencia",
                        MONTO_ANTICIPO: "375",
                        NOMBRE_COMPLETO: "Juan Pérez",
                        SALDO_PENDIENTE: "375",
                        LISTA_APARTAMENTOS: "Apartamento 101",
                        PRECIO_ALOJAMIENTO: "750",
                        PRECIO_EXTRAS: "0",
                        PRECIO_TOTAL: "750",
                        CAPACIDAD_ESTANDAR: "2",
                        FECHA_ACTUAL: new Date().toLocaleDateString('es-CO'),
                        HORA_ACTUAL: new Date().toLocaleTimeString('es-CO')
                    }
                },
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: 'Hola' }]
                    }
                ],
                max_output_tokens: 50,
                store: true
            })
        });

        const data2 = await response2.json();
        
        console.log('\nRespuesta completa:');
        console.log(JSON.stringify(data2, null, 2));
        
        // Análisis de tokens
        console.log('\n\n📊 ANÁLISIS DE TOKENS:');
        console.log('Test 1 - usage:', data1.usage);
        console.log('Test 2 - usage:', data2.usage);
        
        // Verificar campos de tokens
        if (data1.usage) {
            console.log('\n✅ Campos de tokens disponibles en GPT-5 mini:');
            Object.keys(data1.usage).forEach(key => {
                console.log(`- ${key}: ${data1.usage[key]}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTokenStructure();
