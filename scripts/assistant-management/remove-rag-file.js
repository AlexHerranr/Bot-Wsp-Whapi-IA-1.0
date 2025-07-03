#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🗑️ Eliminando Archivo RAG del Vector Store...\n');

async function removeRagFile(fileName) {
    try {
        const dotenv = await import('dotenv');
        dotenv.config();
        
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // Cargar configuración
        const configPath = join(__dirname, '..', '..', 'assistant-config.json');
        let config;
        try {
            config = JSON.parse(readFileSync(configPath, 'utf8'));
        } catch (error) {
            console.error('❌ No se encontró assistant-config.json');
            return;
        }
        
        console.log(`✅ Vector Store ID: ${config.vectorStore.id}`);
        console.log(`📁 Archivo a eliminar: ${fileName}`);
        
        // Buscar el archivo en la configuración
        const uploadedFiles = config.uploadedFiles || [];
        const fileToRemove = uploadedFiles.find(f => f.filename === fileName);
        
        if (!fileToRemove) {
            console.error(`❌ Archivo "${fileName}" no encontrado en el vector store`);
            console.log('\n📋 Archivos disponibles:');
            uploadedFiles.forEach((file, index) => {
                console.log(`   ${String(index + 1).padStart(2, '0')}. ${file.filename} (ID: ${file.id})`);
            });
            return;
        }
        
        // Proteger el prompt principal
        if (fileName === '# 00_INSTRUCCIONES_DEL_ASISTENTE.txt') {
            console.error('❌ NO SE PUEDE ELIMINAR EL PROMPT PRINCIPAL');
            console.log('\n⚠️  Este archivo contiene las instrucciones principales del assistant.');
            console.log('   Para modificarlo, usa: npm run assistant prompt');
            console.log('   Para eliminarlo del vector store, primero actualiza el assistant.');
            return;
        }
        
        console.log(`🔍 Encontrado: ${fileToRemove.filename} (ID: ${fileToRemove.id})`);
        
        // Confirmar eliminación
        console.log('\n⚠️  ¿Estás seguro de que quieres eliminar este archivo?');
        console.log(`   Archivo: ${fileToRemove.filename}`);
        console.log(`   ID: ${fileToRemove.id}`);
        console.log('\n   Esta acción no se puede deshacer.');
        
        // En un entorno interactivo, aquí se pediría confirmación
        // Por ahora, procedemos directamente
        console.log('\n🗑️ Procediendo con la eliminación...');
        
        // Eliminar del vector store
        console.log('🗃️ Eliminando del vector store...');
        await openai.vectorStores.files.del(config.vectorStore.id, fileToRemove.id);
        
        // Eliminar el archivo de OpenAI (opcional, pero recomendado)
        console.log('📁 Eliminando archivo de OpenAI...');
        try {
            await openai.files.del(fileToRemove.id);
            console.log('✅ Archivo eliminado de OpenAI');
        } catch (error) {
            console.log('⚠️ No se pudo eliminar de OpenAI (puede estar en uso)');
        }
        
        // Actualizar configuración
        console.log('📝 Actualizando configuración...');
        const updatedFiles = uploadedFiles.filter(f => f.filename !== fileName);
        config.uploadedFiles = updatedFiles;
        config.lastUpdate = new Date().toISOString();
        
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log('\n🎉 ¡Archivo eliminado exitosamente!');
        console.log(`📊 Archivos restantes: ${updatedFiles.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('   Detalles:', error.response.data);
        }
    }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    const fileName = process.argv[2];
    if (!fileName) {
        console.error('❌ Uso: node remove-rag-file.js "nombre_archivo.txt"');
        console.error('   Ejemplo: node remove-rag-file.js "# 17_NUEVO_ARCHIVO.txt"');
        process.exit(1);
    }
    removeRagFile(fileName);
}

export { removeRagFile }; 