// Prueba real con reserva 74793397 - STIVEN COLEGA
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function testReserva74793397() {
  console.log('🧪 PRUEBA REAL CON RESERVA 74793397');
  console.log('=' + '='.repeat(50));
  
  try {
    console.log('\n1️⃣ CONSULTANDO RESERVA 74793397...');
    console.log('   📋 Esta reserva apareció en el listado de Beds24');
    console.log('   👤 Huésped: STIVEN COLEGA');
    
    const result = await generateBookingConfirmationPDF({ 
      bookingId: '74793397'
    });
    
    console.log('\n2️⃣ RESULTADO DE LA GENERACIÓN:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n3️⃣ DETALLES DEL PDF:');
      console.log(`   📊 Tamaño: ${result.data.size}`);
      console.log(`   ⏱️ Tiempo: ${result.data.generationTime}`);
      console.log(`   📄 Tipo: ${result.data.documentType}`);
      console.log(`   🎯 BookingId: ${result.data.bookingId}`);
      
      console.log('\n✅ PRUEBA EXITOSA CON RESERVA DIFERENTE');
      
      if (result.pdfPath) {
        console.log(`   📁 PDF guardado en: ${result.pdfPath}`);
      }
    } else {
      console.log('\n❌ ERROR EN LA GENERACIÓN:');
      console.log(`   🚫 Error: ${result.error}`);
      console.log(`   💬 Mensaje: ${result.message}`);
    }
    
  } catch (error) {
    console.error('❌ ERROR INESPERADO:', error.message);
    console.error('Stack:', error.stack);
  }
}

testReserva74793397();