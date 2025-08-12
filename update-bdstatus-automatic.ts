import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function calculateBDStatus(booking: any, today: Date): string {
  const arrivalDate = new Date(booking.arrivalDate + 'T00:00:00Z');
  const isFuture = arrivalDate >= today;
  const status = booking.status?.toLowerCase();
  
  // Verificar si tiene payments (array no vacío)
  const hasPayments = Array.isArray(booking.payments) && booking.payments.length > 0;
  
  if (status === 'cancelled') {
    return isFuture ? 'Cancelada Futura' : 'Cancelada Pasada';
  }
  
  if (isFuture) {
    if (status === 'confirmed' && hasPayments) {
      return 'Futura Confirmada';
    } else {
      return 'Futura Pendiente';
    }
  }
  
  // Para reservas pasadas que no son cancelled
  if (status === 'confirmed' && hasPayments) {
    return 'Pasada Confirmada';
  } else {
    return 'Pasada Pendiente';
  }
}

async function updateBDStatusAutomatic() {
  console.log('🔄 ACTUALIZANDO BDStatus automático para TODAS las reservas...\n');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`📅 Fecha de referencia: ${today.toISOString().split('T')[0]}\n`);

    // Obtener todas las reservas
    const allBookings = await prisma.booking.findMany({
      select: {
        bookingId: true,
        arrivalDate: true,
        status: true,
        payments: true,
        propertyName: true,
        guestName: true
      }
    });

    console.log(`📊 Total reservas a procesar: ${allBookings.length}\n`);

    let updated = 0;
    const estadisticas = {
      'Futura Confirmada': 0,
      'Futura Pendiente': 0,
      'Cancelada Futura': 0,
      'Cancelada Pasada': 0,
      'Pasada Confirmada': 0,
      'Pasada Pendiente': 0
    };

    console.log('🔧 Procesando reservas...\n');

    for (const booking of allBookings) {
      try {
        const bdStatus = calculateBDStatus(booking, today);
        
        // Actualizar en BD
        await prisma.booking.updateMany({
          where: { bookingId: booking.bookingId },
          data: { BDStatus: bdStatus }
        });

        estadisticas[bdStatus as keyof typeof estadisticas]++;
        updated++;

        // Log de muestra para verificar lógica
        if (updated <= 10) {
          const hasPayments = Array.isArray(booking.payments) && booking.payments.length > 0;
          console.log(`${updated}. ${booking.bookingId} - ${booking.propertyName}`);
          console.log(`   📅 Llegada: ${booking.arrivalDate}`);
          console.log(`   📊 Status: ${booking.status}`);
          console.log(`   💰 Payments: ${hasPayments ? 'SÍ' : 'NO'}`);
          console.log(`   🏷️ BDStatus: ${bdStatus}\n`);
        }

      } catch (error: any) {
        console.log(`❌ Error en ${booking.bookingId}: ${error.message}`);
      }
    }

    console.log(`✅ Proceso completado: ${updated}/${allBookings.length} reservas actualizadas\n`);

    console.log('📈 ESTADÍSTICAS POR CLASIFICACIÓN:');
    Object.entries(estadisticas).forEach(([status, count]) => {
      const percentage = Math.round((count / allBookings.length) * 100);
      console.log(`  ${status}: ${count} (${percentage}%)`);
    });

    // Verificar muestra de cada categoría
    console.log('\n🔍 MUESTRA DE CADA CATEGORÍA:');
    for (const [categoria, _] of Object.entries(estadisticas)) {
      const muestra = await prisma.booking.findFirst({
        where: { BDStatus: categoria },
        select: {
          bookingId: true,
          propertyName: true,
          arrivalDate: true,
          status: true,
          payments: true,
          BDStatus: true
        }
      });

      if (muestra) {
        const hasPayments = Array.isArray(muestra.payments) && muestra.payments.length > 0;
        console.log(`\n${categoria}:`);
        console.log(`  📋 ${muestra.bookingId} - ${muestra.propertyName}`);
        console.log(`  📅 ${muestra.arrivalDate} | Status: ${muestra.status} | Payments: ${hasPayments ? 'SÍ' : 'NO'}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error general:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateBDStatusAutomatic();