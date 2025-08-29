// Script de prueba para generación de PDF
const path = require('path');
const fs = require('fs');

// Simular entorno Railway
process.env.RAILWAY_PROJECT_ID = 'test-railway';
process.env.RAILWAY_ENVIRONMENT_NAME = 'development';

async function testPDFGeneration() {
  console.log('🧪 Iniciando prueba de generación de PDF...');
  console.log('📋 Entorno simulado: Railway');
  
  try {
    // Cargar el servicio de PDF
    const { PDFGeneratorService } = require('./dist/plugins/hotel/services/pdf-generator.service.js');
    
    // Crear instancia del servicio
    const pdfService = new PDFGeneratorService();
    
    // Datos de prueba para el PDF
    const testData = {
      bookingId: '12345678',
      guestName: 'Juan Pérez',
      guestCount: '2',
      email: 'juan@example.com',
      checkInDate: '2025-09-01',
      checkOutDate: '2025-09-05',
      roomName: 'Habitación Deluxe',
      aptDescription: 'Apartamento con vista al mar',
      distribucion: '1 cama king size',
      nights: 4,
      totalCharges: '800000',
      totalPaid: '800000',
      balance: '0',
      invoiceItems: [
        {
          description: 'Hospedaje - 4 noches',
          quantity: '4',
          unitPrice: '200000',
          totalAmount: '800000'
        }
      ],
      paymentItems: [
        {
          description: 'Pago con tarjeta',
          amount: 800000,
          formattedAmount: '$800,000'
        }
      ],
      documentType: 'CONFIRMACIÓN',
      triggerFunction: 'test'
    };
    
    console.log('📄 Generando PDF con datos de prueba...');
    
    // Generar el PDF
    const result = await pdfService.generateInvoicePDF(testData);
    
    if (result.success) {
      console.log('✅ PDF generado exitosamente!');
      console.log(`📁 Archivo: ${result.pdfPath}`);
      console.log(`📊 Tamaño: ${(result.size / 1024).toFixed(2)} KB`);
      
      // Verificar que el archivo existe
      if (fs.existsSync(result.pdfPath)) {
        console.log('✅ Archivo verificado en el sistema de archivos');
      } else {
        console.log('❌ Error: El archivo no existe en la ruta especificada');
      }
    } else {
      console.log('❌ Error generando PDF:', result.error);
    }
    
    // Limpiar
    if (pdfService.cleanup) {
      await pdfService.cleanup();
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

// Ejecutar la prueba
testPDFGeneration();