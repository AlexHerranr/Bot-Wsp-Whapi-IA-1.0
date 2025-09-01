#!/usr/bin/env node

/**
 * Script para mostrar las instrucciones EXACTAS que retorna cada función en caso de éxito
 */

console.log('📋 INSTRUCCIONES EXACTAS QUE RETORNA CADA FUNCIÓN AL SER EXITOSA');
console.log('=' .repeat(70));

const SUCCESS_MESSAGES = {
    'check_availability': {
        caso: 'Cuando HAY disponibilidad',
        retorna: `EXITO_DISPONIBILIDAD: Se encontraron [N] opciones disponibles.

[Lista de apartamentos con precios]

INSTRUCCION: Presenta las opciones al huésped de forma clara y amable. 
Si muestra interés en alguna, procede a recopilar sus datos para crear la reserva.
Si los precios no están disponibles, menciona que puedes consultarlos.`
    },
    
    'check_booking_details': {
        caso: 'Cuando encuentra la reserva',
        retorna: `EXITO_CONSULTA: Reserva(s) encontrada(s) correctamente.

INSTRUCCION: Presenta los detalles de la reserva al huésped de forma clara. 
Si necesita hacer cambios, ofrece ayuda. Si todo está bien, confirma que está todo listo para su llegada.`
    },
    
    'create_new_booking': {
        caso: 'Cuando crea la reserva exitosamente',
        retorna: `EXITO_RESERVA: La reserva [ID] se creó correctamente en Beds24.

SIGUIENTE_PASO: Procede a ejecutar generate_booking_confirmation_pdf con el bookingId [ID] para enviar los detalles al huésped.

Luego sigue las instrucciones que recibirás de esa función.`
    },
    
    'edit_booking': {
        caso: 'Cuando registra el pago',
        retorna: `EXITO_PAGO_REGISTRADO: Comprobante registrado correctamente en la reserva [ID].

DATOS_CONFIRMADOS:
• Código reserva: [ID]
• Status: [status]
• Monto registrado: $[monto] COP
• Comprobante: [descripción]
• Número de pago: #[número]
• Fecha: [fecha]

SIGUIENTE_PASO: [generate_payment_receipt_pdf o generate_booking_confirmation_pdf según el caso]

INSTRUCCION: Confirma al huésped que su pago fue registrado exitosamente. 
Menciona que recibirá un documento actualizado por email. 
[Es un pago adicional / Es el primer pago de la reserva]`
    },
    
    'cancel_booking': {
        caso: 'Cuando cancela la reserva',
        retorna: `EXITO_CANCELACION: Reserva [ID] cancelada correctamente.

DATOS_CONFIRMADOS:
• Código reserva: [ID]
• Status anterior: [status]
• Nuevo status: CANCELADA
• Motivo: [motivo]
• Fecha cancelación: [fecha]
• Espacio liberado: Sí

[PROMOCION_DISPONIBLE: si aplica por el motivo]

INSTRUCCION: Confirma al huésped que la reserva fue cancelada exitosamente. 
El espacio ya está liberado. [Menciona promoción si aplica]`
    },
    
    'generate_booking_confirmation_pdf': {
        caso: 'Cuando genera y envía el PDF',
        retorna: `PDF_ENVIADO: Documento enviado exitosamente.

RESUMEN:
Reserva: [ID]
Cliente: [Nombre]
Fechas: [entrada] al [salida] ([N] noches)
Apartamento: [nombre]
Huéspedes: [adultos] adultos [+ niños si hay]
Total: $[total] COP
Pagado: $[pagado] COP
Saldo: $[saldo] COP

INSTRUCCION: Dile al cliente algo así:
"¡Hola! 👋 Te envié el PDF con los detalles. Revísalo cuando puedas para verificar que todo esté en orden. ¿Sabes aproximadamente tu hora de llegada? Si necesitas recomendaciones de actividades, tours? Estoy aquí para ayudarte."`
    },
    
    'generate_payment_receipt_pdf': {
        caso: 'Cuando genera el recibo de pago',
        retorna: `EXITO_RECIBO: Recibo de pago generado y enviado exitosamente.

DATOS_CONFIRMADOS:
• Reserva: [ID]
• Documento: Recibo de Pago
• Último pago: $[monto] COP
• Total pagado: $[total] COP
• Saldo pendiente: $[saldo] COP

INSTRUCCION: Confirma al huésped que le enviaste el recibo de pago. 
Si hay saldo pendiente, recuérdale amablemente el monto. 
Si está todo pagado, felicítalo y confirma que su reserva está completa.`
    }
};

console.log('\n');

Object.entries(SUCCESS_MESSAGES).forEach(([func, info], index) => {
    console.log(`${index + 1}. 📁 ${func}`);
    console.log(`   Caso: ${info.caso}`);
    console.log('   ' + '-'.repeat(60));
    console.log('   RETORNA:');
    info.retorna.split('\n').forEach(line => {
        console.log(`   ${line}`);
    });
    console.log('   ' + '-'.repeat(60));
    console.log('');
});

console.log('=' .repeat(70));
console.log('\n🎯 PUNTOS CLAVE:');
console.log('  • Cada función da instrucciones ESPECÍFICAS a OpenAI');
console.log('  • Algunas funciones indican SIGUIENTE_PASO (llamar otra función)');
console.log('  • Todas incluyen INSTRUCCION sobre qué decirle al huésped');
console.log('  • Los datos confirmados permiten a OpenAI dar detalles precisos');
console.log('  • El formato es consistente para facilitar el procesamiento');

console.log('\n✨ OpenAI recibe toda la información necesaria para continuar la conversación!');