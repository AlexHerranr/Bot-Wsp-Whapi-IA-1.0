// src/utils/groqAi.js

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { FunctionHandler } from '../handlers/function-handler.js';

dotenv.config();

const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

const functionHandler = new FunctionHandler();
const state = new Map();

/**
 * Obtiene o crea un thread para un usuario
 */
const getOrCreateThread = async (userJid) => {
    let threadId = state.get(userJid);
    if (!threadId) {
        const thread = await openai.beta.threads.create();
        threadId = thread.id;
        state.set(userJid, threadId);
        console.log(`[OpenAI] Nuevo thread creado para ${userJid}: ${threadId}`);
    }
    return threadId;
};

/**
 * Función principal para interactuar con el Assistant
 * Ahora con soporte completo para function calling
 */
export const toAsk = async (assistantId, userMsg, userJid) => {
    try {
        const threadId = await getOrCreateThread(userJid);
        
        // Agregar mensaje del usuario si existe
        if (userMsg) {
            await openai.beta.threads.messages.create(threadId, {
                role: 'user',
                content: userMsg
            });
            console.log(`[OpenAI] Mensaje agregado al thread ${threadId}`);
        }
        
        // Crear y ejecutar el run
        let run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId
        });
        
        console.log(`[OpenAI] Run creado: ${run.id} - Estado: ${run.status}`);
        
        // Esperar a que el run complete o requiera acción
        while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
            await new Promise(resolve => setTimeout(resolve, 500));
            run = await openai.beta.threads.runs.retrieve(threadId, run.id);
            
            // Si requiere acción (function calling)
            if (run.status === 'requires_action') {
                console.log('[OpenAI] Run requiere acción - Function calling detectado');
                
                const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
                console.log(`[OpenAI] ${toolCalls.length} function calls a procesar`);
                
                // Procesar todas las function calls en paralelo
                const outputs = await Promise.all(
                    toolCalls.map(async (call) => {
                        console.log(`[OpenAI] Ejecutando función: ${call.function.name}`);
                        
                        try {
                            const args = JSON.parse(call.function.arguments);
                            const result = await functionHandler.handleFunction(
                                call.function.name, 
                                args
                            );
                            
                            return {
                                tool_call_id: call.id,
                                output: JSON.stringify(result)
                            };
                        } catch (error) {
                            console.error(`[OpenAI] Error en función ${call.function.name}:`, error);
                            return {
                                tool_call_id: call.id,
                                output: JSON.stringify({
                                    error: true,
                                    message: error.message
                                })
                            };
                        }
                    })
                );
                
                // Enviar los resultados de vuelta a OpenAI
                console.log('[OpenAI] Enviando resultados de functions a OpenAI');
                await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: outputs
                });
                
                // El run continuará procesando después de recibir los outputs
                run = await openai.beta.threads.runs.retrieve(threadId, run.id);
            }
        }
        
        // Verificar si el run completó exitosamente
        if (run.status === 'completed') {
            console.log('[OpenAI] Run completado exitosamente');
            
            // Obtener la respuesta más reciente
            const messages = await openai.beta.threads.messages.list(threadId);
            const lastMessage = messages.data[0];
            
            if (lastMessage.content[0].type === 'text') {
                return lastMessage.content[0].text.value;
            }
        } else if (run.status === 'failed') {
            console.error('[OpenAI] Run falló:', run.last_error);
            throw new Error(`Assistant run failed: ${run.last_error?.message || 'Unknown error'}`);
        } else if (run.status === 'cancelled') {
            console.error('[OpenAI] Run fue cancelado');
            throw new Error('Assistant run was cancelled');
        } else if (run.status === 'expired') {
            console.error('[OpenAI] Run expiró');
            throw new Error('Assistant run expired');
        }
        
        // Si llegamos aquí, algo salió mal
        throw new Error(`Unexpected run status: ${run.status}`);
        
    } catch (error) {
        console.error('[OpenAI] Error en toAsk:', error);
        
        // Intentar dar una respuesta útil según el tipo de error
        if (error.message.includes('rate_limit')) {
            return 'Estamos experimentando alta demanda. Por favor intenta de nuevo en unos segundos.';
        } else if (error.message.includes('expired')) {
            // Si el thread expiró, crear uno nuevo
            state.delete(userJid);
            return 'Tu sesión expiró. Por favor repite tu pregunta.';
        } else {
            return 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
        }
    }
};

/**
 * Limpia el thread de un usuario (útil para testing o reset)
 */
export const clearUserThread = (userJid) => {
    if (state.has(userJid)) {
        state.delete(userJid);
        console.log(`[OpenAI] Thread eliminado para usuario ${userJid}`);
    }
};

/**
 * Obtiene el ID del thread actual de un usuario
 */
export const getUserThreadId = (userJid) => {
    return state.get(userJid);
};