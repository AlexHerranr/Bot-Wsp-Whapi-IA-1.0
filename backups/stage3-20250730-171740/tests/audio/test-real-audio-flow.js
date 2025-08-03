/**
 * 🧪 TEST REAL - Flujo Completo de Audio
 * 
 * Simula el flujo completo de nota de voz:
 * 1. Archivo .ogg → Whisper transcription
 * 2. Transcripción → OpenAI Assistant 
 * 3. Assistant → Respuesta como asesor hotelero
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
    audioFile: './WhatsApp Ptt 2025-07-24 at 11.25.38 AM.ogg',
    assistantId: process.env.ASSISTANT_ID,
    testUser: 'Cliente Test Audio',
    whisperModel: 'whisper-1' // Modelo de transcripción
};

console.log('🧪 TEST REAL - FLUJO COMPLETO DE AUDIO\n');
console.log('📋 Configuración:');
console.log(`   - Archivo audio: ${CONFIG.audioFile}`);
console.log(`   - Assistant ID: ${CONFIG.assistantId}`);
console.log(`   - Usuario: ${CONFIG.testUser}`);
console.log(`   - Modelo Whisper: ${CONFIG.whisperModel}`);
console.log('─'.repeat(60));

async function testCompleteAudioFlow() {
    let threadId = null;
    
    try {
        // 🟢 PASO 1: Verificar archivo de audio
        console.log('\n🔄 PASO 1: Verificando archivo de audio...');
        
        const audioPath = path.resolve(CONFIG.audioFile);
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Archivo no encontrado: ${audioPath}`);
        }
        
        const stats = fs.statSync(audioPath);
        console.log(`✅ Audio encontrado: ${audioPath}`);
        console.log(`   - Tamaño: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`   - Formato: ${path.extname(audioPath).toLowerCase()}`);
        console.log(`   - Fecha: ${stats.mtime.toLocaleString()}`);
        
        // 🟢 PASO 2: Transcribir audio con Whisper
        console.log('\n🔄 PASO 2: Transcribiendo audio con Whisper...');
        
        const audioFile = fs.createReadStream(audioPath);
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: CONFIG.whisperModel,
            language: 'es', // Español como en el bot real
            response_format: 'json'
        });
        
        const transcribedText = transcription.text;
        console.log(`✅ Transcripción completada:`);
        console.log(`   - Texto: "${transcribedText}"`);
        console.log(`   - Longitud: ${transcribedText.length} caracteres`);
        
        // 🟢 PASO 3: Crear mensaje como en el bot real
        console.log('\n🔄 PASO 3: Preparando mensaje para Assistant...');
        
        // Formato exacto del bot: "🎤 [NOTA DE VOZ]: [transcripción]"
        const formattedMessage = `🎤 [NOTA DE VOZ]: ${transcribedText}`;
        console.log(`📝 Mensaje formateado: ${formattedMessage}`);
        
        // 🟢 PASO 4: Crear thread y enviar al Assistant
        console.log('\n🔄 PASO 4: Creando thread y enviando al Assistant...');
        
        const thread = await openai.beta.threads.create({
            metadata: {
                test: 'audio_transcription_test',
                user: CONFIG.testUser,
                timestamp: new Date().toISOString()
            }
        });
        
        threadId = thread.id;
        console.log(`✅ Thread creado: ${threadId}`);
        
        // Crear mensaje en el thread
        const message = await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: formattedMessage
        });
        
        console.log(`✅ Mensaje enviado: ${message.id}`);
        
        // 🟢 PASO 5: Ejecutar Assistant
        console.log('\n🔄 PASO 5: Ejecutando Assistant...');
        
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: CONFIG.assistantId
        });
        
        console.log(`✅ Run iniciado: ${run.id}`);
        
        // 🟢 PASO 6: Esperar respuesta
        console.log('\n🔄 PASO 6: Esperando respuesta del Assistant...');
        
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
                
                console.log('🤖 RESPUESTA DEL ASSISTANT A LA NOTA DE VOZ:');
                console.log('─'.repeat(70));
                console.log(responseText);
                console.log('─'.repeat(70));
                
                // 🟢 PASO 8: Estadísticas completas
                console.log(`\\n📊 Estadísticas del flujo completo:`);
                console.log(`   - Audio original: ${(stats.size / 1024).toFixed(1)} KB`);
                console.log(`   - Transcripción: "${transcribedText.substring(0, 50)}..."`);
                console.log(`   - Longitud transcripción: ${transcribedText.length} caracteres`);
                console.log(`   - Longitud respuesta: ${responseText.length} caracteres`);
                console.log(`   - Tiempo total: ~${attempts} segundos`);
                console.log(`   - Tokens usados: ${runStatus.usage?.total_tokens || 'N/A'}`);
                
                return {
                    success: true,
                    transcription: transcribedText,
                    response: responseText,
                    threadId: threadId,
                    runId: run.id,
                    duration: attempts,
                    audioSize: stats.size
                };
                
            } else {
                throw new Error('No se encontró respuesta del Assistant');
            }
            
        } else if (runStatus.status === 'failed') {
            console.log(`\\n❌ Run falló: ${runStatus.last_error?.message || 'Error desconocido'}`);
            return { success: false, error: runStatus.last_error?.message };
            
        } else {
            console.log(`\\n⚠️ Run terminó con estado inesperado: ${runStatus.status}`);
            return { success: false, error: `Estado inesperado: ${runStatus.status}` };
        }
        
    } catch (error) {
        console.error(`\\n❌ Error durante el test: ${error.message}`);
        return { success: false, error: error.message };
        
    } finally {
        if (threadId) {
            console.log(`\\n🧹 Thread creado: ${threadId}`);
            console.log('   (Se mantiene para inspección manual si es necesario)');
        }
    }
}

// Ejecutar test
(async () => {
    const startTime = Date.now();
    
    try {
        const result = await testCompleteAudioFlow();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\\n' + '═'.repeat(70));
        console.log('📊 RESUMEN DEL TEST DE AUDIO COMPLETO');
        console.log('═'.repeat(70));
        console.log(`✅ Éxito: ${result.success ? 'SÍ' : 'NO'}`);
        console.log(`⏱️ Duración total: ${duration}s`);
        
        if (result.success) {
            console.log(`🎤 Transcripción: "${result.transcription}"`);
            console.log(`🧵 Thread ID: ${result.threadId}`);
            console.log(`🏃 Run ID: ${result.runId}`);
            console.log(`📏 Audio: ${(result.audioSize / 1024).toFixed(1)} KB`);
            console.log(`📝 Respuesta: ${result.response.length} caracteres`);
            
            console.log('\\n🎯 RESULTADO: ✅ FLUJO DE AUDIO EXITOSO');
            console.log('   - Whisper transcribió correctamente el audio');
            console.log('   - Assistant procesó la nota de voz');
            console.log('   - Respuesta contextual como asesor hotelero');
            
        } else {
            console.log(`❌ Error: ${result.error}`);
            console.log('\\n🎯 RESULTADO: ❌ TEST FALLIDO');
        }
        
    } catch (error) {
        console.error(`\\n💥 Error fatal: ${error.message}`);
    }
    
    console.log('\\n🏁 Test de audio completo finalizado\\n');
})();