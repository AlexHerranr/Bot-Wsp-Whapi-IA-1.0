#!/usr/bin/env node

/**
 * Script para ejecutar las pruebas de regresión adicionales
 * Garantiza equivalencia funcional 100% con app-unified.ts
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const REGRESSION_TESTS = [
  {
    name: 'Functional Equivalence End-to-End',
    file: 'tests/regression/functional-equivalence.test.ts',
    timeout: 30000,
    description: 'Valida comportamiento exacto de webhooks y buffering'
  },
  {
    name: 'Concurrency & Stress Testing',
    file: 'tests/regression/concurrency-stress.test.ts', 
    timeout: 45000,
    description: 'Prueba 50 usuarios concurrentes y manejo de errores'
  },
  {
    name: 'Media Processing Real',
    file: 'tests/regression/media-processing-real.test.ts',
    timeout: 60000,
    description: 'Procesamiento real de audio e imágenes sin mocks'
  },
  {
    name: 'Context Cache Temporal',
    file: 'tests/regression/context-cache-temporal.test.ts',
    timeout: 45000,
    description: 'Validación de TTL y inyección de contexto'
  },
  {
    name: 'SQL Memory Fallback',
    file: 'tests/regression/sql-memory-fallback.test.ts',
    timeout: 30000,
    description: 'Equivalencia entre modo SQL y memoria'
  },
  {
    name: 'Performance Benchmark',
    file: 'tests/regression/performance-benchmark.test.ts',
    timeout: 120000,
    description: 'Benchmarks comparativos de rendimiento'
  },
  {
    name: 'Local Execution',
    file: 'tests/regression/local-execution.test.ts',
    timeout: 30000,
    description: 'Ejecución local con dotenv vs cloud'
  }
];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log('\n' + '='.repeat(80));
  console.log(colorize('cyan', '🧪 PRUEBAS DE EQUIVALENCIA FUNCIONAL - ETAPA 2'));
  console.log(colorize('yellow', '   Validación 100% compatible con app-unified.ts'));
  console.log('='.repeat(80) + '\n');
}

function printTestInfo(test, index) {
  console.log(colorize('blue', `📋 Test ${index + 1}/${REGRESSION_TESTS.length}: ${test.name}`));
  console.log(colorize('bright', `   📄 ${test.description}`));
  console.log(colorize('bright', `   ⏱️  Timeout: ${test.timeout/1000}s`));
  console.log(colorize('bright', `   📁 ${test.file}`));
  console.log('');
}

async function runSingleTest(test) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const jestProcess = spawn('npx', ['jest', test.file, '--verbose', '--detectOpenHandles'], {
      stdio: 'pipe',
      shell: true,
      timeout: test.timeout
    });

    let stdout = '';
    let stderr = '';

    jestProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Mostrar progreso en tiempo real para tests largos
      if (output.includes('✓') || output.includes('PASS') || output.includes('FAIL')) {
        process.stdout.write('.');
      }
    });

    jestProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    jestProcess.on('close', (code) => {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(''); // Nueva línea después de los puntos de progreso
      
      if (code === 0) {
        console.log(colorize('green', `✅ PASSED in ${duration.toFixed(1)}s\n`));
        resolve({ success: true, duration, stdout, stderr });
      } else {
        console.log(colorize('red', `❌ FAILED in ${duration.toFixed(1)}s`));
        if (stderr) {
          console.log(colorize('red', 'Error details:'));
          console.log(stderr.substring(0, 500) + '...\n');
        }
        resolve({ success: false, duration, stdout, stderr, exitCode: code });
      }
    });

    jestProcess.on('error', (error) => {
      console.log(colorize('red', `❌ ERROR: ${error.message}\n`));
      resolve({ success: false, duration: 0, error: error.message });
    });
  });
}

async function createResultsReport(results) {
  const reportDir = path.join(process.cwd(), 'tests', 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  
  const reportPath = path.join(reportDir, 'regression-test-results.json');
  const timestamp = new Date().toISOString();
  
  const summary = {
    timestamp,
    totalTests: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => r.success === false).length,
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    results: results.map((result, index) => ({
      testName: REGRESSION_TESTS[index].name,
      testFile: REGRESSION_TESTS[index].file,
      success: result.success,
      duration: result.duration,
      exitCode: result.exitCode || 0,
      hasError: !!result.error
    }))
  };
  
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
  
  return { summary, reportPath };
}

function printSummary(summary) {
  console.log('\n' + '='.repeat(80));
  console.log(colorize('cyan', '📊 RESUMEN DE PRUEBAS DE EQUIVALENCIA FUNCIONAL'));
  console.log('='.repeat(80));
  
  const passRate = (summary.passed / summary.totalTests * 100).toFixed(1);
  const totalMinutes = (summary.totalDuration / 60).toFixed(1);
  
  console.log(colorize('bright', `📈 Tests Ejecutados: ${summary.totalTests}`));
  console.log(colorize('green', `✅ Exitosos: ${summary.passed}`));
  console.log(colorize('red', `❌ Fallidos: ${summary.failed}`));
  console.log(colorize('yellow', `📊 Tasa de Éxito: ${passRate}%`));
  console.log(colorize('blue', `⏱️  Tiempo Total: ${totalMinutes} minutos`));
  
  console.log('\n' + colorize('bright', '📋 DETALLES POR TEST:'));
  summary.results.forEach((result, index) => {
    const status = result.success ? colorize('green', '✅ PASS') : colorize('red', '❌ FAIL');
    const duration = `${result.duration.toFixed(1)}s`;
    console.log(`   ${status} ${result.testName} (${duration})`);
  });
  
  if (summary.failed > 0) {
    console.log('\n' + colorize('red', '⚠️  TESTS FALLIDOS REQUIEREN ATENCIÓN:'));
    summary.results
      .filter(r => !r.success)
      .forEach(result => {
        console.log(colorize('red', `   • ${result.testName} - ${result.testFile}`));
      });
  }
  
  console.log('\n' + colorize('bright', '📄 INTERPRETACIÓN DE RESULTADOS:'));
  
  if (passRate >= 95) {
    console.log(colorize('green', '🎉 EQUIVALENCIA FUNCIONAL CONFIRMADA (≥95% éxito)'));
    console.log(colorize('green', '   La implementación modular mantiene 100% compatibilidad con app-unified.ts'));
  } else if (passRate >= 80) {
    console.log(colorize('yellow', '⚠️  EQUIVALENCIA FUNCIONAL PARCIAL (80-94% éxito)'));
    console.log(colorize('yellow', '   Revisar tests fallidos para confirmar equivalencia completa'));
  } else {
    console.log(colorize('red', '🚨 EQUIVALENCIA FUNCIONAL NO CONFIRMADA (<80% éxito)'));
    console.log(colorize('red', '   Se requieren correcciones antes de considerar equivalente'));
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

async function main() {
  try {
    printHeader();
    
    console.log(colorize('bright', '🚀 Iniciando batería de pruebas de equivalencia funcional...\n'));
    
    const results = [];
    
    for (let i = 0; i < REGRESSION_TESTS.length; i++) {
      const test = REGRESSION_TESTS[i];
      printTestInfo(test, i);
      
      const result = await runSingleTest(test);
      results.push(result);
      
      // Pausa entre tests para evitar conflictos de puertos
      if (i < REGRESSION_TESTS.length - 1) {
        console.log(colorize('blue', '⏳ Preparando siguiente test...\n'));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Generar reporte
    const { summary, reportPath } = await createResultsReport(results);
    
    // Mostrar resumen
    printSummary(summary);
    
    console.log(colorize('cyan', `📁 Reporte detallado guardado en: ${reportPath}`));
    
    // Exit code basado en resultados
    const exitCode = summary.failed === 0 ? 0 : 1;
    process.exit(exitCode);
    
  } catch (error) {
    console.error(colorize('red', `💥 Error fatal ejecutando tests: ${error.message}`));
    process.exit(1);
  }
}

// Verificar que Jest esté disponible
async function checkDependencies() {
  try {
    const { spawn } = require('child_process');
    return new Promise((resolve) => {
      const jestCheck = spawn('npx', ['jest', '--version'], { stdio: 'pipe', shell: true });
      jestCheck.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          console.error(colorize('red', '❌ Jest no está disponible. Ejecuta: npm install'));
          process.exit(1);
        }
      });
    });
  } catch (error) {
    console.error(colorize('red', '❌ No se puede verificar Jest. Asegúrate de que Node.js esté instalado.'));
    process.exit(1);
  }
}

// Ejecutar
checkDependencies().then(() => {
  main();
});