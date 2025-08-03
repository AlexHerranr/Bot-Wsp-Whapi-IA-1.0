/**
 * 🎯 TEST DIRECTO - Texto a Audio
 * 
 * Simula el flujo completo:
 * 1. Texto de entrada → OpenAI Assistant
 * 2. Respuesta del Assistant → TTS
 * 3. Generar archivo de audio
 */

const fs = require('fs');
const path = require('path');
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

const CONFIG = {
    assistantId: process.env.ASSISTANT_ID,
    testMessage: 'Hola, ¿podrían darme información sobre las tarifas del hotel para este fin de semana? Necesito una habitación doble.',
    ttsVoice: process.env.TTS_VOICE || 'nova',
    outputFile: './test-generated-audio.mp3',
    testUser: 'Cliente Test TTS'
};

console.log('🎯 TEST DIRECTO - TEXTO A AUDIO\n');
console.log('📋 Configuración:');
console.log(`   - Mensaje test: "${CONFIG.testMessage}"`);
console.log(`   - Assistant ID: ${CONFIG.assistantId}`);
console.log(`   - Voz TTS: ${CONFIG.ttsVoice}`);
console.log(`   - Archivo salida: ${CONFIG.outputFile}`);
console.log('═'.repeat(70));

async function testTextToAudio() {
    let threadId = null;
    const startTime = Date.now();
    
    try {
        // 🟢 PASO 1: Enviar mensaje al Assistant
        console.log('\n🔄 PASO 1: Enviando mensaje al Assistant...');
        
        const thread = await openai.beta.threads.create({
            metadata: {
                test: 'text_to_audio_test',
                user: CONFIG.testUser,
                timestamp: new Date().toISOString()
            }
        });
        
        threadId = thread.id;
        console.log(`✅ Thread creado: ${threadId}`);
        
        // Crear mensaje
        const message = await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: CONFIG.testMessage
        });
        
        console.log(`✅ Mensaje enviado: ${message.id}`);
        console.log(`   - Longitud: ${CONFIG.testMessage.length} caracteres`);
        
        // 🟢 PASO 2: Ejecutar Assistant
        console.log('\n🔄 PASO 2: Ejecutando Assistant...');
        
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: CONFIG.assistantId
        });
        
        console.log(`✅ Run iniciado: ${run.id}`);
        
        // 🟢 PASO 3: Esperar respuesta
        console.log('\n🔄 PASO 3: Esperando respuesta...');
        
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
        
        if (runStatus.status !== 'completed') {
            throw new Error(`Run failed with status: ${runStatus.status}`);
        }
        
        // 🟢 PASO 4: Obtener respuesta
        console.log('\n🔄 PASO 4: Obteniendo respuesta del Assistant...');
        
        const messages = await openai.beta.threads.messages.list(threadId, {
            limit: 10
        });
        
        const assistantResponse = messages.data.find(msg => 
            msg.role === 'assistant' && 
            msg.run_id === run.id
        );
        
        if (!assistantResponse) {
            throw new Error('No se encontró respuesta del Assistant');
        }
        
        const responseText = assistantResponse.content[0]?.text?.value || 'Sin respuesta';
        
        console.log('✅ Respuesta obtenida:');
        console.log(`   - Longitud: ${responseText.length} caracteres`);
        console.log(`   - Vista previa: "${responseText.substring(0, 100)}..."`);
        
        // 🟢 PASO 5: Limpiar texto para TTS (como en tu código real)
        console.log('\n🔄 PASO 5: Limpiando texto para TTS...');
        
        // Limpiar emojis y caracteres especiales (basado en tu código)
        const cleanText = responseText
            .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
            .replace(/[*_~`]/g, '')
            .replace(/\n{2,}/g, '\n')
            .trim();
        
        console.log(`✅ Texto limpio para TTS:`);
        console.log(`   - Longitud original: ${responseText.length} chars`);
        console.log(`   - Longitud limpia: ${cleanText.length} chars`);
        console.log(`   - Texto limpio: "${cleanText.substring(0, 150)}..."`);
        
        // 🟢 PASO 6: Generar audio con TTS
        console.log('\n🔄 PASO 6: Generando audio con TTS...');
        
        const ttsStartTime = Date.now();
        
        const speechResponse = await openai.audio.speech.create({
            model: 'tts-1',
            voice: CONFIG.ttsVoice,
            input: cleanText,
            response_format: 'mp3',
            speed: 0.95 // Un poco más lento, más natural
        });
        
        const ttsTime = Date.now() - ttsStartTime;
        console.log(`✅ Audio generado en ${ttsTime}ms`);
        
        // 🟢 PASO 7: Guardar archivo
        console.log('\n🔄 PASO 7: Guardando archivo de audio...');
        
        const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
        const outputPath = path.resolve(CONFIG.outputFile);
        
        fs.writeFileSync(outputPath, audioBuffer);
        
        const fileStats = fs.statSync(outputPath);
        console.log(`✅ Archivo guardado: ${outputPath}`);
        console.log(`   - Tamaño: ${(fileStats.size / 1024).toFixed(1)} KB`);
        console.log(`   - Formato: ${path.extname(outputPath)}`);
        
        // 🟢 PASO 8: Mostrar respuesta completa
        console.log('\n📝 RESPUESTA COMPLETA DEL ASSISTANT:');
        console.log('─'.repeat(70));
        console.log(responseText);
        console.log('─'.repeat(70));
        
        const totalTime = Date.now() - startTime;
        
        // 🟢 PASO 9: Estadísticas finales
        console.log('\n📊 ESTADÍSTICAS COMPLETAS:');
        console.log(`   💬 Mensaje original: "${CONFIG.testMessage}"`);
        console.log(`   📏 Longitud mensaje: ${CONFIG.testMessage.length} caracteres`);
        console.log(`   📝 Longitud respuesta: ${responseText.length} caracteres`);
        console.log(`   🧹 Longitud texto limpio: ${cleanText.length} caracteres`);
        console.log(`   🎵 Tamaño audio: ${(fileStats.size / 1024).toFixed(1)} KB`);
        console.log(`   🗣️ Voz utilizada: ${CONFIG.ttsVoice}`);
        console.log(`   ⏱️ Tiempo Assistant: ${attempts} segundos`);
        console.log(`   ⏱️ Tiempo TTS: ${ttsTime} ms`);
        console.log(`   ⏱️ Tiempo total: ${(totalTime / 1000).toFixed(1)} segundos`);
        console.log(`   🎯 Tokens usados: ${runStatus.usage?.total_tokens || 'N/A'}`);
        
        return {
            success: true,
            originalMessage: CONFIG.testMessage,
            assistantResponse: responseText,
            cleanedText: cleanText,
            audioFile: outputPath,
            audioSize: fileStats.size,
            threadId: threadId,
            runId: run.id,
            assistantTime: attempts,
            ttsTime: ttsTime,
            totalTime: totalTime,
            tokensUsed: runStatus.usage?.total_tokens
        };
        
    } catch (error) {
        console.error(`\n❌ Error durante el test: ${error.message}`);
        console.error(error.stack);
        return { success: false, error: error.message };
        
    } finally {
        if (threadId) {
            console.log(`\n🧹 Thread: ${threadId}`);
            console.log('   (Mantenido para inspección)');
        }
    }
}

// Ejecutar test
(async () => {
    console.log('🚀 Iniciando test de texto a audio...\n');
    
    try {
        const result = await testTextToAudio();
        
        console.log('\n' + '═'.repeat(70));
        console.log('🎯 RESUMEN FINAL DEL TEST');
        console.log('═'.repeat(70));
        
        if (result.success) {
            console.log('✅ RESULTADO: TEST EXITOSO');
            console.log('\n🎉 FLUJO COMPLETO VERIFICADO:');
            console.log('   ✅ Mensaje enviado al Assistant');
            console.log('   ✅ Respuesta generada correctamente');
            console.log('   ✅ Texto limpiado para TTS');
            console.log('   ✅ Audio generado exitosamente');
            console.log('   ✅ Archivo guardado correctamente');
            
            console.log('\n📁 ARCHIVO GENERADO:');
            console.log(`   🎵 ${result.audioFile}`);
            console.log(`   📏 ${(result.audioSize / 1024).toFixed(1)} KB`);
            console.log(`   🗣️ Voz: ${CONFIG.ttsVoice}`);
            
            console.log('\n⏱️ RENDIMIENTO:');
            console.log(`   🧠 Assistant: ${result.assistantTime}s`);
            console.log(`   🎤 TTS: ${result.ttsTime}ms`);
            console.log(`   📊 Total: ${(result.totalTime / 1000).toFixed(1)}s`);
            
            console.log('\n🎯 PRÓXIMO PASO: Reproduce el archivo para verificar calidad');
            
        } else {
            console.log('❌ RESULTADO: TEST FALLIDO');
            console.log(`   Error: ${result.error}`);
        }
        
    } catch (error) {
        console.error(`\n💥 Error fatal: ${error.message}`);
    }
    
    console.log('\n🏁 Test finalizado\n');
})();