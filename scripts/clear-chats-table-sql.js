/**
 * Script para borrar todos los registros de la tabla Chats
 * 
 * IMPORTANTE: Este script necesita la variable de entorno DATABASE_URL configurada
 * 
 * Uso:
 * DATABASE_URL="postgresql://user:password@host:port/database" node scripts/clear-chats-table-sql.js
 */

const { PrismaClient } = require('@prisma/client');

// Verificar que DATABASE_URL esté configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está configurada');
  console.log('\n📝 Por favor, ejecuta el script con la variable de entorno:');
  console.log('DATABASE_URL="postgresql://user:password@host:port/database" node scripts/clear-chats-table-sql.js');
  process.exit(1);
}

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function clearChatsTable() {
  try {
    console.log('🔗 Conectando a la base de datos...');
    console.log(`📍 URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`); // Ocultar contraseña
    
    // Verificar que la tabla existe con el nuevo nombre
    console.log('\n🔍 Verificando la tabla Chats...');
    
    try {
      // Intentar contar registros usando el modelo WhatsApp (que ahora mapea a Chats)
      const countBefore = await prisma.whatsApp.count();
      console.log(`✅ Tabla encontrada con ${countBefore} registros`);
      
      if (countBefore === 0) {
        console.log('ℹ️  La tabla ya está vacía');
        return;
      }
      
      // Confirmar antes de borrar
      console.log('\n⚠️  ADVERTENCIA: Se borrarán TODOS los registros de la tabla Chats');
      console.log('🗑️  Procediendo con la eliminación...');
      
      // Borrar todos los registros
      const result = await prisma.whatsApp.deleteMany({});
      
      console.log(`\n✅ Se eliminaron ${result.count} registros exitosamente`);
      
      // Verificar que la tabla está vacía
      const countAfter = await prisma.whatsApp.count();
      console.log(`📊 Registros después de la limpieza: ${countAfter}`);
      
    } catch (dbError) {
      // Si hay un error, podría ser que la tabla aún se llama Client_View
      console.error('\n❌ Error al acceder a la tabla:', dbError.message);
      
      if (dbError.code === 'P2021') {
        console.log('\n⚠️  Parece que la tabla aún no existe o tiene otro nombre en la base de datos');
        console.log('📝 Asegúrate de que la tabla se llame "Chats" en la base de datos');
        console.log('   Puedes renombrarla con: ALTER TABLE "Client_View" RENAME TO "Chats";');
      }
      
      throw dbError;
    }
    
  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    if (error.code) {
      console.error('📍 Código de error:', error.code);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

// Ejecutar la función
console.log('🚀 Iniciando script de limpieza de tabla Chats\n');
console.log('=' .repeat(50));

clearChatsTable()
  .then(() => {
    console.log('=' .repeat(50));
    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.log('=' .repeat(50));
    console.error('\n❌ El proceso falló');
    process.exit(1);
  });