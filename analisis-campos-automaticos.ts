import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analizarCamposAutomaticos() {
  console.log('🔍 ANALIZANDO CAMPOS AUTOMÁTICOS EN BOOKING\n');

  try {
    // Verificar una muestra de registros
    const muestra = await prisma.booking.findMany({
      select: {
        bookingId: true,
        numNights: true,
        lastUpdatedBD: true,
        arrivalDate: true,
        departureDate: true,
        status: true,
        payments: true
      },
      take: 5
    });

    console.log('📋 CAMPOS AUTOMÁTICOS IDENTIFICADOS:\n');
    
    console.log('1️⃣ lastUpdatedBD:');
    console.log('   🔧 AUTOMÁTICO por Prisma: @default(now()) @updatedAt');
    console.log('   📅 Se actualiza automáticamente en cada modificación');
    console.log('   ✅ NO requiere programación manual\n');

    console.log('2️⃣ numNights:');
    console.log('   🔧 CALCULADO por nuestros scripts');
    console.log('   📊 Calculamos: arrival - departure en días');
    console.log('   ⚠️ Requiere ser calculado y guardado manualmente\n');

    console.log('3️⃣ id (primary key):');
    console.log('   🔧 AUTOMÁTICO por Prisma: @default(autoincrement())');
    console.log('   🔢 Se incrementa automáticamente');
    console.log('   ✅ NO requiere programación\n');

    console.log('📊 MUESTRA DE DATOS:');
    muestra.forEach((booking, idx) => {
      console.log(`${idx + 1}. Reserva ${booking.bookingId}:`);
      console.log(`   📅 Llegada: ${booking.arrivalDate}`);
      console.log(`   📅 Salida: ${booking.departureDate}`);
      console.log(`   🌙 Noches: ${booking.numNights}`);
      console.log(`   📊 Status: ${booking.status}`);
      console.log(`   💰 Payments: ${JSON.stringify(booking.payments).substring(0, 50)}...`);
      console.log(`   🕐 Última actualización BD: ${booking.lastUpdatedBD}`);
      console.log('');
    });

    console.log('🎯 PRÓXIMO PASO: Agregar columna BDStatus automática');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

analizarCamposAutomaticos();