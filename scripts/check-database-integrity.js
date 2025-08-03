// scripts/check-database-integrity.js
// Script para verificar integridad de datos en la base de datos

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = 
// DATABASE_URL Railway check
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no encontrada - verifica tu .env');
    process.exit(1);
}

if (!process.env.DATABASE_URL.includes('railway')) {
    console.warn('⚠️  DATABASE_URL no parece ser de Railway');
}

new PrismaClient();

async function checkDatabaseIntegrity() {
    try {
        console.log('🔍 Verificando integridad de la base de datos...\n');

        await prisma.$connect();
        console.log('✅ Conectado a PostgreSQL\n');

        // 1. Obtener todos los usuarios
        const allUsers = await prisma.clientView.findMany({
            orderBy: { lastActivity: 'desc' }
        });

        console.log(`📊 Total usuarios en BD: ${allUsers.length}\n`);

        // 2. Analizar phoneNumber vs chatId
        console.log('🔍 ANÁLISIS phoneNumber vs chatId:');
        console.log('='.repeat(80));

        let correctFormat = 0;
        let incorrectFormat = 0;
        let inconsistencies = [];

        allUsers.forEach((user, index) => {
            const phoneNumber = user.phoneNumber;
            const chatId = user.chatId;
            const userName = user.userName || 'Sin nombre';

            console.log(`${index + 1}. phoneNumber: ${phoneNumber}`);
            console.log(`   chatId:      ${chatId}`);
            console.log(`   userName:    ${userName}`);

            // Verificar formato del phoneNumber
            if (phoneNumber.includes('@s.whatsapp.net')) {
                console.log(`   ✅ phoneNumber con formato correcto`);
                correctFormat++;
            } else {
                console.log(`   ❌ phoneNumber SIN formato @s.whatsapp.net`);
                incorrectFormat++;
            }

            // Verificar consistencia phoneNumber vs chatId
            if (phoneNumber !== chatId) {
                console.log(`   ⚠️  INCONSISTENCIA: phoneNumber ≠ chatId`);
                inconsistencies.push({
                    phoneNumber,
                    chatId,
                    userName
                });
            } else {
                console.log(`   ✅ phoneNumber = chatId (consistente)`);
            }

            console.log('');
        });

        // 3. Resumen de análisis
        console.log('\n📊 RESUMEN DE INTEGRIDAD:');
        console.log('='.repeat(50));
        console.log(`✅ phoneNumber con formato correcto: ${correctFormat}`);
        console.log(`❌ phoneNumber sin formato correcto: ${incorrectFormat}`);
        console.log(`⚠️  Inconsistencias phoneNumber ≠ chatId: ${inconsistencies.length}`);

        // 4. Mostrar inconsistencias detalladas
        if (inconsistencies.length > 0) {
            console.log('\n⚠️  INCONSISTENCIAS DETECTADAS:');
            console.log('='.repeat(50));
            inconsistencies.forEach((item, index) => {
                console.log(`${index + 1}. ${item.userName}`);
                console.log(`   phoneNumber: ${item.phoneNumber}`);
                console.log(`   chatId:      ${item.chatId}`);
                console.log('');
            });
        }

        // 5. Verificar duplicados
        console.log('\n🔍 VERIFICANDO DUPLICADOS:');
        console.log('='.repeat(50));

        const phoneNumbers = allUsers.map(u => u.phoneNumber);
        const uniquePhoneNumbers = [...new Set(phoneNumbers)];
        
        if (phoneNumbers.length === uniquePhoneNumbers.length) {
            console.log('✅ No hay duplicados en phoneNumber');
        } else {
            console.log('❌ Se encontraron duplicados en phoneNumber');
            
            // Encontrar duplicados
            const duplicates = phoneNumbers.filter((item, index) => phoneNumbers.indexOf(item) !== index);
            const uniqueDuplicates = [...new Set(duplicates)];
            
            console.log('\n📋 phoneNumbers duplicados:');
            uniqueDuplicates.forEach(dup => {
                const duplicatedUsers = allUsers.filter(u => u.phoneNumber === dup);
                console.log(`   ${dup}: ${duplicatedUsers.length} registros`);
                duplicatedUsers.forEach((user, i) => {
                    console.log(`     ${i + 1}. ${user.userName} - ${user.lastActivity}`);
                });
            });
        }

        // 6. Verificar campos requeridos
        console.log('\n🔍 VERIFICANDO CAMPOS REQUERIDOS:');
        console.log('='.repeat(50));

        const usersWithoutChatId = allUsers.filter(u => !u.chatId);
        const usersWithoutUserName = allUsers.filter(u => !u.userName);
        const usersWithoutLastActivity = allUsers.filter(u => !u.lastActivity);

        console.log(`❌ Usuarios sin chatId: ${usersWithoutChatId.length}`);
        console.log(`❌ Usuarios sin userName: ${usersWithoutUserName.length}`);
        console.log(`❌ Usuarios sin lastActivity: ${usersWithoutLastActivity.length}`);

        // 7. Verificar patrones de datos
        console.log('\n🔍 ANÁLISIS DE PATRONES:');
        console.log('='.repeat(50));

        const phoneNumberPatterns = {};
        allUsers.forEach(user => {
            if (user.phoneNumber.includes('@s.whatsapp.net')) {
                phoneNumberPatterns['@s.whatsapp.net'] = (phoneNumberPatterns['@s.whatsapp.net'] || 0) + 1;
            } else if (user.phoneNumber.includes('@c.us')) {
                phoneNumberPatterns['@c.us'] = (phoneNumberPatterns['@c.us'] || 0) + 1;
            } else {
                phoneNumberPatterns['solo_numero'] = (phoneNumberPatterns['solo_numero'] || 0) + 1;
            }
        });

        console.log('📊 Distribución de formatos phoneNumber:');
        Object.entries(phoneNumberPatterns).forEach(([pattern, count]) => {
            console.log(`   ${pattern}: ${count} usuarios`);
        });

        // 8. Sugerencias de corrección
        console.log('\n💡 SUGERENCIAS DE CORRECCIÓN:');
        console.log('='.repeat(50));

        if (incorrectFormat > 0) {
            console.log(`1. ❌ ${incorrectFormat} usuarios tienen phoneNumber sin formato @s.whatsapp.net`);
            console.log('   💡 Sugerencia: Migrar a formato WHAPI correcto');
        }

        if (inconsistencies.length > 0) {
            console.log(`2. ⚠️  ${inconsistencies.length} usuarios tienen phoneNumber ≠ chatId`);
            console.log('   💡 Sugerencia: Sincronizar phoneNumber con chatId');
        }

        if (usersWithoutChatId.length > 0) {
            console.log(`3. ❌ ${usersWithoutChatId.length} usuarios sin chatId`);
            console.log('   💡 Sugerencia: Generar chatId basado en phoneNumber');
        }

        console.log('\n🎯 ESTADO GENERAL:');
        if (correctFormat === allUsers.length && inconsistencies.length === 0) {
            console.log('✅ La base de datos tiene integridad correcta');
        } else {
            console.log('⚠️  La base de datos necesita correcciones');
        }

    } catch (error) {
        console.error('💥 Error verificando integridad:', error.message);
    } finally {
        await prisma.$disconnect();
        console.log('\n🔌 Desconectado de PostgreSQL');
    }
}

// Ejecutar verificación
if (require.main === module) {
    checkDatabaseIntegrity()
        .then(() => console.log('✨ Verificación completada'))
        .catch(console.error);
}

module.exports = { checkDatabaseIntegrity };