// scripts/migrate-data.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ThreadsData {
    [userId: string]: {
        threadId: string;
        chatId: string;
        userName?: string;
    };
}

interface GuestMemoryData {
    [userId: string]: {
        name?: string;
        labels?: string[];
        lastInteraction?: string;
    };
}

async function migrateExistingData() {
    console.log('🔄 Iniciando migración de datos existentes...');
    
    try {
        await prisma.$connect();
        console.log('✅ Conectado a la base de datos');

        // Migrar threads-data.json
        const threadsPath = path.join(process.cwd(), 'threads-data.json');
        if (fs.existsSync(threadsPath)) {
            console.log('📄 Migrando threads-data.json...');
            const threadsContent = fs.readFileSync(threadsPath, 'utf8');
            const threadsData: ThreadsData = JSON.parse(threadsContent);
            
            let threadsCount = 0;
            for (const [userId, threadInfo] of Object.entries(threadsData)) {
                try {
                    // Crear o actualizar usuario
                    const user = await prisma.user.upsert({
                        where: { phoneNumber: userId },
                        update: { name: threadInfo.userName },
                        create: { 
                            phoneNumber: userId, 
                            name: threadInfo.userName 
                        },
                    });

                    // Crear thread
                    await prisma.thread.upsert({
                        where: { openaiId: threadInfo.threadId },
                        update: {
                            chatId: threadInfo.chatId,
                            userName: threadInfo.userName,
                        },
                        create: {
                            openaiId: threadInfo.threadId,
                            userId: user.id,
                            chatId: threadInfo.chatId,
                            userName: threadInfo.userName,
                        }
                    });
                    
                    threadsCount++;
                } catch (error) {
                    console.error(`❌ Error migrando thread para ${userId}:`, error);
                }
            }
            console.log(`✅ Migrados ${threadsCount} threads`);
        } else {
            console.log('⚠️ No se encontró threads-data.json');
        }

        // Migrar guest-memory.json
        const guestMemoryPath = path.join(process.cwd(), 'guest-memory.json');
        if (fs.existsSync(guestMemoryPath)) {
            console.log('📄 Migrando guest-memory.json...');
            const guestContent = fs.readFileSync(guestMemoryPath, 'utf8');
            const guestData: GuestMemoryData = JSON.parse(guestContent);
            
            let guestsCount = 0;
            for (const [userId, guestInfo] of Object.entries(guestData)) {
                try {
                    // Actualizar información del usuario
                    await prisma.user.upsert({
                        where: { phoneNumber: userId },
                        update: {
                            name: guestInfo.name,
                            lastActivity: guestInfo.lastInteraction ? 
                                new Date(guestInfo.lastInteraction) : 
                                new Date(),
                        },
                        create: {
                            phoneNumber: userId,
                            name: guestInfo.name,
                            lastActivity: guestInfo.lastInteraction ? 
                                new Date(guestInfo.lastInteraction) : 
                                new Date(),
                        },
                    });

                    // Si hay labels, actualizar el thread más reciente
                    if (guestInfo.labels && guestInfo.labels.length > 0) {
                        const user = await prisma.user.findUnique({
                            where: { phoneNumber: userId }
                        });
                        
                        if (user) {
                            await prisma.thread.updateMany({
                                where: { userId: user.id },
                                data: { labels: guestInfo.labels }
                            });
                        }
                    }
                    
                    guestsCount++;
                } catch (error) {
                    console.error(`❌ Error migrando guest para ${userId}:`, error);
                }
            }
            console.log(`✅ Migrados ${guestsCount} usuarios/guests`);
        } else {
            console.log('⚠️ No se encontró guest-memory.json');
        }

        // Mostrar estadísticas finales
        const stats = await getStats();
        console.log('\n📊 Estadísticas finales:');
        console.log(`👥 Usuarios: ${stats.users}`);
        console.log(`💬 Threads: ${stats.threads}`);
        console.log(`📝 Mensajes: ${stats.messages}`);
        
        console.log('\n🎉 Migración completada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

async function getStats() {
    const [userCount, threadCount, messageCount] = await Promise.all([
        prisma.user.count(),
        prisma.thread.count(),
        prisma.message.count(),
    ]);

    return {
        users: userCount,
        threads: threadCount,
        messages: messageCount,
    };
}

// Ejecutar migración si es llamado directamente
if (require.main === module) {
    migrateExistingData();
}

export { migrateExistingData };