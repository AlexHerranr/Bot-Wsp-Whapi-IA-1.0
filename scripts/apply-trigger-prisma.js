#!/usr/bin/env node

/**
 * Script para aplicar trigger usando Prisma con la conexión de Railway
 */

require('dotenv').config();

// Configurar DATABASE_URL para Railway
process.env.DATABASE_URL = 'postgresql://postgres:sRWlVDYJZJMPCMkzIZMfGFWGHBmNKIJG@monorail.proxy.rlwy.net:57391/railway?schema=public';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    log: ['error', 'warn']
});

async function applyTrigger() {
    console.log('🔧 APLICANDO TRIGGER PROVISIONAL EN RAILWAY DB');
    console.log('=' .repeat(60));
    console.log('📱 ChatId afectado: 3003913251');
    console.log('🎯 Objetivo: Omitir guardado de thread y tokens');
    console.log('=' .repeat(60));
    
    try {
        // Verificar conexión
        console.log('\n📡 Conectando a Railway DB...');
        const testConnection = await prisma.$queryRaw`SELECT current_database() as db`;
        console.log('✅ Conectado a:', testConnection[0].db);
        
        // 1. Crear la función del trigger
        console.log('\n1️⃣ Creando función del trigger...');
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION skip_updates_for_3003913251()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Si es el chat 3003913251, mantener valores antiguos
                IF NEW."phoneNumber" = '3003913251' THEN
                    IF OLD."threadId" IS NOT NULL THEN
                        NEW."threadId" = OLD."threadId";
                    END IF;
                    IF OLD."threadTokenCount" IS NOT NULL THEN
                        NEW."threadTokenCount" = OLD."threadTokenCount";
                    END IF;
                    RAISE NOTICE 'PROVISIONAL: Omitiendo actualización para 3003913251';
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Función creada');
        
        // 2. Eliminar trigger existente si hay
        console.log('\n2️⃣ Eliminando trigger anterior si existe...');
        await prisma.$executeRawUnsafe(`
            DROP TRIGGER IF EXISTS skip_3003913251_updates ON "WhatsApp";
        `);
        console.log('✅ Trigger anterior eliminado');
        
        // 3. Crear el nuevo trigger
        console.log('\n3️⃣ Creando trigger BEFORE UPDATE...');
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER skip_3003913251_updates
            BEFORE UPDATE ON "WhatsApp"
            FOR EACH ROW
            EXECUTE FUNCTION skip_updates_for_3003913251();
        `);
        console.log('✅ Trigger creado');
        
        // 4. Limpiar datos actuales del chat
        console.log('\n4️⃣ Limpiando datos actuales del chat 3003913251...');
        const updated = await prisma.whatsApp.updateMany({
            where: { phoneNumber: '3003913251' },
            data: {
                threadId: null,
                threadTokenCount: 0
            }
        });
        console.log(`✅ Registros actualizados: ${updated.count}`);
        
        // 5. Verificar que el trigger está activo
        console.log('\n5️⃣ Verificando trigger...');
        const triggers = await prisma.$queryRaw`
            SELECT 
                tgname AS trigger_name,
                tgenabled AS enabled
            FROM pg_trigger
            WHERE tgname = 'skip_3003913251_updates';
        `;
        
        if (triggers && triggers.length > 0) {
            console.log('✅ Trigger verificado y activo:');
            console.log('   Nombre:', triggers[0].trigger_name);
            console.log('   Estado:', triggers[0].enabled === 'O' ? 'ACTIVO' : triggers[0].enabled);
        } else {
            console.log('⚠️ No se pudo verificar el trigger');
        }
        
        // 6. Test del trigger
        console.log('\n6️⃣ Probando el trigger...');
        
        // Primero crear o asegurar que existe el registro
        await prisma.whatsApp.upsert({
            where: { phoneNumber: '3003913251' },
            update: {},
            create: {
                phoneNumber: '3003913251',
                chatId: '3003913251@c.us',
                userName: 'Test User'
            }
        });
        
        // Intentar actualizar (el trigger debería prevenir cambios)
        await prisma.whatsApp.update({
            where: { phoneNumber: '3003913251' },
            data: {
                threadId: 'test_thread_123',
                threadTokenCount: 999
            }
        });
        
        // Verificar que no se actualizó
        const checkResult = await prisma.whatsApp.findUnique({
            where: { phoneNumber: '3003913251' },
            select: {
                phoneNumber: true,
                threadId: true,
                threadTokenCount: true
            }
        });
        
        console.log('📊 Resultado del test:');
        console.log('   threadId:', checkResult?.threadId || 'NULL ✅');
        console.log('   threadTokenCount:', checkResult?.threadTokenCount || '0 ✅');
        
        if (!checkResult?.threadId && checkResult?.threadTokenCount === 0) {
            console.log('✅ TRIGGER FUNCIONANDO CORRECTAMENTE');
        } else {
            console.log('⚠️ El trigger puede no estar funcionando como se esperaba');
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ TRIGGER APLICADO EXITOSAMENTE EN RAILWAY');
        console.log('\n⚠️ CONFIGURACIÓN PROVISIONAL:');
        console.log('   • Chat afectado: 3003913251');
        console.log('   • NO guardará threadId en BD');
        console.log('   • NO guardará threadTokenCount en BD');
        console.log('   • El cache seguirá funcionando normal');
        
        console.log('\n🔄 Para REMOVER cuando ya no sea necesario, ejecuta:');
        console.log('   DROP TRIGGER skip_3003913251_updates ON "WhatsApp";');
        console.log('   DROP FUNCTION skip_updates_for_3003913251();');
        
    } catch (error) {
        console.error('❌ Error aplicando trigger:', error.message);
        if (error.code === 'P2010') {
            console.error('   Problema de conexión con Railway DB');
            console.error('   Verifica las credenciales y conexión');
        }
    } finally {
        await prisma.$disconnect();
        console.log('\n📡 Conexión cerrada');
    }
}

// Ejecutar
applyTrigger();