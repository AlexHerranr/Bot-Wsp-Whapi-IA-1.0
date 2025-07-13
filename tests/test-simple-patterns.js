#!/usr/bin/env node

/**
 * Test de Patrones Simples
 * 
 * Este script prueba la detección de patrones simples implementada en la ETAPA 1
 * para verificar que las respuestas fijas funcionan correctamente.
 */

console.log('🧪 TEST: Patrones Simples - ETAPA 1\n');

// Simular los patrones y respuestas del bot
const SIMPLE_PATTERNS = {
  greeting: /^(hola|buen(os)?\s(d[ií]as|tardes|noches))(\s*[\.,¡!¿\?])*\s*$/i,
  thanks: /^(gracias|muchas gracias|mil gracias|te agradezco)(\s*[\.,¡!])*$/i,
  availability: /^(disponibilidad|disponible|libre)(\s*[\.,¡!¿\?])*\s*$/i,
  price: /^(precio|costo|cu[áa]nto|valor)(\s*[\.,¡!¿\?])*\s*$/i,
  bye: /^(chau|adiós|hasta luego|nos vemos|bye)(\s*[\.,¡!])*$/i,
  confusion: /^(no entiendo|no comprendo|qué dijiste|no sé|no se)(\s*[\.,¡!¿\?])*$/i,
  ok: /^(ok|okay|vale|perfecto|listo)(\s*[\.,¡!])*$/i
};

const FIXED_RESPONSES = {
  greeting: "¡Hola! 😊 ¿Cómo puedo ayudarte hoy? ¿Buscas apartamento en Cartagena?",
  thanks: "¡De nada! 😊 Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?",
  bye: "¡Hasta luego! 👋 Que tengas un excelente día. Si necesitas algo más, aquí estaré.",
  confusion: "Lo siento, ¿puedes repetir eso de otra manera? 😅 Estoy aquí para ayudarte.",
  ok: "¡Perfecto! 👍 ¿En qué más puedo ayudarte?"
};

function detectSimplePattern(messageText) {
  for (const [patternName, pattern] of Object.entries(SIMPLE_PATTERNS)) {
    if (pattern.test(messageText.trim())) {
      const response = FIXED_RESPONSES[patternName];
      if (response) {
        return { pattern: patternName, response };
      }
    }
  }
  return null;
}

// Casos de prueba
const testCases = [
  // Saludos
  { input: "hola", expected: "greeting" },
  { input: "buenos días", expected: "greeting" },
  { input: "buenas tardes", expected: "greeting" },
  { input: "buenas noches", expected: "greeting" },
  { input: "HOLA!", expected: "greeting" },
  
  // Agradecimientos
  { input: "gracias", expected: "thanks" },
  { input: "muchas gracias", expected: "thanks" },
  { input: "mil gracias", expected: "thanks" },
  { input: "te agradezco", expected: "thanks" },
  
  // Despedidas
  { input: "chau", expected: "bye" },
  { input: "adiós", expected: "bye" },
  { input: "hasta luego", expected: "bye" },
  { input: "nos vemos", expected: "bye" },
  { input: "bye", expected: "bye" },
  
  // Confusiones
  { input: "no entiendo", expected: "confusion" },
  { input: "no comprendo", expected: "confusion" },
  { input: "qué dijiste", expected: "confusion" },
  { input: "no sé", expected: "confusion" },
  
  // Confirmaciones
  { input: "ok", expected: "ok" },
  { input: "okay", expected: "ok" },
  { input: "vale", expected: "ok" },
  { input: "perfecto", expected: "ok" },
  { input: "listo", expected: "ok" },
  
  // Casos que NO deben detectarse
  { input: "hola, necesito información", expected: null },
  { input: "gracias por la información", expected: null },
  { input: "ok, pero tengo una pregunta", expected: null },
  { input: "no entiendo el precio", expected: null },
  { input: "disponibilidad para mañana", expected: null },
  { input: "¿cuál es el precio?", expected: null }
];

// Ejecutar pruebas
let passed = 0;
let failed = 0;

console.log('═'.repeat(80));
console.log('CASOS DE PRUEBA:');
console.log('═'.repeat(80));

testCases.forEach((testCase, index) => {
  const result = detectSimplePattern(testCase.input);
  const detectedPattern = result ? result.pattern : null;
  const isSuccess = detectedPattern === testCase.expected;
  
  if (isSuccess) {
    passed++;
    console.log(`✅ ${index + 1}. "${testCase.input}" → ${detectedPattern || 'null'}`);
  } else {
    failed++;
    console.log(`❌ ${index + 1}. "${testCase.input}" → ${detectedPattern || 'null'} (esperado: ${testCase.expected || 'null'})`);
  }
  
  if (result) {
    console.log(`   📝 Respuesta: "${result.response.substring(0, 50)}..."`);
  }
  console.log('');
});

// Resumen
console.log('═'.repeat(80));
console.log('RESUMEN:');
console.log('═'.repeat(80));
console.log(`✅ Pasaron: ${passed}`);
console.log(`❌ Fallaron: ${failed}`);
console.log(`📊 Total: ${testCases.length}`);
console.log(`🎯 Efectividad: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON! Los patrones simples están funcionando correctamente.');
} else {
  console.log('\n⚠️  Algunas pruebas fallaron. Revisar los patrones regex.');
}

console.log('\n📋 PATRONES IMPLEMENTADOS:');
Object.keys(SIMPLE_PATTERNS).forEach(pattern => {
  console.log(`   • ${pattern}: ${SIMPLE_PATTERNS[pattern]}`);
});

console.log('\n🚀 Próximos pasos:');
console.log('   1. Reiniciar el bot para activar los patrones');
console.log('   2. Probar con mensajes reales en WhatsApp');
console.log('   3. Monitorear logs para verificar detección');
console.log('   4. Revisar métricas en /health endpoint'); 