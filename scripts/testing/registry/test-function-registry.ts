/**
 * Script de prueba para verificar el registro de funciones
 */

import {
  getRegistryStats,
  generateOpenAISchemas,
  validateRegistry,
  executeFunction
} from '../../src/functions/registry/function-registry';

(async () => {
  console.log('🧪 Verificando el registro de funciones...\n');

  // 1. Validar registro
  console.log('1️⃣ Validando estructura del registro...');
  const validation = validateRegistry();
  if (validation.valid) {
    console.log('✅ Registro válido');
  } else {
    console.log('❌ Errores en el registro:');
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }

  // 2. Obtener estadísticas
  console.log('\n2️⃣ Estadísticas del registro:');
  const stats = getRegistryStats();
  console.log(`   - Total de funciones: ${stats.total}`);
  console.log(`   - Funciones habilitadas: ${stats.enabled}`);
  console.log(`   - Funciones deshabilitadas: ${stats.disabled}`);
  console.log(`   - Categorías: ${Object.keys(stats.categories).join(', ')}`);

  console.log('\n   📋 Funciones registradas:');
  stats.functions.forEach(fn => {
    const status = fn.enabled ? '✅' : '❌';
    console.log(`   ${status} ${fn.name} (${fn.category}) - v${fn.version}`);
  });

  // 3. Generar esquemas OpenAI
  console.log('\n3️⃣ Esquemas para OpenAI:');
  const schemas = generateOpenAISchemas();
  console.log(`   - Esquemas generados: ${schemas.length}`);
  schemas.forEach(schema => {
    console.log(`   📋 ${schema.name}: ${schema.description}`);
    console.log(`      Parámetros requeridos: ${schema.parameters.required.join(', ')}`);
  });

  // 4. Probar ejecución de funciones (simulada)
  console.log('\n4️⃣ Probando ejecución de funciones...');

  // Test check_availability
  try {
    console.log('   🔍 Probando check_availability...');
    const result = await executeFunction('check_availability', {
      startDate: '2025-07-15',
      endDate: '2025-07-18'
    });
    console.log('   ✅ check_availability ejecutada correctamente');
  } catch (error: any) {
    console.log(`   ❌ Error en check_availability: ${error.message}`);
  }

  // Test escalate_to_human
  try {
    console.log('   🔍 Probando escalate_to_human...');
    const result = await executeFunction('escalate_to_human', {
      reason: 'technical_issue',
      context: {
        summary: 'Test de verificación del sistema',
        urgency: 'low'
      }
    });
    console.log('   ✅ escalate_to_human ejecutada correctamente');
  } catch (error: any) {
    console.log(`   ❌ Error en escalate_to_human: ${error.message}`);
  }

  // Test función inexistente
  try {
    console.log('   🔍 Probando función inexistente...');
    await executeFunction('funcion_inexistente', {});
    console.log('   ❌ No debería llegar aquí');
  } catch (error: any) {
    console.log(`   ✅ Error esperado para función inexistente: ${error.message}`);
  }

  console.log('\n🎉 Verificación completada!');
  console.log('\n📊 Resumen:');
  console.log(`   - Registro: ${validation.valid ? 'VÁLIDO' : 'INVÁLIDO'}`);
  console.log(`   - Funciones activas: ${stats.enabled}/${stats.total}`);
  console.log(`   - Esquemas OpenAI: ${schemas.length}`);
  console.log(`   - Sistema: ${validation.valid && stats.enabled > 0 ? 'FUNCIONANDO' : 'NECESITA REVISIÓN'}`);
})(); 