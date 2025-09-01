#!/usr/bin/env node

/**
 * Script para verificar que el PDF use datos reales de la reserva
 * NO datos hardcodeados como "Paula Palacio"
 */

// Configurar variables de entorno
process.env.BEDS24_TOKEN = 'gLNPEkfnMxbKUEVPbvy7EWq/NA6cMLJ31QzPEKJlMAdk6eLSBFzSDj/puTp3HRcTeW6eu8ouWisupA/uKgWZ0DQUmZEisQe1yqz/EiS7lmUp2ScXEMmxoNgLmHHeEWAKhNcSIdKXjYpwtUxBYR7Zcrm9j8X0XBYinnPxsm5Kphg=';
process.env.BEDS24_API_URL = 'https://api.beds24.com/v2';
process.env.DATABASE_URL = "postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway";

async function testPDFRealData() {
    console.log('🧪 TEST: Verificar que el PDF use datos REALES de la reserva');
    console.log('=' .repeat(80));
    
    try {
        // Importar función
        const { generateBookingConfirmationPDF } = require('../dist/plugins/hotel/functions/generate-booking-confirmation-pdf/generate-booking-confirmation-pdf.js');
        
        // Usar una reserva existente conocida
        const bookingId = '75078508'; // Reserva creada en el test anterior
        
        console.log('\n📋 Generando PDF para reserva REAL:', bookingId);
        console.log('Esta reserva fue creada con:');
        console.log('  - Nombre: TestFlow Simplificado');
        console.log('  - Email: test@example.com');
        console.log('  - Fechas: 2025-11-10 al 2025-11-13');
        console.log('  - NO debe aparecer "Paula Palacio" en ningún lado');
        
        // Simular contexto
        const userContext = {
            chatId: '573001234567@s.whatsapp.net',
            userId: '573001234567',
            threadId: 'thread_test'
        };
        
        console.log('\n⏳ Generando PDF...');
        const result = await generateBookingConfirmationPDF(
            { bookingId: bookingId },
            userContext
        );
        
        if (!result.success) {
            console.log('\n❌ Error generando PDF:');
            console.log(result.message);
            return;
        }
        
        console.log('\n✅ PDF generado exitosamente');
        
        // Analizar el mensaje de respuesta
        console.log('\n📝 Analizando datos en la respuesta:');
        console.log('-'.repeat(40));
        
        const message = result.message;
        
        // Verificar que NO aparezca Paula Palacio
        const hasPaula = message.toLowerCase().includes('paula') || 
                        message.toLowerCase().includes('palacio');
        console.log(`${hasPaula ? '❌' : '✅'} NO contiene "Paula Palacio"`);
        
        // Verificar que SÍ aparezcan los datos correctos
        const hasTestFlow = message.includes('TestFlow');
        console.log(`${hasTestFlow ? '✅' : '❌'} Contiene el nombre correcto "TestFlow"`);
        
        const hasCorrectEmail = message.includes('test') && message.includes('@example.com');
        console.log(`${hasCorrectEmail ? '✅' : '❌'} Contiene el email correcto`);
        
        const hasCorrectDates = message.includes('2025-11-10') && message.includes('2025-11-13');
        console.log(`${hasCorrectDates ? '✅' : '❌'} Contiene las fechas correctas`);
        
        // Extraer y mostrar los datos confirmados
        console.log('\n📊 DATOS CONFIRMADOS EN EL PDF:');
        console.log('-'.repeat(40));
        
        const datosMatch = message.match(/DATOS_CONFIRMADOS:([\s\S]*?)DATOS_FINANCIEROS:/);
        if (datosMatch) {
            console.log(datosMatch[1].trim());
        }
        
        // Verificar el archivo PDF físico si existe
        const fs = require('fs');
        const pdfPath = `/workspace/src/temp/pdfs/invoice-${bookingId}-*.pdf`;
        const glob = require('glob');
        
        try {
            const files = glob.sync(pdfPath);
            if (files.length > 0) {
                const latestFile = files[files.length - 1];
                console.log('\n📄 Archivo PDF generado:', latestFile);
                
                // Leer el PDF y buscar "Paula" (esto es aproximado, PDFs son binarios)
                const pdfContent = fs.readFileSync(latestFile, 'utf8');
                const containsPaula = pdfContent.toLowerCase().includes('paula');
                
                console.log(`${containsPaula ? '❌ ALERTA:' : '✅'} El archivo PDF ${containsPaula ? 'CONTIENE' : 'NO contiene'} "Paula"`);
            }
        } catch (e) {
            // Glob no está instalado, skip esta verificación
        }
        
        console.log('\n' + '=' .repeat(80));
        console.log('📊 RESUMEN:');
        
        if (!hasPaula && hasTestFlow && hasCorrectEmail && hasCorrectDates) {
            console.log('✅ El PDF usa datos REALES de la reserva');
            console.log('✅ NO hay datos hardcodeados de prueba');
            console.log('✅ Los datos corresponden a la reserva solicitada');
        } else {
            console.log('❌ PROBLEMA DETECTADO:');
            if (hasPaula) console.log('  - Aparece "Paula Palacio" (dato de prueba)');
            if (!hasTestFlow) console.log('  - NO aparece el nombre correcto');
            if (!hasCorrectEmail) console.log('  - NO aparece el email correcto');
            if (!hasCorrectDates) console.log('  - NO aparecen las fechas correctas');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR en el test:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar el test
testPDFRealData().then(() => {
    console.log('\n✅ Test completado');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
});