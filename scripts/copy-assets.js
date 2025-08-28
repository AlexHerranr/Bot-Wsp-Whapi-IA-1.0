// scripts/copy-assets.js - Copia templates y config a dist/
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  // Crear directorio destino si no existe
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copiado: ${srcPath} → ${destPath}`);
    }
  }
}

function copyAssets() {
  console.log('🔄 Copiando assets HTML y JSON...');
  
  const baseSrc = 'src/plugins/hotel/functions';
  const baseDest = 'dist/plugins/hotel/functions';
  
  // Buscar todas las carpetas de funciones
  const functionDirs = fs.readdirSync(baseSrc, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
    
  for (const funcDir of functionDirs) {
    const srcFuncPath = path.join(baseSrc, funcDir);
    const destFuncPath = path.join(baseDest, funcDir);
    
    // Copiar templates si existe
    const templatesPath = path.join(srcFuncPath, 'templates');
    if (fs.existsSync(templatesPath)) {
      const destTemplatesPath = path.join(destFuncPath, 'templates');
      copyDir(templatesPath, destTemplatesPath);
    }
    
    // Copiar config si existe
    const configPath = path.join(srcFuncPath, 'config');
    if (fs.existsSync(configPath)) {
      const destConfigPath = path.join(destFuncPath, 'config');
      copyDir(configPath, destConfigPath);
    }
  }
  
  console.log('✅ Assets copiados exitosamente');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  try {
    copyAssets();
  } catch (error) {
    console.error('❌ Error copiando assets:', error);
    process.exit(1);
  }
}

module.exports = { copyAssets };