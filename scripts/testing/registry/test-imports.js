/**
 * Script simple para verificar importaciones
 */

console.log('🔍 Verificando importaciones...');

try {
  // 1. Importar tipos
  console.log('1️⃣ Importando tipos...');
  const types = await import('../../src/functions/types/function-types.js');
  console.log('✅ Tipos importados correctamente');

  // 2. Importar registro
  console.log('2️⃣ Importando registro...');
  const registry = await import('../../src/functions/registry/function-registry.js');
  console.log('✅ Registro importado correctamente');

  // 3. Importar funciones específicas
  console.log('3️⃣ Importando funciones específicas...');
  const availability = await import('../../src/functions/availability/beds24-availability.js');
  console.log('✅ Función de disponibilidad importada');

  const escalation = await import('../../src/functions/escalation/escalate-to-human.js');
  console.log('✅ Función de escalamiento importada');

  // 4. Importar índice principal
  console.log('4️⃣ Importando índice principal...');
  const index = await import('../../src/functions/index.js');
  console.log('✅ Índice principal importado');

  // 5. Verificar que las funciones estén disponibles
  console.log('5️⃣ Verificando funciones disponibles...');
  const stats = registry.getRegistryStats();
  console.log(`✅ ${stats.total} funciones registradas, ${stats.enabled} habilitadas`);

  console.log('\n🎉 Todas las importaciones funcionan correctamente!');
  
} catch (error) {
  console.error('❌ Error en importaciones:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
} 