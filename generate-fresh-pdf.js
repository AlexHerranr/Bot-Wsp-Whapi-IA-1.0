// Generar PDF fresco con timestamp único para evitar cache
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');
const path = require('path');
const fs = require('fs');

async function generateFreshPDF() {
  console.log('🧪 GENERANDO PDF FRESCO CON DATOS REALES');
  console.log('=' + '='.repeat(50));
  
  try {
    // Forzar timestamp único para evitar cache
    const timestamp = Date.now();
    console.log(`\n📋 Reserva: 72554184 (STIVEN COLEGA) - Timestamp: ${timestamp}`);
    
    const result = await generateBookingConfirmationPDF({ 
      bookingId: '72554184',
      documentType: `fresh_confirmation_${timestamp}`
    });
    
    console.log('\n📊 RESULTADO:');
    console.log(JSON.stringify(result, null, 2));
    
    // Buscar PDFs generados recientemente
    const pdfDirs = [
      'src/temp/pdfs',
      'src/plugins/hotel/functions/generate-invoice-pdf/pdfs',
      'src/plugins/hotel/functions/generate-invoice-pdf/templates/pdfs'
    ];
    
    for (const dir of pdfDirs) {
      const fullPath = path.join(__dirname, dir);
      if (fs.existsSync(fullPath)) {
        console.log(`\n🔍 Buscando en: ${dir}`);
        const files = fs.readdirSync(fullPath)
          .filter(f => f.endsWith('.pdf'))
          .map(f => {
            const filePath = path.join(fullPath, f);
            return {
              name: f,
              path: filePath,
              time: fs.statSync(filePath).mtime,
              size: fs.statSync(filePath).size
            };
          })
          .sort((a, b) => b.time - a.time);
          
        console.log(`   📁 ${files.length} PDFs encontrados`);
        if (files.length > 0) {
          console.log(`   🆕 Más reciente: ${files[0].name} (${(files[0].size/1024).toFixed(1)} KB)`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

generateFreshPDF();