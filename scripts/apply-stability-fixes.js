#!/usr/bin/env node

/**
 * Script para aplicar correcciones de estabilidad al bot
 * Basado en el análisis de logs del 2025-07-05
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Aplicando correcciones de estabilidad...\n');

// Ruta del archivo principal
const appPath = path.join(__dirname, '..', 'src', 'app.ts');

if (!fs.existsSync(appPath)) {
    console.error('❌ No se encontró src/app.ts');
    process.exit(1);
}

// Leer el archivo
let content = fs.readFileSync(appPath, 'utf8');
const originalContent = content;

// Fix 1: Corregir serialización de etiquetas
console.log('1️⃣ Corrigiendo serialización de etiquetas...');
const labelsBugPattern = /if \(labels && labels\.length > 0\) \{\s*context \+= `ETIQUETAS: \$\{labels\.join\(', '\)\}\\n`;/;
const labelsFixed = `if (labels && Array.isArray(labels) && labels.length > 0) {
        // Corregido: manejar objetos de etiquetas
        const labelNames = labels
            .map(label => {
                if (typeof label === 'object' && label.name) {
                    return label.name;
                }
                return String(label);
            })
            .filter(name => name && name.trim())
            .join(', ');
        
        if (labelNames) {
            context += \`ETIQUETAS: \${labelNames}\\n\`;
        }`;

if (content.includes("labels.join(', ')")) {
    content = content.replace(labelsBugPattern, labelsFixed);
    console.log('   ✅ Serialización de etiquetas corregida');
} else {
    console.log('   ⚠️  Patrón de etiquetas no encontrado o ya corregido');
}

// Fix 2: Simplificar cancelación de runs
console.log('\n2️⃣ Simplificando cancelación de runs activos...');
const runsCancelPattern = /let retryCount = 0;\s*const maxRetries = 3;/;

if (content.includes('maxRetries = 3')) {
    // Marcar el área para revisión manual (es muy compleja para automatizar)
    console.log('   ⚠️  La lógica de cancelación de runs es compleja.');
    console.log('   📝 Por favor, revisa manualmente las líneas 495-621 en app.ts');
    console.log('   💡 Recomendación: Reducir reintentos y eliminar verificaciones múltiples');
} else {
    console.log('   ℹ️  Lógica de runs ya podría estar optimizada');
}

// Fix 3: Prevenir webhooks duplicados
console.log('\n3️⃣ Agregando prevención de webhooks duplicados...');
const webhookStartPattern = /for \(const message of messages\) \{/;
const duplicateCheckCode = `// Prevenir procesamiento de mensajes duplicados
        const messageIds = new Set<string>();
        
        for (const message of messages) {
            // Evitar procesar el mismo mensaje dos veces
            if (message.id && messageIds.has(message.id)) {
                logDebug('WEBHOOK_DUPLICATE', 'Mensaje duplicado ignorado', { messageId: message.id });
                continue;
            }
            if (message.id) {
                messageIds.add(message.id);
            }`;

if (!content.includes('messageIds.has(message.id)')) {
    content = content.replace(
        webhookStartPattern,
        duplicateCheckCode
    );
    console.log('   ✅ Prevención de duplicados agregada');
} else {
    console.log('   ⚠️  Prevención de duplicados ya existe');
}

// Guardar cambios si hubo modificaciones
if (content !== originalContent) {
    // Backup
    const backupPath = appPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, originalContent);
    console.log(`\n📦 Backup creado en: ${path.basename(backupPath)}`);
    
    // Guardar cambios
    fs.writeFileSync(appPath, content);
    console.log('✅ Cambios aplicados exitosamente');
    
    console.log('\n📋 Próximos pasos:');
    console.log('1. Revisa manualmente la lógica de cancelación de runs (líneas 495-621)');
    console.log('2. Ejecuta: npm run build (si usas TypeScript)');
    console.log('3. Reinicia el bot');
    console.log('4. Monitorea los logs por 24-48 horas');
} else {
    console.log('\n⚠️  No se realizaron cambios (posiblemente ya aplicados)');
}

console.log('\n💡 Tip: Si persisten problemas de rate limit después de 48h, considera:');
console.log('   - npm install bottleneck');
console.log('   - Implementar el rate limiter según el plan en docs/development/'); 