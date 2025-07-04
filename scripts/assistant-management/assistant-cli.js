#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🤖 TeAlquilamos Assistant Management CLI\n');

// Función para mostrar ayuda
function showHelp() {
    console.log(`
📋 COMANDOS DISPONIBLES:

🔧 GESTIÓN BÁSICA:
  prompt                    Actualizar prompt principal
  functions                 Actualizar funciones del assistant
  add-file <archivo>        Agregar archivo RAG al vector store
  remove-file <archivo>     Eliminar archivo RAG del vector store
  update-all                Actualización inteligente completa

🚀 GESTIÓN AVANZADA:
  create                    Crear assistant nuevo desde cero
  remove-prompt             Eliminar archivo del prompt del vector store
  status                    Mostrar estado actual del assistant
  list-files                Listar archivos RAG locales
  list-vector-files         Listar archivos en el vector store

📚 DOCUMENTACIÓN:
  help                      Mostrar esta ayuda
  docs                      Abrir documentación

💡 EJEMPLOS:
  node assistant-cli.js prompt
  node assistant-cli.js add-file "# 17_NUEVO_ARCHIVO.txt"
  node assistant-cli.js remove-file "# 17_NUEVO_ARCHIVO.txt"
  node assistant-cli.js update-all
  node assistant-cli.js status
`);
}

// Función para ejecutar comandos
async function executeCommand(command, args) {
    try {
        switch (command) {
            case 'prompt':
                console.log('🔄 Actualizando prompt principal...');
                const { updatePrompt } = await import('./update-prompt.js');
                await updatePrompt();
                break;
                
            case 'functions':
                console.log('🔧 Actualizando funciones...');
                const { updateFunctions } = await import('./update-functions.js');
                await updateFunctions();
                break;
                
            case 'add-file':
                if (!args[0]) {
                    console.error('❌ Uso: add-file <nombre_archivo>');
                    return;
                }
                console.log(`📁 Agregando archivo: ${args[0]}`);
                const { addRagFile } = await import('./add-rag-file.js');
                await addRagFile(args[0]);
                break;
                
            case 'remove-file':
                if (!args[0]) {
                    console.error('❌ Uso: remove-file <nombre_archivo>');
                    return;
                }
                console.log(`🗑️ Eliminando archivo: ${args[0]}`);
                const { removeRagFile } = await import('./remove-rag-file.js');
                await removeRagFile(args[0]);
                break;
                
            case 'update-all':
                console.log('🔄 Actualización inteligente completa...');
                const { updateAssistant } = await import('./update-assistant-smart.js');
                await updateAssistant();
                break;
                
            case 'create':
                console.log('🚀 Creando assistant nuevo...');
                const { createAssistant } = await import('../create-new-assistant-v2.js');
                await createAssistant();
                break;
                
            case 'remove-prompt':
                console.log('🗑️ Eliminando archivo del prompt del vector store...');
                const { removePromptFile } = await import('./remove-prompt-file.js');
                await removePromptFile();
                break;
                
            case 'status':
                await showStatus();
                break;
                
            case 'list-files':
                await listFiles();
                break;
                
            case 'list-vector-files':
                await listVectorFiles();
                break;
                
            case 'docs':
                console.log('📚 Abriendo documentación...');
                console.log('📖 Archivo: docs/ASSISTANT_MANAGEMENT.md');
                break;
                
            case 'cleanup-threads':
                console.log('🧹 Limpiando todos los threads/conversaciones...');
                const { cleanupThreads } = await import('./cleanup-threads.js');
                await cleanupThreads();
                break;
                
            case 'cleanup-threads-local':
                console.log('🧹 Limpiando solo los threadId locales (otros datos conservados)...');
                const { cleanupThreadsLocal } = await import('./cleanup-threads-local.js');
                await cleanupThreadsLocal();
                break;
                
            case 'help':
            default:
                showHelp();
                break;
        }
    } catch (error) {
        console.error('❌ Error ejecutando comando:', error.message);
    }
}

// Función para mostrar estado
async function showStatus() {
    try {
        const dotenv = await import('dotenv');
        dotenv.config();
        
        const fs = await import('fs');
        const path = await import('path');
        
        console.log('📊 ESTADO DEL ASSISTANT:\n');
        
        // Verificar .env
        const assistantId = process.env.OPENAI_ASSISTANT_ID;
        console.log(`🤖 Assistant ID: ${assistantId || '❌ No configurado'}`);
        
        // Verificar configuración
        const configPath = join(__dirname, '..', '..', 'config', 'assistant-config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log(`🗃️ Vector Store ID: ${config.vectorStore?.id || '❌ No encontrado'}`);
            console.log(`📁 Archivos RAG: ${config.uploadedFiles?.length || 0}`);
            console.log(`🕒 Última actualización: ${config.lastUpdate || '❌ No registrada'}`);
        } else {
            console.log('❌ No se encontró assistant-config.json');
        }
        
        // Verificar archivos RAG
        const ragFolder = join(__dirname, '..', '..', 'RAG OPEN AI ASSISTANCE');
        if (fs.existsSync(ragFolder)) {
            const files = fs.readdirSync(ragFolder)
                .filter(file => file.endsWith('.txt') && file.startsWith('#') && !file.includes('PROPOSITO_RAG_SISTEMA'))
                .sort();
            console.log(`📂 Archivos RAG locales: ${files.length}`);
        }
        
    } catch (error) {
        console.error('❌ Error obteniendo estado:', error.message);
    }
}

// Función para listar archivos
async function listFiles() {
    try {
        const fs = await import('fs');
        const path = await import('path');
        
        console.log('📁 ARCHIVOS RAG LOCALES:\n');
        
        const ragFolder = join(__dirname, '..', '..', 'RAG OPEN AI ASSISTANCE');
        if (fs.existsSync(ragFolder)) {
            const files = fs.readdirSync(ragFolder)
                .filter(file => file.endsWith('.txt') && file.startsWith('#') && !file.includes('PROPOSITO_RAG_SISTEMA'))
                .sort();
            
            files.forEach((file, index) => {
                const filePath = join(ragFolder, file);
                const stats = fs.statSync(filePath);
                console.log(`${String(index + 1).padStart(2, '0')}. ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
            });
        } else {
            console.log('❌ Carpeta RAG no encontrada');
        }
        
    } catch (error) {
        console.error('❌ Error listando archivos:', error.message);
    }
}

// Función para listar archivos en el vector store
async function listVectorFiles() {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const dotenv = await import('dotenv');
        dotenv.config();
        
        console.log('🗃️ ARCHIVOS EN EL VECTOR STORE:\n');
        
        // Cargar configuración
        const configPath = join(__dirname, '..', '..', 'config', 'assistant-config.json');
        if (!fs.existsSync(configPath)) {
            console.log('❌ No se encontró assistant-config.json');
            return;
        }
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const uploadedFiles = config.uploadedFiles || [];
        
        if (uploadedFiles.length === 0) {
            console.log('📭 No hay archivos en el vector store');
            return;
        }
        
        uploadedFiles.forEach((file, index) => {
            console.log(`${String(index + 1).padStart(2, '0')}. ${file.filename} (ID: ${file.id})`);
        });
        
        console.log(`\n📊 Total: ${uploadedFiles.length} archivos`);
        
    } catch (error) {
        console.error('❌ Error listando archivos del vector store:', error.message);
    }
}

// Procesar argumentos
const args = process.argv.slice(2);
const command = args[0] || 'help';
const commandArgs = args.slice(1);

// Ejecutar comando
executeCommand(command, commandArgs); 