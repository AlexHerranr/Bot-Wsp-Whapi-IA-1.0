// Test básico para la nueva función simplificada
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function testBookingConfirmationPDF() {
  console.log('🧪 INICIANDO TEST: generateBookingConfirmationPDF');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Solo con bookingId real
    console.log('\n📋 TEST 1: Solo bookingId real');
    console.log('Input:', { bookingId: '72554184' });
    
    const result1 = await generateBookingConfirmationPDF({
      bookingId: '72554184'
    });
    
    console.log('Result 1:', JSON.stringify(result1, null, 2));
    
    // Test 2: Con distribución opcional  
    console.log('\n📋 TEST 2: Con distribución opcional');
    console.log('Input:', { 
      bookingId: '72554184', 
      distribucion: '2 camas queen, 1 sofá cama, cocina equipada' 
    });
    
    const result2 = await generateBookingConfirmationPDF({
      bookingId: '72554184',
      distribucion: '2 camas queen, 1 sofá cama, cocina equipada'
    });
    
    console.log('Result 2:', JSON.stringify(result2, null, 2));
    
    // Test 3: Con documentType
    console.log('\n📋 TEST 3: Con documentType updated_confirmation');
    console.log('Input:', { 
      bookingId: '72554184', 
      documentType: 'updated_confirmation' 
    });
    
    const result3 = await generateBookingConfirmationPDF({
      bookingId: '72554184',
      documentType: 'updated_confirmation'
    });
    
    console.log('Result 3:', JSON.stringify(result3, null, 2));
    
    console.log('\n✅ TESTS COMPLETADOS');
    
  } catch (error) {
    console.error('❌ ERROR EN TEST:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testBookingConfirmationPDF();
}

module.exports = { testBookingConfirmationPDF };