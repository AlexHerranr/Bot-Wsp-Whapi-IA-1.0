#!/usr/bin/env node

// Script para verificar la compilación
import { exec } from 'child_process';

console.log('🔍 Verificando compilación TypeScript...\n');

exec('npm run build', (error, stdout, stderr) => {
    console.log(stdout);
    
    if (error) {
        console.error('❌ Error en compilación:', error);
        console.error(stderr);
        process.exit(1);
    }
    
    console.log('✅ Compilación exitosa!');
    
    // Contar warnings
    const warnings = (stdout.match(/\[plugin typescript\]/g) || []).length;
    console.log(`⚠️  Warnings restantes: ${warnings}`);
    
    if (warnings === 0) {
        console.log('🎉 ¡Sin errores ni warnings!');
    } else if (warnings < 10) {
        console.log('✅ Pocos warnings, se puede proceder con deploy');
    }
});
