// src/core/services/database.service.ts
import { PrismaClient } from '@prisma/client';
import { ThreadRecord } from '../../shared/types';
import { fetchWithRetry } from '../utils/retry-utils';
import { logError, logInfo, logWarning } from '../../utils/logging';
import type { ClientDataCache } from '../state/client-data-cache';
// 🔧 NUEVO: Importar logging compacto
import { logDatabaseOperation, logThreadUsage } from '../../utils/logging/integrations';
import { setCacheSize } from '../../utils/logging/collectors';

// ELIMINADO: MemoryStore interface - migrado a ClientDataCache unificado

export class DatabaseService {
    private prisma: PrismaClient;
    private isConnected: boolean = false;
    private connectionRetries: number = 0;
    private maxRetries: number = 3;
    private clientCache?: ClientDataCache;

    constructor() {
        this.prisma = new PrismaClient({
            log: ['warn', 'error'],
        });
        
        // ELIMINADO: memoryStore completamente migrado a ClientDataCache unificado
    }

    // Helper para crear entrada de cache por defecto
    private createDefaultCacheEntry(phoneNumber: string) {
        return {
            phoneNumber,
            name: null,
            userName: null,
            labels: [],
            chatId: null,
            threadId: null,
            lastActivity: new Date(),
            threadTokenCount: 0
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
            logInfo('DATABASE_CONNECTION', '🗄️ Conectado a la base de datos PostgreSQL.', {}, 'database.service.ts');
            
            // Log técnico de sesión
            const { logSuccess } = require('../../utils/logging');
            logSuccess('DATABASE_CONNECTED', 'Conexión exitosa a PostgreSQL', {
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'unknown',
                environment: process.env.NODE_ENV || 'development'
            }, 'database.service.ts');
            
            // Sync memory data to database if we were in fallback mode
            await this.syncMemoryToDatabase();
            
        } catch (error) {
            this.isConnected = false;
            this.connectionRetries++;
            logWarning('DATABASE_CONNECTION', `⚠️ Error conectando a PostgreSQL (intento ${this.connectionRetries}/${this.maxRetries})`, { error: error instanceof Error ? error.message : error });
            
            if (this.connectionRetries >= this.maxRetries) {
                logInfo('DATABASE_FALLBACK', '🔄 Activando modo fallback a memoria...', {}, 'database.service.ts');
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

    public getClientCache(): ClientDataCache | undefined {
        return this.clientCache;
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
                    labels: labelsString,
                    lastActivity: new Date(),
                };

                try {
                    // CRÍTICO: Usar phoneNumber como PK principal para evitar constraint conflicts
                    await this.prisma.clientView.upsert({
                        where: { phoneNumber: userId },
                        update: clientViewData,
                        create: {
                            phoneNumber: userId,
                            ...clientViewData
                        }
                    });
                } catch (error: any) {
                    // MEJORADO: Manejo más robusto de constraint duplicado en chatId
                    const msg = typeof error?.message === 'string' ? error.message : String(error);
                    if (msg.includes('Unique constraint') && msg.includes('chatId')) {
                        logWarning('CHATID_CONSTRAINT_ERROR', 'Resolviendo constraint duplicado de chatId', {
                            userId,
                            threadId: threadData.threadId,
                            chatId: threadData.chatId,
                            error: msg.substring(0, 200)
                        });
                        
                        // Estrategia: preservar chatId existente, actualizar otros campos
                        const { chatId, ...restData } = clientViewData as any;
                        await this.prisma.clientView.upsert({
                            where: { phoneNumber: userId },
                            update: restData, // actualizar todo menos chatId
                            create: {
                                phoneNumber: userId,
                                ...restData,
                                chatId: threadData.chatId || undefined // usar chatId original si existe, sino omitir
                            }
                        });
                        
                        logInfo('CHATID_CONSTRAINT_RESOLVED', 'Constraint resuelto - chatId preservado', { userId }, 'database.service.ts');
                    } else {
                        logError('DATABASE_ERROR', `Error guardando thread en BD: ${msg}`, { userId, threadId: threadData.threadId, operation: 'setThread' }, 'database.service.ts');
                        // Solo desconectar BD por errores de conectividad, no constraints
                        if (msg.includes('connect') || msg.includes('timeout') || msg.includes('network')) {
                            this.isConnected = false;
                        }
                        throw error;
                    }
                }
                
                logInfo('THREAD_SAVED_SIMPLE', `✅ Thread guardado con lógica simplificada: ${userId}`, { userId }, 'database.service.ts');
                
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
                logWarning('THREAD_SAVE_ERROR', `⚠️ Error guardando en PostgreSQL, usando cache unificado`, { error: error instanceof Error ? error.message : error }, 'database.service.ts');
                this.isConnected = false;
                // Fallback to unified cache
                if (this.clientCache) {
                    const cached = this.clientCache.get(userId) || this.createDefaultCacheEntry(userId);
                    Object.assign(cached, {
                        threadId: threadRecord.threadId,
                        threadTokenCount: threadRecord.tokenCount,
                        lastActivity: threadRecord.lastActivity
                    });
                    this.clientCache.set(userId, cached);
                }
            }
        } else {
            // Store in unified cache
            if (this.clientCache) {
                const cached = this.clientCache.get(userId) || this.createDefaultCacheEntry(userId);
                Object.assign(cached, {
                    threadId: threadRecord.threadId,
                    threadTokenCount: threadRecord.tokenCount,
                    lastActivity: threadRecord.lastActivity
                });
                this.clientCache.set(userId, cached);
            }
            logInfo('THREAD_CACHE_SAVE', `💾 Thread guardado en cache unificado (fallback): ${userId}`, { userId });
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
                        // THREAD REUSADO: Sumar tokens BD + acumulados (lógica simplificada)
                        const currentTokens = current.threadTokenCount || 0;
                        updateData.threadTokenCount = currentTokens + tokenCount;
                        logInfo('THREAD_TOKENS_ACCUMULATED_SIMPLE', `Thread reusado - tokens acumulados: ${currentTokens} + ${tokenCount}`, {
                            userId, threadId: currentThreadId, previousTokens: currentTokens, newTokens: tokenCount, total: currentTokens + tokenCount
                        }, 'database.service.ts');
                    } else {
                        // THREAD NUEVO: Empezar desde tokens del run actual (lógica simplificada)
                        updateData.threadTokenCount = tokenCount;
                        updateData.threadId = currentThreadId; // Actualizar threadId también
                        
                        logInfo('THREAD_TOKENS_NEW_SIMPLE', `Thread nuevo - iniciando con tokens: ${tokenCount}`, {
                            userId, 
                            threadId: currentThreadId, 
                            initialTokens: tokenCount,
                            reason: 'simplified_new_thread'
                        }, 'database.service.ts');
                    }
                } else if (tokenCount !== undefined && tokenCount <= 0) {
                    // Log cuando se skip por tokens inválidos
                    logInfo('TOKEN_COUNT_SKIPPED', 'Token count inválido - solo actualiza lastActivity', {
                        userId,
                        tokenCount,
                        threadId: currentThreadId,
                        reason: 'invalid_token_count'
                    }, 'database.service.ts');
                }
                
                await this.prisma.clientView.upsert({
                    where: { phoneNumber: userId },
                    update: updateData,
                    create: {
                        phoneNumber: userId,
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
                                // Actualizar tamaño del cache en métricas
                                setCacheSize(this.clientCache.getStats().size);
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
                logError('DATABASE_ERROR', `Error actualizando activity, usando memoria: ${error instanceof Error ? error.message : error}`, { userId, operation: 'updateThreadActivity' }, 'database.service.ts');
                this.isConnected = false;
                
                // Fallback: actualizar en cache
                if (this.clientCache) {
                    const cached = this.clientCache.get(userId);
                    if (cached) {
                        cached.lastActivity = new Date();
                        this.clientCache.set(userId, cached);
                        return true;
                    }
                }
                return false;
            }
        } else {
            // DB desconectada: actualizar en cache
            if (this.clientCache) {
                const cached = this.clientCache.get(userId);
                if (cached) {
                    cached.lastActivity = new Date();
                    this.clientCache.set(userId, cached);
                    return true;
                }
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
                    tokenCount: client.threadTokenCount || 0
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
                logError('DATABASE_ERROR', `Error leyendo de PostgreSQL, usando cache: ${error instanceof Error ? error.message : error}`, { userId, operation: 'getThread' }, 'database.service.ts');
                this.isConnected = false;
                // Fallback to cache
                if (this.clientCache) {
                    const cached = this.clientCache.get(userId);
                    if (cached?.threadId) {
                        return {
                            threadId: cached.threadId,
                            chatId: cached.chatId || '',
                            userName: cached.userName,
                            lastActivity: cached.lastActivity,
                            labels: cached.labels,
                            tokenCount: cached.threadTokenCount || 0
                        };
                    }
                }
                return null;
            }
        } else {
            // Read from cache
            if (this.clientCache) {
                const cached = this.clientCache.get(userId);
                if (cached?.threadId) {
                    return {
                        threadId: cached.threadId,
                        chatId: cached.chatId || '',
                        userName: cached.userName,
                        lastActivity: cached.lastActivity,
                        labels: cached.labels,
                        tokenCount: cached.threadTokenCount || 0
                    };
                }
            }
            return null;
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
                logWarning('THREAD_DELETE_ERROR', `⚠️ Error eliminando thread de PostgreSQL, usando cache`, { error: error instanceof Error ? error.message : error }, 'database.service.ts');
                this.isConnected = false;
                // Fallback to cache deletion
                if (this.clientCache) {
                    const cached = this.clientCache.get(userId);
                    if (cached) {
                        cached.threadId = null;
                        cached.threadTokenCount = 0;
                        this.clientCache.set(userId, cached);
                    }
                }
                return true;
            }
        } else {
            // Delete from cache
            if (this.clientCache) {
                const cached = this.clientCache.get(userId);
                if (cached) {
                    cached.threadId = null;
                    cached.threadTokenCount = 0;
                    this.clientCache.set(userId, cached);
                }
            }
            return true;
        }
    }

    // --- Métodos de Sincronización (Deprecado - Cache unificado no necesita sync) ---
    private async syncMemoryToDatabase(): Promise<void> {
        // DEPRECADO: Cache unificado no necesita sync manual
        // El ClientDataCache mantiene consistencia automáticamente
        logInfo('SYNC_DEPRECATED', `Sync deprecado - Cache unificado mantiene consistencia automática`, {}, 'database.service.ts');
    }

    public async forceSync(): Promise<void> {
        await this.syncMemoryToDatabase();
    }

    public getConnectionStatus(): { connected: boolean; mode: string; memoryItems: number } {
        return {
            connected: this.isConnected,
            mode: this.isConnected ? 'PostgreSQL' : 'Cache Fallback',
            memoryItems: this.clientCache?.getStats().size || 0
        };
    }

    // --- Operaciones con Usuarios ---
    public async findUserByPhoneNumber(phoneNumber: string) {
        if (this.isConnected) {
            try {
                return await this.prisma.clientView.findUnique({ where: { phoneNumber } });
            } catch (error) {
                logError('DATABASE_ERROR', `Error buscando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`, { phoneNumber, operation: 'findUserByPhoneNumber' }, 'database.service.ts');
                this.isConnected = false;
                return null;
            }
        } else {
            // Check cache
            if (this.clientCache) {
                const cached = this.clientCache.get(phoneNumber);
                return cached ? {
                    phoneNumber,
                    name: cached.name,
                    userName: cached.userName,
                    threadId: cached.threadId,
                    chatId: cached.chatId,
                    lastActivity: cached.lastActivity
                } : null;
            }
            return null;
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
                logError('DATABASE_ERROR', `Error creando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`, { phoneNumber, operation: 'createUser' }, 'database.service.ts');
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
        
        // Store in unified cache
        if (this.clientCache) {
            const cached = this.clientCache.get(phoneNumber) || this.createDefaultCacheEntry(phoneNumber);
            Object.assign(cached, userData);
            this.clientCache.set(phoneNumber, cached);
        }
        return userData;
    }

    // --- Método específico para webhook ---
    public async upsertClient(clientData: {
        phoneNumber: string;
        userName: string;
        chatId: string;
        lastActivity: Date;
        chat_name?: string;  // Nuevo: nombre del chat
        from_name?: string;  // Nuevo: display name del perfil
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
                
                // NAME (chat_name): Solo actualizar si hay discrepancia o está vacío
                if (clientData.chat_name && clientData.chat_name !== existingClient?.name) {
                    updateData.name = clientData.chat_name !== clientData.phoneNumber ? clientData.chat_name : null;
                }
                
                // USERNAME (from_name): Solo actualizar si hay discrepancia o está vacío  
                if (clientData.from_name && clientData.from_name !== existingClient?.userName) {
                    updateData.userName = clientData.from_name !== clientData.phoneNumber ? clientData.from_name : null;
                } else if (!existingClient?.userName) {
                    // Fallback: usar userName original si no hay from_name
                    updateData.userName = clientData.userName !== clientData.phoneNumber ? clientData.userName : null;
                }
                
                // Limpieza adicional: Si los valores finales son phoneNumber, mantenerlos null
                if (updateData.name === clientData.phoneNumber) updateData.name = null;
                if (updateData.userName === clientData.phoneNumber) updateData.userName = null;
                
                // Usar upsert por phoneNumber (PK)
                const result = await this.prisma.clientView.upsert({
                    where: { phoneNumber: clientData.phoneNumber },
                    update: updateData,
                    create: {
                        phoneNumber: clientData.phoneNumber,
                        name: clientData.chat_name !== clientData.phoneNumber ? clientData.chat_name : null,
                        userName: clientData.from_name !== clientData.phoneNumber ? clientData.from_name : 
                                 (clientData.userName !== clientData.phoneNumber ? clientData.userName : null),
                        chatId: clientData.chatId,
                        lastActivity: clientData.lastActivity,
                        threadTokenCount: 0 // Inicializar contador tokens
                    }
                });
                
                // NUEVO: Sincronizar clientCache después de BD update exitoso
                if (this.clientCache && result) {
                    try {
                        // Obtener o crear entrada en clientCache
                        const existingCacheData = this.clientCache.get(clientData.phoneNumber) || {
                            phoneNumber: clientData.phoneNumber,
                            name: null,
                            userName: null,
                            labels: [],
                            chatId: null,
                            threadId: null,
                            lastActivity: new Date(),
                            cachedAt: new Date(),
                            threadTokenCount: 0
                        };
                        
                        // Actualizar con datos del webhook + BD preservando threadId existente
                        existingCacheData.name = result.name || existingCacheData.name;
                        existingCacheData.userName = result.userName || existingCacheData.userName;
                        existingCacheData.chatId = result.chatId || existingCacheData.chatId;
                        existingCacheData.lastActivity = result.lastActivity;
                        existingCacheData.cachedAt = new Date();
                        
                        // CRÍTICO: Sincronizar labels desde BD si no están en cache
                        if (result.labels && (!existingCacheData.labels || existingCacheData.labels.length === 0)) {
                            existingCacheData.labels = Array.isArray(result.labels) ? result.labels : 
                                (typeof result.labels === 'string' ? result.labels.split('/').filter(Boolean) : []);
                        }
                        
                        // IMPORTANTE: Preservar threadId y threadTokenCount existentes
                        
                        this.clientCache.set(clientData.phoneNumber, existingCacheData);
                        console.info(`WEBHOOK_CACHE_SYNC: Updated clientCache for ${clientData.phoneNumber}, preserving threadId: ${existingCacheData.threadId}`);
                    } catch (cacheError) {
                        console.warn(`Error syncing webhook data to clientCache: ${cacheError}`);
                    }
                }
                
                return result;
            } catch (error) {
                logError('DATABASE_ERROR', `Error guardando cliente en BD: ${error instanceof Error ? error.message : error}`, { phoneNumber: clientData.phoneNumber, operation: 'saveClient' }, 'database.service.ts');
                
                // Para constraint errors, no desconectar BD inmediatamente - es recoverable
                if (error instanceof Error && error.message.includes('Unique constraint failed')) {
                    logWarning('CONSTRAINT_ERROR_RECOVERABLE', `Constraint error recoverable, manteniendo conexión BD`, { 
                        phoneNumber: clientData.phoneNumber, 
                        error: error.message 
                    }, 'database.service.ts');
                } else {
                    // Otros errores sí marcan BD como desconectada
                    this.isConnected = false;
                }
                
                // Fallback to unified cache
                if (this.clientCache) {
                    const cached = this.clientCache.get(clientData.phoneNumber) || this.createDefaultCacheEntry(clientData.phoneNumber);
                    Object.assign(cached, clientData);
                    this.clientCache.set(clientData.phoneNumber, cached);
                }
            }
        } else {
            // Fallback to unified cache
            if (this.clientCache) {
                const cached = this.clientCache.get(clientData.phoneNumber) || this.createDefaultCacheEntry(clientData.phoneNumber);
                Object.assign(cached, clientData);
                this.clientCache.set(clientData.phoneNumber, cached);
            }
            logInfo('CLIENT_CACHE_SAVE', `💾 Cliente guardado en cache unificado: ${clientData.phoneNumber}`, { phoneNumber: clientData.phoneNumber }, 'database.service.ts');
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
                    cacheSize: this.clientCache?.getStats().size || 0
                };
            } catch (error) {
                logWarning('STATS_ERROR', `⚠️ Error obteniendo estadísticas de PostgreSQL`, { error: error instanceof Error ? error.message : error }, 'database.service.ts');
                this.isConnected = false;
            }
        }
        
        // Fallback to memory stats
        return {
            users: this.clientCache?.getStats().size || 0,
            threads: this.clientCache?.getStats().size || 0,
            messages: 0,
            timestamp: new Date(),
            mode: 'Memory Fallback',
            cacheSize: this.clientCache?.getStats().size || 0
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
                logInfo('DATABASE_UPDATE', `Cliente actualizado: ${phoneNumber}`, { phoneNumber, operation: 'updateClient' }, 'database.service.ts');
            } catch (error) {
                logError('DATABASE_ERROR', `Error actualizando cliente ${phoneNumber}`, { phoneNumber, operation: 'updateClient', error: error instanceof Error ? error.message : error }, 'database.service.ts');
                throw error;
            }
        } else {
            // Fallback to unified cache
            if (this.clientCache) {
                const existing = this.clientCache.get(phoneNumber);
                if (existing) {
                    Object.assign(existing, data);
                    this.clientCache.set(phoneNumber, existing);
                }
            }
        }
    }

    public async getClientsWithActionToday(): Promise<any[]> {
        // Bot no debe interactuar con columnas CRM - retorna vacío
        return [];
    }

    // --- Thread Token Management ---
    public async updateThreadTokenCount(phoneNumber: string, tokenCount: number): Promise<void> {
        if (this.isConnected) {
            try {
                // Obtener conteo actual de BD para detectar lag/inconsistencias
                const currentData = await this.prisma.clientView.findUnique({ 
                    where: { phoneNumber }, 
                    select: { threadTokenCount: true } 
                });
                
                const currentDbCount = currentData?.threadTokenCount || 0;
                
                // Detectar inconsistencias significativas
                if (tokenCount > currentDbCount) {
                    const diff = tokenCount - currentDbCount;
                    if (diff > 500) { // Threshold para detectar lags significativos
                        logWarning('TOKEN_DB_LAG_DETECTED', `Lag significativo detectado en BD tokens`, {
                            phoneNumber,
                            currentDbTokens: currentDbCount,
                            newTokens: tokenCount,
                            diff,
                            reason: 'delayed_update_catchup'
                        }, 'database.service.ts');
                    }
                }
                
                await this.prisma.clientView.update({
                    where: { phoneNumber },
                    data: { threadTokenCount: tokenCount }
                });
                
                // Sincronizar inmediatamente a cache para mantener frescura
                if (this.clientCache && this.clientCache.has(phoneNumber)) {
                    try {
                        const cached = this.clientCache.get(phoneNumber);
                        if (cached) {
                            cached.threadTokenCount = tokenCount;
                            cached.cachedAt = new Date(); // Marcar como fresco
                            this.clientCache.set(phoneNumber, cached);
                            setCacheSize(this.clientCache.getStats().size);
                        }
                    } catch (error) {
                        console.warn(`Cache sync failed for token update ${phoneNumber}:`, error);
                    }
                }
                
                logInfo('TOKEN_COUNT_UPDATE', `📊 Token count actualizado: ${phoneNumber} = ${tokenCount} tokens`, { 
                    phoneNumber, 
                    tokenCount,
                    previousTokens: currentDbCount,
                    increment: tokenCount - currentDbCount
                }, 'database.service.ts');
            } catch (error) {
                logWarning('TOKEN_COUNT_ERROR', `⚠️ Error actualizando token count para ${phoneNumber}`, { phoneNumber, tokenCount, error }, 'database.service.ts');
                // Si hay error, marcar como desconectado para intentar reconectar
                this.isConnected = false;
            }
        } else {
            // Intentar reconectar antes de saltar
            logInfo('BD_RECONNECT_ATTEMPT', `Intentando reconectar BD para token update: ${phoneNumber}`, { phoneNumber, tokenCount }, 'database.service.ts');
            await this.connect();
            
            if (this.isConnected) {
                // Reintentar después de reconexión exitosa
                return this.updateThreadTokenCount(phoneNumber, tokenCount);
            } else {
                logWarning('TOKEN_COUNT_SKIP', `Saltando actualización de tokens: BD desconectada`, { phoneNumber, tokenCount }, 'database.service.ts');
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
                logWarning('WHAPI_ENRICHMENT', 'WHAPI_TOKEN no disponible para enriquecimiento', { phoneNumber, operation: 'enrichUserFromWhapi' }, 'database.service.ts');
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
                logWarning('WHAPI_ENRICHMENT', `Error ${response.status} enriqueciendo usuario ${phoneNumber}`, { phoneNumber, statusCode: response.status, operation: 'enrichUserFromWhapi' }, 'database.service.ts');
                return;
            }

            const chatInfo = await response.json() as any;
            const labels = (chatInfo as any).labels || [];

            // Solo procesar labels - names ya vienen del webhook
            if (labels.length > 0) {
                const existingClient = await this.prisma.clientView.findUnique({
                    where: { phoneNumber }
                });
                
                const updateData: any = {};
                
                // LABELS: Solo actualizar si están vacíos o hay discrepancia
                const labelsArray = labels.map((label: any) => label?.name || label).filter(Boolean);
                const newLabelsString = labelsArray.join('/');
                
                if (!existingClient?.labels || existingClient.labels !== newLabelsString) {
                    updateData.labels = newLabelsString;
                }
                
                // Solo hacer update si hay cambios
                if (Object.keys(updateData).length > 0) {
                    await this.prisma.clientView.update({
                        where: { phoneNumber },
                        data: updateData
                    });

                    logInfo('USER_ENRICHMENT', `Labels actualizados automáticamente: ${phoneNumber} → ${labels.length} etiquetas`, { phoneNumber, labelsCount: labels.length, source: 'whapi_get', operation: 'enrichUserFromWhapi' }, 'database.service.ts');

                    // 🔧 NUEVO: Log compacto de operación DB
                    logDatabaseOperation(
                        phoneNumber,
                        'enrich',
                        Date.now() - enrichStart,
                        `labels=${labels.length}`,
                        true // cache updated
                    );
                }
            }
        } catch (error) {
            logError('WHAPI_ENRICHMENT', `Error enriqueciendo usuario ${phoneNumber}`, { phoneNumber, operation: 'enrichUserFromWhapi', error: error instanceof Error ? error.message : error }, 'database.service.ts');
        }
    }
}