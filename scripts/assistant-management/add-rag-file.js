#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, createReadStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📁 Agregando Archivo RAG al Vector Store...\n');

async function addRagFile() {
    try {
        const dotenv = await import('dotenv');
        dotenv.config();
        
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // Obtener argumentos
        const fileName = process.argv[2];
        if (!fileName) {
            console.error('❌ Uso: node scripts/add-rag-file.js "nombre_archivo.txt"');
            console.error('   Ejemplo: node scripts/add-rag-file.js "# 17_NUEVO_ARCHIVO.txt"');
            return;
        }
        
        // Cargar configuración
        const configPath = join(__dirname, '..', '..', 'config', 'assistant-config.json');
        let config;
        try {
            config = JSON.parse(readFileSync(configPath, 'utf8'));
        } catch (error) {
            console.error('❌ No se encontró assistant-config.json');
            return;
        }
        
        console.log(`✅ Vector Store ID: ${config.vectorStore.id}`);
        console.log(`📁 Archivo a agregar: ${fileName}`);
        
        // Verificar que el archivo existe
        const ragFolder = join(__dirname, '..', 'RAG OPEN AI ASSISTANCE');
        const filePath = join(ragFolder, fileName);
        
        try {
            readFileSync(filePath, 'utf8');
        } catch (error) {
            console.error(`❌ Archivo no encontrado: ${filePath}`);
            return;
        }
        
        // Subir archivo
        console.log('📤 Subiendo archivo...');
        const fileStream = createReadStream(filePath);
        
        const file = await openai.files.create({
            file: fileStream,
            purpose: 'assistants'
        });
        
        console.log(`✅ Archivo subido: ${file.id}`);
        
        // Agregar al vector store
        console.log('🗃️ Agregando al vector store...');
        await openai.vectorStores.files.create(config.vectorStore.id, {
            file_id: file.id
        });
        
        console.log('✅ Archivo agregado al vector store exitosamente!');
        console.log(`📋 File ID: ${file.id}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    const fileName = process.argv[2];
    if (!fileName) {
        console.error('❌ Uso: node add-rag-file.js "nombre_archivo.txt"');
        console.error('   Ejemplo: node add-rag-file.js "# 17_NUEVO_ARCHIVO.txt"');
        process.exit(1);
    }
    addRagFile(fileName);
}

export { addRagFile }; 