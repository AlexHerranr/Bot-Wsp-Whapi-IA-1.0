#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync, createReadStream, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Iniciando creación de nuevo assistant...\n');

async function createAssistant() {
    try {
        // 1. Cargar dependencias
        console.log('📦 Cargando dependencias...');
        const dotenv = await import('dotenv');
        dotenv.config();
        
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        console.log('✅ Dependencias cargadas');
        
        // 2. Configuración
        const RAG_FOLDER = join(__dirname, '..', 'RAG OPEN AI ASSISTANCE');
        const ASSISTANT_NAME = 'TeAlquilamos Bot v2.0 - Cartagena Apartments';
        const VECTOR_STORE_NAME = 'TeAlquilamos-RAG-Knowledge-Base-v2';
        
        // 3. Leer prompt principal
        console.log('\n📖 Leyendo prompt principal...');
        const promptPath = join(RAG_FOLDER, '# 00_INSTRUCCIONES_DEL_ASISTENTE.txt');
        const mainPrompt = readFileSync(promptPath, 'utf8');
        console.log(`✅ Prompt leído (${mainPrompt.length} caracteres)`);
        
        // 4. Obtener archivos RAG (excluyendo el prompt principal)
        console.log('\n📁 Obteniendo archivos RAG...');
        const files = readdirSync(RAG_FOLDER);
        const ragFiles = files.filter(file => 
            file.endsWith('.txt') && 
            file.startsWith('#') &&
            !file.includes('PROPOSITO_RAG_SISTEMA') &&
            !file.includes('00_INSTRUCCIONES_DEL_ASISTENTE')  // Excluir el prompt principal
        ).sort();
        
        console.log(`📋 Encontrados ${ragFiles.length} archivos:`);
        ragFiles.forEach(file => console.log(`   - ${file}`));
        
        // 5. Subir archivos
        console.log('\n📤 Subiendo archivos al Files API...');
        const uploadedFiles = [];
        
        for (let i = 0; i < ragFiles.length; i++) {
            const fileName = ragFiles[i];
            const filePath = join(RAG_FOLDER, fileName);
            
            console.log(`   Subiendo ${i + 1}/${ragFiles.length}: ${fileName}`);
            
            try {
                const fileStream = createReadStream(filePath);
                const file = await openai.files.create({
                    file: fileStream,
                    purpose: 'assistants'
                });
                
                uploadedFiles.push(file);
                console.log(`   ✅ ${fileName} -> ${file.id}`);
                
                // Pausa para evitar rate limits
                if (i < ragFiles.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`   ❌ Error subiendo ${fileName}:`, error.message);
                throw error;
            }
        }
        
        console.log(`\n✅ ${uploadedFiles.length} archivos subidos exitosamente`);
        
        // 6. Crear vector store
        console.log('\n🗃️ Creando vector store...');
        const vectorStore = await openai.vectorStores.create({
            name: VECTOR_STORE_NAME,
            file_ids: uploadedFiles.map(file => file.id)
        });
        
        console.log(`✅ Vector store creado: ${vectorStore.id}`);
        
        // 7. Crear assistant
        console.log('\n🤖 Creando assistant...');
        const assistant = await openai.beta.assistants.create({
            name: ASSISTANT_NAME,
            instructions: mainPrompt,
            model: "gpt-4o",
            tools: [
                { type: "file_search" },
                {
                    type: "function",
                    function: {
                        name: "check_availability",
                        description: "Consulta disponibilidad de apartamentos en fechas específicas usando integración con Beds24",
                        parameters: {
                            type: "object",
                            properties: {
                                startDate: { 
                                    type: "string", 
                                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                                    description: "Fecha de inicio en formato YYYY-MM-DD" 
                                },
                                endDate: { 
                                    type: "string", 
                                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                                    description: "Fecha de salida en formato YYYY-MM-DD" 
                                }
                            },
                            required: ["startDate", "endDate"],
                            additionalProperties: false
                        }
                    }
                },
                {
                    type: "function", 
                    function: {
                        name: "escalate_to_human",
                        description: "Transfiere conversación a agente humano cuando se requiere intervención manual",
                        parameters: {
                            type: "object",
                            properties: {
                                reason: { 
                                    type: "string", 
                                    enum: ["complex_request", "payment_issues", "complaint_resolution", "special_requirements", "booking_modification", "emergency_support", "technical_issues", "late_arrival", "reminder_needed", "payment_received", "arrival_coordination", "special_access", "b2b_request", "other"],
                                    description: "Razón específica para la escalación" 
                                },
                                context: { 
                                    type: "object",
                                    properties: {
                                        summary: { type: "string", description: "Resumen de la consulta" },
                                        urgency: { type: "string", enum: ["low", "medium", "high", "critical"] }
                                    },
                                    required: ["summary"],
                                    description: "Contexto adicional" 
                                }
                            },
                            required: ["reason", "context"],
                            additionalProperties: false
                        }
                    }
                }
            ],
            tool_resources: {
                file_search: {
                    vector_store_ids: [vectorStore.id]
                }
            },
            temperature: 0.3
        });
        
        console.log(`✅ Assistant creado: ${assistant.id}`);
        
        // 8. Guardar configuración
        console.log('\n💾 Guardando configuración...');
        const config = {
            timestamp: new Date().toISOString(),
            assistant: {
                id: assistant.id,
                name: assistant.name,
                model: assistant.model
            },
            vectorStore: {
                id: vectorStore.id,
                name: vectorStore.name,
                fileCount: uploadedFiles.length
            },
            uploadedFiles: uploadedFiles.map(file => ({
                id: file.id,
                filename: file.filename,
                bytes: file.bytes
            }))
        };
        
        const configPath = join(__dirname, '..', 'assistant-config.json');
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // 9. Resumen final
        console.log('\n🎉 ¡ASSISTANT CREADO EXITOSAMENTE!');
        console.log('\n📊 RESUMEN:');
        console.log(`   🤖 Assistant ID: ${assistant.id}`);
        console.log(`   🗃️ Vector Store ID: ${vectorStore.id}`);
        console.log(`   📁 Archivos subidos: ${uploadedFiles.length}`);
        console.log(`   🔧 Funciones: check_availability, escalate_to_human`);
        console.log('\n💡 Próximos pasos:');
        console.log(`   1. Actualizar OPENAI_ASSISTANT_ID en .env con: ${assistant.id}`);
        console.log(`   2. Reiniciar el bot para usar el nuevo assistant`);
        console.log(`   3. Probar funcionalidad completa`);
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Ejecutar
createAssistant(); 