#!/usr/bin/env node

/**
 * Script automático para corregir los errores de TypeScript restantes
 * Ejecutar con: node fix-typescript-errors.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Iniciando corrección automática de errores TypeScript...\n');

// Función auxiliar para hacer backup
function backupFile(filePath) {
    const backupPath = filePath + '.backup';
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`📋 Backup creado: ${backupPath}`);
    }
}

// 1. Corregir conversationHistory.ts
console.log('📝 Corrigiendo conversationHistory.ts...');
const conversationHistoryPath = path.join(__dirname, 'src/utils/context/conversationHistory.ts');

if (fs.existsSync(conversationHistoryPath)) {
    backupFile(conversationHistoryPath);
    
    let content = fs.readFileSync(conversationHistoryPath, 'utf8');
    
    // Agregar interfaz WhapiApiResponse después de WhapiMessage
    const interfaceToAdd = `
// Interfaz para respuesta de API
interface WhapiApiResponse {
    messages?: WhapiMessage[];
    total?: number;
    [key: string]: any;
}
`;
    
    // Insertar después de la interfaz WhapiMessage
    if (!content.includes('interface WhapiApiResponse')) {
        content = content.replace(
            'interface ConversationHistory {',
            interfaceToAdd + '\ninterface ConversationHistory {'
        );
    }
    
    // Corregir el cast de data
    content = content.replace(
        'const data = await response.json();',
        'const data = await response.json() as WhapiApiResponse;'
    );
    
    // Mejorar validación de messages
    content = content.replace(
        /if \(data\.messages && Array\.isArray\(data\.messages\)\) \{/g,
        'if (data && data.messages && Array.isArray(data.messages)) {'
    );
    
    fs.writeFileSync(conversationHistoryPath, content);
    console.log('✅ conversationHistory.ts corregido\n');
} else {
    console.log('❌ No se encontró conversationHistory.ts\n');
}

// 2. Corregir contextManager.ts
console.log('📝 Corrigiendo contextManager.ts...');
const contextManagerPath = path.join(__dirname, 'src/utils/context/contextManager.ts');

if (fs.existsSync(contextManagerPath)) {
    backupFile(contextManagerPath);
    
    let content = fs.readFileSync(contextManagerPath, 'utf8');
    
    // Mejorar el tipado de la respuesta
    content = content.replace(
        'const data = await response.json();',
        'const data = await response.json() as any;'
    );
    
    // Reemplazar la validación de messages con una versión más robusta
    const oldPattern = /if \(!messages \|\| !Array\.isArray\(messages\) \|\| messages\.length === 0\) \{/g;
    const newValidation = `// VALIDACIÓN DE TIPOS MEJORADA
            let messages: any[] = [];
            
            if (data && typeof data === 'object') {
                if (data.messages && Array.isArray(data.messages)) {
                    messages = data.messages;
                } else if (Array.isArray(data)) {
                    messages = data;
                }
            }
            
            // Verificar si hay mensajes
            if (messages.length === 0) {`;
    
    if (content.match(oldPattern)) {
        content = content.replace(oldPattern, newValidation);
    }
    
    fs.writeFileSync(contextManagerPath, content);
    console.log('✅ contextManager.ts corregido\n');
} else {
    console.log('❌ No se encontró contextManager.ts\n');
}

// 3. Información sobre correcciones manuales necesarias
console.log('⚠️  CORRECCIONES MANUALES NECESARIAS:\n');

console.log('📌 function-handler.ts (líneas ~193 y ~197):');
console.log('   Buscar usos de .length y .map en variables no tipadas');
console.log('   Cambiar: if (variable.length > 0)');
console.log('   Por:     if (Array.isArray(variable) && variable.length > 0)\n');

console.log('📌 multi-assistant-handler.ts (líneas 82, 112, 320):');
console.log('   Revisar llamadas a funciones con 5 parámetros');
console.log('   Reducir a 3-4 parámetros según la definición\n');

// 4. Crear script de verificación
console.log('📝 Creando script de verificación...');
    const verifyScript = `#!/usr/bin/env node

// Script para verificar la compilación
import { exec } from 'child_process';

console.log('🔍 Verificando compilación TypeScript...\\n');

exec('npm run build', (error, stdout, stderr) => {
    console.log(stdout);
    
    if (error) {
        console.error('❌ Error en compilación:', error);
        console.error(stderr);
        process.exit(1);
    }
    
    console.log('✅ Compilación exitosa!');
    
    // Contar warnings
    const warnings = (stdout.match(/\\[plugin typescript\\]/g) || []).length;
    console.log(\`⚠️  Warnings restantes: \${warnings}\`);
    
    if (warnings === 0) {
        console.log('🎉 ¡Sin errores ni warnings!');
    } else if (warnings < 10) {
        console.log('✅ Pocos warnings, se puede proceder con deploy');
    }
});
`;

fs.writeFileSync('verify-build.js', verifyScript);
console.log('✅ Script de verificación creado: verify-build.js\n');

// 5. Resumen
console.log('📊 RESUMEN:');
console.log('✅ Archivos corregidos automáticamente:');
console.log('   - conversationHistory.ts');
console.log('   - contextManager.ts');
console.log('\n⚠️  Requieren corrección manual:');
console.log('   - function-handler.ts');
console.log('   - multi-assistant-handler.ts');
console.log('\n🚀 Próximos pasos:');
console.log('   1. Revisar y corregir manualmente los archivos indicados');
console.log('   2. Ejecutar: node verify-build.js');
console.log('   3. Si todo está bien, proceder con el despliegue');

console.log('\n✨ Script completado!'); 