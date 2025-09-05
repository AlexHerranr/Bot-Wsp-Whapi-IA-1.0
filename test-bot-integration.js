// Test de integración completa del bot con Responses API
require('dotenv').config();

// Simular el flujo completo del bot
async function testBotIntegration() {
    console.log('=== TEST DE INTEGRACIÓN DEL BOT ===\n');
    
    // Verificar configuración
    console.log('1. Verificando configuración...');
    const apiKey = process.env.OPENAI_API_KEY;
    const promptId = process.env.OPENAI_PROMPT_ID;
    
    if (!apiKey) {
        console.error('❌ OPENAI_API_KEY no encontrada en .env');
        return;
    }
    console.log('✅ API Key encontrada:', apiKey.substring(0, 10) + '...');
    console.log('✅ Prompt ID:', promptId);
    
    // Cargar los servicios necesarios
    console.log('\n2. Inicializando servicios...');
    
    const { OpenAIResponsesService } = require('./dist/core/services/openai-responses.service');
    const { ConversationManager } = require('./dist/core/services/conversation-manager');
    const { DatabaseService } = require('./dist/core/services/database.service');
    const { WhatsAppService } = require('./dist/core/services/whatsapp.service');
    const { CacheManager } = require('./dist/shared/cache/cache-manager');
    const { TerminalLog } = require('./dist/utils/logging/terminal');
    
    // Crear instancias mock
    const terminalLog = new TerminalLog({ addLog: console.log }, {});
    const cacheManager = new CacheManager();
    const databaseService = new DatabaseService(null); // Sin BD real
    
    // Mock de WhatsApp service para capturar mensajes
    const sentMessages = [];
    const mockWhatsAppService = {
        sendWhatsAppMessage: async (chatId, message, userState, isQuote) => {
            console.log('\n📱 WhatsApp Mock - Mensaje capturado:');
            console.log('   Chat ID:', chatId);
            console.log('   Mensaje:', message.substring(0, 100) + '...');
            sentMessages.push({ chatId, message, userState, isQuote });
            return { success: true };
        }
    };
    
    // Crear servicio de OpenAI con mocks
    const openaiService = new OpenAIResponsesService(
        {
            apiKey: apiKey,
            assistantId: '',
            model: 'gpt-5',
            maxOutputTokens: 4096,
            temperature: 0.7
        },
        terminalLog,
        cacheManager,
        null, // functionRegistry
        mockWhatsAppService,
        databaseService
    );
    
    console.log('✅ Servicios inicializados');
    
    // Test de conversación
    console.log('\n3. Simulando conversación...');
    
    const userId = '573001234567@s.whatsapp.net';
    const chatId = '573001234567@s.whatsapp.net';
    const userName = 'Usuario Test';
    
    try {
        // Mensaje 1
        console.log('\n--- Mensaje 1: Saludo ---');
        await openaiService.processMessage(
            userId,
            'Hola, necesito información sobre habitaciones para este fin de semana',
            chatId,
            userName
        );
        
        // Esperar un poco para simular tiempo real
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mensaje 2
        console.log('\n--- Mensaje 2: Detalles ---');
        await openaiService.processMessage(
            userId,
            'Somos 2 adultos, del viernes al domingo',
            chatId,
            userName
        );
        
        // Esperar un poco
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mensaje 3
        console.log('\n--- Mensaje 3: Precio ---');
        await openaiService.processMessage(
            userId,
            '¿Cuál es el precio total con todo incluido?',
            chatId,
            userName
        );
        
        // Resumen
        console.log('\n\n=== RESUMEN DE LA CONVERSACIÓN ===');
        console.log('Total de mensajes enviados:', sentMessages.length);
        console.log('\nMensajes del asistente:');
        sentMessages.forEach((msg, i) => {
            console.log(`\n${i + 1}. ${msg.message.substring(0, 200)}...`);
        });
        
    } catch (error) {
        console.error('\n❌ Error en la conversación:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

// Ejecutar test
testBotIntegration().catch(console.error);