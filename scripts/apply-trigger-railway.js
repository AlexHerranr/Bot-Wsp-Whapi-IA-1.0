#!/usr/bin/env node

/**
 * Script para aplicar el trigger PROVISIONAL en Railway DB
 * Evita actualizar thread y tokens SOLO para chatId 3003913251
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyTrigger() {
    console.log('🔧 APLICANDO TRIGGER PROVISIONAL EN RAILWAY DB');
    console.log('=' .repeat(60));
    console.log('📱 ChatId afectado: 3003913251');
    console.log('🎯 Objetivo: Omitir guardado de thread y tokens');
    console.log('=' .repeat(60));
    
    try {
        // 1. Crear la función del trigger
        console.log('\n1️⃣ Creando función del trigger...');
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION skip_updates_for_specific_chat()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Si es el chat específico 3003913251
                IF NEW."phoneNumber" = '3003913251' THEN
                    -- Mantener valores antiguos de thread y tokens
                    NEW."threadId" = OLD."threadId";
                    NEW."threadTokenCount" = OLD."threadTokenCount";
                    
                    -- Log opcional
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
            DROP TRIGGER IF EXISTS skip_specific_chat_updates ON "WhatsApp";
        `);
        console.log('✅ Trigger anterior eliminado');
        
        // 3. Crear el nuevo trigger
        console.log('\n3️⃣ Creando trigger BEFORE UPDATE...');
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER skip_specific_chat_updates
            BEFORE UPDATE ON "WhatsApp"
            FOR EACH ROW
            EXECUTE FUNCTION skip_updates_for_specific_chat();
        `);
        console.log('✅ Trigger creado');
        
        // 4. Verificar que está activo
        console.log('\n4️⃣ Verificando trigger...');
        const triggers = await prisma.$queryRawUnsafe(`
            SELECT 
                tgname AS trigger_name,
                tgrelid::regclass AS table_name,
                tgenabled AS enabled
            FROM pg_trigger
            WHERE tgname = 'skip_specific_chat_updates';
        `);
        
        if (triggers && triggers.length > 0) {
            console.log('✅ Trigger verificado y activo:');
            console.log(triggers[0]);
        } else {
            console.log('⚠️ No se pudo verificar el trigger');
        }
        
        // 5. Opcional: Limpiar datos actuales del chat específico
        console.log('\n5️⃣ Limpiando datos actuales del chat 3003913251...');
        const updated = await prisma.whatsApp.updateMany({
            where: { phoneNumber: '3003913251' },
            data: {
                threadId: null,
                threadTokenCount: 0
            }
        });
        console.log(`✅ Registros actualizados: ${updated.count}`);
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ TRIGGER APLICADO EXITOSAMENTE');
        console.log('\n⚠️ IMPORTANTE:');
        console.log('- Este es un cambio PROVISIONAL');
        console.log('- El chat 3003913251 NO guardará thread ni tokens en BD');
        console.log('- El cache seguirá funcionando normal');
        console.log('\n🔄 Para REMOVER el trigger cuando ya no sea necesario:');
        console.log('DROP TRIGGER skip_specific_chat_updates ON "WhatsApp";');
        console.log('DROP FUNCTION skip_updates_for_specific_chat();');
        
    } catch (error) {
        console.error('❌ Error aplicando trigger:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

// Ejecutar
applyTrigger();