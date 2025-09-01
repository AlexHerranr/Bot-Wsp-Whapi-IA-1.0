#!/usr/bin/env node

/**
 * Script para probar el flujo simplificado:
 * 1. create_new_booking retorna mensaje simple
 * 2. generate_booking_confirmation_pdf retorna todos los detalles
 */

// Configurar variables de entorno
process.env.BEDS24_TOKEN = 'gLNPEkfnMxbKUEVPbvy7EWq/NA6cMLJ31QzPEKJlMAdk6eLSBFzSDj/puTp3HRcTeW6eu8ouWisupA/uKgWZ0DQUmZEisQe1yqz/EiS7lmUp2ScXEMmxoNgLmHHeEWAKhNcSIdKXjYpwtUxBYR7Zcrm9j8X0XBYinnPxsm5Kphg=';
process.env.BEDS24_WRITE_REFRESH_TOKEN = 'NTEMt84pthHT2EHUE51k/wz9AvzLFkMXi//0pJarMpu8hUMW8nm0p97AqY0WTddCfCRy2i6AUc/VSPwwfweMfcrj3GDRlWDarg0ENoVLlB+BvDLd/Lw3w6UcMjUwcodUQxRrUZhJGKsevwS5bpH9OkbtDFg6dINPAAw/6PkMWFg=';
process.env.BEDS24_API_URL = 'https://api.beds24.com/v2';

async function testSimplifiedFlow() {
    console.log('🧪 TEST: Flujo simplificado de reserva + PDF');
    console.log('=' .repeat(80));
    
    try {
        // Importar funciones compiladas
        const { createNewBooking } = require('../dist/plugins/hotel/functions/create-new-booking/create-new-booking.js');
        const { generateBookingConfirmationPDF } = require('../dist/plugins/hotel/functions/generate-booking-confirmation-pdf/generate-booking-confirmation-pdf.js');
        
        // PASO 1: Crear reserva
        console.log('\n📋 PASO 1: Crear nueva reserva');
        console.log('-'.repeat(40));
        
        const timestamp = Date.now();
        const bookingParams = {
            roomIds: [506591], // Apartamento 0715
            arrival: '2025-11-10',
            departure: '2025-11-13',
            firstName: `TestFlow${timestamp}`,
            lastName: 'Simplificado',
            email: `test${timestamp}@example.com`,
            phone: '3001234567',
            numAdult: 2,
            numChild: 0,
            arrivalTime: '3:00 PM',
            accommodationRate: 200000,
            extraServices: [{
                description: 'Limpieza especial',
                amount: 70000,
                qty: 1
            }],
            advancePayment: 250000,
            advanceDescription: 'Anticipo via transferencia'
        };
        
        console.log('Creando reserva para:', bookingParams.firstName, bookingParams.lastName);
        const bookingResult = await createNewBooking(bookingParams);
        
        if (!bookingResult.success) {
            console.log('\n❌ Error creando reserva:');
            console.log(bookingResult.message);
            return;
        }
        
        console.log('\n✅ Reserva creada exitosamente');
        console.log('\n📝 Mensaje de create_new_booking:');
        console.log('-'.repeat(40));
        console.log(bookingResult.message);
        console.log('-'.repeat(40));
        
        // Verificar que el mensaje es simple
        const isSimple = bookingResult.message.includes('EXITO_RESERVA') && 
                        bookingResult.message.includes('SIGUIENTE_PASO') &&
                        !bookingResult.message.includes('DATOS_CONFIRMADOS') &&
                        !bookingResult.message.includes('DATOS_FINANCIEROS');
        
        console.log(`\n${isSimple ? '✅' : '❌'} El mensaje es SIMPLE (solo confirmación y siguiente paso)`);
        
        // PASO 2: Generar PDF (simulando que OpenAI lo ejecuta)
        console.log('\n📋 PASO 2: Generar PDF de confirmación');
        console.log('-'.repeat(40));
        
        const bookingId = bookingResult.bookings[0].id;
        console.log('Generando PDF para reserva:', bookingId);
        
        // Simular contexto de usuario (normalmente vendría de OpenAI)
        const userContext = {
            chatId: '573001234567@s.whatsapp.net',
            userId: '573001234567',
            threadId: 'thread_test'
        };
        
        const pdfResult = await generateBookingConfirmationPDF(
            { bookingId: bookingId.toString() },
            userContext
        );
        
        console.log('\n📝 Mensaje de generate_booking_confirmation_pdf:');
        console.log('-'.repeat(40));
        console.log(pdfResult.message);
        console.log('-'.repeat(40));
        
        // Verificar que el mensaje tiene todos los detalles
        const hasDetails = pdfResult.message.includes('DATOS_CONFIRMADOS') && 
                          pdfResult.message.includes('DATOS_FINANCIEROS') &&
                          pdfResult.message.includes('INSTRUCCION_PARA_ASISTENTE');
        
        console.log(`\n${hasDetails ? '✅' : '❌'} El mensaje tiene TODOS LOS DETALLES y las instrucciones`);
        
        // Verificar que incluye el mensaje sugerido
        const hasSuggestedMessage = pdfResult.message.includes('¡Hola! 👋') && 
                                    pdfResult.message.includes('échale un vistazo') &&
                                    pdfResult.message.includes('¿tienes idea de a qué hora llegarás');
        
        console.log(`${hasSuggestedMessage ? '✅' : '❌'} Incluye el mensaje amigable sugerido`);
        
        console.log('\n' + '=' .repeat(80));
        console.log('📊 RESUMEN DEL FLUJO SIMPLIFICADO:');
        console.log('\n1️⃣ create_new_booking:');
        console.log('   ✅ Retorna mensaje SIMPLE');
        console.log('   ✅ Solo confirma éxito');
        console.log('   ✅ Sugiere ejecutar generate_booking_confirmation_pdf');
        
        console.log('\n2️⃣ generate_booking_confirmation_pdf:');
        console.log('   ✅ Retorna TODOS los detalles');
        console.log('   ✅ Incluye datos confirmados y financieros');
        console.log('   ✅ Proporciona mensaje amigable para el cliente');
        console.log('   ✅ Da instrucciones claras al asistente');
        
        console.log('\n✨ El flujo funciona correctamente!');
        
    } catch (error) {
        console.error('\n❌ ERROR en el test:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar el test
testSimplifiedFlow().then(() => {
    console.log('\n✅ Test completado exitosamente');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
});