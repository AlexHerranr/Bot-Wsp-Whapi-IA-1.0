/**
 * 🎤 TEST SIMPLE - Envío directo de formatos de audio
 * 
 * Envía diferentes formatos de audio directamente a WhatsApp 
 * para probar cuál se reproduce correctamente
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

const CONFIG = {
    // Tu número de WhatsApp
    testChatId: '573003913251@s.whatsapp.net',
    
    // Configuración WHAPI
    whapiUrl: process.env.WHAPI_API_URL,
    whapiToken: process.env.WHAPI_TOKEN,
    
    // Voz TTS
    ttsVoice: process.env.TTS_VOICE || 'nova',
    
    // Mensaje base
    baseMessage: 'Esto es una prueba de formato de audio.',
    
    // Formatos a probar
    formats: [
        {
            name: 'MP3',
            format: 'mp3',
            description: 'Formato uno: MP3 universal, compatible con la mayoría de dispositivos'
        },
        {
            name: 'OPUS',
            format: 'opus', 
            description: 'Formato dos: OGG Opus, preferido por WhatsApp Web y WHAPI'
        },
        {
            name: 'AAC',
            format: 'aac',
            description: 'Formato tres: AAC optimizado para dispositivos móviles'
        },
        {
            name: 'FLAC',
            format: 'flac',
            description: 'Formato cuatro: FLAC alta calidad, sin compresión con pérdida'
        }
    ]
};

console.log('🎤 TEST SIMPLE - FORMATOS DE AUDIO');
console.log('═'.repeat(50));
console.log(`📱 Enviando a: ${CONFIG.testChatId}`);
console.log(`🗣️ Voz: ${CONFIG.ttsVoice}`);
console.log(`🎯 Formatos: ${CONFIG.formats.length}`);
console.log('═'.repeat(50));

async function sendAudioFormat(formatConfig, index) {
    const { name, format, description } = formatConfig;
    
    console.log(`\n🔄 ENVIANDO ${index + 1}/${CONFIG.formats.length}: ${name}`);
    
    try {
        // 1. Generar audio con TTS
        console.log(`   🎤 Generando ${format.toUpperCase()}...`);
        
        const ttsResponse = await openai.audio.speech.create({
            model: 'tts-1',
            voice: CONFIG.ttsVoice,
            input: description,
            response_format: format,
            speed: 1.0
        });
        
        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        const fileSize = (audioBuffer.length / 1024).toFixed(1);
        
        console.log(`   ✅ Audio generado: ${fileSize} KB`);
        
        // 2. Convertir a base64 para envío directo
        const base64Audio = audioBuffer.toString('base64');
        
        // 3. Enviar directamente via WHAPI usando base64
        console.log(`   📤 Enviando vía WHAPI...`);
        
        const voiceEndpoint = `${CONFIG.whapiUrl}/messages/voice`;
        
        // Usar base64 directo en lugar de URL
        const payload = {
            to: CONFIG.testChatId,
            media: `data:audio/${format === 'opus' ? 'ogg' : format};base64,${base64Audio}`
        };
        
        const response = await fetch(voiceEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.whapiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const responseData = await response.json();
            console.log(`   ✅ ${name}: ENVIADO EXITOSAMENTE`);
            console.log(`   📨 Message ID: ${responseData.message?.id || 'N/A'}`);
            
            return {
                success: true,
                format: name,
                size: fileSize,
                messageId: responseData.message?.id
            };
            
        } else {
            const errorData = await response.json();
            console.log(`   ❌ ${name}: ERROR ${response.status}`);
            console.log(`   📄 Detalle: ${errorData.error?.message || 'Sin detalles'}`);
            
            return {
                success: false,
                format: name,
                error: `${response.status}: ${errorData.error?.message || 'Unknown'}`
            };
        }
        
    } catch (error) {
        console.log(`   💥 ${name}: EXCEPCIÓN`);
        console.log(`   📄 Error: ${error.message}`);
        
        return {
            success: false,
            format: name,
            error: error.message
        };
    }
}

// Ejecutar test
(async () => {
    const startTime = Date.now();
    
    console.log('\n🚀 INICIANDO ENVÍO DE FORMATOS...\n');
    console.log('⚠️  REVISA TU WHATSAPP - Deberías recibir 4 notas de voz');
    console.log('   📝 Anota cuáles se reproducen correctamente\n');
    
    const results = [];
    
    try {
        // Enviar cada formato con pausa
        for (let i = 0; i < CONFIG.formats.length; i++) {
            const result = await sendAudioFormat(CONFIG.formats[i], i);
            results.push(result);
            
            // Pausa de 3 segundos entre envíos
            if (i < CONFIG.formats.length - 1) {
                console.log(`   ⏳ Esperando 3 segundos...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        // Resumen final
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n' + '═'.repeat(50));
        console.log('📊 RESUMEN FINAL');
        console.log('═'.repeat(50));
        console.log(`⏱️ Tiempo total: ${duration}s`);
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✅ Exitosos: ${successful.length}/${CONFIG.formats.length}`);
        console.log(`❌ Fallidos: ${failed.length}/${CONFIG.formats.length}`);
        
        if (successful.length > 0) {
            console.log('\n🎵 FORMATOS ENVIADOS:');
            successful.forEach(r => {
                console.log(`   ✅ ${r.format}: ${r.size} KB - ID: ${r.messageId || 'N/A'}`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n🚫 FORMATOS FALLIDOS:');
            failed.forEach(r => {
                console.log(`   ❌ ${r.format}: ${r.error}`);
            });
        }
        
        console.log('\n🎯 PRÓXIMO PASO:');
        console.log('   1. Revisa tu WhatsApp');
        console.log('   2. Reproduce cada nota de voz');
        console.log('   3. Dime cuál formato funcionó mejor');
        console.log('\n🏁 Test completado\n');
        
    } catch (error) {
        console.error(`\n💥 Error fatal: ${error.message}`);
    }
})();