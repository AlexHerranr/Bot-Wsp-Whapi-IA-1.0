/**
 * Script de prueba para verificar que la tabla Chats funciona correctamente
 * y que todas las operaciones del bot se registran bien
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function testChatsTable() {
    console.log('🔍 Iniciando prueba de la tabla Chats...\n');
    console.log('=' .repeat(60));
    
    try {
        // 1. Verificar conexión
        console.log('\n1️⃣ Verificando conexión a la base de datos...');
        await prisma.$connect();
        console.log('✅ Conexión exitosa\n');
        
        // 2. Verificar que la tabla existe y está vacía
        console.log('2️⃣ Verificando estado de la tabla Chats...');
        const count = await prisma.whatsApp.count();
        console.log(`📊 Registros actuales en la tabla: ${count}`);
        
        if (count > 0) {
            console.log('⚠️  La tabla no está vacía. Mostrando primeros 5 registros:');
            const samples = await prisma.whatsApp.findMany({ take: 5 });
            samples.forEach(record => {
                console.log(`  - ${record.phoneNumber}: ${record.name || 'Sin nombre'} | Labels: ${record.labels || 'Sin etiquetas'}`);
            });
        } else {
            console.log('✅ La tabla está vacía como se esperaba\n');
        }
        
        // 3. Probar inserción de un registro de prueba
        console.log('3️⃣ Probando inserción de registro de prueba...');
        const testPhone = '573000000001';
        const testData = {
            phoneNumber: testPhone,
            name: 'Usuario de Prueba',
            userName: 'Test User',
            labels: 'test/verificacion',
            chatId: `${testPhone}@s.whatsapp.net`,
            threadId: 'thread_test_123',
            threadTokenCount: 100,
            profileStatus: 'Activo',
            proximaAccion: 'Verificar sistema',
            fechaProximaAccion: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
            prioridad: 1
        };
        
        const created = await prisma.whatsApp.create({ data: testData });
        console.log('✅ Registro creado exitosamente:');
        console.log(`   - Phone: ${created.phoneNumber}`);
        console.log(`   - Name: ${created.name}`);
        console.log(`   - UserName: ${created.userName}`);
        console.log(`   - Labels: ${created.labels}`);
        console.log(`   - ChatId: ${created.chatId}`);
        console.log(`   - ThreadId: ${created.threadId}`);
        console.log(`   - Token Count: ${created.threadTokenCount}`);
        console.log();
        
        // 4. Probar actualización
        console.log('4️⃣ Probando actualización del registro...');
        const updated = await prisma.whatsApp.update({
            where: { phoneNumber: testPhone },
            data: {
                threadTokenCount: 250,
                labels: 'test/verificacion/actualizado',
                lastActivity: new Date()
            }
        });
        console.log('✅ Registro actualizado:');
        console.log(`   - Token Count: ${updated.threadTokenCount}`);
        console.log(`   - Labels: ${updated.labels}`);
        console.log(`   - Last Activity: ${updated.lastActivity.toISOString()}`);
        console.log();
        
        // 5. Probar búsqueda
        console.log('5️⃣ Probando búsqueda del registro...');
        const found = await prisma.whatsApp.findUnique({
            where: { phoneNumber: testPhone }
        });
        
        if (found) {
            console.log('✅ Registro encontrado correctamente');
        } else {
            console.log('❌ Error: No se pudo encontrar el registro');
        }
        console.log();
        
        // 6. Limpiar registro de prueba
        console.log('6️⃣ Limpiando registro de prueba...');
        await prisma.whatsApp.delete({
            where: { phoneNumber: testPhone }
        });
        console.log('✅ Registro de prueba eliminado\n');
        
        // 7. Verificar estado final
        console.log('7️⃣ Verificando estado final de la tabla...');
        const finalCount = await prisma.whatsApp.count();
        console.log(`📊 Registros finales en la tabla: ${finalCount}`);
        
        console.log('\n' + '=' .repeat(60));
        console.log('\n✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE');
        console.log('\n📝 Resumen:');
        console.log('   - La tabla Chats está funcionando correctamente');
        console.log('   - Se pueden crear registros con todos los campos');
        console.log('   - Se pueden actualizar tokens y labels');
        console.log('   - Se pueden buscar registros por phoneNumber');
        console.log('   - El modelo WhatsApp mapea correctamente a la tabla Chats');
        console.log('\n🎉 El sistema está listo para registrar interacciones del bot');
        
    } catch (error) {
        console.error('\n❌ ERROR EN LAS PRUEBAS:', error.message);
        console.error('Detalles:', error);
        
        if (error.code === 'P2002') {
            console.error('\n⚠️  Error de duplicado - el registro de prueba ya existe');
            console.error('   Intenta limpiar la tabla primero con: node scripts/clear-chats-table-sql.js');
        }
        
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        console.log('\n🔌 Desconectado de la base de datos');
    }
}

// Ejecutar las pruebas
console.log('🚀 Script de prueba para tabla Chats\n');
testChatsTable()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error fatal:', error);
        process.exit(1);
    });