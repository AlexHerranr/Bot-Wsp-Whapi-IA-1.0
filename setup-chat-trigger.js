// Script para configurar trigger que evite guardado de threadId y threadTokenCount para tu chatId
const { PrismaClient } = require('@prisma/client');

async function setupChatTrigger() {
    const prisma = new PrismaClient();
    
    try {
        const yourChatId = '573003913251@s.whatsapp.net';
        
        console.log('🔧 Configurando trigger para chatId:', yourChatId);
        
        // 1. Limpiar tu registro actual
        await prisma.whatsApp.updateMany({
            where: { chatId: yourChatId },
            data: {
                threadId: null,
                threadTokenCount: 0
            }
        });
        console.log('✅ Registro limpiado');
        
        // 2. Crear función y trigger en PostgreSQL
        await prisma.$executeRaw`
            CREATE OR REPLACE FUNCTION prevent_thread_updates()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Si es tu chatId específico, no actualizar threadId ni threadTokenCount
                IF NEW."chatId" = '573003913251@s.whatsapp.net' THEN
                    NEW."threadId" = NULL;
                    NEW."threadTokenCount" = 0;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `;
        console.log('✅ Función creada');
        
        // 3. Crear trigger
        await prisma.$executeRaw`
            DROP TRIGGER IF EXISTS prevent_alex_thread_updates ON "Chat";
        `;
        
        await prisma.$executeRaw`
            CREATE TRIGGER prevent_alex_thread_updates
                BEFORE INSERT OR UPDATE ON "Chat"
                FOR EACH ROW
                EXECUTE FUNCTION prevent_thread_updates();
        `;
        console.log('✅ Trigger creado');
        
        // 4. Verificar configuración
        const result = await prisma.whatsApp.findMany({
            where: { chatId: yourChatId },
            select: {
                chatId: true,
                threadId: true,
                threadTokenCount: true,
                lastActivity: true
            }
        });
        
        console.log('📋 Estado actual:', result);
        console.log('🎉 Configuración completada. Tu chatId ya no guardará threadId ni threadTokenCount');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setupChatTrigger();