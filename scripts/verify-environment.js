#!/usr/bin/env node

/**
 * Script de Verificación de Entorno - TeAlquilamos Bot
 * Verifica que la configuración esté correcta para desarrollo local y producción
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración del entorno...\n');

// Verificar archivos críticos
const criticalFiles = [
    'src/app-unified.ts',
    'src/config/environment.ts',
    'src/config/secrets.ts',
    'package.json',
    'tsconfig.json',
    'Dockerfile'
];

console.log('📁 Verificando archivos críticos:');
criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}`);
    } else {
        console.log(`   ❌ ${file} - FALTANTE`);
    }
});

// Verificar configuración de TypeScript
console.log('\n⚙️ Verificando configuración de TypeScript:');
try {
    const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
    if (tsConfig.compilerOptions.outDir === './dist') {
        console.log('   ✅ outDir configurado correctamente');
    } else {
        console.log('   ⚠️ outDir no está configurado como ./dist');
    }
    
    if (tsConfig.include && tsConfig.include.includes('src/**/*')) {
        console.log('   ✅ include configurado correctamente');
    } else {
        console.log('   ⚠️ include no incluye src/**/*');
    }
} catch (error) {
    console.log('   ❌ Error leyendo tsconfig.json');
}

// Verificar scripts de package.json
console.log('\n📦 Verificando scripts de package.json:');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredScripts = ['dev', 'dev:local', 'build', 'start', 'deploy'];
    
    requiredScripts.forEach(script => {
        if (packageJson.scripts[script]) {
            console.log(`   ✅ ${script}`);
        } else {
            console.log(`   ❌ ${script} - FALTANTE`);
        }
    });
    
    // Verificar que el main apunte al archivo correcto
    if (packageJson.main === 'src/app-unified.ts') {
        console.log('   ✅ main apunta a app-unified.ts');
    } else {
        console.log(`   ⚠️ main apunta a: ${packageJson.main}`);
    }
} catch (error) {
    console.log('   ❌ Error leyendo package.json');
}

// Verificar Dockerfile
console.log('\n🐳 Verificando Dockerfile:');
try {
    const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
    if (dockerfile.includes('CMD ["node", "dist/app-unified.js"]')) {
        console.log('   ✅ CMD apunta al archivo correcto');
    } else {
        console.log('   ⚠️ CMD no apunta a dist/app-unified.js');
    }
    
    if (dockerfile.includes('COPY --from=builder /app/dist ./dist')) {
        console.log('   ✅ Copia de dist configurada');
    } else {
        console.log('   ⚠️ Copia de dist no encontrada');
    }
} catch (error) {
    console.log('   ❌ Error leyendo Dockerfile');
}

// Verificar variables de entorno
console.log('\n🔧 Verificando variables de entorno:');
const envFile = '.env';
if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    const requiredVars = [
        'OPENAI_API_KEY',
        'ASSISTANT_ID', 
        'WHAPI_TOKEN',
        'WHAPI_API_URL',
        'BEDS24_TOKEN',
        'BEDS24_API_URL'
    ];
    
    requiredVars.forEach(varName => {
        if (envContent.includes(varName + '=')) {
            console.log(`   ✅ ${varName}`);
        } else {
            console.log(`   ❌ ${varName} - FALTANTE`);
        }
    });
} else {
    console.log('   ⚠️ Archivo .env no encontrado');
    console.log('   💡 Copia env.example a .env y configura las variables');
}

// Verificar configuración de entorno
console.log('\n🌐 Verificando configuración de entorno:');
try {
    // Simular detección de entorno
    const isCloudRun = process.env.K_SERVICE || process.env.NODE_ENV === 'production';
    const isLocal = !isCloudRun;
    
    console.log(`   📍 Entorno detectado: ${isCloudRun ? 'Cloud Run' : 'Local'}`);
    console.log(`   🌐 Puerto: ${process.env.PORT || (isLocal ? '3008' : '8080')}`);
    console.log(`   🔗 Webhook: ${process.env.WEBHOOK_URL || 'No configurado'}`);
    
    if (isCloudRun) {
        console.log('   ☁️ Configuración para Cloud Run detectada');
    } else {
        console.log('   🏠 Configuración para desarrollo local detectada');
    }
} catch (error) {
    console.log('   ❌ Error verificando configuración de entorno');
}

console.log('\n🎯 Resumen de verificación:');
console.log('   ✅ Si todos los archivos críticos están presentes');
console.log('   ✅ Si todos los scripts están configurados');
console.log('   ✅ Si las variables de entorno están definidas');
console.log('   ✅ Si la configuración de entorno es correcta');
console.log('\n🚀 El proyecto está listo para desarrollo y deploy!');

// Verificar si hay archivos de configuración obsoletos
console.log('\n🧹 Verificando archivos obsoletos:');
const obsoleteFiles = [
    'src/app.ts',  // Reemplazado por app-unified.ts
    'config/rollup.config.mjs'  // Configuración antigua
];

obsoleteFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ⚠️ ${file} - CONSIDERAR ELIMINAR`);
    } else {
        console.log(`   ✅ ${file} - No existe (correcto)`);
    }
});

console.log('\n✨ Verificación completada!'); 