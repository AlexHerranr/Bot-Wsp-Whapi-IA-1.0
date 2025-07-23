import axios from 'axios';
import { threadPersistence } from '../src/utils/persistence/index.js';
import { whapiLabels } from '../src/utils/whapi/index.js';
import dotenv from 'dotenv';

dotenv.config();

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
const WHAPI_BASE_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

// Usuario para pruebas
const TEST_USER_ID = process.argv[2];
const CHAT_ID = process.argv[3] || `${TEST_USER_ID}@s.whatsapp.net`;

if (!TEST_USER_ID) {
    console.error(`${colors.red}❌ Error: Debes proporcionar un User ID${colors.reset}`);
    console.log(`${colors.yellow}📝 Uso: node test-labels-update.js <USER_ID> [CHAT_ID]${colors.reset}`);
    console.log(`${colors.yellow}📝 Ejemplo: node test-labels-update.js 573003913251${colors.reset}`);
    process.exit(1);
}

// Función para obtener info del chat (similar a getEnhancedContactInfo)
async function getChatInfo(chatId) {
    try {
        const endpoint = `${WHAPI_BASE_URL}/chats/${encodeURIComponent(chatId)}?token=${WHAPI_TOKEN}`;
        
        console.log(`${colors.cyan}🔍 Obteniendo info del chat...${colors.reset}`);
        
        const response = await axios.get(endpoint, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status === 200) {
            const chatData = response.data;
            
            return {
                name: chatData.name || chatData.first_name || 'Usuario',
                labels: chatData.labels || [],
                lastSeen: chatData.last_message?.timestamp,
                isContact: !!chatData.name,
                profilePic: chatData.profile_pic_url
            };
        }
    } catch (error) {
        console.error(`${colors.red}❌ Error obteniendo info del chat: ${error.message}${colors.reset}`);
        return null;
    }
}

// Función para mostrar el estado actual del thread
function displayThreadState(threadInfo, title) {
    console.log(`\n${colors.bright}${colors.blue}${title}${colors.reset}`);
    console.log('─'.repeat(60));
    
    if (!threadInfo) {
        console.log(`${colors.yellow}⚠️  No existe thread para este usuario${colors.reset}`);
        return;
    }
    
    console.log(`👤 Usuario: ${threadInfo.userName}`);
    console.log(`🏷️  Nombre enriquecido: ${threadInfo.name || 'No establecido'}`);
    console.log(`🆔 Thread ID: ${threadInfo.threadId}`);
    console.log(`💬 Chat ID: ${threadInfo.chatId}`);
    console.log(`📅 Creado: ${new Date(threadInfo.createdAt).toLocaleString()}`);
    console.log(`🕐 Última actividad: ${new Date(threadInfo.lastActivity).toLocaleString()}`);
    
    // Mostrar etiquetas
    if (threadInfo.labels && threadInfo.labels.length > 0) {
        const labelNames = threadInfo.labels.map(label => {
            if (typeof label === 'object' && label.name) {
                return `${label.name} (${label.color || 'sin color'})`;
            }
            return label;
        }).join(', ');
        console.log(`${colors.green}🏷️  Etiquetas: ${labelNames}${colors.reset}`);
    } else {
        console.log(`${colors.yellow}🏷️  Etiquetas: Sin etiquetas${colors.reset}`);
    }
}

// Función para comparar estados
function compareStates(before, after) {
    console.log(`\n${colors.bright}${colors.cyan}📊 COMPARACIÓN DE ESTADOS${colors.reset}`);
    console.log('═'.repeat(60));
    
    // Comparar etiquetas
    const beforeLabels = before?.labels || [];
    const afterLabels = after?.labels || [];
    
    const beforeLabelNames = beforeLabels.map(l => l.name || l).sort();
    const afterLabelNames = afterLabels.map(l => l.name || l).sort();
    
    const labelsChanged = JSON.stringify(beforeLabelNames) !== JSON.stringify(afterLabelNames);
    
    if (labelsChanged) {
        console.log(`${colors.green}✅ ETIQUETAS ACTUALIZADAS${colors.reset}`);
        console.log(`   Antes: ${beforeLabelNames.length === 0 ? 'Sin etiquetas' : beforeLabelNames.join(', ')}`);
        console.log(`   Después: ${afterLabelNames.length === 0 ? 'Sin etiquetas' : afterLabelNames.join(', ')}`);
        
        // Mostrar cambios específicos
        const added = afterLabelNames.filter(l => !beforeLabelNames.includes(l));
        const removed = beforeLabelNames.filter(l => !afterLabelNames.includes(l));
        
        if (added.length > 0) {
            console.log(`   ${colors.green}➕ Agregadas: ${added.join(', ')}${colors.reset}`);
        }
        if (removed.length > 0) {
            console.log(`   ${colors.red}➖ Removidas: ${removed.join(', ')}${colors.reset}`);
        }
    } else {
        console.log(`${colors.yellow}⏸️  Etiquetas sin cambios${colors.reset}`);
    }
    
    // Comparar otros campos
    if (before?.name !== after?.name) {
        console.log(`\n${colors.green}✅ NOMBRE ACTUALIZADO${colors.reset}`);
        console.log(`   Antes: ${before?.name || 'No establecido'}`);
        console.log(`   Después: ${after?.name || 'No establecido'}`);
    }
    
    if (before?.lastActivity !== after?.lastActivity) {
        console.log(`\n${colors.green}✅ ÚLTIMA ACTIVIDAD ACTUALIZADA${colors.reset}`);
        console.log(`   Antes: ${before ? new Date(before.lastActivity).toLocaleString() : 'N/A'}`);
        console.log(`   Después: ${after ? new Date(after.lastActivity).toLocaleString() : 'N/A'}`);
    }
}

// Función principal de prueba
async function testLabelsUpdate() {
    try {
        console.log(`${colors.bright}${colors.cyan}🧪 TEST DE ACTUALIZACIÓN AUTÁTICA DE ETIQUETAS${colors.reset}`);
        console.log('═'.repeat(60));
        console.log(`Usuario: ${TEST_USER_ID}`);
        console.log(`Chat ID: ${CHAT_ID}`);
        console.log('═'.repeat(60));
        
        // 1. Obtener estado actual del thread
        const beforeUpdate = threadPersistence.getThread(TEST_USER_ID);
        displayThreadState(beforeUpdate, '📌 ESTADO INICIAL DEL THREAD');
        
        // 2. Obtener información actual del chat desde WhatsApp
        console.log(`\n${colors.cyan}🔄 Obteniendo información actualizada desde WhatsApp...${colors.reset}`);
        const chatInfo = await getChatInfo(CHAT_ID);
        
        if (!chatInfo) {
            console.error(`${colors.red}❌ No se pudo obtener información del chat${colors.reset}`);
            return;
        }
        
        // Mostrar info obtenida de WhatsApp
        console.log(`\n${colors.bright}${colors.yellow}📱 INFORMACIÓN DE WHATSAPP${colors.reset}`);
        console.log('─'.repeat(60));
        console.log(`👤 Nombre: ${chatInfo.name}`);
        console.log(`📞 Es contacto: ${chatInfo.isContact ? 'Sí' : 'No'}`);
        if (chatInfo.labels && chatInfo.labels.length > 0) {
            const labelNames = chatInfo.labels.map(label => 
                `${label.name} (${label.color || 'sin color'})`
            ).join(', ');
            console.log(`🏷️  Etiquetas: ${labelNames}`);
        } else {
            console.log(`🏷️  Etiquetas: Sin etiquetas`);
        }
        
        // 3. Simular actualización automática (como haría el webhook)
        if (beforeUpdate) {
            console.log(`\n${colors.cyan}🔄 Simulando actualización automática de metadatos...${colors.reset}`);
            
            const updateResult = threadPersistence.updateThreadMetadata(TEST_USER_ID, {
                name: chatInfo.name,
                labels: chatInfo.labels,
                chatId: CHAT_ID
            });
            
            if (updateResult) {
                console.log(`${colors.green}✅ Metadatos actualizados exitosamente${colors.reset}`);
            } else {
                console.log(`${colors.red}❌ Error actualizando metadatos${colors.reset}`);
            }
            
            // Guardar cambios inmediatamente
            threadPersistence.saveThreads();
            console.log(`${colors.green}✅ Cambios guardados en threads.json${colors.reset}`);
        } else {
            console.log(`\n${colors.yellow}⚠️  No existe thread previo. Creando uno nuevo para demostración...${colors.reset}`);
            
            // Simular creación de thread nuevo
            threadPersistence.setThread(TEST_USER_ID, 'thread_DEMO_' + Date.now(), CHAT_ID, 'Usuario Demo');
            
            // Actualizar con labels
            threadPersistence.updateThreadMetadata(TEST_USER_ID, {
                name: chatInfo.name,
                labels: chatInfo.labels
            });
            
            threadPersistence.saveThreads();
            console.log(`${colors.green}✅ Thread creado y actualizado con etiquetas${colors.reset}`);
        }
        
        // 4. Obtener estado después de la actualización
        const afterUpdate = threadPersistence.getThread(TEST_USER_ID);
        displayThreadState(afterUpdate, '📌 ESTADO DESPUÉS DE LA ACTUALIZACIÓN');
        
        // 5. Comparar estados
        compareStates(beforeUpdate, afterUpdate);
        
        // 6. Verificar persistencia
        console.log(`\n${colors.cyan}🔍 Verificando persistencia...${colors.reset}`);
        const stats = threadPersistence.getStats();
        console.log(`📊 Total de threads: ${stats.totalThreads}`);
        console.log(`📊 Threads activos: ${stats.activeThreads}`);
        
        console.log(`\n${colors.bright}${colors.green}✅ PRUEBA COMPLETADA${colors.reset}`);
        console.log('\n💡 En producción, esta actualización ocurre automáticamente:');
        console.log('   - Al recibir cada mensaje del cliente');
        console.log('   - Al crear un thread nuevo');
        console.log('   - Después de procesar con OpenAI');
        
    } catch (error) {
        console.error(`${colors.red}❌ Error en la prueba: ${error.message}${colors.reset}`);
        console.error(error.stack);
    }
}

// Mostrar ayuda
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`\n${colors.bright}${colors.cyan}📋 PRUEBA DE ACTUALIZACIÓN DE ETIQUETAS${colors.reset}`);
    console.log('═'.repeat(60));
    console.log('Verifica que las etiquetas se actualicen automáticamente');
    console.log('\nUso: node test-labels-update.js <USER_ID> [CHAT_ID]');
    console.log('\nParámetros:');
    console.log('  USER_ID: ID del usuario (requerido)');
    console.log('  CHAT_ID: ID del chat (opcional, por defecto USER_ID@s.whatsapp.net)');
    console.log('\nEjemplos:');
    console.log('  node test-labels-update.js 573003913251');
    console.log('  node test-labels-update.js 573003913251 573003913251@s.whatsapp.net');
    console.log('\nEsta prueba:');
    console.log('  1. Muestra el estado actual del thread');
    console.log('  2. Obtiene información actualizada de WhatsApp');
    console.log('  3. Actualiza los metadatos (incluyendo etiquetas)');
    console.log('  4. Muestra el estado actualizado');
    console.log('  5. Compara los cambios realizados');
    process.exit(0);
}

// Ejecutar la prueba
testLabelsUpdate();
