require('dotenv').config();

async function verificarIdsConocidos() {
    console.log('🔍 VERIFICACIÓN DIRECTA POR IDs CONOCIDOS');
    console.log('📋 IDs que aparecieron antes: 67629019, 67629018');
    console.log('');
    
    try {
        const token = process.env.BEDS24_TOKEN;
        const apiUrl = 'https://api.beds24.com/v2';
        
        const knownIds = [67629019, 67629018];
        
        for (const bookingId of knownIds) {
            console.log(`\n📋 VERIFICANDO BOOKING ID: ${bookingId}`);
            
            try {
                // Obtener booking details
                const bookingResponse = await fetch(`${apiUrl}/bookings/${bookingId}`, {
                    headers: { 'token': token, 'Content-Type': 'application/json' }
                });
                
                if (!bookingResponse.ok) {
                    console.log(`❌ No existe booking ${bookingId}`);
                    continue;
                }
                
                const booking = await bookingResponse.json();
                console.log(`✅ BOOKING ENCONTRADO:`);
                console.log(`  - ID: ${booking.id}`);
                console.log(`  - Nombre: ${booking.firstName} ${booking.lastName}`);
                console.log(`  - Entrada: ${booking.firstNight}`);
                console.log(`  - Precio: ${booking.price} COP`);
                console.log(`  - Canal: ${booking.referer}`);
                console.log(`  - roomId: ${booking.roomId}`);
                
                // Obtener invoice items REALES
                const invoiceResponse = await fetch(`${apiUrl}/bookings/${bookingId}/invoice`, {
                    headers: { 'token': token, 'Content-Type': 'application/json' }
                });
                
                if (invoiceResponse.ok) {
                    const invoiceDetails = await invoiceResponse.json();
                    console.log(`\n🧾 INVOICE ITEMS REALES:`);
                    
                    if (invoiceDetails.items && invoiceDetails.items.length > 0) {
                        const charges = invoiceDetails.items.filter(item => item.type === 'charge');
                        const payments = invoiceDetails.items.filter(item => item.type === 'payment');
                        
                        console.log(`  📊 Charges (${charges.length}):`);
                        charges.forEach((item, i) => {
                            console.log(`    ${i+1}. "${item.description}": ${item.amount} COP`);
                        });
                        
                        console.log(`  💳 Payments (${payments.length}):`);
                        if (payments.length > 0) {
                            let totalPagado = 0;
                            payments.forEach((item, i) => {
                                console.log(`    ${i+1}. "${item.description}": ${item.amount} COP`);
                                totalPagado += Math.abs(item.amount || 0);
                            });
                            console.log(`  💰 TOTAL PAGADO REAL: ${totalPagado.toLocaleString()} COP`);
                        } else {
                            console.log(`    ❌ NO HAY PAGOS REALES - NO MOSTRAR "Total Pagado"`);
                        }
                        
                        const saldo = booking.price - (payments.reduce((sum, p) => sum + Math.abs(p.amount || 0), 0));
                        console.log(`  💰 SALDO REAL: ${saldo.toLocaleString()} COP`);
                        
                    } else {
                        console.log(`  ❌ NO HAY INVOICE ITEMS`);
                    }
                } else {
                    console.log(`  ❌ Error obteniendo invoice`);
                }
                
            } catch (error) {
                console.log(`❌ Error con booking ${bookingId}: ${error.message}`);
            }
        }
        
        // También buscar con fechas más amplias
        console.log(`\n🔍 BÚSQUEDA AMPLIA AGOSTO 2025:`);
        const bookingsResponse = await fetch(`${apiUrl}/bookings?arrivalFrom=2025-08-01&arrivalTo=2025-08-31`, {
            headers: { 'token': token, 'Content-Type': 'application/json' }
        });
        
        if (bookingsResponse.ok) {
            const bookingsData = await bookingsResponse.json();
            const bookings = Array.isArray(bookingsData) ? bookingsData : [];
            
            const condeBookings = bookings.filter(booking => {
                const fullName = `${booking.firstName} ${booking.lastName}`.toLowerCase();
                return fullName.includes('conde');
            });
            
            console.log(`📊 Total bookings agosto: ${bookings.length}`);
            console.log(`📊 Bookings con 'conde': ${condeBookings.length}`);
            
            condeBookings.forEach(booking => {
                console.log(`  - ${booking.firstName} ${booking.lastName} (ID: ${booking.id}) - ${booking.firstNight}`);
            });
        }
        
    } catch (error) {
        console.error('💥 ERROR:', error.message);
    }
}

verificarIdsConocidos();