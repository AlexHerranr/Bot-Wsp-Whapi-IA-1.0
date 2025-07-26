#!/usr/bin/env node

const { join } = require('path');

console.log('🧹 Limpiando todos los threads/conversaciones del assistant...\n');

async function cleanupThreads() {
    try {
        require('dotenv').config();
        
        const OpenAI = require('openai');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Obtener el assistant ID
        let assistantId = process.env.OPENAI_ASSISTANT_ID;
        if (!assistantId) {
            // Intentar cargar desde config
            try {
                const configPath = join(__dirname, '..', '..', 'config', 'assistant-config.json');
                const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
                assistantId = config.assistant?.id;
            } catch {}
        }
        if (!assistantId) {
            console.error('❌ No se encontró el Assistant ID.');
            return;
        }
        console.log(`🤖 Assistant ID: ${assistantId}`);

        // Listar todos los threads
        let threads = [];
        let after = undefined;
        let page = 1;
        do {
            const response = await openai.beta.threads.list({ limit: 100, after });
            if (response.data && response.data.length > 0) {
                threads = threads.concat(response.data);
                after = response.last_id;
                page++;
            } else {
                break;
            }
        } while (after);

        if (threads.length === 0) {
            console.log('📭 No hay threads/conversaciones para eliminar.');
            return;
        }

        console.log(`🗑️ Eliminando ${threads.length} threads...`);
        let deleted = 0;
        for (const thread of threads) {
            try {
                await openai.beta.threads.del(thread.id);
                deleted++;
                if (deleted % 10 === 0) {
                    console.log(`   - ${deleted} eliminados...`);
                }
            } catch (err) {
                console.error(`❌ Error eliminando thread ${thread.id}:`, err.message);
            }
        }
        console.log(`\n🎉 ¡Eliminados ${deleted} threads/conversaciones!`);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

if (require.main === module) {
    cleanupThreads();
}

module.exports = { cleanupThreads }; 