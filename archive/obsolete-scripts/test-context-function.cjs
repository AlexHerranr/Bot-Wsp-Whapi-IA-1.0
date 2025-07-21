/**
 * Script de prueba para verificar que la función get_conversation_context está registrada
 */

const { FUNCTION_REGISTRY } = require('../src/functions/registry/function-registry.js');

async function testContextFunction() {
    try {
        console.log('🧪 Verificando función get_conversation_context...');
        
        // Verificar si la función está registrada
        const contextFunction = FUNCTION_REGISTRY.getFunction('get_conversation_context');
        
        if (contextFunction) {
            console.log('✅ Función get_conversation_context encontrada en el registro');
            console.log('📋 Nombre:', contextFunction.name);
            console.log('📝 Descripción:', contextFunction.description);
            console.log('🏷️ Categoría:', contextFunction.category);
            console.log('📊 Versión:', contextFunction.version);
            console.log('✅ Habilitada:', contextFunction.enabled);
            
            console.log('\n🔧 Parámetros:');
            console.log('Context Level:', contextFunction.parameters.properties.context_level.description);
            console.log('Opciones:', contextFunction.parameters.properties.context_level.enum);
            
            console.log('\n🎉 Verificación completada exitosamente!');
            console.log('✅ La función get_conversation_context está correctamente registrada');
            
        } else {
            console.error('❌ Función get_conversation_context no encontrada en el registro');
            
            console.log('\n📋 Funciones disponibles:');
            const functions = FUNCTION_REGISTRY.getAllFunctions();
            functions.forEach((func, name) => {
                console.log(`  - ${name}: ${func.description}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error en la verificación:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Ejecutar la verificación
testContextFunction(); 