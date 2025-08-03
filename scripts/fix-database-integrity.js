// scripts/fix-database-integrity.js
// Script para corregir inconsistencias en la base de datos

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDatabaseIntegrity() {
    try {
        console.log('🔧 Iniciando corrección de integridad de BD...\n');

        await prisma.$connect();
        console.log('✅ Conectado a PostgreSQL\n');

        // 1. Obtener usuarios con problemas
        const allUsers = await prisma.clientView.findMany();
        console.log(`📊 Total usuarios en BD: ${allUsers.length}\n`);

        let correctedUsers = 0;
        let errors = 0;

        console.log('🔧 Corrigiendo formato phoneNumber...\n');

        for (const user of allUsers) {
            try {
                const originalPhoneNumber = user.phoneNumber;
                const originalChatId = user.chatId;

                // Determinar el phoneNumber correcto
                let correctPhoneNumber;
                
                if (originalPhoneNumber.includes('@s.whatsapp.net')) {
                    // Ya tiene formato correcto
                    correctPhoneNumber = originalPhoneNumber;
                } else {
                    // Agregar formato WHAPI
                    correctPhoneNumber = `${originalPhoneNumber}@s.whatsapp.net`;
                }

                // El chatId debería ser igual al phoneNumber correcto
                const correctChatId = correctPhoneNumber;

                // Solo actualizar si hay cambios
                if (originalPhoneNumber !== correctPhoneNumber || originalChatId !== correctChatId) {
                    console.log(`📝 Corrigiendo: ${user.userName || 'Sin nombre'}`);
                    console.log(`   Antes - phoneNumber: ${originalPhoneNumber}`);
                    console.log(`   Antes - chatId:      ${originalChatId}`);
                    console.log(`   Después - phoneNumber: ${correctPhoneNumber}`);
                    console.log(`   Después - chatId:      ${correctChatId}`);

                    // Verificar si ya existe un usuario con el phoneNumber correcto
                    const existingUser = await prisma.clientView.findUnique({
                        where: { phoneNumber: correctPhoneNumber }
                    });

                    if (existingUser && existingUser.phoneNumber !== originalPhoneNumber) {
                        console.log(`   ⚠️  Ya existe usuario con phoneNumber ${correctPhoneNumber}`);
                        console.log(`   🗑️  Eliminando registro duplicado...`);
                        
                        // Eliminar el registro actual (duplicado)
                        await prisma.clientView.delete({
                            where: { phoneNumber: originalPhoneNumber }
                        });
                        
                        console.log(`   ✅ Registro duplicado eliminado\n`);
                    } else {
                        // Actualizar el registro
                        await prisma.clientView.update({
                            where: { phoneNumber: originalPhoneNumber },
                            data: {
                                phoneNumber: correctPhoneNumber,
                                chatId: correctChatId
                            }
                        });
                        
                        console.log(`   ✅ Usuario corregido\n`);
                        correctedUsers++;
                    }
                } else {
                    console.log(`✅ ${user.userName || 'Sin nombre'} - Ya tiene formato correcto\n`);
                }

            } catch (error) {
                console.error(`❌ Error corrigiendo ${user.phoneNumber}: ${error.message}`);
                errors++;
            }
        }

        // 2. Verificar estado final
        console.log('\n🔍 Verificando estado después de correcciones...\n');
        
        const finalUsers = await prisma.clientView.findMany();
        console.log(`📊 Total usuarios después de corrección: ${finalUsers.length}`);

        let correctFormat = 0;
        let inconsistencies = 0;

        finalUsers.forEach(user => {
            if (user.phoneNumber.includes('@s.whatsapp.net')) {
                correctFormat++;
            }
            if (user.phoneNumber !== user.chatId) {
                inconsistencies++;
            }
        });

        console.log('\n📊 RESULTADOS DE LA CORRECCIÓN:');
        console.log('='.repeat(50));
        console.log(`✅ Usuarios corregidos: ${correctedUsers}`);
        console.log(`❌ Errores durante corrección: ${errors}`);
        console.log(`📊 Total usuarios finales: ${finalUsers.length}`);
        console.log(`✅ Usuarios con formato correcto: ${correctFormat}/${finalUsers.length}`);
        console.log(`⚠️  Inconsistencias restantes: ${inconsistencies}`);

        if (correctFormat === finalUsers.length && inconsistencies === 0) {
            console.log('\n🎉 ¡Base de datos corregida exitosamente!');
        } else {
            console.log('\n⚠️  Algunas inconsistencias persisten');
        }

        // 3. Mostrar algunos ejemplos finales
        console.log('\n📋 Ejemplos de usuarios corregidos:');
        const sampleUsers = await prisma.clientView.findMany({
            take: 5,
            orderBy: { lastActivity: 'desc' }
        });

        sampleUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.phoneNumber} (${user.userName || 'Sin nombre'})`);
            console.log(`   chatId: ${user.chatId}`);
            console.log(`   Consistente: ${user.phoneNumber === user.chatId ? '✅' : '❌'}`);
        });

    } catch (error) {
        console.error('💥 Error durante corrección:', error.message);
    } finally {
        await prisma.$disconnect();
        console.log('\n🔌 Desconectado de PostgreSQL');
    }
}

// Ejecutar corrección
if (require.main === module) {
    fixDatabaseIntegrity()
        .then(() => console.log('✨ Corrección completada'))
        .catch(console.error);
}

module.exports = { fixDatabaseIntegrity };