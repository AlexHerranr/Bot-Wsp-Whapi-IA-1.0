/**
 * 🧪 TEST CON IMAGEN DE URL
 * 
 * Prueba el Assistant con una imagen desde URL externa
 * para verificar que funciona con diferentes tipos de imágenes
 */

require('dotenv').config();

let OpenAI;
try {
    OpenAI = require('openai');
} catch (error) {
    console.error('❌ OpenAI SDK no encontrado');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000
});

// Imagen de prueba - un hotel en Cartagena
const TEST_IMAGE_URL = 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80';

const CONFIG = {
    assistantId: process.env.ASSISTANT_ID,
    testMessage: 'Esta es una imagen de un hotel. Como asesor de apartamentos turísticos, ¿qué opinas de esta propiedad? ¿Cómo se compara con nuestros apartamentos?',
    imageUrl: TEST_IMAGE_URL
};

console.log('🧪 TEST CON IMAGEN EXTERNA (URL)\n');
console.log('📋 Configuración:');
console.log(`   - Assistant ID: ${CONFIG.assistantId}`);
console.log(`   - Imagen URL: ${CONFIG.imageUrl}`);
console.log(`   - Mensaje: ${CONFIG.testMessage}`);
console.log('─'.repeat(60));

async function testWithUrlImage() {
    let threadId = null;
    
    try {
        // 🟢 PASO 1: Crear nuevo thread
        console.log('\n🔄 PASO 1: Creando nuevo thread...');
        
        const thread = await openai.beta.threads.create({
            metadata: {
                test: 'url_image_test',
                timestamp: new Date().toISOString()
            }
        });
        
        threadId = thread.id;
        console.log(`✅ Thread creado: ${threadId}`);
        
        // 🟢 PASO 2: Crear mensaje multimodal con URL
        console.log('\n🔄 PASO 2: Creando mensaje multimodal con URL...');
        
        const message = await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: CONFIG.testMessage
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: CONFIG.imageUrl
                    }
                }
            ]
        });
        
        console.log(`✅ Mensaje multimodal creado: ${message.id}`);
        console.log(`   - Contenido: texto + imagen URL`);
        
        // 🟢 PASO 3: Ejecutar Assistant
        console.log('\n🔄 PASO 3: Ejecutando Assistant...');
        
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: CONFIG.assistantId
        });
        
        console.log(`✅ Run iniciado: ${run.id}`);
        
        // 🟢 PASO 4: Esperar respuesta
        console.log('\n🔄 PASO 4: Esperando respuesta...');
        
        let runStatus = run;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (['queued', 'in_progress', 'requires_action'].includes(runStatus.status) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
            attempts++;
            
            process.stdout.write(`⏳ Estado: ${runStatus.status} (${attempts}s)\r`);
        }
        
        console.log(`\n✅ Run completado: ${runStatus.status}`);
        
        if (runStatus.status === 'completed') {
            // 🟢 PASO 5: Obtener respuesta
            console.log('\n🔄 PASO 5: Obteniendo respuesta...');
            
            const messages = await openai.beta.threads.messages.list(threadId, {
                limit: 10
            });
            
            const assistantResponse = messages.data.find(msg => 
                msg.role === 'assistant' && 
                msg.run_id === run.id
            );
            
            if (assistantResponse) {
                const responseText = assistantResponse.content[0]?.text?.value || 'Sin respuesta';
                
                console.log('🤖 RESPUESTA DEL ASSISTANT (Hotel vs Apartamentos):');
                console.log('─'.repeat(70));
                console.log(responseText);
                console.log('─'.repeat(70));
                
                console.log(`\n📊 Estadísticas:`);
                console.log(`   - Longitud respuesta: ${responseText.length} caracteres`);
                console.log(`   - Tiempo total: ~${attempts} segundos`);
                console.log(`   - Tokens usados: ${runStatus.usage?.total_tokens || 'N/A'}`);
                
                return {
                    success: true,
                    response: responseText,
                    threadId: threadId,
                    duration: attempts
                };
                
            } else {
                throw new Error('No se encontró respuesta del Assistant');
            }
            
        } else {
            console.log(`\n❌ Run falló: ${runStatus.last_error?.message || 'Error desconocido'}`);
            return { success: false, error: runStatus.last_error?.message };
        }
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        return { success: false, error: error.message };
        
    } finally {
        if (threadId) {
            console.log(`\n🧹 Thread creado: ${threadId}`);
        }
    }
}

// Ejecutar test
(async () => {
    const startTime = Date.now();
    
    try {
        const result = await testWithUrlImage();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n' + '═'.repeat(70));
        console.log('📊 RESUMEN DEL TEST CON IMAGEN EXTERNA');
        console.log('═'.repeat(70));
        console.log(`✅ Éxito: ${result.success ? 'SÍ' : 'NO'}`);
        console.log(`⏱️ Duración total: ${duration}s`);
        
        if (result.success) {
            console.log(`🧵 Thread ID: ${result.threadId}`);
            console.log(`📝 Longitud respuesta: ${result.response.length} caracteres`);
            
            console.log('\n🎯 RESULTADO: ✅ TEST EXITOSO');
            console.log('   El Assistant puede procesar imágenes externas por URL');
            console.log('   Responde desde su perspectiva de asesor de apartamentos');
            
        } else {
            console.log(`❌ Error: ${result.error}`);
            console.log('\n🎯 RESULTADO: ❌ TEST FALLIDO');
        }
        
    } catch (error) {
        console.error(`\n💥 Error fatal: ${error.message}`);
    }
    
    console.log('\n🏁 Test con imagen externa completado\n');
})();