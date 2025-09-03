const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.test' });

async function testTokensAndCaching() {
    const apiKey = process.env.OPENAI_API_KEY;
    const promptId = process.env.OPENAI_PROMPT_ID;
    
    console.log('🧪 TEST DE TOKENS Y CACHING CON GPT-5 MINI\n');
    
    // Mensaje largo para activar caching (>1024 tokens)
    const systemPrompt = `Eres un asistente experto en reservas hoteleras. 
    Tienes acceso a información sobre disponibilidad, precios, y políticas del hotel.
    Siempre debes ser amable, profesional y preciso en tus respuestas.
    Cuando un cliente solicite información sobre reservas, debes proporcionar:
    - Disponibilidad de habitaciones
    - Precios actualizados
    - Políticas de cancelación
    - Servicios incluidos
    - Información sobre check-in y check-out
    
    Políticas importantes del hotel:
    1. Check-in: 3:00 PM
    2. Check-out: 12:00 PM
    3. Cancelación gratuita hasta 48 horas antes
    4. Se requiere depósito del 50% para confirmar
    5. Niños menores de 5 años gratis
    6. Desayuno incluido en todas las tarifas
    7. WiFi gratuito en todas las áreas
    8. Estacionamiento gratuito
    9. No se permiten mascotas
    10. Piscina abierta de 8:00 AM a 10:00 PM
    
    Tipos de habitaciones disponibles:
    - Estándar Simple: 1 cama individual, ideal para viajeros solos
    - Estándar Doble: 2 camas individuales o 1 cama doble
    - Suite Junior: Sala de estar, cama king size
    - Suite Familiar: 2 habitaciones, capacidad para 6 personas
    - Penthouse: Vista panorámica, jacuzzi privado
    
    Esta es información adicional para asegurar que el prompt tenga más de 1024 tokens
    y así activar el sistema de caching automático de OpenAI. El caching reduce la latencia
    hasta un 80% y los costos hasta un 75% cuando se reutilizan prompts similares.`.repeat(3); // Repetir para asegurar >1024 tokens
    
    try {
        // Primera llamada (cache miss)
        console.log('📤 Primera llamada (debería ser cache miss)...');
        const response1 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-5-mini-2025-08-07',
                input: [
                    {
                        type: 'message',
                        role: 'system',
                        content: [{ type: 'input_text', text: systemPrompt }]
                    },
                    {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: '¿Cuál es el precio de una habitación estándar?' }]
                    }
                ],
                max_output_tokens: 150,
                store: true
            })
        });

        const data1 = await response1.json();
        
        if (data1.error) {
            console.error('❌ Error:', data1.error.message);
            return;
        }

        console.log('\n✅ Respuesta 1:');
        console.log('- ID:', data1.id);
        console.log('- Contenido:', data1.output?.[0]?.content?.[0]?.text?.substring(0, 100) + '...');
        
        // VERIFICAR TOKENS
        console.log('\n📊 CONTEO DE TOKENS:');
        if (data1.usage) {
            console.log('- Tokens de entrada:', data1.usage.prompt_tokens || data1.usage.input_tokens);
            console.log('- Tokens de salida:', data1.usage.completion_tokens || data1.usage.output_tokens);
            console.log('- Tokens totales:', data1.usage.total_tokens);
            
            // Verificar caching
            if (data1.usage.prompt_tokens_details?.cached_tokens !== undefined) {
                console.log('- Tokens en caché:', data1.usage.prompt_tokens_details.cached_tokens);
                console.log('- Porcentaje en caché:', 
                    Math.round((data1.usage.prompt_tokens_details.cached_tokens / data1.usage.prompt_tokens) * 100) + '%');
            }
        } else {
            console.log('⚠️  No se encontró información de usage en la respuesta');
        }

        // Esperar un poco
        console.log('\n⏳ Esperando 2 segundos antes de la segunda llamada...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Segunda llamada (debería ser cache hit)
        console.log('\n📤 Segunda llamada (debería ser cache hit)...');
        const response2 = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-5-mini-2025-08-07',
                input: [
                    {
                        type: 'message',
                        role: 'system',
                        content: [{ type: 'input_text', text: systemPrompt }]
                    },
                    {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: '¿Cuánto cuesta la suite junior?' }] // Pregunta diferente
                    }
                ],
                max_output_tokens: 150,
                store: true
            })
        });

        const data2 = await response2.json();

        console.log('\n✅ Respuesta 2:');
        console.log('- ID:', data2.id);
        
        console.log('\n📊 CONTEO DE TOKENS (Segunda llamada):');
        if (data2.usage) {
            console.log('- Tokens de entrada:', data2.usage.prompt_tokens || data2.usage.input_tokens);
            console.log('- Tokens de salida:', data2.usage.completion_tokens || data2.usage.output_tokens);
            console.log('- Tokens totales:', data2.usage.total_tokens);
            
            if (data2.usage.prompt_tokens_details?.cached_tokens !== undefined) {
                console.log('- Tokens en caché:', data2.usage.prompt_tokens_details.cached_tokens);
                console.log('- Porcentaje en caché:', 
                    Math.round((data2.usage.prompt_tokens_details.cached_tokens / data2.usage.prompt_tokens) * 100) + '%');
                
                if (data2.usage.prompt_tokens_details.cached_tokens > 0) {
                    console.log('\n🎉 ¡CACHING FUNCIONANDO! Se reutilizaron tokens del prompt');
                }
            }
        }

        // Test con prompt ID también
        console.log('\n\n📤 Tercera llamada usando Prompt ID...');
        const response3 = await fetch('https://api.openai.com/v1/responses', {
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
                        TELEFONO: "573001234567",
                        NOMBRE_COMPLETO: "Test User",
                        FECHA_ACTUAL: new Date().toLocaleDateString('es-CO'),
                        HORA_ACTUAL: new Date().toLocaleTimeString('es-CO')
                    }
                },
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: 'Hola, ¿tienen habitaciones disponibles?' }]
                    }
                ],
                max_output_tokens: 150,
                store: true
            })
        });

        const data3 = await response3.json();

        console.log('\n✅ Respuesta 3 (con Prompt ID):');
        console.log('- ID:', data3.id);
        
        console.log('\n📊 CONTEO DE TOKENS (Con Prompt ID):');
        if (data3.usage) {
            console.log('- Tokens de entrada:', data3.usage.prompt_tokens || data3.usage.input_tokens);
            console.log('- Tokens de salida:', data3.usage.completion_tokens || data3.usage.output_tokens);
            console.log('- Tokens totales:', data3.usage.total_tokens);
            console.log('- Estructura completa de usage:', JSON.stringify(data3.usage, null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTokensAndCaching();
