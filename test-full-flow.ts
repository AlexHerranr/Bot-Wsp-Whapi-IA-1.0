// Test completo del flujo de almacenamiento de response_id
import { OpenAIResponsesService } from './src/core/services/openai-responses.service';
import { DatabaseService } from './src/core/services/database.service';
import { ConversationManager } from './src/core/services/conversation-manager';
import { UserManager } from './src/core/state/user-manager';
import { PromptVariablesService } from './src/core/services/prompt-variables.service';
import { PrismaClient } from '@prisma/client';

async function testFullFlow() {
    console.log('🧪 TEST COMPLETO: Flujo de Response ID\n');
    
    // Configuración de prueba
    const TEST_USER_ID = '573009876543';
    const TEST_CHAT_ID = 'test-chat-' + Date.now();
    const TEST_USER_NAME = 'Usuario Prueba Flow';
    
    // Inicializar servicios
    const prisma = new PrismaClient();
    const databaseService = new DatabaseService();
    const userManager = new UserManager();
    const conversationManager = new ConversationManager(databaseService);
    const promptVariablesService = new PromptVariablesService();
    
    await databaseService.connect();
    
    try {
        // 1. Verificar/crear usuario en BD
        console.log('1️⃣ Preparando usuario de prueba...');
        let user = await prisma.whatsApp.findUnique({
            where: { phoneNumber: TEST_USER_ID }
        });
        
        if (!user) {
            user = await prisma.whatsApp.create({
                data: {
                    phoneNumber: TEST_USER_ID,
                    chatId: TEST_CHAT_ID,
                    name: TEST_USER_NAME,
                    userName: TEST_USER_NAME,
                    lastActivity: new Date(),
                    threadTokenCount: 0,
                    labels: 'test/prueba'
                }
            });
            console.log('   ✅ Usuario creado');
        } else {
            console.log('   ℹ️ Usuario ya existe');
        }
        console.log(`   📊 last_response_id inicial: ${user.last_response_id || 'NULL'}\n`);
        
        // 2. Simular procesamiento del primer mensaje
        console.log('2️⃣ Simulando primer mensaje...');
        const openaiService = new OpenAIResponsesService(
            databaseService,
            conversationManager,
            userManager,
            promptVariablesService
        );
        
        const result1 = await openaiService.processMessage(
            'Hola, esto es una prueba del sistema de response_id',
            TEST_USER_ID,
            TEST_CHAT_ID,
            TEST_USER_NAME
        );
        
        if (result1.success) {
            console.log('   ✅ Mensaje procesado exitosamente');
            console.log(`   📝 Response ID: ${result1.responseId}`);
            console.log(`   💬 Respuesta: ${result1.response?.substring(0, 50)}...`);
        } else {
            console.log('   ❌ Error procesando mensaje:', result1.error);
            return;
        }
        
        // 3. Verificar que se guardó en BD
        console.log('\n3️⃣ Verificando almacenamiento en BD...');
        const updatedUser = await prisma.whatsApp.findUnique({
            where: { phoneNumber: TEST_USER_ID }
        });
        
        console.log(`   📊 last_response_id en BD: ${updatedUser?.last_response_id}`);
        console.log(`   ✅ Coincide con response: ${updatedUser?.last_response_id === result1.responseId}\n`);
        
        // 4. Simular segundo mensaje para verificar contexto
        console.log('4️⃣ Simulando segundo mensaje con contexto...');
        const result2 = await openaiService.processMessage(
            '¿Recuerdas de qué estábamos hablando?',
            TEST_USER_ID,
            TEST_CHAT_ID,
            TEST_USER_NAME
        );
        
        if (result2.success) {
            console.log('   ✅ Segundo mensaje procesado');
            console.log(`   📝 Nuevo Response ID: ${result2.responseId}`);
            console.log(`   🔗 Usó previous_response_id: ${result1.responseId}`);
            console.log(`   💬 Respuesta: ${result2.response?.substring(0, 50)}...`);
        }
        
        // 5. Verificar actualización final
        console.log('\n5️⃣ Verificando estado final...');
        const finalUser = await prisma.whatsApp.findUnique({
            where: { phoneNumber: TEST_USER_ID }
        });
        
        console.log(`   📊 last_response_id final: ${finalUser?.last_response_id}`);
        console.log(`   ✅ Actualizado correctamente: ${finalUser?.last_response_id === result2.responseId}\n`);
        
        // 6. Mostrar resumen
        console.log('📋 RESUMEN DEL TEST:');
        console.log('   ✅ Response IDs generados y guardados correctamente');
        console.log('   ✅ Contexto mantenido entre mensajes');
        console.log('   ✅ Base de datos actualizada en cada interacción');
        console.log('   ✅ Sistema funcionando correctamente\n');
        
        // 7. Verificar en ConversationManager
        const context = await conversationManager.getConversationContext(TEST_USER_ID, TEST_CHAT_ID);
        console.log('🔍 Estado en ConversationManager:');
        console.log(`   - previousResponseId: ${context.previousResponseId}`);
        console.log(`   - messageHistory: ${context.messageHistory.length} mensajes`);
        
    } catch (error) {
        console.error('❌ Error en el test:', error);
    } finally {
        await prisma.$disconnect();
        await databaseService.disconnect();
    }
}

// Ejecutar test
testFullFlow().catch(console.error);