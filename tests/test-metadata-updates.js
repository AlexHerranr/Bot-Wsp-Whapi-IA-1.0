import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const THREADS_FILE = path.join(__dirname, '..', 'tmp', 'threads.json');

// Colores para la consola
const COLORS = {
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
};

// Leer threads actuales
function readThreads() {
    try {
        if (!fs.existsSync(THREADS_FILE)) {
            console.log(`${COLORS.YELLOW}⚠️ No existe threads.json${COLORS.RESET}`);
            return [];
        }
        
        const content = fs.readFileSync(THREADS_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`${COLORS.RED}❌ Error leyendo threads:${COLORS.RESET}`, error.message);
        return [];
    }
}

// Verificar metadatos de un thread
function checkThreadMetadata(userId, thread) {
    console.log(`\n${COLORS.BLUE}📋 Verificando thread: ${userId}${COLORS.RESET}`);
    console.log('═'.repeat(50));
    
    const checks = {
        threadId: { exists: !!thread.threadId, value: thread.threadId },
        chatId: { exists: !!thread.chatId, value: thread.chatId },
        userName: { exists: !!thread.userName, value: thread.userName },
        createdAt: { exists: !!thread.createdAt, value: thread.createdAt },
        lastActivity: { exists: !!thread.lastActivity, value: thread.lastActivity },
        name: { exists: !!thread.name, value: thread.name },
        labels: { exists: !!thread.labels, value: thread.labels }
    };
    
    // Mostrar cada campo
    Object.entries(checks).forEach(([field, info]) => {
        const icon = info.exists ? '✅' : '❌';
        const color = info.exists ? COLORS.GREEN : COLORS.RED;
        console.log(`${color}${icon} ${field}:${COLORS.RESET} ${info.value || 'NO DEFINIDO'}`);
    });
    
    // Verificar tiempos
    if (thread.createdAt && thread.lastActivity) {
        const created = new Date(thread.createdAt);
        const lastActivity = new Date(thread.lastActivity);
        const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        
        console.log(`\n⏰ Creado: ${created.toLocaleString('es-ES')}`);
        console.log(`⏰ Última actividad: ${lastActivity.toLocaleString('es-ES')}`);
        console.log(`⏰ Horas desde última actividad: ${hoursSinceActivity.toFixed(1)}h`);
        
        if (hoursSinceActivity > 24) {
            console.log(`${COLORS.YELLOW}⚠️ Han pasado más de 24h - Se actualizarán labels/name/userName en próximo mensaje${COLORS.RESET}`);
        }
    }
    
    return checks;
}

// Función principal
function runMetadataCheck() {
    console.log(`${COLORS.BLUE}🔍 VERIFICACIÓN DE METADATOS EN THREADS${COLORS.RESET}`);
    console.log('═'.repeat(50));
    
    const threads = readThreads();
    
    if (threads.length === 0) {
        console.log(`${COLORS.YELLOW}⚠️ No hay threads para verificar${COLORS.RESET}`);
        return;
    }
    
    console.log(`📊 Total de threads: ${threads.length}`);
    
    let summary = {
        total: threads.length,
        complete: 0,
        missing: {
            threadId: 0,
            chatId: 0,
            userName: 0,
            createdAt: 0,
            lastActivity: 0,
            name: 0,
            labels: 0
        }
    };
    
    // Verificar cada thread
    threads.forEach(([userId, thread]) => {
        const checks = checkThreadMetadata(userId, thread);
        
        // Contar campos faltantes
        let isComplete = true;
        Object.entries(checks).forEach(([field, info]) => {
            if (!info.exists) {
                summary.missing[field]++;
                isComplete = false;
            }
        });
        
        if (isComplete) {
            summary.complete++;
        }
    });
    
    // Mostrar resumen
    console.log(`\n${COLORS.BLUE}📊 RESUMEN FINAL${COLORS.RESET}`);
    console.log('═'.repeat(50));
    console.log(`✅ Threads completos: ${summary.complete}/${summary.total}`);
    
    if (summary.complete < summary.total) {
        console.log(`\n${COLORS.YELLOW}⚠️ Campos faltantes:${COLORS.RESET}`);
        Object.entries(summary.missing).forEach(([field, count]) => {
            if (count > 0) {
                console.log(`  ❌ ${field}: ${count} threads sin este campo`);
            }
        });
    } else {
        console.log(`\n${COLORS.GREEN}✅ ¡Todos los threads tienen todos los campos!${COLORS.RESET}`);
    }
    
    // Recomendaciones
    console.log(`\n${COLORS.BLUE}💡 RECOMENDACIONES:${COLORS.RESET}`);
    if (summary.missing.userName > 0) {
        console.log('- userName faltante: Se actualizará en el próximo mensaje del cliente');
    }
    if (summary.missing.name > 0) {
        console.log('- name faltante: Se obtendrá de WhatsApp en el próximo mensaje');
    }
    if (summary.missing.labels > 0) {
        console.log('- labels faltante: Normal si el contacto no tiene etiquetas asignadas');
    }
}

// Función para simular actualización después de 24h
function simulateOldThread(userId) {
    console.log(`\n${COLORS.YELLOW}🔧 Simulando thread antiguo para ${userId}...${COLORS.RESET}`);
    
    const threads = readThreads();
    const threadIndex = threads.findIndex(([id]) => id === userId);
    
    if (threadIndex === -1) {
        console.log(`${COLORS.RED}❌ No se encontró thread para ${userId}${COLORS.RESET}`);
        return;
    }
    
    // Modificar lastActivity a hace 25 horas
    const oldDate = new Date(Date.now() - (25 * 60 * 60 * 1000));
    threads[threadIndex][1].lastActivity = oldDate.toISOString();
    
    // Guardar
    fs.writeFileSync(THREADS_FILE, JSON.stringify(threads, null, 2));
    console.log(`${COLORS.GREEN}✅ Thread modificado - lastActivity: hace 25 horas${COLORS.RESET}`);
    console.log('Ahora cuando este usuario envíe un mensaje, se actualizarán name/userName/labels');
}

// Manejar argumentos
const command = process.argv[2];
const userId = process.argv[3];

if (command === '--simulate-old' && userId) {
    simulateOldThread(userId);
} else if (command === '--help' || command === '-h') {
    console.log(`\n${COLORS.BLUE}📋 AYUDA - Verificador de Metadatos${COLORS.RESET}`);
    console.log('═'.repeat(50));
    console.log('Verifica que todos los metadatos se guarden correctamente\n');
    console.log('Uso:');
    console.log('  node test-metadata-updates.js              # Verificar todos los threads');
    console.log('  node test-metadata-updates.js --simulate-old <userId>  # Simular thread antiguo');
    console.log('\nEjemplos:');
    console.log('  node test-metadata-updates.js');
    console.log('  node test-metadata-updates.js --simulate-old 573003913251');
} else {
    runMetadataCheck();
} 