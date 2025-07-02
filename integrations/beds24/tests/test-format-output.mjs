import axios from 'axios';

console.log('🧪 Test: Formato de Salida para OpenAI');
console.log('='*50);

// Simulación de lo que produce la nueva lógica de priorización
async function simulateOptimizedOutput() {
    
    console.log('📋 EJEMPLO DE SALIDA OPTIMIZADA PARA OPENAI:');
    console.log('─'.repeat(60));
    
    // CASO 1: Con opciones completas disponibles
    console.log('\n🥇 ESCENARIO 1: Opciones completas disponibles');
    console.log('─'.repeat(30));
    
    const output1 = `📅 **Consulta: 15 Jul - 18 Jul (3 noches)**

🥇 **DISPONIBILIDAD COMPLETA (4 opciones)**
✅ **Opción 1**: 1317 - 3 noches
   💰 Total: $540,000
   📊 Promedio: $180,000/noche

✅ **Opción 2**: 2005 A - 3 noches
   💰 Total: $615,000
   📊 Promedio: $205,000/noche

✅ **Opción 3**: 1820 - 3 noches
   💰 Total: $630,000
   📊 Promedio: $210,000/noche

🔄 *Datos en tiempo real desde Beds24*`;

    console.log(output1);
    
    // CASO 2: Solo opciones con splits
    console.log('\n\n🥈 ESCENARIO 2: Solo opciones con traslados');
    console.log('─'.repeat(30));
    
    const output2 = `📅 **Consulta: 2 Jul - 9 Jul (7 noches)**

🥈 **ALTERNATIVAS CON TRASLADO** (por disponibilidad limitada - posible descuento)
🔄 **Opción 1**: 1 traslado - $1,380,000
   🏠 2005 B: 2025-07-02 a 2025-07-05 (4 noches) - $820,000
   🔄 1403: 2025-07-06 a 2025-07-08 (3 noches) - $560,000

🔄 **Opción 2**: 1 traslado - $1,420,000
   🏠 1421 B: 2025-07-02 a 2025-07-04 (3 noches) - $630,000
   🔄 1001: 2025-07-05 a 2025-07-08 (4 noches) - $790,000

🔄 **Opción 3**: 2 traslados - $1,450,000
   🏠 1317: 2025-07-02 a 2025-07-03 (2 noches) - $360,000
   🔄 2005 A: 2025-07-04 a 2025-07-06 (3 noches) - $615,000
   🔄 1820: 2025-07-07 a 2025-07-08 (2 noches) - $475,000

🔄 *Datos en tiempo real desde Beds24*`;

    console.log(output2);
    
    // CASO 3: Opciones mixtas (completas + alternativas)
    console.log('\n\n🏆 ESCENARIO 3: Completas + Alternativas');
    console.log('─'.repeat(30));
    
    const output3 = `📅 **Consulta: 10 Jul - 15 Jul (5 noches)**

🥇 **DISPONIBILIDAD COMPLETA (2 opciones)**
✅ **Opción 1**: 1317 - 5 noches
   💰 Total: $900,000
   📊 Promedio: $180,000/noche

✅ **Opción 2**: 1421 B - 5 noches
   💰 Total: $1,050,000
   📊 Promedio: $210,000/noche

🥈 **ALTERNATIVAS CON TRASLADO** (por preferencias de precio, comodidad o disponibilidad)
🔄 **Opción 1**: 1 traslado - $950,000
   🏠 2005 A: 2025-07-10 a 2025-07-12 (3 noches) - $615,000
   🔄 1820: 2025-07-13 a 2025-07-14 (2 noches) - $335,000

🔄 *Datos en tiempo real desde Beds24*`;

    console.log(output3);
    
    console.log('\n\n📊 ANÁLISIS DE EFICIENCIA:');
    console.log('─'.repeat(25));
    console.log('✅ Priorización clara: Completas primero');
    console.log('✅ Información esencial: Precios, noches, traslados');
    console.log('✅ Formato optimizado: Mínimo texto, máxima claridad');
    console.log('✅ Lógica de negocio: Descuentos por traslados mencionados');
    console.log('✅ Ordenamiento inteligente: Menos traslados = mejor opción');
    
    console.log('\n🎯 VENTAJAS PARA OPENAI:');
    console.log('─'.repeat(20));
    console.log('• Respuestas consistentes y predecibles');
    console.log('• Menos tokens necesarios para procesamiento');
    console.log('• Información estructurada fácil de interpretar');
    console.log('• Lógica de negocio aplicada automáticamente');
    console.log('• Cliente recibe opciones ya priorizadas');
    
    console.log('\n✅ Simulación completada');
}

simulateOptimizedOutput(); 