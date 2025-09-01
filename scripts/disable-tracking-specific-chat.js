#!/usr/bin/env node

/**
 * Script PROVISIONAL para deshabilitar el guardado de tokens y thread
 * SOLO para el chatId 3003913251
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SPECIFIC_CHAT_ID = '3003913251';

async function disableTrackingForSpecificChat() {
    console.log('🔧 CONFIGURACIÓN PROVISIONAL - DESHABILITANDO TRACKING');
    console.log('=' .repeat(60));
    console.log(`📱 ChatId objetivo: ${SPECIFIC_CHAT_ID}`);
    console.log('=' .repeat(60));
    
    try {
        // 1. Verificar si el chat existe
        console.log('\n1️⃣ Verificando si el chat existe...');
        const existingChat = await prisma.chat.findUnique({
            where: { chatId: SPECIFIC_CHAT_ID }
        });
        
        if (existingChat) {
            console.log('✅ Chat encontrado');
            console.log(`   - Thread actual: ${existingChat.threadId || 'null'}`);
            console.log(`   - Tokens actuales: ${existingChat.totalTokens || 0}`);
            
            // 2. Limpiar datos existentes
            console.log('\n2️⃣ Limpiando datos de tracking...');
            const updated = await prisma.chat.update({
                where: { chatId: SPECIFIC_CHAT_ID },
                data: {
                    threadId: null,
                    totalTokens: 0,
                    lastMessageAt: new Date()
                }
            });
            
            console.log('✅ Datos limpiados:');
            console.log('   - threadId: null');
            console.log('   - totalTokens: 0');
            
        } else {
            console.log('⚠️ Chat no existe aún en la BD');
            console.log('   Se creará cuando llegue el primer mensaje');
        }
        
        // 3. Mostrar configuración a aplicar en el código
        console.log('\n3️⃣ CONFIGURACIÓN A APLICAR EN EL CÓDIGO:');
        console.log('=' .repeat(60));
        console.log(`
// En src/services/chat.service.ts o donde se actualice el chat:

async function updateChatData(chatId, data) {
    // CONFIGURACIÓN PROVISIONAL - NO GUARDAR PARA 3003913251
    if (chatId === '${SPECIFIC_CHAT_ID}') {
        console.log('⚠️ PROVISIONAL: Omitiendo guardado de tokens/thread para ${SPECIFIC_CHAT_ID}');
        return; // No actualizar nada para este chat
    }
    
    // Código normal para otros chats
    await prisma.chat.update({
        where: { chatId },
        data: data
    });
}
`);
        
        console.log('=' .repeat(60));
        console.log('\n⚠️ NOTA IMPORTANTE:');
        console.log('Esta es una configuración PROVISIONAL.');
        console.log('El cambio real debe hacerse en el código de la aplicación.');
        console.log('Busca donde se actualiza la tabla "chat" y agrega la condición.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar
disableTrackingForSpecificChat();