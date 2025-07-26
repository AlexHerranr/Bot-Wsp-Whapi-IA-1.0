#!/usr/bin/env node

// Script para actualizar el Assistant con la función get_conversation_context
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function updateAssistantWithContextFunction() {
    try {
        const assistantId = process.env.ASSISTANT_ID;
        
        if (!assistantId) {
            console.error('❌ Error: ASSISTANT_ID no encontrado en las variables de entorno');
            return;
        }

        console.log('🔄 Actualizando Assistant con función get_conversation_context...');
        console.log(`📍 Assistant ID: ${assistantId}`);

        // Obtener configuración actual del assistant
        const currentAssistant = await openai.beta.assistants.retrieve(assistantId);
        console.log(`✅ Assistant encontrado: ${currentAssistant.name}`);

        // Definir la función get_conversation_context
        const contextFunction = {
            name: "get_conversation_context",
            description: "Obtiene contexto histórico de conversaciones anteriores con diferentes niveles de profundidad según lo necesite el assistant",
            parameters: {
                type: "object",
                properties: {
                    context_level: {
                        type: "string",
                        enum: ["recent_30", "recent_60", "recent_100", "recent_200"],
                        description: "Nivel de contexto: 30, 60, 100 o 200 mensajes recientes. OpenAI determinará cuánto contexto necesita para responder correctamente."
                    }
                },
                required: ["context_level"]
            }
        };

        // Obtener funciones existentes y agregar/actualizar la nueva
        const existingFunctions = currentAssistant.tools.filter(tool => tool.type === 'function');
        
        // Remover función inject_history si existe (ya no se usa)
        const functionsWithoutInject = existingFunctions.filter(
            tool => tool.function && tool.function.name !== 'inject_history'
        );

        // Verificar si get_conversation_context ya existe
        const contextFunctionExists = functionsWithoutInject.some(
            tool => tool.function && tool.function.name === 'get_conversation_context'
        );

        let updatedTools;
        if (contextFunctionExists) {
            // Actualizar función existente
            updatedTools = functionsWithoutInject.map(tool => {
                if (tool.function && tool.function.name === 'get_conversation_context') {
                    return { type: 'function', function: contextFunction };
                }
                return tool;
            });
            console.log('🔄 Actualizando función get_conversation_context existente...');
        } else {
            // Agregar nueva función
            updatedTools = [...functionsWithoutInject, { type: 'function', function: contextFunction }];
            console.log('➕ Agregando nueva función get_conversation_context...');
        }

        // Mantener herramientas que no son funciones (como code_interpreter, file_search)
        const nonFunctionTools = currentAssistant.tools.filter(tool => tool.type !== 'function');
        const allTools = [...nonFunctionTools, ...updatedTools];

        // Actualizar el assistant
        const updatedAssistant = await openai.beta.assistants.update(assistantId, {
            tools: allTools
        });

        console.log('✅ Assistant actualizado exitosamente!');
        console.log('\n📋 Funciones configuradas:');
        
        const functionTools = updatedAssistant.tools.filter(tool => tool.type === 'function');
        functionTools.forEach((tool, index) => {
            if (tool.function) {
                console.log(`   ${index + 1}. ${tool.function.name}`);
                if (tool.function.name === 'get_conversation_context') {
                    console.log('      ✅ Contexto histórico bajo demanda');
                    console.log('      📊 Niveles: 30, 60, 100, 200 mensajes');
                }
            }
        });

        console.log('\n🎯 Configuración completada:');
        console.log('   ❌ inject_history: REMOVIDA (no más inyección automática)');
        console.log('   ✅ get_conversation_context: ACTIVA (OpenAI decide cuándo y cuánto)');
        console.log('\n💡 OpenAI ahora puede solicitar contexto cuando lo necesite:');
        console.log('   - get_conversation_context({context_level: "recent_30"})');
        console.log('   - get_conversation_context({context_level: "recent_60"})');
        console.log('   - get_conversation_context({context_level: "recent_100"})');
        console.log('   - get_conversation_context({context_level: "recent_200"})');

    } catch (error) {
        console.error('❌ Error actualizando el Assistant:', error.message);
        if (error.response) {
            console.error('📋 Detalles del error:', error.response.data);
        }
    }
}

// Ejecutar la actualización
updateAssistantWithContextFunction();