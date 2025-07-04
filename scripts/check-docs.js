#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📋 DETECTOR DE DOCUMENTACIÓN PENDIENTE\n');

// Función para buscar archivos recursivamente
function findFiles(dir, extensions = ['.ts', '.js']) {
    const files = [];
    
    function scanDir(currentDir) {
        try {
            const items = readdirSync(currentDir);
            
            for (const item of items) {
                // Saltar directorios excluidos
                if (['node_modules', 'dist', '.git', 'tmp', 'logs'].includes(item)) {
                    continue;
                }
                
                const fullPath = join(currentDir, item);
                const stat = statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDir(fullPath);
                } else if (stat.isFile()) {
                    const ext = item.substring(item.lastIndexOf('.'));
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Ignorar errores de acceso a directorios
        }
    }
    
    scanDir(dir);
    return files;
}

// Función para extraer tags @docs de un archivo
function extractDocsTags(filePath) {
    try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const docsTags = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Buscar diferentes formatos de tags
            const patterns = [
                /\/\/\s*@docs:\s*(.+)/,           // @docs: archivo.md
                /\/\/\s*@docs-update:\s*(.+)/,   // @docs-update: archivo.md
                /\/\/\s*@documentation:\s*(.+)/   // @documentation: archivo.md
            ];
            
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    const docFile = match[1].trim().replace(/['"]/g, '');
                    const changeMatch = lines[i + 1]?.match(/\/\/\s*@change:\s*["'](.+)["']/);
                    const dateMatch = lines[i + 2]?.match(/\/\/\s*@date:\s*(.+)/);
                    
                    docsTags.push({
                        file: docFile,
                        change: changeMatch ? changeMatch[1] : 'Cambio no especificado',
                        date: dateMatch ? dateMatch[1].trim() : 'Fecha no especificada',
                        lineNumber: i + 1
                    });
                }
            }
        }
        
        return docsTags;
    } catch (error) {
        return [];
    }
}

// Función principal
async function checkDocs() {
    try {
        const projectRoot = join(__dirname, '..');
        
        console.log('🔍 Escaneando archivos de código...');
        
        // Buscar archivos de código
        const codeFiles = findFiles(projectRoot, ['.ts', '.js']);
        console.log(`📁 Encontrados ${codeFiles.length} archivos de código`);
        
        // Extraer tags de documentación
        const pendingUpdates = [];
        let totalTags = 0;
        
        for (const filePath of codeFiles) {
            const relativePath = filePath.replace(projectRoot, '').replace(/\\/g, '/').replace(/^\//, '');
            const docsTags = extractDocsTags(filePath);
            
            if (docsTags.length > 0) {
                totalTags += docsTags.length;
                pendingUpdates.push({
                    file: relativePath,
                    tags: docsTags
                });
            }
        }
        
        console.log(`🏷️  Tags encontrados: ${totalTags}\n`);
        
        // Mostrar resultados
        if (pendingUpdates.length === 0) {
            console.log('✅ ¡Excelente! No hay documentación pendiente de actualización.');
            return;
        }
        
        console.log(`📊 RESUMEN:`);
        console.log(`   📁 Archivos con tags: ${pendingUpdates.length}`);
        console.log(`   🏷️  Total de tags: ${totalTags}\n`);
        
        console.log('📋 DOCUMENTACIÓN PENDIENTE:\n');
        
        for (const item of pendingUpdates) {
            console.log(`📄 ${item.file}`);
            
            for (const tag of item.tags) {
                console.log(`   🏷️  ${tag.file}`);
                console.log(`      💬 ${tag.change}`);
                console.log(`      📅 ${tag.date}`);
                console.log(`      📍 Línea ${tag.lineNumber}\n`);
            }
        }
        
        console.log('\n🚀 PRÓXIMOS PASOS:');
        console.log('1. Revisa los archivos marcados arriba');
        console.log('2. Actualiza la documentación correspondiente');
        console.log('3. Elimina los tags @docs una vez actualizado');
        console.log('4. O pide actualización masiva al asistente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Ejecutar
checkDocs(); 