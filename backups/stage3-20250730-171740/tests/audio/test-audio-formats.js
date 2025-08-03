/**
 * 🧪 TEST - Formatos de Audio TTS para WhatsApp
 * 
 * Prueba diferentes formatos de TTS para ver cuál funciona mejor:
 * - MP3: Más compatible universalmente
 * - OGG: Preferido por WHAPI según docs
 * - AAC: Formato móvil optimizado
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
    testChatId: '573003913251@s.whatsapp.net', // Tu chat ID
    testMessage: 'Hola, esto es una prueba de formato de audio. ¿Puedes escuchar esto correctamente?',
    whapiUrl: process.env.WHAPI_API_URL,
    whapiToken: process.env.WHAPI_TOKEN,
    ttsVoice: process.env.TTS_VOICE || 'nova',
    
    // Formatos a probar
    formats: [
        { format: 'mp3', extension: 'mp3', contentType: 'audio/mpeg', description: 'MP3 - Universal' },
        { format: 'opus', extension: 'ogg', contentType: 'audio/ogg; codecs=opus', description: 'OGG/Opus - WHAPI preferido' },
        { format: 'aac', extension: 'aac', contentType: 'audio/aac', description: 'AAC - Móvil optimizado' },
        { format: 'flac', extension: 'flac', contentType: 'audio/flac', description: 'FLAC - Alta calidad' }
    ]
};

console.log('🧪 TEST DE FORMATOS DE AUDIO TTS\n');
console.log('📋 Configuración:');
console.log(`   - Chat ID: ${CONFIG.testChatId}`);
console.log(`   - Mensaje: "${CONFIG.testMessage}"`);
console.log(`   - Voz TTS: ${CONFIG.ttsVoice}`);
console.log(`   - Formatos a probar: ${CONFIG.formats.length}`);
console.log('═'.repeat(70));

async function testAudioFormat(formatConfig, index) {
    const { format, extension, contentType, description } = formatConfig;
    
    console.log(`\n🔄 FORMATO ${index + 1}/${CONFIG.formats.length}: ${description}`);
    console.log(`   - TTS Format: ${format}`);
    console.log(`   - File Extension: .${extension}`);
    console.log(`   - Content-Type: ${contentType}`);
    
    try {
        // 🟢 PASO 1: Generar audio con TTS
        console.log('   🎤 Generando audio...');
        
        const ttsResponse = await openai.audio.speech.create({
            model: 'tts-1',
            voice: CONFIG.ttsVoice,
            input: CONFIG.testMessage,
            response_format: format,
            speed: 1.0
        });
        
        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        console.log(`   ✅ Audio generado: ${(audioBuffer.length / 1024).toFixed(1)} KB`);
        
        // 🟢 PASO 2: Guardar archivo temporalmente
        const fileName = `test_${format}_${Date.now()}.${extension}`;
        const audioPath = path.join('tmp', 'audio', fileName);
        
        // Crear directorio si no existe
        await fs.promises.mkdir(path.dirname(audioPath), { recursive: true });
        await fs.promises.writeFile(audioPath, audioBuffer);
        
        console.log(`   📁 Archivo guardado: ${audioPath}`);
        
        // 🟢 PASO 3: Generar URL pública (simular tu webhook)
        const baseUrl = 'https://actual-bobcat-handy.ngrok-free.app'; // Tu ngrok
        const audioUrl = `${baseUrl}/audio/${fileName}`;
        
        console.log(`   🌐 URL: ${audioUrl}`);
        
        // 🟢 PASO 4: Enviar via WHAPI
        console.log('   📤 Enviando via WHAPI...');
        
        const voiceEndpoint = `${CONFIG.whapiUrl}/messages/voice`;
        const payload = {
            to: CONFIG.testChatId,
            media: audioUrl
        };
        
        const response = await fetch(voiceEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.whapiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const responseData = await response.json();
        
        if (response.ok) {
            console.log(`   ✅ WHAPI SUCCESS: ${response.status}`);
            console.log(`   📱 Message ID: ${responseData.message?.id || 'N/A'}`);
            
            // Programar eliminación después de 2 minutos
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(audioPath);
                    console.log(`   🗑️ Archivo ${fileName} eliminado`);
                } catch (error) {
                    // Ignorar si ya fue eliminado
                }
            }, 2 * 60 * 1000);
            
            return {
                success: true,
                format: format,
                description: description,
                fileSize: audioBuffer.length,
                messageId: responseData.message?.id,
                whatsappResponse: responseData
            };
            
        } else {
            console.log(`   ❌ WHAPI ERROR: ${response.status}`);
            console.log(`   📄 Error: ${responseData.error?.message || 'Unknown'}`);
            
            return {
                success: false,
                format: format,
                description: description,
                error: responseData.error?.message || `HTTP ${response.status}`
            };
        }
        
    } catch (error) {
        console.log(`   💥 EXCEPTION: ${error.message}`);
        
        return {
            success: false,
            format: format,
            description: description,
            error: error.message
        };
    }
}

// Servir archivos temporalmente (simulando tu servidor)
async function setupTempServer() {
    const express = require('express');
    const app = express();
    const port = 3009; // Puerto diferente para no interferir
    
    // Servir archivos de audio
    app.get('/audio/:filename', async (req, res) => {
        try {
            const { filename } = req.params;
            const audioPath = path.join('tmp', 'audio', filename);
            
            // Detectar content-type por extensión
            let contentType = 'audio/mpeg';
            if (filename.endsWith('.ogg')) contentType = 'audio/ogg; codecs=opus';
            else if (filename.endsWith('.aac')) contentType = 'audio/aac';
            else if (filename.endsWith('.flac')) contentType = 'audio/flac';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-cache');
            
            const audioBuffer = await fs.promises.readFile(audioPath);
            res.send(audioBuffer);
            
        } catch (error) {
            res.status(404).json({ error: 'File not found' });
        }
    });
    
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`🌐 Servidor temporal corriendo en puerto ${port}`);
            resolve(server);
        });
    });
}

// Ejecutar test completo
(async () => {
    const startTime = Date.now();
    
    try {
        // Configurar servidor temporal
        console.log('\n🔧 Configurando servidor temporal...');
        const server = await setupTempServer();
        
        console.log('\n🚀 Iniciando pruebas de formatos...');
        console.log('\n⚠️  IMPORTANTE: Revisa tu WhatsApp después de cada formato');
        console.log('   - ¿Llega la nota de voz?');
        console.log('   - ¿Se puede reproducir?');
        console.log('   - ¿Calidad de audio es buena?');
        
        const results = [];
        
        // Probar cada formato con delay
        for (let i = 0; i < CONFIG.formats.length; i++) {
            const result = await testAudioFormat(CONFIG.formats[i], i);
            results.push(result);
            
            // Esperar 3 segundos entre formatos
            if (i < CONFIG.formats.length - 1) {
                console.log('\n   ⏳ Esperando 3 segundos antes del siguiente formato...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        // Resumen final
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n' + '═'.repeat(70));
        console.log('📊 RESUMEN FINAL DE FORMATOS');
        console.log('═'.repeat(70));
        console.log(`⏱️ Tiempo total: ${duration}s`);
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (successful.length > 0) {
            console.log(`\n✅ FORMATOS EXITOSOS (${successful.length}):`);
            successful.forEach(r => {
                console.log(`   🎵 ${r.format.toUpperCase()}: ${r.description}`);
                console.log(`      - Tamaño: ${(r.fileSize / 1024).toFixed(1)} KB`);
                console.log(`      - Message ID: ${r.messageId || 'N/A'}`);
            });
        }
        
        if (failed.length > 0) {
            console.log(`\n❌ FORMATOS FALLIDOS (${failed.length}):`);
            failed.forEach(r => {
                console.log(`   🚫 ${r.format.toUpperCase()}: ${r.error}`);
            });
        }
        
        console.log('\n🎯 PRÓXIMOS PASOS:');
        console.log('   1. Revisa tu WhatsApp y nota cuáles se reprodujeron');
        console.log('   2. Elige el formato que mejor funcione');
        console.log('   3. Actualiza el código principal con ese formato');
        
        // Cerrar servidor temporal
        server.close();
        console.log('\n🏁 Test de formatos completado\n');
        
    } catch (error) {
        console.error(`\n💥 Error fatal: ${error.message}`);
    }
})();