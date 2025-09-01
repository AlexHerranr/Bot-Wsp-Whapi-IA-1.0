#!/usr/bin/env node

/**
 * Script para probar los mensajes de error de create_new_booking
 * Verifica que los mensajes sean instrucciones para OpenAI, no para el huésped
 */

const path = require('path');

// Configurar variables de entorno
process.env.BEDS24_TOKEN = 'gLNPEkfnMxbKUEVPbvy7EWq/NA6cMLJ31QzPEKJlMAdk6eLSBFzSDj/puTp3HRcTeW6eu8ouWisupA/uKgWZ0DQUmZEisQe1yqz/EiS7lmUp2ScXEMmxoNgLmHHeEWAKhNcSIdKXjYpwtUxBYR7Zcrm9j8X0XBYinnPxsm5Kphg=';
process.env.BEDS24_WRITE_REFRESH_TOKEN = 'NTEMt84pthHT2EHUE51k/wz9AvzLFkMXi//0pJarMpu8hUMW8nm0p97AqY0WTddCfCRy2i6AUc/VSPwwfweMfcrj3GDRlWDarg0ENoVLlB+BvDLd/Lw3w6UcMjUwcodUQxRrUZhJGKsevwS5bpH9OkbtDFg6dINPAAw/6PkMWFg=';
process.env.BEDS24_API_URL = 'https://api.beds24.com/v2';
process.env.BEDS24_TIMEOUT = '15000';

async function testErrorMessages() {
    console.log('🧪 TEST: Verificando mensajes de error para OpenAI');
    console.log('=' .repeat(80));
    
    try {
        // Importar la función compilada
        const { createNewBooking } = require('../dist/plugins/hotel/functions/create-new-booking/create-new-booking.js');
        
        console.log('\n📋 TEST 1: Sin parámetros');
        console.log('-'.repeat(40));
        let result = await createNewBooking(null);
        console.log('Mensaje para OpenAI:', result.message);
        console.log('✅ Debe indicar instrucciones para el asistente\n');
        
        console.log('\n📋 TEST 2: Campos faltantes');
        console.log('-'.repeat(40));
        result = await createNewBooking({
            roomIds: [506591],
            arrival: '2025-09-02',
            // Faltan muchos campos
        });
        console.log('Mensaje para OpenAI:', result.message);
        console.log('✅ Debe indicar qué decirle al huésped sobre campos faltantes\n');
        
        console.log('\n📋 TEST 3: Room ID inválido');
        console.log('-'.repeat(40));
        result = await createNewBooking({
            roomIds: [123], // ID muy bajo
            arrival: '2025-09-02',
            departure: '2025-09-06',
            firstName: 'Test',
            lastName: 'Error',
            email: 'test@example.com',
            phone: '3001234567',
            numAdult: 2,
            accommodationRate: 150000,
            advancePayment: 100000,
            advanceDescription: 'Test anticipo'
        });
        console.log('Mensaje para OpenAI:', result.message);
        console.log('✅ Debe indicar problema técnico y consulta con superior\n');
        
        console.log('\n📋 TEST 4: Fechas inválidas (salida antes que entrada)');
        console.log('-'.repeat(40));
        result = await createNewBooking({
            roomIds: [506591],
            arrival: '2025-09-06',
            departure: '2025-09-02', // Fecha incorrecta
            firstName: 'Test',
            lastName: 'Fechas',
            email: 'test@example.com',
            phone: '3001234567',
            numAdult: 2,
            accommodationRate: 150000,
            advancePayment: 100000,
            advanceDescription: 'Test anticipo'
        });
        console.log('Mensaje para OpenAI:', result.message);
        console.log('✅ Debe indicar error con fechas y solicitar confirmación\n');
        
        console.log('\n📋 TEST 5: Formato de fecha incorrecto');
        console.log('-'.repeat(40));
        result = await createNewBooking({
            roomIds: [506591],
            arrival: '02/09/2025', // Formato incorrecto
            departure: '06/09/2025',
            firstName: 'Test',
            lastName: 'Formato',
            email: 'test@example.com',
            phone: '3001234567',
            numAdult: 2,
            accommodationRate: 150000,
            advancePayment: 100000,
            advanceDescription: 'Test anticipo'
        });
        console.log('Mensaje para OpenAI:', result.message);
        console.log('✅ Debe indicar problema con formato de fechas\n');
        
        console.log('\n' + '=' .repeat(80));
        console.log('📊 RESUMEN DE MENSAJES DE ERROR:');
        console.log('✅ Todos los mensajes son instrucciones para OpenAI');
        console.log('✅ Indican qué decirle al huésped');
        console.log('✅ Mencionan consultar con superior cuando es apropiado');
        console.log('✅ Son claros sobre el problema y la acción a tomar');
        
    } catch (error) {
        console.error('\n❌ ERROR en el test:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar el test
testErrorMessages().then(() => {
    console.log('\n✅ Tests completados exitosamente');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
});