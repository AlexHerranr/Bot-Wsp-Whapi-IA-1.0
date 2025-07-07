#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar si el prompt se está aplicando correctamente
 */

import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

async function diagnosticPromptApplication() {
    console.log('🔬 DIAGNÓSTICO: Verificación de aplicación del prompt\n');

    try {
        // 1. Verificar el asistente actual
        console.log('1️⃣ Verificando configuración del asistente...');
        const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
        
        console.log(`✅ Asistente ID: ${assistant.id}`);
        console.log(`✅ Modelo: ${assistant.model}`);
        console.log(`✅ Temperatura: ${assistant.temperature}`);
        console.log(`✅ Longitud de instrucciones: ${assistant.instructions?.length || 0} caracteres`);
        
        // 2. Verificar si contiene el "Guardián de fechas"
        const hasGuardian = assistant.instructions?.includes('GUARDIÁN DE FECHAS') || false;
        const hasMandato = assistant.instructions?.includes('MANDATO CRÍTICO') || false;
        const hasValidation = assistant.instructions?.includes('check_availability()') || false;
        
        console.log(`\n2️⃣ Verificando contenido del prompt:`);
        console.log(`${hasGuardian ? '✅' : '❌'} Contiene "GUARDIÁN DE FECHAS"`);
        console.log(`${hasMandato ? '✅' : '❌'} Contiene "MANDATO CRÍTICO"`);
        console.log(`${hasValidation ? '✅' : '❌'} Contiene validación de check_availability`);
        
        // 3. Mostrar primeras líneas del prompt
        const firstLines = assistant.instructions?.split('\n').slice(0, 10).join('\n') || '';
        console.log(`\n3️⃣ Primeras líneas del prompt actual:`);
        console.log('---');
        console.log(firstLines);
        console.log('---');
        
        // 4. Verificar funciones disponibles
        console.log(`\n4️⃣ Funciones disponibles:`);
        assistant.tools?.forEach((tool, index) => {
            if (tool.type === 'function') {
                console.log(`✅ ${index + 1}. ${tool.function.name}`);
            } else {
                console.log(`✅ ${index + 1}. ${tool.type}`);
            }
        });
        
        // 5. Test de thread específico
        console.log(`\n5️⃣ Creando thread de prueba...`);
        const testThread = await openai.beta.threads.create();
        
        // Agregar mensaje de prueba
        await openai.beta.threads.messages.create(testThread.id, {
            role: 'user',
            content: 'que tienes disponible para diciembre'
        });
        
        console.log(`✅ Thread de prueba creado: ${testThread.id}`);
        
        // Crear run de prueba
        console.log(`\n6️⃣ Ejecutando run de prueba...`);
        const testRun = await openai.beta.threads.runs.create(testThread.id, {
            assistant_id: ASSISTANT_ID
        });
        
        console.log(`✅ Run de prueba creado: ${testRun.id}`);
        
        // Esperar y verificar resultado
        let runStatus = testRun.status;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (runStatus === 'queued' || runStatus === 'in_progress') {
            if (attempts >= maxAttempts) {
                console.log('❌ Timeout esperando el run');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            const updatedRun = await openai.beta.threads.runs.retrieve(testThread.id, testRun.id);
            runStatus = updatedRun.status;
            attempts++;
            
            console.log(`⏳ Run status: ${runStatus} (intento ${attempts}/${maxAttempts})`);
        }
        
        // Verificar si llamó funciones
        if (runStatus === 'requires_action') {
            const finalRun = await openai.beta.threads.runs.retrieve(testThread.id, testRun.id);
            const toolCalls = finalRun.required_action?.submit_tool_outputs?.tool_calls || [];
            
            console.log(`\n7️⃣ RESULTADO CRÍTICO:`);
            if (toolCalls.length > 0) {
                console.log(`❌ EL ASISTENTE LLAMÓ FUNCIONES SIN FECHAS ESPECÍFICAS:`);
                toolCalls.forEach((call, index) => {
                    console.log(`   ${index + 1}. ${call.function.name}(${call.function.arguments})`);
                });
                console.log(`\n🚨 CONCLUSIÓN: El prompt NO se está aplicando correctamente`);
            } else {
                console.log(`✅ El asistente NO llamó funciones - Prompt funcionando`);
            }
        } else if (runStatus === 'completed') {
            // Obtener respuesta
            const messages = await openai.beta.threads.messages.list(testThread.id);
            const lastMessage = messages.data[0];
            
            if (lastMessage.role === 'assistant') {
                const content = lastMessage.content[0];
                if (content.type === 'text') {
                    console.log(`\n7️⃣ RESPUESTA DEL ASISTENTE:`);
                    console.log(`"${content.text.value}"`);
                    
                    const asksDates = content.text.value.toLowerCase().includes('fechas') || 
                                    content.text.value.toLowerCase().includes('específicas');
                    
                    if (asksDates) {
                        console.log(`\n✅ CONCLUSIÓN: El asistente PIDE fechas específicas - Prompt funcionando`);
                    } else {
                        console.log(`\n❌ CONCLUSIÓN: El asistente NO pide fechas - Prompt NO funcionando`);
                    }
                }
            }
        } else {
            console.log(`\n❌ Run terminó con status: ${runStatus}`);
        }
        
        // Limpiar thread de prueba
        console.log(`\n8️⃣ Limpiando thread de prueba...`);
        await openai.beta.threads.del(testThread.id);
        console.log(`✅ Thread eliminado`);
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
}

// Ejecutar diagnóstico
diagnosticPromptApplication(); 