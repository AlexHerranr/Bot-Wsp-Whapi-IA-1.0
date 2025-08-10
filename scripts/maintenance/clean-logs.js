#!/usr/bin/env node

/**
 * Limpiador de logs
 * - Mantiene solo N archivos recientes por carpeta
 * - Borra archivos antiguos de logs locales y Railway
 * Uso: node scripts/maintenance/clean-logs.js [--keep 5]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const keepIndex = args.indexOf('--keep');
const numToKeep = keepIndex !== -1 ? parseInt(args[keepIndex + 1], 10) : 5;

const ROOT = path.join(__dirname, '..', '..');
const LOGS_DIR = path.join(ROOT, 'logs');
const DIRECTORIES_TO_CLEAN = [
  path.join(LOGS_DIR, 'railway'),
  path.join(LOGS_DIR, 'railway-downloads'),
  path.join(LOGS_DIR, 'Local'),
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return false;
  }
  const stat = fs.statSync(directoryPath);
  return stat.isDirectory();
}

function cleanDirectory(directoryPath, keep) {
  if (!ensureDirectoryExists(directoryPath)) {
    return { directoryPath, skipped: true };
  }

  const files = fs
    .readdirSync(directoryPath)
    .map((fileName) => ({
      fileName,
      fullPath: path.join(directoryPath, fileName),
      stat: fs.statSync(path.join(directoryPath, fileName)),
    }))
    .filter((entry) => entry.stat.isFile())
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  const toDelete = files.slice(keep);
  const deleted = [];
  for (const entry of toDelete) {
    try {
      fs.unlinkSync(entry.fullPath);
      deleted.push(entry.fileName);
    } catch (error) {
      // Intenta cambiar permisos o ignorar si no es crítico
    }
  }

  return { directoryPath, kept: files.length - toDelete.length, deleted };
}

function main() {
  console.log(`🧹 Limpiando logs… (mantener ${numToKeep})`);
  const results = DIRECTORIES_TO_CLEAN.map((dir) => cleanDirectory(dir, numToKeep));
  for (const result of results) {
    if (result.skipped) {
      console.log(`↪️  Carpeta no encontrada, salto: ${result.directoryPath}`);
    } else {
      console.log(`📁 ${result.directoryPath}`);
      console.log(`   ✅ Guardados: ${result.kept} | 🗑️ Eliminados: ${result.deleted.length}`);
    }
  }
  console.log('✅ Limpieza completada');
}

main();


