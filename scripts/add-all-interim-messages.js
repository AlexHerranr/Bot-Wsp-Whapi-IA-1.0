#!/usr/bin/env node

/**
 * Script para agregar mensajes automáticos a todas las funciones
 */

const fs = require('fs');
const path = require('path');

// Definir los mensajes para cada función
const FUNCTION_MESSAGES = {
    'check-availability': '🔍 Consultando disponibilidad en nuestro sistema...',
    'check-booking-details': '📋 Buscando los detalles de tu reserva...',
    'edit-booking': '✏️ Voy a proceder a modificar tu reserva...',
    'cancel-booking': '🚫 Procesando la cancelación de tu reserva...',
    'generate-payment-receipt-pdf': '🧾 Generando el recibo de pago...',
    'informar-movimiento-manana': '📊 Consultando los movimientos de mañana...'
};

// Función helper para agregar sendInterimMessage si no existe
const SEND_INTERIM_MESSAGE_CODE = `
async function sendInterimMessage(chatId: string, message: string, userId?: string): Promise<void> {
  try {
    const WHAPI_API_URL = process.env.WHAPI_API_URL;
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    
    if (!WHAPI_API_URL || !WHAPI_TOKEN) {
      return;
    }

    const payload = {
      to: chatId,
      body: message
    };

    const response = await fetchWithRetry(\`\${WHAPI_API_URL}/messages/text\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${WHAPI_TOKEN}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(\`Error \${response.status}: \${errorText}\`);
    }

    logInfo('INTERIM_MESSAGE_SENT', 'Mensaje durante run enviado exitosamente', {
      chatId,
      userId,
      messagePreview: message.substring(0, 50)
    });

  } catch (error) {
    logError('INTERIM_MESSAGE_ERROR', 'Error enviando mensaje durante run', {
      chatId,
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}`;

console.log('📋 FUNCIONES QUE NECESITAN MENSAJES AUTOMÁTICOS:');
console.log('=' .repeat(60));

Object.entries(FUNCTION_MESSAGES).forEach(([funcName, message]) => {
    console.log(`\n✅ ${funcName}:`);
    console.log(`   Mensaje: "${message}"`);
});

console.log('\n' + '=' .repeat(60));
console.log('\n📝 CAMBIOS NECESARIOS EN CADA FUNCIÓN:\n');

console.log('1. Agregar import de fetchWithRetry:');
console.log(`   import { fetchWithRetry } from '../../../../core/utils/retry-utils';`);

console.log('\n2. Agregar función sendInterimMessage (si no existe)');

console.log('\n3. Modificar la función principal para aceptar context:');
console.log(`   export async function nombreFuncion(params: any, context?: any)`);

console.log('\n4. Agregar el envío del mensaje al inicio:');
console.log(`   if (context?.chatId) {
     try {
       await sendInterimMessage(
         context.chatId, 
         "MENSAJE_AQUI",
         context.userId
       );
     } catch (error) {
       // Continuar sin interrumpir
     }
   }`);

console.log('\n5. Actualizar el index.ts para pasar el contexto:');
console.log(`   registry.register('nombre_funcion', async (args, context) => {
     const { nombreFuncion } = require('./functions/...');
     const result = await nombreFuncion(args as any, context);
     return JSON.stringify(result);
   }, source);`);

console.log('\n' + '=' .repeat(60));
console.log('📌 NOTA: Las funciones generate_booking_confirmation_pdf y create_new_booking');
console.log('        ya tienen mensajes automáticos implementados.');