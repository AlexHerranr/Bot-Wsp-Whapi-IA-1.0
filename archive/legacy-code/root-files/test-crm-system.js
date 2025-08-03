// Test completo del sistema CRM-IA
const { PrismaClient } = require('@prisma/client');

async function testCRMSystem() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧪 Testing CRM System...\n');
    
    // 1. Test clientes con lastActivity > 1 hora
    console.log('1️⃣ Testing Analysis Job (1+ hora después de lastActivity)');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const clientsForAnalysis = await prisma.$queryRaw`
      SELECT "phoneNumber", "chatId", "userName", "lastActivity", "profileStatus"
      FROM "ClientView" 
      WHERE "lastActivity" < ${oneHourAgo}
      AND ("profileStatus" IS NULL OR "profileStatus" = '')
      ORDER BY "lastActivity" ASC
      LIMIT 5
    `;
    
    console.log(`📊 Clientes que necesitan análisis CRM: ${clientsForAnalysis.length}`);
    clientsForAnalysis.forEach(client => {
      console.log(`  - ${client.phoneNumber}: lastActivity ${client.lastActivity.toISOString()}`);
      console.log(`    profileStatus: ${client.profileStatus || 'NULL'}`);
    });
    
    // 2. Test clientes con acciones programadas para hoy
    console.log('\n2️⃣ Testing Daily Actions Job (fechaProximaAccion = hoy)');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const clientsWithActionToday = await prisma.clientView.findMany({
      where: {
        fechaProximaAccion: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    console.log(`📅 Clientes con acciones programadas para hoy: ${clientsWithActionToday.length}`);
    clientsWithActionToday.forEach(client => {
      console.log(`  - ${client.phoneNumber}: ${client.proximaAccion}`);
      console.log(`    Fecha: ${client.fechaProximaAccion?.toISOString()}`);
    });
    
    // 3. Test variables de entorno
    console.log('\n3️⃣ Testing Environment Variables');
    console.log(`CRM_ANALYSIS_ENABLED: ${process.env.CRM_ANALYSIS_ENABLED}`);
    console.log(`CRM_MODE: ${process.env.CRM_MODE}`);
    console.log(`CRM_ASSISTANT_ID: ${process.env.CRM_ASSISTANT_ID ? 'Configurado' : 'NO CONFIGURADO'}`);
    console.log(`ASSISTANT_ID: ${process.env.ASSISTANT_ID ? 'Configurado' : 'NO CONFIGURADO'}`);
    
    // 4. Test ejemplo de cliente completo
    console.log('\n4️⃣ Testing Cliente Completo Example');
    const completeClient = await prisma.clientView.findFirst({
      where: {
        AND: [
          { profileStatus: { not: null } },
          { profileStatus: { not: '' } }
        ]
      }
    });
    
    if (completeClient) {
      console.log(`📋 Cliente ejemplo con CRM completo:`);
      console.log(`  - Phone: ${completeClient.phoneNumber}`);
      console.log(`  - Status: ${completeClient.profileStatus?.substring(0, 100)}...`);
      console.log(`  - Próxima acción: ${completeClient.proximaAccion || 'N/A'}`);
      console.log(`  - Fecha próxima: ${completeClient.fechaProximaAccion?.toISOString() || 'N/A'}`);
      console.log(`  - Prioridad: ${completeClient.prioridad || 'N/A'}`);
    } else {
      console.log('❌ No hay clientes con CRM completo aún');
    }
    
    console.log('\n✅ Test CRM System completado');
    
  } catch (error) {
    console.error('❌ Error en test CRM:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCRMSystem();