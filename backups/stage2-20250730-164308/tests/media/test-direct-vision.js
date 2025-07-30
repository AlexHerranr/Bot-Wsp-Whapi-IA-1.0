/**
 * 🧪 TEST DIRECTO - Vision API sin Assistant
 * 
 * Prueba directa con Chat Completions API usando gpt-4o-mini
 * para verificar que el modelo puede realmente procesar imágenes
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

let OpenAI;
try {
    OpenAI = require('openai');
} catch (error) {
    console.error('❌ OpenAI SDK no encontrado. Instalar con: npm install openai');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function testDirectVision() {
    try {
        console.log('🧪 TEST DIRECTO CON VISION API\n');
        
        // Convertir imagen a base64
        const imagePath = path.resolve('./WhatsApp Image 2025-07-24 at 11.31.44 AM.jpeg');
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        console.log(`📷 Imagen cargada: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
        console.log('🔄 Enviando a gpt-4o-mini directamente...\n');
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "¿Qué ves en esta imagen? Describe detalladamente lo que muestra."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500
        });
        
        const answer = response.choices[0].message.content;
        
        console.log('🤖 RESPUESTA DIRECTA DE GPT-4O-MINI:');
        console.log('─'.repeat(60));
        console.log(answer);
        console.log('─'.repeat(60));
        
        console.log(`\n📊 Estadísticas:`);
        console.log(`   - Tokens usados: ${response.usage.total_tokens}`);
        console.log(`   - Tokens prompt: ${response.usage.prompt_tokens}`);
        console.log(`   - Tokens completion: ${response.usage.completion_tokens}`);
        console.log(`   - Longitud respuesta: ${answer.length} caracteres`);
        
        return { success: true, response: answer, usage: response.usage };
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Ejecutar test
(async () => {
    const result = await testDirectVision();
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 COMPARACIÓN DE RESULTADOS');
    console.log('═'.repeat(60));
    
    if (result.success) {
        console.log('✅ Vision API directa: FUNCIONA');
        console.log('❓ Assistant API: Dice que no puede ver imágenes');
        console.log('\n🔍 CONCLUSIÓN:');
        console.log('   - El modelo gpt-4o-mini SÍ puede procesar imágenes');
        console.log('   - El problema está en la configuración del Assistant');
        console.log('   - Posiblemente hay instrucciones que limitan la visión');
    } else {
        console.log('❌ Vision API directa: FALLO');
        console.log(`   Error: ${result.error}`);
    }
    
    console.log('\n🏁 Test completado\n');
})();