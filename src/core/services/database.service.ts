// src/core/services/database.service.ts
import { PrismaClient } from '@prisma/client';
import { ThreadRecord } from '../../shared/types';
import { fetchWithRetry } from '../utils/retry-utils';

interface MemoryStore {
    threads: Map<string, ThreadRecord>;
    users: Map<string, any>;
    lastSync: Date;
}

export class DatabaseService {
    private prisma: PrismaClient;
    private isConnected: boolean = false;
    private memoryStore: MemoryStore;
    private connectionRetries: number = 0;
    private maxRetries: number = 3;

    constructor() {
        this.prisma = new PrismaClient({
            log: ['warn', 'error'],
        });
        
        // Initialize memory store for fallback
        this.memoryStore = {
            threads: new Map(),
            users: new Map(),
            lastSync: new Date()
        };
    }

    // Getters públicos para acceso externo
    public get connected(): boolean {
        return this.isConnected;
    }

    public get client() {
        return this.prisma;
    }

    public async connect(): Promise<void> {
        try {
            await this.prisma.$connect();
            this.isConnected = true;
            this.connectionRetries = 0;
            console.log('🗄️ Conectado a la base de datos PostgreSQL.');
            
            // Log técnico de sesión
            const { logSuccess } = require('../../utils/logging');
            logSuccess('DATABASE_CONNECTED', 'Conexión exitosa a PostgreSQL', {
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'unknown',
                environment: process.env.NODE_ENV || 'development'
            });
            
            // Sync memory data to database if we were in fallback mode
            await this.syncMemoryToDatabase();
            
        } catch (error) {
            this.isConnected = false;
            this.connectionRetries++;
            console.warn(`⚠️ Error conectando a PostgreSQL (intento ${this.connectionRetries}/${this.maxRetries}):`, error instanceof Error ? error.message : error);
            
            if (this.connectionRetries >= this.maxRetries) {
                console.log('🔄 Activando modo fallback a memoria...');
                // Don't throw error, continue in memory mode
            } else {
                throw error;
            }
        }
    }

    public async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
    }

    // --- Operaciones con Threads ---
    public async saveOrUpdateThread(userId: string, threadData: Partial<ThreadRecord>): Promise<ThreadRecord> {
        const threadRecord: ThreadRecord = {
            threadId: threadData.threadId || '',
            chatId: threadData.chatId || '',
            userName: threadData.userName,
            lastActivity: new Date(),
            labels: threadData.labels || [],
        };

        if (this.isConnected) {
            try {
                // Map labels array to individual label fields
                const labels = threadData.labels || [];
                const clientViewData = {
                    threadId: threadData.threadId,
                    chatId: threadData.chatId,
                    userName: threadData.userName,
                    profileStatus: (threadData as any).profileStatus,
                    proximaAccion: (threadData as any).proximaAccion,
                    prioridad: (threadData as any).prioridad || 2,
                    label1: labels[0] || null,
                    label2: labels[1] || null,
                    label3: labels[2] || null,
                    lastActivity: new Date(),
                };

                await this.prisma.clientView.upsert({
                    where: { phoneNumber: userId },
                    update: clientViewData,
                    create: {
                        phoneNumber: userId,
                        ...clientViewData
                    }
                });
                
                console.log(`✅ Thread guardado en PostgreSQL: ${userId}`);
            } catch (error) {
                console.warn(`⚠️ Error guardando en PostgreSQL, usando memoria: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
                // Fallback to memory
                this.memoryStore.threads.set(userId, threadRecord);
            }
        } else {
            // Store in memory
            this.memoryStore.threads.set(userId, threadRecord);
            console.log(`💾 Thread guardado en memoria (fallback): ${userId}`);
        }

        return threadRecord;
    }

    // Método optimizado para actualizar solo lastActivity
    public async updateThreadActivity(userId: string): Promise<boolean> {
        if (this.isConnected) {
            try {
                await this.prisma.clientView.update({
                    where: { phoneNumber: userId },
                    data: { lastActivity: new Date() }
                });
                
                console.log(`✅ Thread activity actualizada: ${userId}`);
                return true;
            } catch (error) {
                console.warn(`⚠️ Error actualizando activity, usando memoria: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
                
                // Fallback: actualizar en memoria
                const existingThread = this.memoryStore.threads.get(userId);
                if (existingThread) {
                    existingThread.lastActivity = new Date();
                    return true;
                }
                return false;
            }
        } else {
            // DB desconectada: actualizar en memoria
            const existingThread = this.memoryStore.threads.get(userId);
            if (existingThread) {
                existingThread.lastActivity = new Date();
                return true;
            }
            return false;
        }
    }

    public async getThread(userId: string): Promise<ThreadRecord | null> {
        if (this.isConnected) {
            try {
                const client = await this.prisma.clientView.findUnique({
                    where: { phoneNumber: userId }
                });

                if (!client) return null;

                return {
                    threadId: client.threadId || '',
                    chatId: client.chatId || '',
                    userName: client.userName,
                    lastActivity: client.lastActivity,
                    labels: [client.label1, client.label2, client.label3].filter(Boolean) as string[],
                };
            } catch (error) {
                console.warn(`⚠️ Error leyendo de PostgreSQL, usando memoria: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
                // Fallback to memory
                return this.memoryStore.threads.get(userId) || null;
            }
        } else {
            // Read from memory
            return this.memoryStore.threads.get(userId) || null;
        }
    }

    public async deleteThread(userId: string): Promise<boolean> {
        if (this.isConnected) {
            try {
                // Clear thread ID from database (but keep client record)
                await this.prisma.clientView.update({
                    where: { phoneNumber: userId },
                    data: { 
                        threadId: null,
                        lastActivity: new Date()
                    }
                });
                return true;
            } catch (error) {
                console.warn(`⚠️ Error eliminando thread de PostgreSQL, usando memoria: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
                // Fallback to memory deletion
                this.memoryStore.threads.delete(userId);
                return true;
            }
        } else {
            // Delete from memory
            this.memoryStore.threads.delete(userId);
            return true;
        }
    }

    // --- Métodos de Sincronización ---
    private async syncMemoryToDatabase(): Promise<void> {
        if (!this.isConnected || this.memoryStore.threads.size === 0) {
            return;
        }

        console.log(`🔄 Sincronizando ${this.memoryStore.threads.size} threads de memoria a PostgreSQL...`);
        let syncedCount = 0;

        for (const [userId, threadData] of this.memoryStore.threads.entries()) {
            try {
                await this.prisma.clientView.upsert({
                    where: { phoneNumber: userId },
                    update: {
                        threadId: threadData.threadId,
                        chatId: threadData.chatId,
                        userName: threadData.userName,
                        lastActivity: threadData.lastActivity,
                    },
                    create: {
                        phoneNumber: userId,
                        threadId: threadData.threadId,
                        chatId: threadData.chatId,
                        userName: threadData.userName,
                        lastActivity: threadData.lastActivity,
                    }
                });
                syncedCount++;
            } catch (error) {
                console.warn(`⚠️ Error sincronizando thread ${userId}:`, error instanceof Error ? error.message : error);
            }
        }

        if (syncedCount > 0) {
            console.log(`✅ ${syncedCount} threads sincronizados a PostgreSQL`);
            // Clear synced data from memory
            this.memoryStore.threads.clear();
            this.memoryStore.lastSync = new Date();
        }
    }

    public async forceSync(): Promise<void> {
        await this.syncMemoryToDatabase();
    }

    public getConnectionStatus(): { connected: boolean; mode: string; memoryItems: number } {
        return {
            connected: this.isConnected,
            mode: this.isConnected ? 'PostgreSQL' : 'Memory Fallback',
            memoryItems: this.memoryStore.threads.size
        };
    }

    // --- Operaciones con Usuarios ---
    public async findUserByPhoneNumber(phoneNumber: string) {
        if (this.isConnected) {
            try {
                return await this.prisma.clientView.findUnique({ where: { phoneNumber } });
            } catch (error) {
                console.warn(`⚠️ Error buscando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
                return null;
            }
        } else {
            // Check memory store
            const thread = this.memoryStore.threads.get(phoneNumber);
            return thread ? {
                phoneNumber,
                name: thread.userName,
                userName: thread.userName,
                threadId: thread.threadId,
                chatId: thread.chatId,
                lastActivity: thread.lastActivity
            } : null;
        }
    }

    public async getOrCreateUser(phoneNumber: string, name?: string) {
        if (this.isConnected) {
            try {
                const user = await this.prisma.clientView.upsert({
                    where: { phoneNumber },
                    update: { name },
                    create: { phoneNumber, name, lastActivity: new Date() },
                });

                // Si el usuario fue recién creado o tiene datos incompletos, intentar enriquecerlo
                if (this.shouldEnrichUser(user)) {
                    await this.enrichUserFromWhapi(phoneNumber);
                }

                return user;
            } catch (error) {
                console.warn(`⚠️ Error creando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
            }
        }
        
        // Fallback to memory
        const userData = {
            phoneNumber,
            name,
            userName: name,
            threadId: '',
            chatId: phoneNumber,
            lastActivity: new Date()
        };
        
        this.memoryStore.users.set(phoneNumber, userData);
        return userData;
    }

    // --- Método específico para webhook ---
    public async upsertClient(clientData: {
        phoneNumber: string;
        userName: string;
        chatId: string;
        lastActivity: Date;
    }) {
        if (this.isConnected) {
            try {
                // Verificar si el cliente ya existe
                const existingClient = await this.prisma.clientView.findUnique({
                    where: { phoneNumber: clientData.phoneNumber }
                });
                
                const result = await this.prisma.clientView.upsert({
                    where: { phoneNumber: clientData.phoneNumber },
                    update: {
                        userName: clientData.userName,
                        chatId: clientData.chatId,
                        lastActivity: clientData.lastActivity
                    },
                    create: {
                        phoneNumber: clientData.phoneNumber,
                        userName: clientData.userName,
                        chatId: clientData.chatId,
                        lastActivity: clientData.lastActivity,
                        prioridad: 2 // Valor por defecto (MEDIA)
                    }
                });
                
                // Solo loggear si es un cliente nuevo
                if (!existingClient) {
                    console.log(`✅ Nuevo cliente registrado: ${clientData.phoneNumber}`);
                }
                
                return result;
            } catch (error) {
                console.error(`❌ Error guardando cliente en BD: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
                // Fallback to memory
                this.memoryStore.users.set(clientData.phoneNumber, clientData);
            }
        } else {
            // Fallback to memory
            this.memoryStore.users.set(clientData.phoneNumber, clientData);
            console.log(`💾 Cliente guardado en memoria: ${clientData.phoneNumber}`);
        }
    }

    // --- Operaciones con Mensajes ---
    public async saveMessage(openaiThreadId: string, role: 'user' | 'assistant', content: string, metadata?: any): Promise<void> {
        // Implementación simplificada - sin persistencia de mensajes por ahora
        // Log técnico removido - solo para sistema de logs interno
    }

    public async getMessages(openaiThreadId: string, limit?: number): Promise<any[]> {
        // Implementación simplificada - retorna array vacío
        return [];
    }

    // --- Operaciones de Limpieza ---
    public async cleanup(): Promise<void> {
        // Limpiar clientes inactivos después de 30 días
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        await this.prisma.clientView.deleteMany({
            where: {
                lastActivity: { lt: thirtyDaysAgo }
            }
        });
    }

    // --- Estadísticas ---
    public async getStats(): Promise<any> {
        if (this.isConnected) {
            try {
                const clientCount = await this.prisma.clientView.count();
                return {
                    users: clientCount,
                    threads: clientCount,
                    messages: 0,
                    timestamp: new Date(),
                    mode: 'PostgreSQL',
                    memoryFallback: this.memoryStore.threads.size
                };
            } catch (error) {
                console.warn(`⚠️ Error obteniendo estadísticas de PostgreSQL: ${error instanceof Error ? error.message : error}`);
                this.isConnected = false;
            }
        }
        
        // Fallback to memory stats
        return {
            users: this.memoryStore.threads.size,
            threads: this.memoryStore.threads.size,
            messages: 0,
            timestamp: new Date(),
            mode: 'Memory Fallback',
            memoryFallback: this.memoryStore.threads.size
        };
    }

    // --- CRM Methods ---
    public async getClientByPhone(phoneNumber: string): Promise<any> {
        return await this.findUserByPhoneNumber(phoneNumber);
    }

    public async updateClient(phoneNumber: string, data: any): Promise<void> {
        if (this.isConnected) {
            try {
                await this.prisma.clientView.update({
                    where: { phoneNumber },
                    data
                });
                console.log(`✅ Cliente actualizado: ${phoneNumber}`);
            } catch (error) {
                console.error(`❌ Error actualizando cliente ${phoneNumber}:`, error);
                throw error;
            }
        } else {
            // Fallback to memory
            const existing = this.memoryStore.users.get(phoneNumber);
            if (existing) {
                this.memoryStore.users.set(phoneNumber, { ...existing, ...data });
            }
        }
    }

    public async getClientsWithActionToday(): Promise<any[]> {
        if (this.isConnected) {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                return await this.prisma.clientView.findMany({
                    where: {
                        fechaProximaAccion: {
                            gte: today,
                            lt: tomorrow
                        }
                    }
                });
            } catch (error) {
                console.error('Error obteniendo clientes para hoy:', error);
                return [];
            }
        } else {
            // Fallback to memory - simple implementation
            return [];
        }
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

    // --- Enriquecimiento automático ---
    private shouldEnrichUser(user: any): boolean {
        // Enriquecer si el nombre es igual al teléfono (datos incompletos) o no hay etiquetas
        const nameEqualsPhone = user.name === user.phoneNumber;
        const hasNoLabels = !user.label1 && !user.label2 && !user.label3;
        return nameEqualsPhone || hasNoLabels;
    }

    private async enrichUserFromWhapi(phoneNumber: string): Promise<void> {
        try {
            const chatId = `${phoneNumber}@s.whatsapp.net`;
            const whapiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
            const whapiToken = process.env.WHAPI_TOKEN;

            if (!whapiToken) {
                console.warn('⚠️ WHAPI_TOKEN no disponible para enriquecimiento');
                return;
            }

            const response = await fetchWithRetry(`${whapiUrl}/chats/${encodeURIComponent(chatId)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${whapiToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`⚠️ Error ${response.status} enriqueciendo usuario ${phoneNumber}`);
                return;
            }

            const chatInfo = await response.json() as any;
            const realName = (chatInfo as any).name || (chatInfo as any).last_message?.from_name || null;
            const labels = (chatInfo as any).labels || [];

            if (realName || labels.length > 0) {
                const updateData: any = {};
                
                if (realName && realName !== phoneNumber) {
                    updateData.name = realName;
                    updateData.userName = realName;
                }

                if (labels.length > 0) {
                    updateData.label1 = labels[0]?.name || labels[0] || null;
                    updateData.label2 = labels[1]?.name || labels[1] || null;
                    updateData.label3 = labels[2]?.name || labels[2] || null;
                }

                await this.prisma.clientView.update({
                    where: { phoneNumber },
                    data: updateData
                });

                console.log(`✅ Usuario enriquecido automáticamente: ${phoneNumber} → ${realName || 'sin nombre'}, ${labels.length} etiquetas`);
            }
        } catch (error) {
            console.warn(`⚠️ Error enriqueciendo usuario ${phoneNumber}:`, error);
        }
    }
}