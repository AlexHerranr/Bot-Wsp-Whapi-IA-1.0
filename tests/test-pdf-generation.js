// Test funcional para generar PDF con nuevo diseño
const { generateInvoicePDF } = require('../src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');

// Datos de prueba completos
const testData = {
  bookingId: "MS-2024-0825-001",
  guestName: "María Elena González",
  guestCount: "2 personas",
  phone: "+57 314 567 8901",
  email: "maria.gonzalez@email.com",
  checkInDate: "2024-09-15",
  checkOutDate: "2024-09-18",
  checkInDateFormatted: "15 Sep 2024",
  checkOutDateFormatted: "18 Sep 2024",
  roomName: "Suite Ejecutiva Vista Parque",
  nights: 3,
  multipleNights: true,
  totalCharges: "$450.000 COP",
  totalPaid: "$150.000 COP",
  balance: "$300.000 COP",
  bookingStatus: "Confirmada",
  distribucion: "Habitación Doble - 2 huéspedes",
  invoiceItems: [
    {
      description: "Alojamiento Suite Ejecutiva (3 noches)",
      quantity: "3",
      unitPrice: "$130.000",
      totalAmount: "$390.000"
    },
    {
      description: "Limpieza Final",
      quantity: "1",
      unitPrice: "$30.000",
      totalAmount: "$30.000"
    },
    {
      description: "Seguro de Daños",
      quantity: "1", 
      unitPrice: "$30.000",
      totalAmount: "$30.000"
    }
  ],
  documentType: "CONFIRMACIÓN DE RESERVA",
  triggerFunction: "create_new_booking",
  saveToFile: true,
  returnBuffer: false
};

async function testPDFGeneration() {
  console.log('🚀 Iniciando prueba de generación PDF...');
  console.log(`📋 Datos de prueba: ${testData.bookingId} - ${testData.guestName}`);
  
  try {
    console.log('🎨 Generando PDF con nuevo diseño visual...');
    
    const result = await generateInvoicePDF(testData);
    
    if (result.success) {
      console.log('✅ PDF generado exitosamente!');
      console.log(`📁 Archivo: ${result.pdfPath || 'Buffer en memoria'}`);
      console.log(`📊 Tamaño: ${result.data?.size || 'N/A'}`);
      console.log(`⏱️  Tiempo: ${result.data?.generationTime || 'N/A'}`);
      console.log(`🚀 Eficiencia: ${result.data?.efficiency || 'N/A'}`);
    } else {
      console.error('❌ Error generando PDF:', result.error || result.message);
      if (result.error?.context) {
        console.error('📋 Contexto:', result.error.context);
      }
    }
  } catch (error) {
    console.error('💥 Error inesperado:', error.message);
    console.error('🔍 Stack:', error.stack);
  }
}

testPDFGeneration();