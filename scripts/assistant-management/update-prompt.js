#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔄 Actualizando Prompt Principal...\n');

async function updatePrompt() {
    try {
        const dotenv = await import('dotenv');
        dotenv.config();
        
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        const assistantId = process.env.OPENAI_ASSISTANT_ID;
        if (!assistantId) {
            console.error('❌ OPENAI_ASSISTANT_ID no encontrado en .env');
            return;
        }
        
        console.log(`✅ Assistant ID: ${assistantId}`);
        
        // Leer prompt principal
        const ragFolder = join(__dirname, '..', '..', 'RAG OPEN AI ASSISTANCE');
        const promptPath = join(ragFolder, '# 00_INSTRUCCIONES_DEL_ASISTENTE.txt');
        const newPrompt = readFileSync(promptPath, 'utf8');
        
        console.log(`📝 Leyendo prompt (${newPrompt.length} caracteres)...`);
        
        // Actualizar assistant
        console.log('🔄 Actualizando prompt principal...');
        await openai.beta.assistants.update(assistantId, {
            instructions: newPrompt
        });
        
        console.log('✅ Prompt principal actualizado exitosamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    updatePrompt();
}

export { updatePrompt };
