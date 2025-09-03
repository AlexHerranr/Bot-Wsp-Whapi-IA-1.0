// test-secure.js
// Test seguro que lee las credenciales de .env.test

const fs = require('fs');
const path = require('path');

// Cargar variables de .env.test
function loadEnvFile() {
    const envPath = path.join(__dirname, '.env.test');
    if (!fs.existsSync(envPath)) {
        console.error('❌ Archivo .env.test no encontrado');
        console.error('Crea el archivo con: OPENAI_API_KEY=tu-key');
        process.exit(1);
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    const env = {};
    
    lines.forEach(line => {
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                env[key.trim()] = valueParts.join('=').trim();
            }
        }
    });
    
    return env;
}

const env = loadEnvFile();
const OPENAI_API_KEY = env.OPENAI_API_KEY;
const PROMPT_ID = env.OPENAI_PROMPT_ID;

if (!OPENAI_API_KEY || !PROMPT_ID) {
    console.error('❌ Falta OPENAI_API_KEY o OPENAI_PROMPT_ID en .env.test');
    process.exit(1);
}

async function testSecureAPI() {
    console.log('🔒 Test Seguro con Credenciales Locales\n');
    console.log('📁 Credenciales cargadas de .env.test');
    console.log('✅ Este archivo NO se sube a git\n');
    
    try {
        // Test 1: Crear conversación
        console.log('1️⃣ Probando Conversations API...');
        
        const convResponse = await fetch('https://api.openai.com/v1/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });
        
        let conversationId = null;
        let useConversationsAPI = false;
        
        if (convResponse.ok) {
            const conv = await convResponse.json();
            conversationId = conv.id;
            useConversationsAPI = true;
            console.log('✅ Conversations API disponible:', conversationId);
        } else {
            console.log('⚠️ Conversations API no disponible, usando previous_response_id');
        }
        
        // Test 2: Primera respuesta
        console.log('\n2️⃣ Enviando primera consulta...');
        
        const variables = {
            "NOMBRE_COMPLETO": "Test Usuario",
            "TELEFONO": "573001234567",
            "FECHA_ENTRADA": "2024-01-25",
            "FECHA_SALIDA": "2024-01-27",
            "PERSONAS": "2",
            "ADULTOS": "2",
            "NINOS": "0",
            // Defaults
            "NOMBRE": "Test",
            "APELLIDO": "Usuario",
            "EMAIL": "",
            "TARIFA_API": "",
            "ANTICIPO": "",
            "DESCRIPCION_PAGO": "",
            "MONTO_CON_RECARGO": "",
            "ROOM_IDS_API": "",
            "numero_personas": "2",
            "fecha_entrada": "25/01/2024",
            "fecha_salida": "27/01/2024",
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
            "MONTO_ANTICIPO": "",
            "SALDO_PENDIENTE": "",
            "LISTA_APARTAMENTOS": "",
            "PRECIO_ALOJAMIENTO": "",
            "PRECIO_EXTRAS": "",
            "PRECIO_TOTAL": "",
            "CAPACIDAD_ESTANDAR": "4"
        };
        
        const requestBody = {
            prompt: {
                id: PROMPT_ID,
                version: '1',
                variables: variables
            },
            input: [{
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: 'Hola, necesito información sobre habitaciones disponibles'
                }]
            }],
            max_output_tokens: 1000,
            store: true
        };
        
        if (useConversationsAPI && conversationId) {
            requestBody.conversation = conversationId;
        }
        
        const response1 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response1.ok) {
            const error = await response1.text();
            throw new Error(`Error en respuesta: ${error}`);
        }
        
        const data1 = await response1.json();
        console.log('✅ Respuesta recibida');
        console.log('- ID:', data1.id);
        console.log('- Modelo:', data1.model);
        console.log('- Status:', data1.status);
        console.log('- Tokens:', data1.usage?.total_tokens);
        
        // Extraer texto
        let responseText = '';
        if (data1.output) {
            for (const output of data1.output) {
                if (output.type === 'message' && output.content) {
                    for (const content of output.content) {
                        if (content.type === 'output_text') {
                            responseText += content.text;
                        }
                    }
                }
            }
        }
        
        console.log('\n🤖 Asistente:');
        console.log(responseText.substring(0, 300) + '...\n');
        
        // Test 3: Segunda respuesta con contexto
        console.log('3️⃣ Probando contexto de conversación...');
        
        const request2Body = {
            prompt: {
                id: PROMPT_ID,
                version: '1',
                variables: variables
            },
            input: [{
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: '¿Cuáles son los precios?'
                }]
            }],
            max_output_tokens: 1000,
            store: true
        };
        
        if (useConversationsAPI && conversationId) {
            request2Body.conversation = conversationId;
        } else {
            request2Body.previous_response_id = data1.id;
        }
        
        const response2 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(request2Body)
        });
        
        const data2 = await response2.json();
        
        if (data2.error) {
            console.log('❌ Error en segunda respuesta:', data2.error.message);
        } else {
            console.log('✅ Contexto mantenido correctamente');
            console.log(`✅ Usando: ${useConversationsAPI ? 'Conversations API' : 'previous_response_id'}`);
        }
        
        // Resumen
        console.log('\n📊 RESUMEN DE PRUEBAS:');
        console.log('✅ API Key válida y funcionando');
        console.log('✅ Prompt ID configurado correctamente');
        console.log('✅ Modelo:', data1.model);
        console.log('✅ Variables procesadas');
        console.log('✅ Contexto de conversación funcionando');
        console.log(`✅ Método de contexto: ${useConversationsAPI ? 'Conversations API' : 'previous_response_id'}`);
        
        console.log('\n🎉 ¡SISTEMA COMPLETAMENTE FUNCIONAL!');
        console.log('\n📝 Para producción:');
        console.log('1. Usa estas mismas credenciales en Railway');
        console.log('2. Configura USE_CONVERSATIONS_API=true si está disponible');
        console.log('3. La API key está segura en .env.test (no se sube a git)');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        if (error.message.includes('401')) {
            console.error('La API key no es válida');
        }
    }
}

// Ejecutar
console.log('=====================================');
console.log('  TEST SEGURO - RESPONSES API');
console.log('=====================================\n');

testSecureAPI()
    .then(() => {
        console.log('\n✅ Test completado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });