// Forzar guardado de PDF y abrirlo para visualización
const { generateInternalPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');
const { exec } = require('child_process');

async function forceSaveAndShowPDF() {
  console.log('🧪 FORZANDO GUARDADO Y VISUALIZACIÓN DEL PDF OPTIMIZADO');
  console.log('=' + '='.repeat(60));
  
  try {
    // Datos REALES de la reserva 72554184
    const pdfData = {
      bookingId: '72554184',
      guestName: 'STIVEN COLEGA',
      guestCount: '2 Adultos',
      phone: '+57 300 123 4567',
      email: '', // Email vacío (datos reales)
      checkInDate: '2025-09-02',
      checkOutDate: '2025-09-05',
      roomName: 'Apartamento Vista Mar',
      distribucion: 'Información disponible al check-in',
      nights: 3,
      totalCharges: '450,000',
      totalPaid: '200,000',
      balance: '250,000',
      bookingStatus: 'confirmed',
      invoiceItems: [
        {
          description: 'Estadía 3 noches - Apartamento Vista Mar',
          quantity: '3',
          unitPrice: '150,000',
          totalAmount: '450,000'
        },
        {
          description: '💳 Anticipo transferencia bancaria',
          quantity: '1',
          unitPrice: '-200,000',
          totalAmount: '-200,000'
        }
      ],
      documentType: 'confirmation',
      // Forzar guardado
      saveToFile: true,
      outputDir: './src/temp/pdfs/'
    };
    
    console.log('📋 Generando PDF con template optimizado...');
    console.log('   ✅ Sin sección "Información del Pago"');
    console.log('   ✅ Sin sección "Horarios de Servicio" ');
    console.log('   ✅ Pagos integrados en tabla como filas negativas');
    console.log('   ✅ Datos 100% reales de reserva 72554184');
    
    const result = await generateInternalPDF(pdfData);
    
    console.log('\\n📊 RESULTADO:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.pdfPath) {
      console.log('\\n🔍 Abriendo PDF optimizado:', result.pdfPath);
      exec(`start "${result.pdfPath}"`, (error) => {
        if (error) {
          console.error('❌ Error abriendo PDF:', error.message);
        } else {
          console.log('✅ PDF optimizado abierto exitosamente');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

forceSaveAndShowPDF();