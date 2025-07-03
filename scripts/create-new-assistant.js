#!/usr/bin/env node

import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const RAG_FOLDER = path.join(__dirname, '..', 'RAG OPEN AI ASSISTANCE');
const ASSISTANT_NAME = 'TeAlquilamos Bot v2.0 - Cartagena Apartments';
const VECTOR_STORE_NAME = 'TeAlquilamos-RAG-Knowledge-Base-v2';

console.log('🚀 Iniciando creación de nuevo assistant...\n');

// Función para leer el prompt principal
function readMainPrompt() {
    try {
        const promptPath = path.join(RAG_FOLDER, '# 00_INSTRUCCIONES_DEL_ASISTENTE.txt');
        console.log(`📖 Leyendo prompt desde: ${promptPath}`);
        const content = fs.readFileSync(promptPath, 'utf8');
        console.log(`✅ Prompt principal leído (${content.length} caracteres)`);
        return content;
    } catch (error) {
        console.error('❌ Error leyendo prompt principal:', error.message);
        throw error;
    }
}

// Función para obtener archivos RAG
function getRagFiles() {
    try {
        console.log(`📂 Escaneando directorio: ${RAG_FOLDER}`);
        const files = fs.readdirSync(RAG_FOLDER);
        console.log(`📋 Total archivos encontrados: ${files.length}`);
        
        const ragFiles = files.filter(file => 
            file.endsWith('.txt') && 
            file.startsWith('#') &&
            !file.includes('PROPOSITO_RAG_SISTEMA')
        ).sort();
        
        console.log(`📁 Encontrados ${ragFiles.length} archivos RAG:`);
        ragFiles.forEach(file => console.log(`   - ${file}`));
        return ragFiles;
    } catch (error) {
        console.error('❌ Error obteniendo archivos RAG:', error.message);
        throw error;
    }
}

// Función principal
async function main() {
    try {
        // 0. Verificar API key
        console.log('🔑 Verificando API key...');
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno');
        }
        console.log('✅ API key encontrada');
        
        // 1. Leer prompt principal
        console.log('\n📖 Paso 1: Leyendo prompt principal...');
        const mainPrompt = readMainPrompt();
        
        // 2. Obtener archivos RAG
        console.log('\n📁 Paso 2: Obteniendo archivos RAG...');
        const ragFiles = getRagFiles();
        
        // 3. Subir archivos
        console.log('\n📤 Paso 3: Subiendo archivos al Files API...');
        const uploadedFiles = [];
        
        for (const fileName of ragFiles) {
            const filePath = path.join(RAG_FOLDER, fileName);
            const fileStream = fs.createReadStream(filePath);
            
            const file = await openai.files.create({
                file: fileStream,
                purpose: 'assistants'
            });
            
            uploadedFiles.push(file);
            console.log(`✅ ${fileName} -> ${file.id}`);
            
            // Pausa para evitar rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 4. Crear vector store
        console.log('\n🗃️ Creando vector store...');
        const vectorStore = await openai.beta.vectorStores.create({
            name: VECTOR_STORE_NAME,
            file_ids: uploadedFiles.map(file => file.id)
        });
        
        console.log(`✅ Vector store creado: ${vectorStore.id}`);
        
        // 5. Crear assistant
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
                        description: "Consulta disponibilidad de apartamentos en fechas específicas",
                        parameters: {
                            type: "object",
                            properties: {
                                startDate: { type: "string", description: "Fecha inicio YYYY-MM-DD" },
                                endDate: { type: "string", description: "Fecha salida YYYY-MM-DD" }
                            },
                            required: ["startDate", "endDate"]
                        }
                    }
                },
                {
                    type: "function", 
                    function: {
                        name: "escalate_to_human",
                        description: "Transfiere conversación a agente humano",
                        parameters: {
                            type: "object",
                            properties: {
                                reason: { type: "string", description: "Razón de la escalación" },
                                context: { type: "object", description: "Contexto adicional" }
                            },
                            required: ["reason", "context"]
                        }
                    }
                }
            ],
            tool_resources: {
                file_search: {
                    vector_store_ids: [vectorStore.id]
                }
            }
        });
        
        console.log(`✅ Assistant creado: ${assistant.id}`);
        
        // 6. Guardar configuración
        const config = {
            timestamp: new Date().toISOString(),
            assistant_id: assistant.id,
            vector_store_id: vectorStore.id,
            files_uploaded: uploadedFiles.length
        };
        
        fs.writeFileSync(
            path.join(__dirname, '..', 'assistant-config.json'), 
            JSON.stringify(config, null, 2)
        );
        
        console.log('\n🎉 ¡COMPLETADO EXITOSAMENTE!');
        console.log(`🤖 Assistant ID: ${assistant.id}`);
        console.log(`🗃️ Vector Store ID: ${vectorStore.id}`);
        console.log(`📁 Archivos: ${uploadedFiles.length}`);
        console.log('\n💡 Actualiza OPENAI_ASSISTANT_ID en tu .env con:', assistant.id);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Ejecutar
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 