// Forzar generación y guardado de PDF para visualizar
const { generateInternalPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

async function forceSavePDF() {
  console.log('🧪 FORZANDO GENERACIÓN Y GUARDADO DE PDF');
  console.log('=' + '='.repeat(50));
  
  try {
    // Datos de ejemplo con la reserva real
    const pdfData = {
      bookingId: '72554184',
      guestName: 'STIVEN COLEGA',
      guestCount: '2 Adultos',
      phone: '+57 300 123 4567',
      email: '', // Email vacío como en los datos reales
      checkInDate: '2025-09-02',
      checkOutDate: '2025-09-05',
      roomName: 'Apartamento Estándar',
      distribucion: 'Información disponible al check-in',
      nights: 3,
      totalCharges: '450,000',
      totalPaid: '200,000',
      balance: '250,000',
      bookingStatus: 'confirmed',
      invoiceItems: [
        {
          description: 'Estadía 3 noches - Apartamento Estándar',
          quantity: '3',
          unitPrice: '150,000',
          totalAmount: '450,000'
        },
        {
          description: '💳 Anticipo transferencia',
          quantity: '1',
          unitPrice: '-200,000',
          totalAmount: '-200,000'
        }
      ],
      documentType: 'confirmation'
    };
    
    console.log('\n📋 Generando PDF con datos de la reserva 72554184...');
    const result = await generateInternalPDF(pdfData);
    
    console.log('\n📊 RESULTADO:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

forceSavePDF();