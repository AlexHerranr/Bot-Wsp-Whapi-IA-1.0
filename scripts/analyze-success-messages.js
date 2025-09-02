#!/usr/bin/env node

/**
 * Script para analizar mensajes de éxito en todas las funciones
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ANÁLISIS DE MENSAJES DE ÉXITO (200 OK) EN FUNCIONES');
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

console.log('\n📋 BUSCANDO MENSAJES DE ÉXITO EN CADA FUNCIÓN:\n');

FUNCTIONS.forEach((func, index) => {
    console.log(`${index + 1}. ${func}`);
    const filePath = path.join('/workspace/src/plugins/hotel/functions', func, `${func}.ts`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Buscar patrones de éxito
        const successPatterns = [
            /success:\s*true[\s\S]*?message:\s*[`"']([^`"']*)[`"']/gi,
            /EXITO[_\w]*:([^`"'\n]*)/gi,
            /INSTRUCCION[ES]*:([^`"'\n]*)/gi,
            /PDF_ENVIADO:([^`"'\n]*)/gi,
            /DATOS_CONFIRMADOS:([^`"'\n]*)/gi
        ];
        
        let successFound = false;
        let hasInstructions = false;
        
        successPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                successFound = true;
                const message = match[0];
                
                // Verificar si tiene instrucciones para OpenAI
                if (message.includes('INSTRUCCION') || 
                    message.includes('EXITO') || 
                    message.includes('PDF_ENVIADO') ||
                    message.includes('SIGUIENTE_PASO')) {
                    hasInstructions = true;
                }
            }
        });
        
        if (successFound) {
            if (hasInstructions) {
                console.log(`   ✅ TIENE instrucciones internas para OpenAI`);
            } else {
                console.log(`   ⚠️ Retorna éxito pero SIN instrucciones claras`);
            }
        } else {
            console.log(`   ❓ No se encontraron mensajes de éxito explícitos`);
        }
        
    } catch (error) {
        console.log(`   ❌ Error leyendo archivo: ${error.message}`);
    }
    
    console.log('');
});

console.log('=' .repeat(70));
console.log('\n💡 FORMATO IDEAL PARA MENSAJES DE ÉXITO:\n');
console.log('Para acciones completadas:');
console.log(`{
    success: true,
    message: \`EXITO_[ACCION]: [Descripción de lo que se logró].
    
DATOS_CONFIRMADOS: [Detalles importantes].

INSTRUCCION: [Qué decirle al huésped o siguiente paso].\`
}`);

console.log('\n✨ Esto asegura que OpenAI sepa cómo proceder después del éxito.');