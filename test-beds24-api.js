// Test directo de Beds24 API para ver qué devuelve
const { Beds24Client } = require('./dist/plugins/hotel/services/beds24-client.js');

async function testBeds24API() {
  console.log('🔍 TEST DIRECTO DE BEDS24 API');
  console.log('=' .repeat(50));
  
  try {
    const beds24Client = new Beds24Client();
    
    console.log('\n📋 Consultando con bookingId: 72554184');
    
    const response = await beds24Client.searchBookings({
      bookingId: '72554184',
      includeInvoiceItems: true,
      includeInfoItems: true,
      includeGuests: true,
      includeBookingGroup: true
    });
    
    console.log('\n📊 ESTRUCTURA DE RESPUESTA:');
    console.log('Success:', response.success);
    console.log('Type:', response.type);  
    console.log('Count:', response.count);
    console.log('Data Length:', response.data?.length || 0);
    
    if (response.data && response.data.length > 0) {
      console.log('\n📋 PRIMEROS 5 BOOKING IDs DISPONIBLES:');
      for (let i = 0; i < Math.min(5, response.data.length); i++) {
        const booking = response.data[i];
        console.log(`${i + 1}. ID: ${booking.bookId || booking.id || 'N/A'} - ${booking.firstName || ''} ${booking.lastName || ''}`);
      }
      
      console.log('\n🔍 BUSCANDO 72554184 EN LA RESPUESTA...');
      const found = response.data.find(b => 
        b.bookId == 72554184 || b.id == 72554184 || 
        b.bookId === '72554184' || b.id === '72554184'
      );
      
      if (found) {
        console.log('✅ ENCONTRADO:', JSON.stringify({
          bookId: found.bookId,
          id: found.id,
          firstName: found.firstName,
          lastName: found.lastName,
          email: found.email,
          arrival: found.arrival,
          departure: found.departure
        }, null, 2));
      } else {
        console.log('❌ NO ENCONTRADO en los', response.data.length, 'resultados');
        
        // Mostrar todos los IDs disponibles para debug
        console.log('\n📋 TODOS LOS IDs DISPONIBLES:');
        response.data.forEach((b, i) => {
          console.log(`${i + 1}. ${b.bookId || b.id || 'N/A'}`);
        });
      }
    } else {
      console.log('❌ NO HAY DATOS EN LA RESPUESTA');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testBeds24API();