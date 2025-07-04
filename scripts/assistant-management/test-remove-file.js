#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Prueba de Funcionalidad de Eliminación de Archivos\n');

async function testRemoveFile() {
    try {
        // Cargar configuración
        const configPath = join(__dirname, '..', '..', 'config', 'assistant-config.json');
        let config;
        try {
            config = JSON.parse(readFileSync(configPath, 'utf8'));
        } catch (error) {
            console.error('❌ No se encontró assistant-config.json');
            return;
        }
        
        console.log('📊 ESTADO ACTUAL:');
        console.log(`   Assistant ID: ${config.assistant?.id || 'No configurado'}`);
        console.log(`   Vector Store ID: ${config.vectorStore?.id || 'No configurado'}`);
        console.log(`   Archivos en vector store: ${config.uploadedFiles?.length || 0}`);
        
        if (config.uploadedFiles && config.uploadedFiles.length > 0) {
            console.log('\n📋 ARCHIVOS DISPONIBLES PARA ELIMINAR:');
            config.uploadedFiles.forEach((file, index) => {
                console.log(`   ${String(index + 1).padStart(2, '0')}. ${file.filename} (ID: ${file.id})`);
            });
            
            console.log('\n💡 PARA ELIMINAR UN ARCHIVO:');
            console.log('   npm run assistant remove-file "NOMBRE_ARCHIVO.txt"');
            console.log('   Ejemplo: npm run assistant remove-file "# 17_NUEVO_ARCHIVO.txt"');
        } else {
            console.log('\n📭 No hay archivos en el vector store para eliminar');
        }
        
        console.log('\n🔧 COMANDOS ÚTILES:');
        console.log('   npm run assistant list-vector-files    # Ver archivos en vector store');
        console.log('   npm run assistant list-files           # Ver archivos locales');
        console.log('   npm run assistant status               # Ver estado completo');
        console.log('   npm run assistant help                 # Ver todos los comandos');
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }
}

testRemoveFile(); 