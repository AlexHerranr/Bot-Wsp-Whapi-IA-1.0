// Test con cache limpio para verificar nuevo título "CONFIRMACIÓN DE RESERVA"
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');
const { getPDFService } = require('./src/plugins/hotel/services/pdf-lifecycle.service.ts');

async function testWithClearCache() {
  console.log('🧹 TEST CON CACHE LIMPIO - NUEVO TÍTULO');
  console.log('=' + '='.repeat(50));
  
  try {
    console.log('\n🗑️ Limpiando cache de template y configuración...');
    const pdfService = getPDFService();
    pdfService.clearCache();
    
    console.log('\n📞 OpenAI llama con cache limpio:');
    console.log('   Function: generateBookingConfirmationPDF');
    console.log('   Parameter: { bookingId: "74793397" }');
    console.log('   Esperado: "CONFIRMACIÓN DE RESERVA" en lugar de "CONFIRMATION"');
    
    const result = await generateBookingConfirmationPDF({ 
      bookingId: '74793397'
    });
    
    console.log('\n📊 RESULTADO:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.pdfPath) {
      console.log('\n✅ PDF generado con cache limpio');
      console.log(`   📁 Archivo: ${result.pdfPath}`);
      console.log('   📋 Verificar que el título sea "CONFIRMACIÓN DE RESERVA"');
      
      // Abrir PDF para verificar
      const { exec } = require('child_process');
      console.log('\n🔍 Abriendo PDF para verificar título...');
      exec(`start "${result.pdfPath}"`, (error) => {
        if (error) {
          console.error('❌ Error abriendo PDF:', error.message);
        } else {
          console.log('✅ PDF abierto - verificar título manualmente');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testWithClearCache();