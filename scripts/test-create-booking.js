#!/usr/bin/env node

/**
 * Script de prueba para la función create_new_booking
 * Crea una reserva de prueba del 2 al 6 de septiembre para el apartamento 0715
 */

const path = require('path');

// Configurar variables de entorno
process.env.BEDS24_TOKEN = 'gLNPEkfnMxbKUEVPbvy7EWq/NA6cMLJ31QzPEKJlMAdk6eLSBFzSDj/puTp3HRcTeW6eu8ouWisupA/uKgWZ0DQUmZEisQe1yqz/EiS7lmUp2ScXEMmxoNgLmHHeEWAKhNcSIdKXjYpwtUxBYR7Zcrm9j8X0XBYinnPxsm5Kphg=';
process.env.BEDS24_WRITE_REFRESH_TOKEN = 'NTEMt84pthHT2EHUE51k/wz9AvzLFkMXi//0pJarMpu8hUMW8nm0p97AqY0WTddCfCRy2i6AUc/VSPwwfweMfcrj3GDRlWDarg0ENoVLlB+BvDLd/Lw3w6UcMjUwcodUQxRrUZhJGKsevwS5bpH9OkbtDFg6dINPAAw/6PkMWFg=';
process.env.BEDS24_API_URL = 'https://api.beds24.com/v2';
process.env.BEDS24_TIMEOUT = '15000';

async function testCreateBooking() {
    console.log('🧪 TEST: Iniciando prueba de create_new_booking');
    console.log('=' .repeat(80));
    
    try {
        // Importar la función compilada
        const { createNewBooking } = require('../dist/plugins/hotel/functions/create-new-booking/create-new-booking.js');
        
        // Parámetros de prueba
        const testParams = {
            roomIds: [506591], // Apartamento 0715
            arrival: '2025-09-02',
            departure: '2025-09-06',
            firstName: 'Test',
            lastName: 'Reserva',
            email: 'test@example.com',
            phone: '3001234567',
            numAdult: 3,
            numChild: 0,
            arrivalTime: '3:00 PM',
            accommodationRate: 150000, // $150,000 por noche
            extraServices: [
                {
                    description: 'Limpieza especial',
                    amount: 70000,
                    qty: 1
                }
            ],
            advancePayment: 200000, // $200,000 de anticipo
            advanceDescription: 'Anticipo de prueba via script'
        };
        
        console.log('\n📋 Parámetros de prueba:');
        console.log(JSON.stringify(testParams, null, 2));
        
        console.log('\n⏳ Ejecutando función create_new_booking...');
        const startTime = Date.now();
        
        // Ejecutar la función
        const result = await createNewBooking(testParams);
        
        const duration = Date.now() - startTime;
        
        console.log('\n✅ Función ejecutada en', duration, 'ms');
        console.log('\n📊 Resultado:');
        console.log('=' .repeat(80));
        
        if (result.success) {
            console.log('✅ ÉXITO: Reserva creada exitosamente');
            console.log('\n📄 Mensaje para el usuario:');
            console.log(result.message);
            
            if (result.bookings && result.bookings.length > 0) {
                console.log('\n🏨 Detalles de las reservas creadas:');
                result.bookings.forEach((booking, index) => {
                    console.log(`\n  Reserva ${index + 1}:`);
                    console.log(`    - ID: ${booking.id}`);
                    console.log(`    - Room ID: ${booking.roomId}`);
                    console.log(`    - Status: ${booking.status}`);
                    console.log(`    - Pago recibido: $${booking.paymentReceived?.toLocaleString()}`);
                });
            }
            
            if (result.summary) {
                console.log('\n📊 Resumen:');
                const summary = JSON.parse(result.summary);
                console.log(`  - Total reservas: ${summary.totalBookings}`);
                console.log(`  - Reservas fallidas: ${summary.failedBookings}`);
                console.log(`  - Total general: $${summary.grandTotal?.toLocaleString()}`);
                console.log(`  - Anticipo: $${summary.advancePayment?.toLocaleString()}`);
                console.log(`  - Saldo pendiente: $${summary.pendingBalance?.toLocaleString()}`);
            }
        } else {
            console.log('❌ ERROR: No se pudo crear la reserva');
            console.log('\n📄 Mensaje de error:');
            console.log(result.message);
            
            if (result.error) {
                console.log('\n🔍 Detalles del error:');
                console.log(JSON.stringify(result.error, null, 2));
            }
        }
        
        console.log('\n' + '=' .repeat(80));
        console.log('🧪 TEST COMPLETADO');
        
    } catch (error) {
        console.error('\n❌ ERROR CRÍTICO en el test:');
        console.error(error);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar el test
testCreateBooking().then(() => {
    console.log('\n✅ Script terminado exitosamente');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
});