#!/usr/bin/env node

/**
 * Script para verificar TODOS los mensajes de generate_booking_confirmation_pdf
 * Tanto éxito como errores
 */

console.log('📊 RESUMEN DE MENSAJES EN generate_booking_confirmation_pdf');
console.log('=' .repeat(80));

console.log('\n✅ MENSAJE DE ÉXITO (detallado y claro):');
console.log('-'.repeat(40));
console.log(`PDF_ENVIADO: Documento enviado exitosamente.

RESUMEN:
Reserva: 75078508
Cliente: TestFlow Simplificado
Fechas: 2025-11-10 al 2025-11-13 (3 noches)
Apartamento: Apartamento 0715
Huéspedes: 2 adultos + 1 niños
Total: $670,000 COP
Pagado: $250,000 COP
Saldo: $420,000 COP

INSTRUCCION: Dile al cliente algo así:
"¡Hola! 👋 Te envié el PDF con los detalles. Revísalo cuando puedas para verificar que todo esté en orden. ¿Sabes aproximadamente tu hora de llegada? Si necesitas recomendaciones de actividades, tours? Estoy aquí para ayudarte."`);

console.log('\n❌ MENSAJES DE ERROR (cortos con instrucciones claras):');
console.log('-'.repeat(40));

const errores = [
  {
    tipo: 'ERROR_RESERVA',
    mensaje: 'No se encontró 12345. Dile al cliente que verificarás con tu superior.',
    descripcion: 'Cuando no encuentra la reserva'
  },
  {
    tipo: 'ERROR_SISTEMA',
    mensaje: 'Reserva 12345 no encontrada. Indica problema técnico, consultarás con superior.',
    descripcion: 'Error de API Beds24'
  },
  {
    tipo: 'ERROR_STATUS',
    mensaje: 'Reserva 12345 con estado cancelled. Indica que revisarás con superior.',
    descripcion: 'Estado inválido de reserva'
  },
  {
    tipo: 'ERROR_ACCESO',
    mensaje: 'Problema técnico con datos. Dile que consultarás con superior.',
    descripcion: 'Error accediendo datos'
  },
  {
    tipo: 'ERROR_DETALLES',
    mensaje: 'Sin detalles de 12345. Indica problema técnico, gestionarás con superior.',
    descripcion: 'No se pueden obtener detalles'
  },
  {
    tipo: 'ERROR_INCOMPLETO',
    mensaje: 'Datos incompletos de 12345. Consultarás con superior.',
    descripcion: 'Datos API incompletos'
  },
  {
    tipo: 'ERROR_CANAL',
    mensaje: 'Airbnb no permite PDF. Buscarás alternativa con superior.',
    descripcion: 'Canal no permitido'
  },
  {
    tipo: 'ERROR_PDF',
    mensaje: 'Problema generando documento. Dile que consultarás con superior, reserva está confirmada.',
    descripcion: 'Error general generando PDF'
  }
];

errores.forEach(error => {
  console.log(`\n${error.tipo}:`);
  console.log(`  Caso: ${error.descripcion}`);
  console.log(`  Mensaje: "${error.mensaje}"`);
});

console.log('\n' + '=' .repeat(80));
console.log('📌 CARACTERÍSTICAS DE LOS MENSAJES:');
console.log('  ✅ CORTOS: Menos tokens, más eficiente');
console.log('  ✅ CLAROS: Instrucciones directas para el asistente');
console.log('  ✅ CONSISTENTES: Todos mencionan consultar con superior en errores');
console.log('  ✅ SIMPLES: Fácil de procesar por OpenAI');

console.log('\n💡 PATRÓN DE ERRORES:');
console.log('  ERROR_[TIPO]: [Descripción breve]. [Instrucción al asistente].');

console.log('\n✅ Todos los mensajes están optimizados para ahorrar tokens!');