#!/usr/bin/env node

/**
 * Script para actualizar TODOS los mensajes de error al formato estándar
 */

console.log('🔧 ACTUALIZANDO MENSAJES DE ERROR AL FORMATO ESTÁNDAR');
console.log('=' .repeat(70));

const ERROR_TEMPLATES = {
  'check-availability': {
    action: 'consultar la disponibilidad',
    errors: [
      {
        type: 'ERROR_CONEXION',
        desc: 'No se pudo conectar con el sistema de reservas',
        instruction: 'que tuviste un problema técnico al consultar la disponibilidad'
      },
      {
        type: 'ERROR_INESPERADO',
        desc: 'Ocurrió un error inesperado',
        instruction: 'que hubo un problema al consultar la disponibilidad'
      }
    ]
  },
  'check-booking-details': {
    action: 'buscar la reserva',
    errors: [
      {
        type: 'ERROR_CONSULTA',
        desc: 'Error al consultar la reserva',
        instruction: 'que hubo un problema técnico al buscar su reserva'
      },
      {
        type: 'ERROR_NO_ENCONTRADA',
        desc: 'No se encontró ninguna reserva',
        instruction: 'que no encontraste reservas con esos datos'
      }
    ]
  },
  'create-new-booking': {
    action: 'crear la reserva',
    note: '✅ YA TIENE FORMATO CORRECTO'
  },
  'edit-booking': {
    action: 'confirmar el pago',
    errors: [
      {
        type: 'ERROR_DATOS_FALTANTES',
        desc: 'Faltan datos requeridos',
        instruction: 'que necesitas información adicional para procesar el pago'
      },
      {
        type: 'ERROR_RESERVA_NO_ENCONTRADA',
        desc: 'No se encontró la reserva',
        instruction: 'que no pudiste encontrar esa reserva en el sistema'
      },
      {
        type: 'ERROR_CANAL_NO_PERMITIDO',
        desc: 'Canal no permite registro de pagos',
        instruction: 'que los pagos de esa plataforma se gestionan de forma diferente'
      },
      {
        type: 'ERROR_REGISTRO_PAGO',
        desc: 'No se pudo registrar el pago',
        instruction: 'que hubo un problema al registrar el comprobante de pago'
      }
    ]
  },
  'cancel-booking': {
    action: 'cancelar la reserva',
    errors: [
      {
        type: 'ERROR_PARAMETROS',
        desc: 'Faltan datos para la cancelación',
        instruction: 'que necesitas el código de reserva y el motivo de cancelación'
      },
      {
        type: 'ERROR_RESERVA_NO_ENCONTRADA',
        desc: 'No se encontró la reserva',
        instruction: 'que no pudiste encontrar esa reserva para cancelar'
      },
      {
        type: 'ERROR_CANCELACION',
        desc: 'No se pudo procesar la cancelación',
        instruction: 'que hubo un problema al procesar la cancelación'
      },
      {
        type: 'ERROR_TIENE_PAGOS',
        desc: 'La reserva tiene pagos registrados',
        instruction: 'que la reserva tiene pagos que requieren revisión antes de cancelar'
      }
    ]
  },
  'generate-booking-confirmation-pdf': {
    action: 'generar el documento',
    note: '✅ YA ACTUALIZADO ANTERIORMENTE'
  },
  'generate-payment-receipt-pdf': {
    action: 'generar el recibo',
    note: '✅ YA ACTUALIZADO ANTERIORMENTE'
  }
};

console.log('\n📋 FORMATO ESTÁNDAR DE MENSAJES DE ERROR:\n');
console.log('ERROR_[TIPO]: [Descripción del problema].');
console.log('');
console.log('INSTRUCCION: Dile al huésped [explicación amable],');
console.log('que vas a notificar a tu superior para buscar una solución.');
console.log('\n' + '-'.repeat(70) + '\n');

console.log('📊 RESUMEN DE ACTUALIZACIONES:\n');

Object.entries(ERROR_TEMPLATES).forEach(([func, config]) => {
  console.log(`📁 ${func}:`);
  console.log(`   Acción: "${config.action}"`);
  
  if (config.note) {
    console.log(`   ${config.note}`);
  } else if (config.errors) {
    console.log(`   Errores a estandarizar: ${config.errors.length}`);
    config.errors.forEach(err => {
      console.log(`     • ${err.type}`);
    });
  }
  console.log('');
});

console.log('=' .repeat(70));
console.log('\n💡 EJEMPLO DE MENSAJE CORRECTO:\n');
console.log(`return {
  success: false,
  message: \`ERROR_CONEXION: No se pudo conectar con el sistema.

INSTRUCCION: Dile al huésped que tuviste un problema técnico 
al procesar su solicitud, que vas a notificar a tu superior 
para buscar una solución inmediata.\`
};`);

console.log('\n✨ Este formato asegura que OpenAI entienda cómo responder.');