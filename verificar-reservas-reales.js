require('dotenv').config();

async function verificarReservasReales() {
    console.log('🔍 VERIFICACIÓN RESERVAS REALES - Conde Lina');
    console.log('📋 Buscando todas las fechas agosto 2025');
    console.log('');
    
    try {
        const token = process.env.BEDS24_TOKEN;
        const apiUrl = 'https://api.beds24.com/v2';
        
        // Buscar en diferentes fechas de agosto
        const fechas = ['2025-08-20', '2025-08-21', '2025-08-22', '2025-08-23', '2025-08-24', '2025-08-25'];
        
        for (const fecha of fechas) {
            console.log(`\n📅 Buscando en fecha: ${fecha}`);
            
            const bookingsResponse = await fetch(`${apiUrl}/bookings?checkIn=${fecha}`, {
                headers: { 'token': token, 'Content-Type': 'application/json' }
            });
            const bookingsData = await bookingsResponse.json();
            const bookings = Array.isArray(bookingsData) ? bookingsData : [];
            
            const condeBookings = bookings.filter(booking => {
                const fullName = `${booking.firstName} ${booking.lastName}`.toLowerCase();
                return fullName.includes('conde') && fullName.includes('lina');
            });
            
            if (condeBookings.length > 0) {
                console.log(`✅ Encontradas ${condeBookings.length} reservas Conde Lina en ${fecha}:`);
                
                for (let i = 0; i < condeBookings.length; i++) {
                    const booking = condeBookings[i];
                    console.log(`\n📋 RESERVA ${i + 1}:`);
                    console.log(`  - ID: ${booking.id}`);
                    console.log(`  - Nombre: ${booking.firstName} ${booking.lastName}`);
                    console.log(`  - Entrada: ${booking.firstNight}`);
                    console.log(`  - Salida: ${booking.lastNight}`);
                    console.log(`  - Huéspedes: ${booking.numAdult} adultos, ${booking.numChild} niños`);
                    console.log(`  - Precio: ${booking.price} COP`);
                    console.log(`  - Canal: ${booking.referer}`);
                    console.log(`  - roomId: ${booking.roomId}`);
                    
                    // Verificar invoice items REALES
                    try {
                        const invoiceResponse = await fetch(`${apiUrl}/bookings/${booking.id}/invoice`, {
                            headers: { 'token': token, 'Content-Type': 'application/json' }
                        });
                        const invoiceDetails = await invoiceResponse.json();
                        
                        console.log(`  - Invoice items:`);
                        if (invoiceDetails.items && invoiceDetails.items.length > 0) {
                            const charges = invoiceDetails.items.filter(item => item.type === 'charge');
                            const payments = invoiceDetails.items.filter(item => item.type === 'payment');
                            
                            console.log(`    • Charges: ${charges.length}`);
                            charges.forEach(item => {
                                console.log(`      - "${item.description}": ${item.amount} COP`);
                            });
                            
                            console.log(`    • Payments: ${payments.length}`);
                            if (payments.length > 0) {
                                payments.forEach(item => {
                                    console.log(`      - "${item.description}": ${item.amount} COP`);
                                });
                            } else {
                                console.log(`      - NO HAY PAGOS REALES`);
                            }
                        } else {
                            console.log(`    • NO HAY INVOICE ITEMS`);
                        }
                    } catch (invoiceError) {
                        console.log(`    • Error obteniendo invoice: ${invoiceError.message}`);
                    }
                }
                
                // Si encontramos reservas, no seguir buscando
                break;
            }
        }
        
    } catch (error) {
        console.error('💥 ERROR:', error.message);
    }
}

verificarReservasReales();