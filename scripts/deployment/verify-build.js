#!/usr/bin/env node

/**
 * Script de verificación de build antes del deploy
 * Detecta errores de TypeScript sin necesidad de hacer deploy completo
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Iniciando verificación de build...\n');

try {
  // 1. Verificar que TypeScript esté instalado
  console.log('📦 Verificando TypeScript...');
  execSync('npx tsc --version', { stdio: 'inherit' });
  
  // 2. Verificar sintaxis de TypeScript sin generar archivos
  console.log('\n🔧 Verificando sintaxis de TypeScript...');
  execSync('npx tsc --noEmit --skipLibCheck', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  // 3. Verificar imports y dependencias
  console.log('\n📋 Verificando imports y dependencias...');
  execSync('npx tsc --noEmit --skipLibCheck --isolatedModules', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  // 4. Verificar archivos críticos específicos
  console.log('\n🎯 Verificando archivos críticos...');
  const criticalFiles = [
    'src/app-unified.ts',
    'src/handlers/integrations/beds24-availability.ts',
    'src/functions/registry/function-registry.ts',
    'src/utils/logger.ts'
  ];
  
  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} - OK`);
    } else {
      console.log(`❌ ${file} - NO ENCONTRADO`);
      process.exit(1);
    }
  }
  
  // 5. Verificar configuración de TypeScript
  console.log('\n⚙️ Verificando configuración de TypeScript...');
  if (fs.existsSync('tsconfig.json')) {
    const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
    console.log('✅ tsconfig.json - OK');
  } else {
    console.log('❌ tsconfig.json - NO ENCONTRADO');
    process.exit(1);
  }
  
  console.log('\n🎉 ¡Verificación completada exitosamente!');
  console.log('✅ El código está listo para deploy');
  
} catch (error) {
  console.error('\n❌ ERROR EN LA VERIFICACIÓN:');
  console.error(error.message);
  console.error('\n💡 SUGERENCIAS:');
  console.error('1. Ejecuta: npm run build:check');
  console.error('2. Revisa los errores de TypeScript');
  console.error('3. Corrige los problemas antes del deploy');
  process.exit(1);
} 