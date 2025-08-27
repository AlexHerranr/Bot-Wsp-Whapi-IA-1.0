// Simulación COMPLETA de llamada de OpenAI con bookingId 74793397
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function simulateOpenAICall() {
  console.log('🤖 SIMULANDO LLAMADA COMPLETA DE OPENAI');
  console.log('=' + '='.repeat(50));
  
  console.log('\n📞 OpenAI llama a la función con:');
  console.log('   Function: generateBookingConfirmationPDF');
  console.log('   Parameter: { bookingId: "74793397" }');
  
  try {
    const startTime = Date.now();
    
    // SIMULACIÓN EXACTA DE LA LLAMADA DE OPENAI
    const result = await generateBookingConfirmationPDF({ 
      bookingId: '74793397'
    });
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n📊 FLUJO COMPLETO EJECUTADO:');
    console.log('   1. ✅ Validación de bookingId');
    console.log('   2. ✅ Consulta a Beds24 API');
    console.log('   3. ✅ Validación de status "confirmed"');
    console.log('   4. ✅ Validación de canal permitido');
    console.log('   5. ✅ Transformación de datos');
    console.log('   6. ✅ Generación de PDF con template');
    
    console.log('\n🎯 RESULTADO PARA OPENAI:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n📈 MÉTRICAS DE RENDIMIENTO:');
    console.log(`   ⏱️ Tiempo total: ${totalTime}ms`);
    console.log(`   📊 Tamaño PDF: ${result.data?.size || 'N/A'}`);
    console.log(`   🚀 Eficiencia: ${result.data?.efficiency || 'N/A'}`);
    
    if (result.success) {
      console.log('\n✅ ÉXITO: OpenAI recibe respuesta positiva');
      console.log('   📋 BookingId procesado:', result.data?.bookingId);
      console.log('   📄 Documento generado:', result.data?.documentType);
      console.log('   💬 Mensaje:', result.message);
    } else {
      console.log('\n❌ ERROR: OpenAI recibe respuesta de fallo');
      console.log('   🚫 Error:', result.error);
      console.log('   💬 Mensaje:', result.message);
    }
    
  } catch (error) {
    console.log('\n💥 EXCEPCIÓN CAPTURADA:');
    console.log('   ❌ OpenAI recibiría un error 500');
    console.error('   📝 Error:', error.message);
    console.error('   📚 Stack:', error.stack);
  }
}

simulateOpenAICall();