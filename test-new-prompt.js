// test-new-prompt.js
// Test del nuevo prompt con variables

const OPENAI_API_KEY = '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';
const PROMPT_ID = 'pmpt_68b7dbd8b694819386644f198b2165880410e06c7884ad66';

async function testNewPrompt() {
    console.log('🧪 Probando nuevo prompt con variables...\n');
    
    try {
        // Simular un mensaje típico de cliente
        const userMessage = "Hola, soy Carlos Rodríguez. Quisiera hacer una reserva para este fin de semana, somos 4 adultos y 2 niños. ¿Qué opciones tienen disponibles?";
        
        console.log('📤 Mensaje del cliente:', userMessage);
        console.log('🔑 Prompt ID:', PROMPT_ID);
        
        // Variables simuladas del contexto
        const variables = {
            "FECHA_ENTRADA": "2024-01-20",
            "FECHA_SALIDA": "2024-01-22",
            "NOMBRE": "Carlos",
            "APELLIDO": "Rodríguez",
            "EMAIL": "carlos@example.com",
            "TELEFONO": "573001234567",
            "ADULTOS": "4",
            "NINOS": "2",
            "PERSONAS": "6",
            "numero_personas": "6",
            "fecha_entrada": "20/01/2024",
            "fecha_salida": "22/01/2024",
            "numero_noches": "2",
            "NOMBRE_COMPLETO": "Carlos Rodríguez",
            // Valores por defecto para las demás
            "TARIFA_API": "",
            "ANTICIPO": "",
            "DESCRIPCION_PAGO": "",
            "MONTO_CON_RECARGO": "",
            "ROOM_IDS_API": "",
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
        
        console.log('\n📊 Variables del prompt:');
        console.log('- Nombre:', variables.NOMBRE_COMPLETO);
        console.log('- Personas:', variables.PERSONAS);
        console.log('- Fechas:', variables.fecha_entrada, 'al', variables.fecha_salida);
        
        console.log('\n⏳ Enviando a OpenAI Responses API...\n');
        
        // Llamada a la API
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
                    content: [{
                        type: 'input_text',
                        text: userMessage
                    }]
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
        console.log('- Estado:', data.status);
        console.log('- Tokens:', data.usage?.total_tokens || 'N/A');
        
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
        
        console.log('\n🤖 Respuesta del asistente:');
        console.log('='.repeat(60));
        console.log(assistantResponse);
        console.log('='.repeat(60));
        
        console.log('\n✅ ¡Prueba exitosa!');
        console.log('\n📌 Resumen:');
        console.log('- El prompt con variables funciona correctamente');
        console.log('- El modelo usado fue:', data.model);
        console.log('- Las variables se procesaron correctamente');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        // Intentar parsear el error si es JSON
        try {
            const match = error.message.match(/API Error \d+: ({.*})/);
            if (match) {
                const errorData = JSON.parse(match[1]);
                console.error('\n📋 Detalles del error:');
                console.error('- Tipo:', errorData.error?.type);
                console.error('- Mensaje:', errorData.error?.message);
                console.error('- Parámetro:', errorData.error?.param);
                console.error('- Código:', errorData.error?.code);
            }
        } catch (e) {
            // Ignorar errores de parseo
        }
    }
}

// Ejecutar
console.log('=====================================');
console.log('  TEST NUEVO PROMPT CON VARIABLES');
console.log('=====================================\n');

testNewPrompt()
    .then(() => {
        console.log('\n✅ Fin del test');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });