/**
 * 🧪 TEST REAL - OpenAI Assistant con Imagen
 * 
 * Conecta directamente al OpenAI Assistant para probar:
 * 1. Crear nuevo thread
 * 2. Subir imagen real usando file upload
 * 3. Crear mensaje multimodal
 * 4. Ejecutar Assistant y obtener respuesta real
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Verificar que OpenAI esté disponible
let OpenAI;
try {
    OpenAI = require('openai');
} catch (error) {
    console.error('❌ OpenAI SDK no encontrado. Instalar con: npm install openai');
    process.exit(1);
}

// Configuración
const CONFIG = {
    imageFile: './WhatsApp Image 2025-07-24 at 11.31.44 AM.jpeg',
    assistantId: process.env.ASSISTANT_ID,
    testMessage: '¿Qué ves en esta imagen? Describe detalladamente lo que muestra.'
};

// Validar configuración
if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY no encontrada en .env');
    process.exit(1);
}

if (!process.env.ASSISTANT_ID) {
    console.error('❌ ASSISTANT_ID no encontrada en .env');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000 // 60 segundos timeout
});

console.log('🧪 INICIANDO TEST REAL CON OPENAI ASSISTANT\n');
console.log('📋 Configuración:');
console.log(`   - Assistant ID: ${CONFIG.assistantId}`);
console.log(`   - Archivo: ${CONFIG.imageFile}`);
console.log(`   - Mensaje: ${CONFIG.testMessage}`);
console.log('─'.repeat(60));

async function runRealAssistantTest() {
    let threadId = null;
    
    try {
        // 🟢 PASO 1: Verificar archivo de imagen
        console.log('\n🔄 PASO 1: Verificando imagen...');
        
        const imagePath = path.resolve(CONFIG.imageFile);
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Archivo no encontrado: ${imagePath}`);
        }
        
        const stats = fs.statSync(imagePath);
        console.log(`✅ Imagen encontrada: ${imagePath}`);
        console.log(`   - Tamaño: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`   - Fecha: ${stats.mtime.toLocaleString()}`);
        
        // 🟢 PASO 2: Subir imagen a OpenAI
        console.log('\n🔄 PASO 2: Subiendo imagen a OpenAI...');
        
        const fileStream = fs.createReadStream(imagePath);
        const fileUpload = await openai.files.create({
            file: fileStream,
            purpose: 'vision'
        });
        
        console.log(`✅ Imagen subida exitosamente`);
        console.log(`   - File ID: ${fileUpload.id}`);
        console.log(`   - Tamaño: ${fileUpload.bytes} bytes`);
        
        // 🟢 PASO 3: Crear nuevo thread
        console.log('\n🔄 PASO 3: Creando nuevo thread...');
        
        const thread = await openai.beta.threads.create({
            metadata: {
                test: 'image_multimodal_test',
                timestamp: new Date().toISOString()
            }
        });
        
        threadId = thread.id;
        console.log(`✅ Thread creado: ${threadId}`);
        
        // 🟢 PASO 4: Crear mensaje multimodal
        console.log('\n🔄 PASO 4: Creando mensaje multimodal...');
        
        const message = await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: CONFIG.testMessage
                },
                {
                    type: 'image_file',
                    image_file: {
                        file_id: fileUpload.id
                    }
                }
            ]
        });
        
        console.log(`✅ Mensaje multimodal creado: ${message.id}`);
        console.log(`   - Contenido: texto + imagen`);
        
        // 🟢 PASO 5: Ejecutar Assistant
        console.log('\n🔄 PASO 5: Ejecutando Assistant...');
        
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: CONFIG.assistantId
        });
        
        console.log(`✅ Run iniciado: ${run.id}`);
        console.log(`   - Estado: ${run.status}`);
        
        // 🟢 PASO 6: Esperar respuesta
        console.log('\n🔄 PASO 6: Esperando respuesta del Assistant...');
        
        let runStatus = run;
        let attempts = 0;
        const maxAttempts = 30; // 30 segundos máximo
        
        while (['queued', 'in_progress', 'requires_action'].includes(runStatus.status) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
            attempts++;
            
            process.stdout.write(`⏳ Estado: ${runStatus.status} (${attempts}s)\r`);
        }
        
        console.log(`\n✅ Run completado: ${runStatus.status}`);
        
        if (runStatus.status === 'completed') {
            // 🟢 PASO 7: Obtener respuesta
            console.log('\n🔄 PASO 7: Obteniendo respuesta...');
            
            const messages = await openai.beta.threads.messages.list(threadId, {
                limit: 10
            });
            
            const assistantResponse = messages.data.find(msg => 
                msg.role === 'assistant' && 
                msg.run_id === run.id
            );
            
            if (assistantResponse) {
                const responseText = assistantResponse.content[0]?.text?.value || 'Sin respuesta';
                
                console.log('🤖 RESPUESTA DEL ASSISTANT:');
                console.log('─'.repeat(60));
                console.log(responseText);
                console.log('─'.repeat(60));
                
                // Mostrar estadísticas
                console.log(`\n📊 Estadísticas:`);
                console.log(`   - Longitud respuesta: ${responseText.length} caracteres`);
                console.log(`   - Tiempo total: ~${attempts} segundos`);
                console.log(`   - Tokens usados: ${runStatus.usage?.total_tokens || 'N/A'}`);
                
                return {
                    success: true,
                    response: responseText,
                    threadId: threadId,
                    runId: run.id,
                    fileId: fileUpload.id,
                    duration: attempts
                };
                
            } else {
                throw new Error('No se encontró respuesta del Assistant');
            }
            
        } else if (runStatus.status === 'failed') {
            console.log(`\n❌ Run falló: ${runStatus.last_error?.message || 'Error desconocido'}`);
            return { success: false, error: runStatus.last_error?.message };
            
        } else {
            console.log(`\n⚠️ Run terminó con estado inesperado: ${runStatus.status}`);
            return { success: false, error: `Estado inesperado: ${runStatus.status}` };
        }
        
    } catch (error) {
        console.error(`\n❌ Error durante el test: ${error.message}`);
        return { success: false, error: error.message };
        
    } finally {
        // 🟢 PASO 8: Limpieza opcional
        if (threadId) {
            console.log(`\n🧹 Thread creado: ${threadId}`);
            console.log('   (Se mantiene para inspección manual si es necesario)');
        }
    }
}

// Ejecutar test
(async () => {
    const startTime = Date.now();
    
    try {
        const result = await runRealAssistantTest();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n' + '═'.repeat(70));
        console.log('📊 RESUMEN DEL TEST REAL');
        console.log('═'.repeat(70));
        console.log(`✅ Éxito: ${result.success ? 'SÍ' : 'NO'}`);
        console.log(`⏱️ Duración total: ${duration}s`);
        
        if (result.success) {
            console.log(`🧵 Thread ID: ${result.threadId}`);
            console.log(`🏃 Run ID: ${result.runId}`);
            console.log(`📄 File ID: ${result.fileId}`);
            console.log(`📝 Longitud respuesta: ${result.response.length} caracteres`);
            
            console.log('\n🎯 RESULTADO: ✅ TEST EXITOSO');
            console.log('   La imagen se procesó correctamente con el Assistant real');
            
        } else {
            console.log(`❌ Error: ${result.error}`);
            console.log('\n🎯 RESULTADO: ❌ TEST FALLIDO');
        }
        
    } catch (error) {
        console.error(`\n💥 Error fatal: ${error.message}`);
    }
    
    console.log('\n🏁 Test real completado\n');
})();