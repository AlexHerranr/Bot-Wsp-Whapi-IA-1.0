// Verificar datos específicos de la reserva 74793397
const { fetchBookingByIdFromBeds24 } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function testDatos74793397() {
  console.log('🔍 VERIFICANDO DATOS ESPECÍFICOS DE RESERVA 74793397');
  console.log('=' + '='.repeat(55));
  
  try {
    console.log('\n📋 Obteniendo datos directos de Beds24...');
    
    const result = await fetchBookingByIdFromBeds24('74793397');
    
    if (result.success && result.booking) {
      console.log('\n✅ DATOS OBTENIDOS EXITOSAMENTE:');
      console.log('   📊 Estructura completa:');
      console.log(JSON.stringify(result.booking, null, 2));
      
      console.log('\n🎯 CAMPOS CLAVE PARA PDF:');
      console.log(`   🆔 ID: ${result.booking.id}`);
      console.log(`   👤 Nombre: ${result.booking.firstName} ${result.booking.lastName}`);
      console.log(`   📧 Email: "${result.booking.email}" ${result.booking.email ? '✅' : '❌ Vacío'}`);
      console.log(`   📅 Llegada: ${result.booking.arrival}`);
      console.log(`   📅 Salida: ${result.booking.departure}`);
      console.log(`   ✅ Status: ${result.booking.status}`);
      console.log(`   🏢 Canal: ${result.booking.referer || result.booking.source || 'N/A'}`);
      console.log(`   🏠 Habitación: ${result.booking.roomName || 'N/A'}`);
      console.log(`   📞 Teléfono: ${result.booking.phone || 'N/A'}`);
      
      if (result.booking.invoiceItems && result.booking.invoiceItems.length > 0) {
        console.log(`   💰 Invoice Items: ${result.booking.invoiceItems.length} items`);
        result.booking.invoiceItems.forEach((item, index) => {
          console.log(`      ${index + 1}. ${item.description} (${item.type}) - $${item.amount}`);
        });
      }
      
    } else {
      console.log('❌ ERROR obteniendo datos:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ ERROR INESPERADO:', error.message);
  }
}

testDatos74793397();