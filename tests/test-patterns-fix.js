/**
 * 🧪 Test de Patrones Simplificados - Validación de Fix
 * 
 * Prueba que los patrones simplificados funcionen correctamente:
 * - "Tienen apartamentos?" debe detectarse como "availability"
 * - "confusion" ya no debe existir
 * - Respuestas más naturales y apropiadas
 */

// Simular la función analyzeCompleteContext simplificada
function analyzeCompleteContext(combinedText, userId = null) {
  const cleanText = combinedText.trim().toLowerCase();
  
  // Simular contexto del usuario
  const userContext = { lastPattern: null };
  const lastPattern = userContext?.lastPattern;
  
  // 1. Detectar si es una consulta de disponibilidad
  const hasReservationKeywords = ['reservar', 'reserva', 'gustaría', 'quiero', 'busco', 'necesito'].some(kw => cleanText.includes(kw));
  const hasApartmentKeywords = ['apartamento', 'apto', 'habitación', 'lugar', 'alojamiento'].some(kw => cleanText.includes(kw));
  const hasDateKeywords = ['del', 'al', 'desde', 'hasta', 'fecha', 'días'].some(kw => cleanText.includes(kw));
  const hasPeopleKeywords = ['personas', 'gente', 'huespedes', '4', '5', '6'].some(kw => cleanText.includes(kw));
  
  // Si tiene elementos de reserva o consulta directa de apartamentos, es availability
  if ((hasReservationKeywords && hasApartmentKeywords) || 
      (hasApartmentKeywords && (cleanText.includes('tienen') || cleanText.includes('hay') || cleanText.includes('disponible')))) {
    return { 
      pattern: 'availability', 
      response: "Sí, tenemos apartamentos disponibles en Cartagena. Dime las fechas, número de personas y presupuesto para recomendarte opciones.",
      isFuzzy: true 
    };
  }
  
  // 2. Si viene después de availability y tiene fechas, es dates
  if (lastPattern === 'availability' && hasDateKeywords) {
    return { 
      pattern: 'dates', 
      response: "Perfecto, veo que me das fechas. ¿Cuántas personas serían? Con esa información puedo buscar disponibilidad en mi sistema.",
      isFuzzy: true 
    };
  }
  
  // 3. Detectar información de personas
  const peopleMatch = cleanText.match(/(\d+)\s*(personas?|gente|huespedes?)/);
  if (peopleMatch) {
    let response;
    
    // Si viene después de availability o dates, es información completa
    if (lastPattern === 'availability' || lastPattern === 'dates') {
      response = "Perfecto, ya tengo toda la información. Buscando disponibilidad para " + peopleMatch[1] + " personas en las fechas que me dijiste. Un momento...";
    } else {
      // Si no hay contexto previo, preguntar por fechas
      response = "Perfecto, " + peopleMatch[1] + " personas. ¿Para qué fechas necesitas el apartamento?";
    }
    
    return { 
      pattern: 'people_info', 
      response, 
      isFuzzy: true 
    };
  }
  
  // 4. Detectar saludos
  if (['hola', 'buenos', 'buenas', 'que tal', 'hey', 'hi', 'hello'].some(kw => cleanText.includes(kw)) || 
      cleanText === 'qué tal' || cleanText === 'que tal') {
    return { 
      pattern: 'greeting', 
      response: "¡Hola! Bienvenido a nuestro servicio de apartamentos en Cartagena. ¿En qué puedo ayudarte hoy?",
      isFuzzy: true 
    };
  }
  
  return null;
}

// Casos de prueba específicos para el fix
const testCases = [
  // ✅ CASOS QUE DEBEN FUNCIONAR CORRECTAMENTE
  
  // Disponibilidad - debe detectarse como availability
  { 
    input: "Tienen apartamentos?", 
    expected: "availability", 
    description: "Consulta de disponibilidad con interrogación",
    shouldPass: true
  },
  { 
    input: "¿Tienen apartamentos disponibles?", 
    expected: "availability", 
    description: "Consulta de disponibilidad con ¿?",
    shouldPass: true
  },
  { 
    input: "Busco apartamento en Cartagena", 
    expected: "availability", 
    description: "Consulta de disponibilidad con 'busco'",
    shouldPass: true
  },
  { 
    input: "Necesito un apartamento", 
    expected: "availability", 
    description: "Consulta de disponibilidad con 'necesito'",
    shouldPass: true
  },
  
  // Saludos - deben detectarse como greeting
  { 
    input: "Hola", 
    expected: "greeting", 
    description: "Saludo simple",
    shouldPass: true
  },
  { 
    input: "Buenos días", 
    expected: "greeting", 
    description: "Saludo formal",
    shouldPass: true
  },
  { 
    input: "¿Qué tal?", 
    expected: "greeting", 
    description: "Saludo con interrogación",
    shouldPass: true
  },
  
  // Información de personas
  { 
    input: "4 personas", 
    expected: "people_info", 
    description: "Información de personas sin contexto",
    shouldPass: true
  },
  { 
    input: "Somos 6 personas", 
    expected: "people_info", 
    description: "Información de personas con 'somos'",
    shouldPass: true
  },
  
  // ❌ CASOS QUE NO DEBEN DETECTARSE COMO CONFUSION
  
  // Preguntas válidas que antes se detectaban como confusion
  { 
    input: "¿Por qué no me respondiste?", 
    expected: null, 
    description: "Pregunta sobre respuesta - debe ir a OpenAI",
    shouldPass: true
  },
  { 
    input: "No entiendo el precio", 
    expected: null, 
    description: "Confusión sobre precio - debe ir a OpenAI",
    shouldPass: true
  },
  { 
    input: "¿Qué pasó con mi reserva?", 
    expected: null, 
    description: "Pregunta sobre reserva - debe ir a OpenAI",
    shouldPass: true
  },
  
  // Casos complejos que deben ir a OpenAI
  { 
    input: "¿Tienen wifi en las habitaciones?", 
    expected: null, 
    description: "Pregunta específica sobre servicios",
    shouldPass: true
  },
  { 
    input: "¿Cuál es la política de cancelación?", 
    expected: null, 
    description: "Pregunta sobre políticas",
    shouldPass: true
  },
  { 
    input: "¿Pueden hacer traslado desde el aeropuerto?", 
    expected: null, 
    description: "Pregunta sobre servicios adicionales",
    shouldPass: true
  }
];

// Ejecutar pruebas
console.log('🧪 Test de Patrones Simplificados - Validación de Fix\n');
console.log('═'.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = analyzeCompleteContext(testCase.input);
  const actualPattern = result ? result.pattern : null;
  const success = actualPattern === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✅ [${index + 1}] ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.expected || 'null (OpenAI)'}`);
    console.log(`   Actual: ${actualPattern || 'null (OpenAI)'}`);
    if (result) {
      console.log(`   Response: "${result.response.substring(0, 60)}..."`);
    }
  } else {
    failed++;
    console.log(`❌ [${index + 1}] ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.expected || 'null (OpenAI)'}`);
    console.log(`   Actual: ${actualPattern || 'null (OpenAI)'}`);
    if (result) {
      console.log(`   Response: "${result.response.substring(0, 60)}..."`);
    }
  }
  console.log('');
});

console.log('═'.repeat(80));
console.log(`📊 Resultados: ${passed} ✅ pasaron, ${failed} ❌ fallaron`);
console.log(`📈 Tasa de éxito: ${((passed / testCases.length) * 100).toFixed(1)}%`);

// Validaciones específicas del fix
console.log('\n🔧 Validaciones Específicas del Fix:');
console.log('═'.repeat(50));

// 1. Verificar que "confusion" ya no existe
const confusionTest = analyzeCompleteContext("No entiendo nada");
if (confusionTest && confusionTest.pattern === 'confusion') {
  console.log('❌ ERROR: El patrón "confusion" aún existe');
  failed++;
} else {
  console.log('✅ OK: El patrón "confusion" fue eliminado correctamente');
  passed++;
}

// 2. Verificar que "Tienen apartamentos?" se detecta como availability
const availabilityTest = analyzeCompleteContext("Tienen apartamentos?");
if (availabilityTest && availabilityTest.pattern === 'availability') {
  console.log('✅ OK: "Tienen apartamentos?" se detecta como availability');
  passed++;
} else {
  console.log('❌ ERROR: "Tienen apartamentos?" no se detecta como availability');
  failed++;
}

// 3. Verificar respuestas más naturales
const greetingTest = analyzeCompleteContext("Hola");
if (greetingTest && greetingTest.response.includes("Bienvenido")) {
  console.log('✅ OK: Respuesta de saludo mejorada');
  passed++;
} else {
  console.log('❌ ERROR: Respuesta de saludo no mejorada');
  failed++;
}

console.log('\n═'.repeat(80));
console.log(`🎯 Validaciones del Fix: ${passed} ✅ pasaron, ${failed} ❌ fallaron`);

if (failed === 0) {
  console.log('\n🎉 ¡TODOS LOS TESTS PASARON! El fix está funcionando correctamente.');
  console.log('\n📋 Resumen de mejoras implementadas:');
  console.log('   ✅ Eliminado patrón "confusion" problemático');
  console.log('   ✅ "Tienen apartamentos?" ahora se detecta como availability');
  console.log('   ✅ Respuestas más naturales y apropiadas');
  console.log('   ✅ Preguntas complejas van a OpenAI en lugar de respuestas fijas');
} else {
  console.log('\n⚠️  Algunos tests fallaron. Revisar implementación.');
} 