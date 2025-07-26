#!/usr/bin/env node

/**
 * Checklist pre-deploy automático para TeAlquilamos Bot
 * Revisa variables, archivos, build y arranque en modo producción local
 */

const fs = require('fs');
const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');

const CRITICAL_ENV = [
  'OPENAI_API_KEY',
  'ASSISTANT_ID',
  'WHAPI_TOKEN',
  'WHAPI_API_URL',
  'BEDS24_TOKEN',
  'BEDS24_API_URL',
];

const CONFIG_FILES = [
  'src/config/environment.ts',
  'src/config/secrets.ts',
  'Dockerfile',
  'cloudbuild.yaml',
  'package.json',
  'tsconfig.json',
];

function log(status, msg) {
  const icons = { OK: '✅', WARNING: '⚠️', ERROR: '❌' };
  console.log(`${icons[status] || ''} [${status}] ${msg}`);
}

function checkEnvVars() {
  let ok = true;
  log('OK', 'Verificando variables de entorno críticas...');
  CRITICAL_ENV.forEach((key) => {
    if (!process.env[key] || process.env[key].trim() === '') {
      log('ERROR', `Variable de entorno faltante o vacía: ${key}`);
      ok = false;
    } else {
      log('OK', `Variable definida: ${key}`);
    }
  });
  return ok;
}

function checkConfigFiles() {
  let ok = true;
  log('OK', 'Verificando archivos de configuración clave...');
  CONFIG_FILES.forEach((file) => {
    if (!fs.existsSync(file)) {
      log('ERROR', `Archivo faltante: ${file}`);
      ok = false;
    } else {
      log('OK', `Archivo presente: ${file}`);
    }
  });
  return ok;
}

function checkPackageScripts() {
  let ok = true;
  log('OK', 'Verificando scripts de build/start en package.json...');
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = pkg.scripts || {};
    const required = ['build', 'start', 'dev', 'dev:cloud', 'deploy'];
    required.forEach((s) => {
      if (!scripts[s]) {
        log('ERROR', `Script faltante: ${s}`);
        ok = false;
      } else {
        log('OK', `Script presente: ${s}`);
      }
    });
    if (pkg.main !== 'src/app-unified.ts') {
      log('WARNING', `El campo 'main' debería ser src/app-unified.ts (actual: ${pkg.main})`);
    }
  } catch (e) {
    log('ERROR', 'No se pudo leer package.json');
    ok = false;
  }
  return ok;
}

function checkDockerfile() {
  log('OK', 'Verificando Dockerfile...');
  try {
    const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
    if (!dockerfile.includes('CMD ["node", "--max-old-space-size=768", "dist/app-unified.js"]')) {
      log('WARNING', 'CMD en Dockerfile no apunta a dist/app-unified.js');
    } else {
      log('OK', 'CMD correcto en Dockerfile');
    }
    if (!dockerfile.includes('EXPOSE 8080')) {
      log('WARNING', 'Dockerfile no expone el puerto 8080');
    } else {
      log('OK', 'EXPOSE 8080 presente');
    }
  } catch (e) {
    log('ERROR', 'No se pudo leer Dockerfile');
    return false;
  }
  return true;
}

function checkBuild() {
  log('OK', 'Probando build local (npm run build)...');
  try {
    execSync('npm run build', { stdio: 'ignore' });
    log('OK', 'Build local exitoso');
    return true;
  } catch (e) {
    log('ERROR', 'El build local falló. Revisa errores de TypeScript o dependencias.');
    return false;
  }
}

function checkHealthEndpoint(port = 3008, cb) {
  log('OK', `Verificando endpoint /health en http://localhost:${port}/health ...`);
  http.get(`http://localhost:${port}/health`, (res) => {
    if (res.statusCode === 200) {
      log('OK', `/health responde 200 OK`);
      cb(true);
    } else {
      log('ERROR', `/health responde ${res.statusCode}`);
      cb(false);
    }
  }).on('error', (err) => {
    log('ERROR', `No se pudo conectar a /health: ${err.message}`);
    cb(false);
  });
}

function simulateProdStartAndHealth() {
  log('OK', 'Verificación de arranque en modo producción local...');
  log('WARNING', 'Para verificar completamente, ejecuta manualmente:');
  log('WARNING', '1. npm run dev:cloud');
  log('WARNING', '2. En otra terminal: curl http://localhost:3008/health');
  log('WARNING', '3. Debería responder con status 200');
  log('OK', 'Checklist pre-deploy finalizado. Revisa los mensajes anteriores.');
  log('OK', 'Si todo está OK, puedes hacer deploy con: npm run deploy');
}

// --- EJECUCIÓN ---
console.log('\n==============================');
console.log('🛡️  CHECKLIST PRE-DEPLOY CLOUD RUN');
console.log('==============================\n');

let allOk = true;
if (!checkEnvVars()) allOk = false;
if (!checkConfigFiles()) allOk = false;
if (!checkPackageScripts()) allOk = false;
if (!checkDockerfile()) allOk = false;
if (!checkBuild()) allOk = false;

if (allOk) {
  simulateProdStartAndHealth();
} else {
  log('ERROR', 'Hay errores críticos. Corrige antes de hacer deploy.');
  process.exit(1);
} 