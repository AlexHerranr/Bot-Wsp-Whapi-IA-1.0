/**
 * Script para actualizar el assistant con la nueva función get_conversation_context
 * Permite al assistant solicitar contexto histórico cuando lo necesite
 */

const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!ASSISTANT_ID) {
    console.error('❌ ASSISTANT_ID no encontrado en variables de entorno');
    process.exit(1);
}

async function updateAssistantWithContextFunction() {
    try {
        console.log('🔄 Actualizando assistant con función get_conversation_context...');
        
        // Obtener el assistant actual
        const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
        console.log(`📋 Assistant actual: ${assistant.name}`);
        
        // Verificar si la función get_conversation_context ya está en las herramientas
        const hasContextFunction = assistant.tools.some(tool => 
            tool.type === 'function' && tool.function.name === 'get_conversation_context'
        );
        
        if (hasContextFunction) {
            console.log('✅ Función get_conversation_context ya está configurada');
        } else {
            console.log('⚠️ Función get_conversation_context no encontrada en el assistant');
            console.log('📊 Niveles disponibles: 30, 60, 100, 200 mensajes recientes');
        }
        
        // Verificar las instrucciones actuales
        const currentInstructions = assistant.instructions || '';
        
        // Verificar si ya tiene las instrucciones de contexto
        if (!currentInstructions.includes('get_conversation_context')) {
            const newInstructions = currentInstructions + `

## Función de Contexto Histórico

Cuando necesites información sobre conversaciones anteriores, usa la función get_conversation_context con el nivel apropiado:

- "recent_30": Últimos 30 mensajes (contexto mínimo)
- "recent_60": Últimos 60 mensajes (contexto moderado)
- "recent_100": Últimos 100 mensajes (contexto amplio)
- "recent_200": Últimos 200 mensajes (contexto completo)

Tú determinarás cuánto contexto necesitas para responder correctamente al huésped. Usa el nivel más bajo que te permita dar una respuesta adecuada.

Ejemplos de uso:
- Si el usuario dice "recuerda lo que hablamos" → usar "recent_30"
- Si necesitas más contexto para entender la conversación → usar "recent_60" o "recent_100"
- Si la conversación es muy larga y necesitas contexto completo → usar "recent_200"
- Si el usuario pregunta sobre algo específico mencionado antes → usar el nivel que consideres necesario
`;

            await openai.beta.assistants.update(ASSISTANT_ID, {
                instructions: newInstructions
            });
            
            console.log('✅ Instrucciones actualizadas con función de contexto');
        } else {
            console.log('ℹ️ Las instrucciones ya incluyen la función de contexto');
        }
        
        // Mostrar las funciones actuales
        console.log('\n🔧 Funciones configuradas:');
        assistant.tools.forEach((tool, index) => {
            if (tool.type === 'function') {
                console.log(`  ${index + 1}. ${tool.function.name} - ${tool.function.description}`);
            }
        });
        
        console.log('\n🎉 Verificación completada exitosamente!');
        console.log('🤖 El assistant puede solicitar contexto histórico cuando lo necesite');
        
    } catch (error) {
        console.error('❌ Error actualizando assistant:', error.message);
        if (error.response) {
            console.error('Detalles:', error.response.data);
        }
        process.exit(1);
    }
}

// Ejecutar la actualización
updateAssistantWithContextFunction(); 