// src/core/services/database.service.ts
import { PrismaClient } from '@prisma/client';
import { ThreadRecord } from '../../shared/types';

export class DatabaseService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient({
            log: ['warn', 'error'],
        });
    }

    public async connect(): Promise<void> {
        await this.prisma.$connect();
        console.log('🗄️ Conectado a la base de datos.');
    }

    public async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
    }

    // --- Operaciones con Threads ---
    public async saveOrUpdateThread(userId: string, threadData: Partial<ThreadRecord>): Promise<ThreadRecord> {
        const user = await this.findUserByPhoneNumber(userId);
        if (!user) {
            throw new Error(`Usuario ${userId} no encontrado para guardar el thread.`);
        }

        const thread = await this.prisma.thread.upsert({
            where: { openaiId: threadData.threadId! },
            update: {
                chatId: threadData.chatId,
                userName: threadData.userName,
                labels: threadData.labels as any,
            },
            create: {
                openaiId: threadData.threadId!,
                userId: user.id,
                chatId: threadData.chatId,
                userName: threadData.userName,
                labels: threadData.labels as any,
            }
        });
        return this.mapToThreadRecord(thread);
    }

    public async getThread(userId: string): Promise<ThreadRecord | null> {
        const user = await this.findUserByPhoneNumber(userId);
        if (!user) return null;

        const thread = await this.prisma.thread.findFirst({
            where: { userId: user.id },
            orderBy: { lastActivity: 'desc' },
        });

        return thread ? this.mapToThreadRecord(thread) : null;
    }

    // --- Operaciones con Usuarios ---
    public async findUserByPhoneNumber(phoneNumber: string) {
        return this.prisma.user.findUnique({ where: { phoneNumber } });
    }

    public async getOrCreateUser(phoneNumber: string, name?: string) {
        return this.prisma.user.upsert({
            where: { phoneNumber },
            update: { name },
            create: { phoneNumber, name },
        });
    }

    // --- Operaciones con Mensajes ---
    public async saveMessage(openaiThreadId: string, role: 'user' | 'assistant', content: string, metadata?: any): Promise<void> {
        // Encontrar el thread por openaiId para obtener el id interno
        const thread = await this.prisma.thread.findUnique({
            where: { openaiId: openaiThreadId }
        });
        
        if (!thread) {
            throw new Error(`Thread with openaiId ${openaiThreadId} not found`);
        }
        
        await this.prisma.message.create({
            data: {
                threadId: thread.id, // Usar el id interno, no el openaiId
                role,
                content,
                metadata: metadata || null,
            }
        });
    }

    public async getMessages(openaiThreadId: string, limit?: number): Promise<any[]> {
        // Encontrar el thread por openaiId para obtener el id interno
        const thread = await this.prisma.thread.findUnique({
            where: { openaiId: openaiThreadId }
        });
        
        if (!thread) {
            return [];
        }
        
        return this.prisma.message.findMany({
            where: { threadId: thread.id },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    }

    // --- Operaciones de Limpieza ---
    public async cleanup(): Promise<void> {
        // Limpiar threads inactivos después de 30 días
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        await this.prisma.thread.deleteMany({
            where: {
                lastActivity: { lt: thirtyDaysAgo }
            }
        });

        // Limpiar mensajes huérfanos
        await this.prisma.message.deleteMany({
            where: {
                thread: null
            }
        });
    }

    // --- Estadísticas ---
    public async getStats(): Promise<any> {
        const [userCount, threadCount, messageCount] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.thread.count(),
            this.prisma.message.count(),
        ]);

        return {
            users: userCount,
            threads: threadCount,
            messages: messageCount,
            timestamp: new Date(),
        };
    }

    // --- Helper ---
    private mapToThreadRecord(thread: any): ThreadRecord {
        return {
            threadId: thread.openaiId,
            chatId: thread.chatId || '',
            userName: thread.userName,
            lastActivity: thread.lastActivity,
            labels: thread.labels as string[] || [],
        };
    }
}