// Test PDF con datos 100% reales de la reserva 72554184
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function testRealDataPDF() {
  console.log('🧪 GENERANDO PDF CON DATOS 100% REALES');
  console.log('=' + '='.repeat(50));
  
  try {
    console.log('\n📋 Reserva: 72554184 (STIVEN COLEGA)');
    const result = await generateBookingConfirmationPDF({ 
      bookingId: '72554184'
    });
    
    console.log('\n📊 RESULTADO:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRealDataPDF();