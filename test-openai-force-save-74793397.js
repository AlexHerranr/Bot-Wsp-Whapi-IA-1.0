// Simulación COMPLETA de OpenAI con GUARDADO FORZADO - bookingId 74793397
const { generateInternalPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function simulateOpenAIWithForcedSave() {
  console.log('🤖 SIMULANDO OPENAI CON GUARDADO FORZADO');
  console.log('=' + '='.repeat(50));
  
  console.log('\n📞 OpenAI llama: generateBookingConfirmationPDF({ bookingId: "74793397" })');
  
  try {
    const startTime = Date.now();
    
    // PASO 1: Simular llamada exacta de OpenAI
    const result = await generateBookingConfirmationPDF({ 
      bookingId: '74793397',
      saveToFile: true,  // FORZAR GUARDADO
      outputDir: './src/temp/pdfs/'
    });
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n📊 RESULTADO COMPLETO:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n📈 MÉTRICAS:');
    console.log(`   ⏱️ Tiempo total: ${totalTime}ms`);
    console.log(`   📊 Tamaño: ${result.data?.size || 'N/A'}`);
    
    if (result.success) {
      console.log('\n✅ ÉXITO TOTAL');
      
      if (result.pdfPath) {
        console.log(`   📁 PDF guardado: ${result.pdfPath}`);
        
        // Intentar abrir el PDF
        const { exec } = require('child_process');
        console.log('\n🔍 Abriendo PDF generado...');
        exec(`start "${result.pdfPath}"`, (error) => {
          if (error) {
            console.error('❌ Error abriendo PDF:', error.message);
          } else {
            console.log('✅ PDF abierto exitosamente');
          }
        });
        
      } else {
        console.log('   ⚠️ PDF no guardado físicamente');
      }
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

simulateOpenAIWithForcedSave();