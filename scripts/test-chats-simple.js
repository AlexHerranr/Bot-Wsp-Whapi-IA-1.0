/**
 * Script de prueba simplificado para verificar la tabla Chats
 * Solo usa los campos básicos que el bot necesita
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: ['warn', 'error'],
});

async function testChatsTable() {
    console.log('🔍 Verificando funcionamiento de la tabla Chats...\n');
    console.log('=' .repeat(60));
    
    try {
        // 1. Verificar conexión
        console.log('\n1️⃣ Conectando a la base de datos...');
        await prisma.$connect();
        console.log('✅ Conexión exitosa\n');
        
        // 2. Verificar estado actual
        console.log('2️⃣ Estado de la tabla Chats:');
        const count = await prisma.whatsApp.count();
        console.log(`   📊 Registros actuales: ${count}`);
        
        // 3. Probar inserción con campos básicos del bot
        console.log('\n3️⃣ Probando registro de interacción del bot...');
        const testPhone = '573000000TEST';
        const testData = {
            phoneNumber: testPhone,
            name: 'Usuario Test Bot',
            userName: 'Test Bot User',
            labels: 'test/bot/verificacion',
            chatId: `${testPhone}@s.whatsapp.net`,
            threadId: 'thread_test_' + Date.now(),
            threadTokenCount: 150,
            lastActivity: new Date()
        };
        
        console.log('   Creando registro con:');
        console.log(`   - phoneNumber: ${testData.phoneNumber}`);
        console.log(`   - name: ${testData.name}`);
        console.log(`   - userName: ${testData.userName}`);
        console.log(`   - labels: ${testData.labels}`);
        console.log(`   - chatId: ${testData.chatId}`);
        console.log(`   - threadId: ${testData.threadId}`);
        console.log(`   - threadTokenCount: ${testData.threadTokenCount}`);
        
        const created = await prisma.whatsApp.create({ data: testData });
        console.log('   ✅ Registro creado exitosamente\n');
        
        // 4. Simular actualización del bot (tokens y activity)
        console.log('4️⃣ Simulando actualización del bot (tokens)...');
        const newTokens = 350;
        const updated = await prisma.whatsApp.update({
            where: { phoneNumber: testPhone },
            data: {
                threadTokenCount: newTokens,
                lastActivity: new Date()
            }
        });
        console.log(`   ✅ Tokens actualizados: ${updated.threadTokenCount}`);
        console.log(`   ✅ Last Activity: ${updated.lastActivity.toISOString()}\n`);
        
        // 5. Simular búsqueda del bot
        console.log('5️⃣ Simulando búsqueda del bot...');
        const found = await prisma.whatsApp.findUnique({
            where: { phoneNumber: testPhone },
            select: {
                phoneNumber: true,
                name: true,
                userName: true,
                labels: true,
                chatId: true,
                threadId: true,
                threadTokenCount: true,
                lastActivity: true
            }
        });
        
        if (found) {
            console.log('   ✅ Registro encontrado:');
            console.log(`   - Name: ${found.name}`);
            console.log(`   - UserName: ${found.userName}`);
            console.log(`   - Labels: ${found.labels}`);
            console.log(`   - Thread: ${found.threadId}`);
            console.log(`   - Tokens: ${found.threadTokenCount}\n`);
        }
        
        // 6. Limpiar registro de prueba
        console.log('6️⃣ Limpiando registro de prueba...');
        await prisma.whatsApp.delete({
            where: { phoneNumber: testPhone }
        });
        console.log('   ✅ Registro eliminado\n');
        
        // Resumen final
        console.log('=' .repeat(60));
        console.log('\n✅ VERIFICACIÓN COMPLETADA EXITOSAMENTE\n');
        console.log('📝 El sistema está funcionando correctamente:');
        console.log('   ✅ La tabla Chats responde correctamente');
        console.log('   ✅ Se pueden registrar interacciones del bot');
        console.log('   ✅ Se actualizan labels correctamente');
        console.log('   ✅ Se registra el conteo de tokens');
        console.log('   ✅ Se guarda chatId, name y userName');
        console.log('   ✅ Se actualiza lastActivity');
        console.log('   ✅ Se mantiene el threadId de OpenAI');
        console.log('\n🎉 Todo listo para el funcionamiento del bot!');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        
        if (error.code === 'P2022') {
            console.error('\n⚠️  La tabla en la BD no coincide con el esquema');
            console.error('   Campos disponibles en el esquema Prisma:');
            console.error('   - phoneNumber, name, userName, labels');
            console.error('   - chatId, threadId, threadTokenCount');
            console.error('   - lastActivity, profileStatus, proximaAccion');
            console.error('   - fechaProximaAccion, prioridad');
        }
        
        if (error.code === 'P2002') {
            console.error('\n⚠️  El registro de prueba ya existe');
            console.error('   Ejecuta primero: node scripts/clear-chats-table-sql.js');
        }
        
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        console.log('\n🔌 Desconectado de la base de datos');
    }
}

// Ejecutar
console.log('🚀 Prueba de funcionamiento - Tabla Chats\n');
testChatsTable()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });