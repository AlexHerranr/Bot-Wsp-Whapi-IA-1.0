#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync, createReadStream, writeFileSync, statSync } from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔄 Sistema de Actualización TeAlquilamos Assistant\n');

async function updateAssistant() {
    try {
        // 1. Cargar dependencias
        console.log('📦 Cargando configuración...');
        const dotenv = await import('dotenv');
        dotenv.config();
        
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // Cargar configuración existente
        const configPath = join(__dirname, '..', '..', 'config', 'assistant-config.json');
        let config;
        try {
            config = JSON.parse(readFileSync(configPath, 'utf8'));
        } catch (error) {
            console.error('❌ No se encontró assistant-config.json. Ejecuta create-new-assistant-v2.js primero.');
            return;
        }
        
        console.log(`✅ Assistant ID: ${config.assistant.id}`);
        console.log(`✅ Vector Store ID: ${config.vectorStore.id}`);
        
        // 2. Detectar cambios
        const RAG_FOLDER = join(__dirname, '..', '..', 'RAG OPEN AI ASSISTANCE');
        const updates = await detectChanges(config, RAG_FOLDER);
        
        if (updates.totalChanges === 0) {
            console.log('\n✅ No hay cambios detectados. El assistant está actualizado.');
            return;
        }
        
        console.log(`\n📊 Cambios detectados: ${updates.totalChanges}`);
        if (updates.promptChanged) console.log('   🔄 Prompt principal modificado');
        if (updates.newFiles.length > 0) console.log(`   ➕ ${updates.newFiles.length} archivos nuevos`);
        if (updates.modifiedFiles.length > 0) console.log(`   📝 ${updates.modifiedFiles.length} archivos modificados`);
        
        // 3. Actualizar prompt si cambió
        if (updates.promptChanged) {
            await updateAssistantPrompt(openai, config, RAG_FOLDER);
        }
        
        // 4. Actualizar vector store
        if (updates.vectorStoreChanges > 0) {
            await updateVectorStoreFiles(openai, config, updates, RAG_FOLDER);
        }
        
        // 5. Guardar configuración actualizada
        await updateConfig(config, RAG_FOLDER);
        
        console.log('\n🎉 ¡Actualización completada exitosamente!');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        process.exit(1);
    }
}

// Detectar qué cambió
async function detectChanges(config, ragFolder) {
    console.log('\n🔍 Detectando cambios...');
    
    const changes = {
        promptChanged: false,
        newFiles: [],
        modifiedFiles: [],
        vectorStoreChanges: 0,
        totalChanges: 0
    };
    
    // Verificar prompt principal
    const promptPath = join(ragFolder, '# 00_INSTRUCCIONES_DEL_ASISTENTE.txt');
    const currentPromptHash = getFileHash(promptPath);
    const lastPromptHash = config.promptHash || '';
    
    if (currentPromptHash !== lastPromptHash) {
        changes.promptChanged = true;
        changes.totalChanges++;
        console.log('   🔄 Prompt principal cambió');
    }
    
    // Verificar archivos RAG
    const currentFiles = readdirSync(ragFolder)
        .filter(file => file.endsWith('.txt') && file.startsWith('#') && !file.includes('PROPOSITO_RAG_SISTEMA'))
        .sort();
    
    const previousFiles = config.uploadedFiles || [];
    const previousFileMap = new Map(previousFiles.map(f => [f.filename, f]));
    
    // Detectar nuevos y modificados
    for (const fileName of currentFiles) {
        const currentHash = getFileHash(join(ragFolder, fileName));
        const previousFile = previousFileMap.get(fileName);
        
        if (!previousFile) {
            changes.newFiles.push(fileName);
            changes.vectorStoreChanges++;
            console.log(`   ➕ Nuevo: ${fileName}`);
        } else if (previousFile.hash !== currentHash) {
            changes.modifiedFiles.push({ fileName, previousId: previousFile.id });
            changes.vectorStoreChanges++;
            console.log(`   📝 Modificado: ${fileName}`);
        }
    }
    
    changes.totalChanges += changes.vectorStoreChanges;
    return changes;
}

// Obtener hash de archivo
function getFileHash(filePath) {
    try {
        const content = readFileSync(filePath, 'utf8');
        return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
        return '';
    }
}

// Actualizar prompt del assistant
async function updateAssistantPrompt(openai, config, ragFolder) {
    console.log('\n📝 Actualizando prompt principal...');
    
    const promptPath = join(ragFolder, '# 00_INSTRUCCIONES_DEL_ASISTENTE.txt');
    const newPrompt = readFileSync(promptPath, 'utf8');
    
    await openai.beta.assistants.update(config.assistant.id, {
        instructions: newPrompt
    });
    
    console.log('✅ Prompt principal actualizado');
}

// Actualizar archivos del vector store
async function updateVectorStoreFiles(openai, config, updates, ragFolder) {
    console.log('\n🗃️ Actualizando vector store...');
    
    // Subir archivos nuevos
    for (const fileName of updates.newFiles) {
        console.log(`   📤 Subiendo: ${fileName}`);
        const filePath = join(ragFolder, fileName);
        const fileStream = createReadStream(filePath);
        
        const file = await openai.files.create({
            file: fileStream,
            purpose: 'assistants'
        });
        
        await openai.vectorStores.files.create(config.vectorStore.id, {
            file_id: file.id
        });
        
        console.log(`   ✅ ${fileName} -> ${file.id}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Actualizar archivos modificados
    for (const fileInfo of updates.modifiedFiles) {
        console.log(`   🔄 Actualizando: ${fileInfo.fileName}`);
        
        // Eliminar anterior del vector store
        try {
            await openai.vectorStores.files.del(config.vectorStore.id, fileInfo.previousId);
        } catch (error) {
            console.log(`   ⚠️ No se pudo eliminar versión anterior`);
        }
        
        // Subir nueva versión
        const filePath = join(ragFolder, fileInfo.fileName);
        const fileStream = createReadStream(filePath);
        
        const file = await openai.files.create({
            file: fileStream,
            purpose: 'assistants'
        });
        
        await openai.vectorStores.files.create(config.vectorStore.id, {
            file_id: file.id
        });
        
        console.log(`   ✅ ${fileInfo.fileName} -> ${file.id}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// Actualizar configuración
async function updateConfig(config, ragFolder) {
    console.log('\n💾 Actualizando configuración...');
    
    // Actualizar hash del prompt
    const promptPath = join(ragFolder, '# 00_INSTRUCCIONES_DEL_ASISTENTE.txt');
    config.promptHash = getFileHash(promptPath);
    
    // Actualizar lista de archivos
    const currentFiles = readdirSync(ragFolder)
        .filter(file => file.endsWith('.txt') && file.startsWith('#') && !file.includes('PROPOSITO_RAG_SISTEMA'))
        .sort();
    
    config.uploadedFiles = currentFiles.map(fileName => {
        const filePath = join(ragFolder, fileName);
        return {
            filename: fileName,
            hash: getFileHash(filePath),
            id: 'updated-' + Date.now(),
            bytes: statSync(filePath).size
        };
    });
    
    config.lastUpdate = new Date().toISOString();
    
    const configPath = join(__dirname, '..', '..', 'config', 'assistant-config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ Configuración actualizada');
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    updateAssistant();
}

export { updateAssistant }; 