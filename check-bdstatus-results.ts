import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBDStatusResults() {
  console.log('📊 VERIFICANDO ESTADO ACTUAL DE BDStatus...\n');

  try {
    // Contar total y por categoría
    const total = await prisma.booking.count();
    const conBDStatus = await prisma.booking.count({
      where: { BDStatus: { not: null } }
    });

    console.log(`📋 Total reservas: ${total}`);
    console.log(`✅ Con BDStatus: ${conBDStatus}`);
    console.log(`⏳ Pendientes: ${total - conBDStatus}\n`);

    // Estadísticas por categoría
    const estadisticas = await prisma.booking.groupBy({
      by: ['BDStatus'],
      _count: { bookingId: true }
    });

    console.log('📈 ESTADÍSTICAS POR CATEGORÍA:');
    estadisticas.forEach(stat => {
      const categoria = stat.BDStatus || 'Sin clasificar';
      const count = stat._count.bookingId;
      const percentage = Math.round((count / total) * 100);
      console.log(`  ${categoria}: ${count} (${percentage}%)`);
    });

    // Verificar lógica con muestras
    console.log('\n🔍 VERIFICACIÓN DE LÓGICA:');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Futuras confirmadas (confirmed + payments + futuras)
    const futuraConfirmada = await prisma.booking.findFirst({
      where: {
        BDStatus: 'Futura Confirmada',
        arrivalDate: { gte: todayStr }
      },
      select: {
        bookingId: true,
        arrivalDate: true,
        status: true,
        payments: true,
        BDStatus: true
      }
    });

    if (futuraConfirmada) {
      console.log('\n✅ Futura Confirmada (ejemplo):');
      console.log(`   📋 ${futuraConfirmada.bookingId}`);
      console.log(`   📅 ${futuraConfirmada.arrivalDate} (≥ ${todayStr})`);
      console.log(`   📊 Status: ${futuraConfirmada.status}`);
      console.log(`   💰 Payments: ${JSON.stringify(futuraConfirmada.payments).length > 2 ? 'SÍ' : 'NO'}`);
    }

    // Futuras pendientes
    const futuraPendiente = await prisma.booking.findFirst({
      where: { BDStatus: 'Futura Pendiente' },
      select: {
        bookingId: true,
        arrivalDate: true,
        status: true,
        payments: true
      }
    });

    if (futuraPendiente) {
      console.log('\n⏳ Futura Pendiente (ejemplo):');
      console.log(`   📋 ${futuraPendiente.bookingId}`);
      console.log(`   📅 ${futuraPendiente.arrivalDate}`);
      console.log(`   📊 Status: ${futuraPendiente.status}`);
      console.log(`   💰 Payments: ${JSON.stringify(futuraPendiente.payments).length > 2 ? 'SÍ' : 'NO'}`);
    }

    // Canceladas
    const cancelada = await prisma.booking.findFirst({
      where: { BDStatus: { startsWith: 'Cancelada' } },
      select: {
        bookingId: true,
        arrivalDate: true,
        status: true,
        BDStatus: true
      }
    });

    if (cancelada) {
      console.log('\n❌ Cancelada (ejemplo):');
      console.log(`   📋 ${cancelada.bookingId}`);
      console.log(`   📅 ${cancelada.arrivalDate}`);
      console.log(`   📊 Status: ${cancelada.status}`);
      console.log(`   🏷️ BDStatus: ${cancelada.BDStatus}`);
    }

    console.log('\n🎯 La columna BDStatus se actualiza automáticamente basada en:');
    console.log('   ✅ Status de la reserva');
    console.log('   ✅ Fecha de llegada vs fecha actual');
    console.log('   ✅ Presencia de payments (array no vacío)');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBDStatusResults();