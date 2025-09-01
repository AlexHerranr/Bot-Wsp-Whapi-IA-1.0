#!/usr/bin/env node

/**
 * Script para analizar mensajes de error en todas las funciones
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ANÁLISIS DE MENSAJES DE ERROR EN FUNCIONES');
console.log('=' .repeat(70));

const FUNCTIONS = [
    'check-availability',
    'check-booking-details', 
    'create-new-booking',
    'edit-booking',
    'cancel-booking',
    'generate-booking-confirmation-pdf',
    'generate-payment-receipt-pdf'
];

console.log('\n📋 FORMATO CORRECTO DE MENSAJES DE ERROR:');
console.log('----------------------------------------');
console.log('ERROR_[TIPO]: [descripción del problema].');
console.log('INSTRUCCION: Dile al huésped que hubo un problema con [acción],');
console.log('             que vas a notificar a tu superior para buscar una solución.');
console.log('----------------------------------------\n');

console.log('📊 FUNCIONES A REVISAR:\n');

FUNCTIONS.forEach((func, index) => {
    console.log(`${index + 1}. ${func}`);
    const filePath = path.join('/workspace/src/plugins/hotel/functions', func, `${func}.ts`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Buscar patrones de error
        const errorPatterns = [
            /message:\s*[`"']([^`"']*error[^`"']*)[`"']/gi,
            /message:\s*[`"']([^`"']*ERROR[^`"']*)[`"']/gi,
            /message:\s*[`"']([^`"']*❌[^`"']*)[`"']/gi
        ];
        
        let errorCount = 0;
        let needsUpdate = false;
        
        errorPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                errorCount++;
                const message = match[1];
                
                // Verificar si sigue el formato correcto
                if (!message.includes('ERROR_') || !message.includes('INSTRUCCION:')) {
                    needsUpdate = true;
                }
            }
        });
        
        if (errorCount > 0) {
            console.log(`   📝 Mensajes de error encontrados: ${errorCount}`);
            if (needsUpdate) {
                console.log(`   ⚠️ NECESITA ACTUALIZACIÓN - No sigue el formato estándar`);
            } else {
                console.log(`   ✅ Formato correcto`);
            }
        } else {
            console.log(`   ℹ️ No se encontraron mensajes de error explícitos`);
        }
        
    } catch (error) {
        console.log(`   ❌ Error leyendo archivo: ${error.message}`);
    }
    
    console.log('');
});

console.log('=' .repeat(70));
console.log('\n💡 EJEMPLO DE MENSAJE DE ERROR CORRECTO:\n');
console.log(`{
    success: false,
    message: \`ERROR_CONEXION: No se pudo conectar con el sistema de reservas.
    
INSTRUCCION: Dile al huésped que tuviste un problema técnico al consultar 
la disponibilidad, que vas a notificar a tu superior para buscar una 
solución inmediata.\`
}`);

console.log('\n✨ Este formato asegura que OpenAI entienda cómo responder al huésped.');