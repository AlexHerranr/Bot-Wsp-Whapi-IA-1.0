const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.test' });

async function testConversationTokens() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🧪 TEST DE TOKENS EN CONVERSACIÓN CONTINUA\n');
    
    // Primero crear una conversación
    console.log('1️⃣ Creando conversación...');
    const convResponse = await fetch('https://api.openai.com/v1/conversations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
    });
    
    const conversation = await convResponse.json();
    const conversationId = conversation.id;
    console.log('✅ Conversation ID:', conversationId);
    
    // Array para guardar los resultados
    const messages = [];
    const tokenHistory = [];
    
    // Mensaje 1
    console.log('\n📤 Mensaje 1: "Hola, necesito información"');
    const response1 = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            conversation: conversationId,
            instructions: 'Eres un asistente de hotel. Sé breve.',
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text: 'Hola, necesito información' }]
                }
            ],
            max_output_tokens: 50,
            store: true
        })
    });
    
    const data1 = await response1.json();
    messages.push({ user: 'Hola, necesito información', assistant: data1.output?.[0]?.content?.[0]?.text });
    tokenHistory.push({
        mensaje: 1,
        input: data1.usage?.input_tokens,
        output: data1.usage?.output_tokens,
        total: data1.usage?.total_tokens
    });
    
    console.log('📊 Tokens:', data1.usage);
    
    // Esperar un poco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mensaje 2
    console.log('\n📤 Mensaje 2: "¿Cuál es el precio de una habitación?"');
    const response2 = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            conversation: conversationId,  // Misma conversación
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text: '¿Cuál es el precio de una habitación?' }]
                }
            ],
            max_output_tokens: 50,
            store: true
        })
    });
    
    const data2 = await response2.json();
    messages.push({ user: '¿Cuál es el precio de una habitación?', assistant: data2.output?.[0]?.content?.[0]?.text });
    tokenHistory.push({
        mensaje: 2,
        input: data2.usage?.input_tokens,
        output: data2.usage?.output_tokens,
        total: data2.usage?.total_tokens
    });
    
    console.log('📊 Tokens:', data2.usage);
    
    // Esperar un poco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mensaje 3
    console.log('\n📤 Mensaje 3: "¿Y para dos personas?"');
    const response3 = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            conversation: conversationId,  // Misma conversación
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text: '¿Y para dos personas?' }]
                }
            ],
            max_output_tokens: 50,
            store: true
        })
    });
    
    const data3 = await response3.json();
    messages.push({ user: '¿Y para dos personas?', assistant: data3.output?.[0]?.content?.[0]?.text });
    tokenHistory.push({
        mensaje: 3,
        input: data3.usage?.input_tokens,
        output: data3.usage?.output_tokens,
        total: data3.usage?.total_tokens
    });
    
    console.log('📊 Tokens:', data3.usage);
    
    // Análisis
    console.log('\n\n📈 ANÁLISIS DE TOKENS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Msg | Input | Output | Total | ¿Acumulado?');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let totalAcumulado = 0;
    tokenHistory.forEach((t, i) => {
        totalAcumulado += t.total;
        const esAcumulado = t.total > totalAcumulado - t.total ? '❌ NO' : '✅ SÍ';
        console.log(`${t.mensaje}   | ${String(t.input).padEnd(5)} | ${String(t.output).padEnd(6)} | ${String(t.total).padEnd(5)} | ${esAcumulado}`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total manual acumulado: ${totalAcumulado}`);
    
    // Test con previous_response_id también
    console.log('\n\n🔄 TEST CON PREVIOUS_RESPONSE_ID:');
    
    let previousId = null;
    const tokenHistory2 = [];
    
    // Primera llamada
    const resp1 = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            instructions: 'Eres un asistente de hotel.',
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text: 'Hola' }]
                }
            ],
            max_output_tokens: 30,
            store: true
        })
    });
    
    const d1 = await resp1.json();
    previousId = d1.id;
    tokenHistory2.push({ msg: 1, tokens: d1.usage?.total_tokens });
    
    // Segunda llamada con previous_response_id
    const resp2 = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            previous_response_id: previousId,
            input: [
                {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text: '¿Tienen piscina?' }]
                }
            ],
            max_output_tokens: 30,
            store: true
        })
    });
    
    const d2 = await resp2.json();
    tokenHistory2.push({ msg: 2, tokens: d2.usage?.total_tokens });
    
    console.log('\nCon previous_response_id:');
    console.log('Mensaje 1:', tokenHistory2[0].tokens, 'tokens');
    console.log('Mensaje 2:', tokenHistory2[1].tokens, 'tokens (¿incluye contexto anterior?)');
    
    console.log('\n\n🎯 CONCLUSIÓN:');
    if (tokenHistory[1].input > tokenHistory[0].input) {
        console.log('✅ Los tokens SE ACUMULAN - OpenAI cuenta todo el contexto');
    } else {
        console.log('❌ Los tokens NO se acumulan - Solo cuenta el mensaje actual');
    }
}

testConversationTokens().catch(console.error);
