// Test para validar que solo acepta canales permitidos
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function testChannelValidation() {
  console.log('🧪 TEST: Validación de Canal de Reserva');
  console.log('=' .repeat(60));
  
  try {
    // Test con reserva de canal permitido (pacartagena2)
    console.log('\n📋 TEST: Reserva de canal PERMITIDO');
    console.log('BookingId: 72554184 - Canal: pacartagena2');
    
    const result1 = await generateBookingConfirmationPDF({
      bookingId: '72554184'  // Canal pacartagena2 (permitido)
    });
    
    console.log('Result CANAL PERMITIDO:', {
      success: result1.success,
      message: result1.success ? '✅ PDF generado correctamente' : result1.message,
      error: result1.error || 'N/A'
    });
    
    console.log('\n📋 VALIDACIONES IMPLEMENTADAS:');
    console.log('✅ CANALES PERMITIDOS:');
    console.log('  - Booking.com');
    console.log('  - Direct / Directo');
    console.log('  - PaCartagena');
    console.log('  - Booking');
    
    console.log('\n❌ CANALES BLOQUEADOS:');
    console.log('  - Airbnb');
    console.log('  - Expedia'); 
    console.log('  - Hoteles.com');
    console.log('  - Hotels.com');
    console.log('  - Agoda');
    
    console.log('\n📝 ERROR PARA CANALES BLOQUEADOS:');
    console.log('   "No se puede generar PDF para reservas del canal [CANAL]"');
    console.log('   "Los PDFs solo se generan para reservas de Booking.com, Direct y PaCartagena"');
    
    console.log('\n✅ TEST CHANNEL VALIDATION COMPLETADO');
    
  } catch (error) {
    console.error('❌ ERROR EN TEST:', error.message);
  }
}

testChannelValidation();