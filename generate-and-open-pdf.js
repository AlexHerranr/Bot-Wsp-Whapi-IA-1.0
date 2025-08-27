// Generar PDF y abrir automáticamente
const { generateBookingConfirmationPDF } = require('./src/plugins/hotel/functions/generate-invoice-pdf/generate-invoice-pdf.ts');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function generateAndOpenPDF() {
  console.log('🧪 GENERANDO Y ABRIENDO PDF CON DATOS REALES');
  console.log('=' + '='.repeat(50));
  
  try {
    console.log('\n📋 Reserva: 72554184 (STIVEN COLEGA)');
    const result = await generateBookingConfirmationPDF({ 
      bookingId: '72554184'
    });
    
    console.log('\n📊 RESULTADO:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.data?.filePath) {
      console.log('\n🔍 Abriendo PDF:', result.data.filePath);
      exec(`start "${result.data.filePath}"`, (error) => {
        if (error) {
          console.error('❌ Error abriendo PDF:', error.message);
        } else {
          console.log('✅ PDF abierto exitosamente');
        }
      });
    } else {
      // Buscar el PDF más reciente
      const pdfDir = path.join(__dirname, 'src', 'temp', 'pdfs');
      if (fs.existsSync(pdfDir)) {
        const files = fs.readdirSync(pdfDir)
          .filter(f => f.endsWith('.pdf'))
          .map(f => ({
            name: f,
            path: path.join(pdfDir, f),
            time: fs.statSync(path.join(pdfDir, f)).mtime
          }))
          .sort((a, b) => b.time - a.time);
          
        if (files.length > 0) {
          console.log('\n🔍 Abriendo PDF más reciente:', files[0].name);
          exec(`start "${files[0].path}"`, (error) => {
            if (error) {
              console.error('❌ Error abriendo PDF:', error.message);
            } else {
              console.log('✅ PDF abierto exitosamente');
            }
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

generateAndOpenPDF();