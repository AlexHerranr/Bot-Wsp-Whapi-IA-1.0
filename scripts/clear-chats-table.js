const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearChatsTable() {
  try {
    console.log('🗑️  Iniciando limpieza de la tabla Chats...');
    
    // Contar registros antes de borrar
    const countBefore = await prisma.whatsApp.count();
    console.log(`📊 Registros encontrados: ${countBefore}`);
    
    if (countBefore === 0) {
      console.log('✅ La tabla ya está vacía');
      return;
    }
    
    // Borrar todos los registros
    const result = await prisma.whatsApp.deleteMany({});
    
    console.log(`✅ Se eliminaron ${result.count} registros de la tabla Chats`);
    
    // Verificar que la tabla está vacía
    const countAfter = await prisma.whatsApp.count();
    console.log(`📊 Registros después de la limpieza: ${countAfter}`);
    
  } catch (error) {
    console.error('❌ Error al limpiar la tabla Chats:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función
clearChatsTable()
  .then(() => {
    console.log('✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  });