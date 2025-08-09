// src/core/services/database.service.ts
import { PrismaClient } from '@prisma/client';
import { ThreadRecord } from '../../shared/types';
import { fetchWithRetry } from '../utils/retry-utils';
import { logError, logInfo, logWarning } from '../../utils/logging';
import type { ClientDataCache } from '../state/client-data-cache';
// 🔧 NUEVO: Importar logging compacto
import { logDatabaseOperation, logThreadUsage } from '../../utils/logging/integrations';

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
    private clientCache?: ClientDataCache;

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
            logInfo('DATABASE_CONNECTION', '🗄️ Conectado a la base de datos PostgreSQL.');
            
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
            logWarning('DATABASE_CONNECTION', `⚠️ Error conectando a PostgreSQL (intento ${this.connectionRetries}/${this.maxRetries})`, { error: error instanceof Error ? error.message : error });
            
            if (this.connectionRetries >= this.maxRetries) {
                logInfo('DATABASE_FALLBACK', '🔄 Activando modo fallback a memoria...');
                // Don't throw error, continue in memory mode
            } else {
                throw error;
            }
        }
    }

    // Método para inyectar el cache (evita dependencias circulares)
    public setClientCache(cache: ClientDataCache): void {
        this.clientCache = cache;
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
                // Map labels array to concatenated string
                const labels = threadData.labels || [];
                const labelsString = labels.length > 0 ? labels.join('/') : null;
                
                const clientViewData = {
                    threadId: threadData.threadId,
                    chatId: threadData.chatId,
                    userName: threadData.userName,
                    profileStatus: (threadData as any).profileStatus,
                    proximaAccion: (threadData as any).proximaAccion,
                    prioridad: (threadData as any).prioridad || 2,
                    labels: labelsString,
                    lastActivity: new Date(),
                };

                try {
                    await this.prisma.clientView.upsert({
                        where: { phoneNumber: userId },
                        update: clientViewData,
                        create: {
                            phoneNumber: userId,
                            ...clientViewData
                        }
                    });
                } catch (error: any) {
                    // Manejo simple: si falla por unique en chatId, rehacer sin tocar chatId
                    const msg = typeof error?.message === 'string' ? error.message : String(error);
                    if (msg.includes('Unique constraint') && msg.includes('chatId')) {
                        const { chatId, ...rest } = clientViewData as any;
                        await this.prisma.clientView.upsert({
                            where: { phoneNumber: userId },
                            update: rest, // evitar sobrescribir chatId existente
                            create: {
                                phoneNumber: userId,
                                ...rest,
                                chatId: threadData.chatId || chatId || undefined
                            }
                        });
                    } else {
                        throw error;
                    }
                }
                
                logInfo('THREAD_SAVED', `✅ Thread guardado en PostgreSQL: ${userId}`, { userId });
                
                // 🔧 NUEVO: Log compacto de thread usage
                if (threadData.threadId) {
                    logThreadUsage(
                        userId,
                        threadData.threadId,
                        0, // messageCount - no disponible aquí
                        0, // tokenCount - no disponible aquí
                        false, // reused - es un save, no reuse
                        0 // ageMinutes - no disponible aquí
                    );
                }
            } catch (error) {
                logWarning('THREAD_SAVE_ERROR', `⚠️ Error guardando en PostgreSQL, usando memoria`, { error: error instanceof Error ? error.message : error });
                this.isConnected = false;
                // Fallback to memory
                this.memoryStore.threads.set(userId, threadRecord);
            }
        } else {
            // Store in memory
            this.memoryStore.threads.set(userId, threadRecord);
            logInfo('THREAD_MEMORY_SAVE', `💾 Thread guardado en memoria (fallback): ${userId}`, { userId });
        }

        return threadRecord;
    }

    // Método optimizado para actualizar solo lastActivity
    // NOTA: El lastActivity se debe actualizar 10 minutos DESPUÉS del último mensaje
    // Esta función actualiza inmediatamente, el delay se maneja por un job separado
    public async updateThreadActivity(userId: string, tokenCount?: number, currentThreadId?: string): Promise<boolean> {
        if (this.isConnected) {
            try {
                const updateData: any = { lastActivity: new Date() };
                
                // Si se proporciona token count válido, manejar según thread nuevo vs reusado
                if (tokenCount !== undefined && tokenCount > 0 && currentThreadId) {
                    // Obtener datos actuales para verificar si es el mismo thread
                    const current = await this.prisma.clientView.findUnique({
                        where: { phoneNumber: userId },
                        select: { threadTokenCount: true, threadId: true }
                    });
                    
                    if (current && current.threadId === currentThreadId) {
                        // THREAD REUSADO: Sumar tokens BD + acumulados
                        const currentTokens = current.threadTokenCount || 0;
                        updateData.threadTokenCount = currentTokens + tokenCount;
                        logInfo('THREAD_TOKENS_ACCUMULATED', `Thread reusado: ${currentTokens} + ${tokenCount} = ${currentTokens + tokenCount}`, {
                            userId, threadId: currentThreadId, previousTokens: currentTokens, newTokens: tokenCount
                        });
                    } else {
                        // THREAD NUEVO: Empezar desde 0, ignorar BD
                        updateData.threadTokenCount = tokenCount;
                        updateData.threadId = currentThreadId; // Actualizar threadId también
                        
                        // Log detallado para monitoreo - distinguir casos
                        const resetReason = !current ? 'user_not_found' : 
                                          !current.threadId ? 'first_thread' : 
                                          'thread_changed';
                        
                        logInfo('THREAD_TOKENS_RESET', `Thread nuevo: empezando desde ${tokenCount} tokens`, {
                            userId, 
                            threadId: currentThreadId, 
                            oldThreadId: current?.threadId || null,
                            oldTokenCount: current?.threadTokenCount || 0,
                            newTokens: tokenCount,
                            resetReason: resetReason,
                            tokensLost: current?.threadTokenCount || 0
                        });
                    }
                } else if (tokenCount !== undefined && tokenCount <= 0) {
                    // Log cuando se skip por tokens inválidos
                    logInfo('TOKEN_COUNT_SKIPPED', 'Token count inválido - solo actualiza lastActivity', {
                        userId,
                        tokenCount,
                        threadId: currentThreadId,
                        reason: 'invalid_token_count'
                    });
                }
                
                await this.prisma.clientView.upsert({
                    where: { phoneNumber: userId },
                    update: updateData,
                    create: {
                        phoneNumber: userId,
                        prioridad: 2, // Valor por defecto (MEDIA)
                        ...updateData
                    }
                });
                
                // Actualizar cache si está disponible con manejo de errores
                if (this.clientCache) {
                    try {
                        if (this.clientCache.has(userId)) {
                            const cached = this.clientCache.get(userId);
                            if (cached) {
                                // Actualizar los datos en cache
                                cached.lastActivity = updateData.lastActivity;
                                if (updateData.threadTokenCount !== undefined) {
                                    cached.threadTokenCount = updateData.threadTokenCount;
                                }
                                // Re-guardar en cache
                                this.clientCache.set(userId, cached);
                            }
                        }
                    } catch (error) {
                        logWarning('CACHE_UPDATE_FROM_BD_ERROR', 'Error actualizando cache desde BD, continuando', {
                            userId,
                            error: error instanceof Error ? error.message : String(error),
                            operation: 'cache_update_from_bd',
                            hasTokenCount: updateData.threadTokenCount !== undefined
                        });
                    }
                }
                
                const logMessage = tokenCount !== undefined 
                    ? `Thread activity + tokens actualizados: ${userId} (${tokenCount} tokens)`
                    : `Thread activity actualizada: ${userId}`;
                logInfo('THREAD_ACTIVITY_UPDATED', logMessage, { 
                    userId, 
                    tokenCount,
                    cacheUpdated: !!this.clientCache?.has(userId)
                });
                return true;
            } catch (error) {
                logError('DATABASE_ERROR', `Error actualizando activity, usando memoria: ${error instanceof Error ? error.message : error}`, { userId, operation: 'updateThreadActivity' });
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
        const getStart = Date.now(); // 🔧 NUEVO: Capturar tiempo inicio
        if (this.isConnected) {
            try {
                const client = await this.prisma.clientView.findUnique({
                    where: { phoneNumber: userId }
                });

                if (!client) {
                    // 🔧 NUEVO: Log compacto de operación DB para not found
                    logDatabaseOperation(
                        userId,
                        'thread_fetch',
                        Date.now() - getStart,
                        'not_found',
                        false // no cache update
                    );
                    return null;
                }

                // OPTIMIZADO: Enriquecimiento automático deshabilitado - se hace via hook externo
                // Solo usar datos del cliente actual sin enriquecer automáticamente
                const result = {
                    threadId: client.threadId || '',
                    chatId: client.chatId || '',
                    userName: client.userName,
                    lastActivity: client.lastActivity,
                    labels: client.labels ? client.labels.split('/') : [],
                };
                
                // 🔧 NUEVO: Log compacto de operación DB
                logDatabaseOperation(
                    userId,
                    'thread_fetch',
                    Date.now() - getStart,
                    `thread:${result.threadId?.substring(0, 8)}...`,
                    false // no cache update
                );
                
                return result;
            } catch (error) {
                logError('DATABASE_ERROR', `Error leyendo de PostgreSQL, usando memoria: ${error instanceof Error ? error.message : error}`, { userId, operation: 'getThread' });
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
                logWarning('THREAD_DELETE_ERROR', `⚠️ Error eliminando thread de PostgreSQL, usando memoria`, { error: error instanceof Error ? error.message : error });
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

        logInfo('SYNC_START', `🔄 Sincronizando ${this.memoryStore.threads.size} threads de memoria a PostgreSQL...`, { threadsCount: this.memoryStore.threads.size });
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
                logWarning('SYNC_ERROR', `⚠️ Error sincronizando thread ${userId}`, { userId, error: error instanceof Error ? error.message : error });
            }
        }

        if (syncedCount > 0) {
            logInfo('SYNC_COMPLETE', `✅ ${syncedCount} threads sincronizados a PostgreSQL`, { syncedCount });
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
                logError('DATABASE_ERROR', `Error buscando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`, { phoneNumber, operation: 'findUserByPhoneNumber' });
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
                logError('DATABASE_ERROR', `Error creando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`, { phoneNumber, operation: 'createUser' });
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
                // Primero obtener datos existentes para comparar discrepancias
                const existingClient = await this.prisma.clientView.findUnique({
                    where: { phoneNumber: clientData.phoneNumber }
                });
                
                // Preparar datos de actualización
                const updateData: any = {
                    phoneNumber: clientData.phoneNumber,
                    chatId: clientData.chatId,
                    // lastActivity se actualiza 10 minutos DESPUÉS del último mensaje
                    // Por ahora solo actualizamos inmediatamente, el delay se maneja en otro job
                    lastActivity: clientData.lastActivity
                };
                
                // USERNAME: Solo actualizar si hay discrepancia o está vacío
                if (!existingClient || 
                    !existingClient.userName || 
                    existingClient.userName !== clientData.userName) {
                    updateData.userName = clientData.userName;
                }
                
                // Usar upsert por phoneNumber (PK)
                const result = await this.prisma.clientView.upsert({
                    where: { phoneNumber: clientData.phoneNumber },
                    update: updateData,
                    create: {
                        phoneNumber: clientData.phoneNumber,
                        userName: clientData.userName,
                        chatId: clientData.chatId,
                        lastActivity: clientData.lastActivity,
                        prioridad: 2, // Valor por defecto (MEDIA)
                        threadTokenCount: 0 // Inicializar contador tokens
                    }
                });
                
                return result;
            } catch (error) {
                logError('DATABASE_ERROR', `Error guardando cliente en BD: ${error instanceof Error ? error.message : error}`, { phoneNumber: clientData.phoneNumber, operation: 'saveClient' });
                this.isConnected = false;
                // Fallback to memory
                this.memoryStore.users.set(clientData.phoneNumber, clientData);
            }
        } else {
            // Fallback to memory
            this.memoryStore.users.set(clientData.phoneNumber, clientData);
            logInfo('CLIENT_MEMORY_SAVE', `💾 Cliente guardado en memoria: ${clientData.phoneNumber}`, { phoneNumber: clientData.phoneNumber });
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
                logWarning('STATS_ERROR', `⚠️ Error obteniendo estadísticas de PostgreSQL`, { error: error instanceof Error ? error.message : error });
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
                logInfo('DATABASE_UPDATE', `Cliente actualizado: ${phoneNumber}`, { phoneNumber, operation: 'updateClient' });
            } catch (error) {
                logError('DATABASE_ERROR', `Error actualizando cliente ${phoneNumber}`, { phoneNumber, operation: 'updateClient', error: error instanceof Error ? error.message : error });
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
                logError('DATABASE_ERROR', 'Error obteniendo clientes para hoy', { operation: 'getClientsToday', error: error instanceof Error ? error.message : error });
                return [];
            }
        } else {
            // Fallback to memory - simple implementation
            return [];
        }
    }

    // --- Thread Token Management ---
    public async updateThreadTokenCount(phoneNumber: string, tokenCount: number): Promise<void> {
        if (this.isConnected) {
            try {
                await this.prisma.clientView.update({
                    where: { phoneNumber },
                    data: { threadTokenCount: tokenCount }
                });
                logInfo('TOKEN_COUNT_UPDATE', `📊 Token count actualizado: ${phoneNumber} = ${tokenCount} tokens`, { phoneNumber, tokenCount });
            } catch (error) {
                logWarning('TOKEN_COUNT_ERROR', `⚠️ Error actualizando token count para ${phoneNumber}`, { phoneNumber, error });
            }
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
        const hasNoLabels = !user.labels;
        return nameEqualsPhone || hasNoLabels;
    }

    public async enrichUserFromWhapi(phoneNumber: string): Promise<void> {
        const enrichStart = Date.now(); // 🔧 NUEVO: Capturar tiempo inicio
        try {
            const chatId = `${phoneNumber}@s.whatsapp.net`;
            const whapiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
            const whapiToken = process.env.WHAPI_TOKEN;

            if (!whapiToken) {
                logWarning('WHAPI_ENRICHMENT', 'WHAPI_TOKEN no disponible para enriquecimiento', { phoneNumber, operation: 'enrichUserFromWhapi' });
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
                logWarning('WHAPI_ENRICHMENT', `Error ${response.status} enriqueciendo usuario ${phoneNumber}`, { phoneNumber, statusCode: response.status, operation: 'enrichUserFromWhapi' });
                return;
            }

            const chatInfo = await response.json() as any;
            const realName = (chatInfo as any).name || (chatInfo as any).last_message?.from_name || null;
            const labels = (chatInfo as any).labels || [];

            if (realName || labels.length > 0) {
                const updateData: any = {};
                
                // NAME: Solo actualizar si hay discrepancia o está vacío
                const existingClient = await this.prisma.clientView.findUnique({
                    where: { phoneNumber }
                });
                
                if (realName && realName !== phoneNumber) {
                    // Solo actualizar name si es diferente del actual
                    if (!existingClient?.name || existingClient.name !== realName) {
                        updateData.name = realName;
                    }
                    // Solo actualizar userName si es diferente del actual
                    if (!existingClient?.userName || existingClient.userName !== realName) {
                        updateData.userName = realName;
                    }
                }

                // LABELS: Solo actualizar si están vacíos o hay discrepancia
                if (labels.length > 0) {
                    const labelsArray = labels.map((label: any) => label?.name || label).filter(Boolean);
                    const newLabelsString = labelsArray.join('/');
                    
                    if (!existingClient?.labels || existingClient.labels !== newLabelsString) {
                        updateData.labels = newLabelsString;
                    }
                }
                
                // Solo hacer update si hay cambios
                if (Object.keys(updateData).length > 0) {
                    await this.prisma.clientView.update({
                        where: { phoneNumber },
                        data: updateData
                    });

                    logInfo('USER_ENRICHMENT', `Usuario enriquecido automáticamente: ${phoneNumber} → ${realName || 'sin nombre'}, ${labels.length} etiquetas`, { phoneNumber, realName, labelsCount: labels.length, operation: 'enrichUserFromWhapi' });

                    // 🔧 NUEVO: Log compacto de operación DB
                    logDatabaseOperation(
                        phoneNumber,
                        'enrich',
                        Date.now() - enrichStart,
                        `labels=${labels.length} name="${realName || 'unknown'}"`,
                        true // cache updated
                    );
                }
            }
        } catch (error) {
            logError('WHAPI_ENRICHMENT', `Error enriqueciendo usuario ${phoneNumber}`, { phoneNumber, operation: 'enrichUserFromWhapi', error: error instanceof Error ? error.message : error });
        }
    }
}