"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
// src/core/services/database.service.ts
const client_1 = require("@prisma/client");
const retry_utils_1 = require("../utils/retry-utils");
const logging_1 = require("../../utils/logging");
// 🔧 NUEVO: Importar logging compacto
const integrations_1 = require("../../utils/logging/integrations");
const collectors_1 = require("../../utils/logging/collectors");
const MOD = 'database.service.ts';
// ELIMINADO: MemoryStore interface - migrado a ClientDataCache unificado
class DatabaseService {
    constructor() {
        this.isConnected = false;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.prisma = new client_1.PrismaClient({
            log: ['warn', 'error'],
        });
        // ELIMINADO: memoryStore completamente migrado a ClientDataCache unificado
    }
    // Helper para crear entrada de cache por defecto
    createDefaultCacheEntry(phoneNumber) {
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
    get connected() {
        return this.isConnected;
    }
    get client() {
        return this.prisma;
    }
    async connect() {
        try {
            await this.prisma.$connect();
            this.isConnected = true;
            this.connectionRetries = 0;
            (0, logging_1.logInfo)('DATABASE_CONNECTION', '🗄️ Conectado a la base de datos PostgreSQL.', {}, MOD);
            // Log técnico de sesión
            const { logSuccess } = require('../../utils/logging');
            logSuccess('DATABASE_CONNECTED', 'Conexión exitosa a PostgreSQL', {
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'unknown',
                environment: process.env.NODE_ENV || 'development'
            }, MOD);
            // Sync memory data to database if we were in fallback mode
            await this.syncMemoryToDatabase();
        }
        catch (error) {
            this.isConnected = false;
            this.connectionRetries++;
            (0, logging_1.logWarning)('DATABASE_CONNECTION', `⚠️ Error conectando a PostgreSQL (intento ${this.connectionRetries}/${this.maxRetries})`, { error: error instanceof Error ? error.message : error });
            if (this.connectionRetries >= this.maxRetries) {
                (0, logging_1.logInfo)('DATABASE_FALLBACK', '🔄 Activando modo fallback a memoria...', {}, MOD);
                // Don't throw error, continue in memory mode
            }
            else {
                throw error;
            }
        }
    }
    // Método para inyectar el cache (evita dependencias circulares)
    setClientCache(cache) {
        this.clientCache = cache;
    }
    getClientCache() {
        return this.clientCache;
    }
    async disconnect() {
        await this.prisma.$disconnect();
    }
    // --- Operaciones con Threads ---
    async saveOrUpdateThread(userId, threadData) {
        const threadRecord = {
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
                // RECONCILIACIÓN PREVIA: evitar constraint conflicts desde el origen
                const byPhone = await this.prisma.whatsApp.findUnique({ where: { phoneNumber: userId } });
                const cid = threadData.chatId;
                const byChat = !byPhone && cid ? await this.prisma.whatsApp.findUnique({ where: { chatId: cid } }) : null;
                // Detectar campos cruzados (log-only, sin alterar flujo)
                if (byPhone && byChat && byPhone.phoneNumber !== byChat.phoneNumber) {
                    (0, logging_1.logWarning)('RECONCILE_CROSSED', 'Campos cruzados detectados', {
                        phone: byPhone.phoneNumber,
                        chat: byChat.chatId
                    }, MOD);
                }
                if (byPhone || byChat) {
                    // Actualizar la fila existente (sin tocar phoneNumber/chatId)
                    const existingPhone = (byPhone ?? byChat).phoneNumber;
                    const { phoneNumber, chatId, ...safeData } = clientViewData;
                    await this.prisma.whatsApp.update({
                        where: { phoneNumber: existingPhone },
                        data: safeData
                    });
                    (0, logging_1.logInfo)('RECONCILE_UPDATE', 'Registro actualizado por reconciliación', {
                        userId,
                        existingPhone,
                        op: 'setThread'
                    }, MOD);
                }
                else {
                    // No existe ninguno: crear con ambos únicos
                    await this.prisma.whatsApp.create({
                        data: {
                            phoneNumber: userId,
                            chatId: cid,
                            lastActivity: new Date(),
                            ...Object.fromEntries(Object.entries(clientViewData).filter(([k]) => k !== 'phoneNumber' && k !== 'chatId' && k !== 'lastActivity'))
                        }
                    });
                    (0, logging_1.logInfo)('RECONCILE_CREATE', 'Nuevo registro creado por reconciliación', {
                        userId,
                        chatId: cid,
                        op: 'setThread'
                    }, MOD);
                }
                (0, logging_1.logInfo)('THREAD_SAVED_SIMPLE', `✅ Thread guardado con lógica simplificada: ${userId}`, { userId }, MOD);
                // 🔧 NUEVO: Log compacto de thread usage
                if (threadData.threadId) {
                    (0, integrations_1.logThreadUsage)(userId, threadData.threadId, 0, // messageCount - no disponible aquí
                    0, // tokenCount - no disponible aquí
                    false, // reused - es un save, no reuse
                    0 // ageMinutes - no disponible aquí
                    );
                }
            }
            catch (error) {
                (0, logging_1.logWarning)('THREAD_SAVE_ERROR', `⚠️ Error guardando en PostgreSQL, usando cache unificado`, { error: error instanceof Error ? error.message : error }, MOD);
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
        }
        else {
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
            (0, logging_1.logInfo)('THREAD_CACHE_SAVE', `💾 Thread guardado en cache unificado (fallback): ${userId}`, { userId });
        }
        return threadRecord;
    }
    // Método optimizado para actualizar solo lastActivity
    // NOTA: El lastActivity se debe actualizar 10 minutos DESPUÉS del último mensaje
    // Esta función actualiza inmediatamente, el delay se maneja por un job separado
    async updateThreadActivity(userId, tokenCount, currentThreadId) {
        if (this.isConnected) {
            try {
                const updateData = { lastActivity: new Date() };
                // Si se proporciona token count válido, manejar según thread nuevo vs reusado
                if (tokenCount !== undefined && tokenCount > 0 && currentThreadId) {
                    // Obtener datos actuales para verificar si es el mismo thread
                    const current = await this.prisma.whatsApp.findUnique({
                        where: { phoneNumber: userId },
                        select: { threadTokenCount: true, threadId: true }
                    });
                    if (current && current.threadId === currentThreadId) {
                        // THREAD REUSADO: Sumar tokens BD + acumulados (lógica simplificada)
                        const currentTokens = current.threadTokenCount || 0;
                        updateData.threadTokenCount = currentTokens + tokenCount;
                        (0, logging_1.logInfo)('THREAD_TOKENS_ACCUMULATED_SIMPLE', `Thread reusado - tokens acumulados: ${currentTokens} + ${tokenCount}`, {
                            userId, threadId: currentThreadId, previousTokens: currentTokens, newTokens: tokenCount, total: currentTokens + tokenCount
                        }, MOD);
                    }
                    else {
                        // THREAD NUEVO: Empezar desde tokens del run actual (lógica simplificada)
                        updateData.threadTokenCount = tokenCount;
                        updateData.threadId = currentThreadId; // Actualizar threadId también
                        (0, logging_1.logInfo)('THREAD_TOKENS_NEW_SIMPLE', `Thread nuevo - iniciando con tokens: ${tokenCount}`, {
                            userId,
                            threadId: currentThreadId,
                            initialTokens: tokenCount,
                            reason: 'simplified_new_thread'
                        }, MOD);
                    }
                }
                else if (tokenCount !== undefined && tokenCount <= 0) {
                    // Log cuando se skip por tokens inválidos
                    (0, logging_1.logInfo)('TOKEN_COUNT_SKIPPED', 'Token count inválido - solo actualiza lastActivity', {
                        userId,
                        tokenCount,
                        threadId: currentThreadId,
                        reason: 'invalid_token_count'
                    }, MOD);
                }
                // RECONCILIACIÓN PREVIA: evitar constraint conflicts desde el origen
                const byPhone = await this.prisma.whatsApp.findUnique({ where: { phoneNumber: userId } });
                const cid = updateData.threadId; // En updateThreadActivity, chatId no está directamente disponible
                const byChat = !byPhone && cid ? await this.prisma.whatsApp.findUnique({ where: { chatId: cid } }) : null;
                if (byPhone || byChat) {
                    // Actualizar la fila existente (sin tocar phoneNumber/chatId)
                    const existingPhone = (byPhone ?? byChat).phoneNumber;
                    const { phoneNumber, chatId, ...safeData } = updateData;
                    await this.prisma.whatsApp.update({
                        where: { phoneNumber: existingPhone },
                        data: safeData
                    });
                    (0, logging_1.logInfo)('RECONCILE_UPDATE', 'Thread activity actualizado por reconciliación', {
                        userId,
                        existingPhone,
                        op: 'updateThreadActivity'
                    }, MOD);
                }
                else {
                    // No existe ninguno: crear registro básico
                    await this.prisma.whatsApp.create({
                        data: {
                            phoneNumber: userId,
                            lastActivity: new Date(),
                            ...Object.fromEntries(Object.entries(updateData).filter(([k]) => k !== 'phoneNumber' && k !== 'chatId' && k !== 'lastActivity'))
                        }
                    });
                    (0, logging_1.logInfo)('RECONCILE_CREATE', 'Registro básico creado por reconciliación', {
                        userId,
                        op: 'updateThreadActivity'
                    }, MOD);
                }
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
                                (0, collectors_1.setCacheSize)(this.clientCache.getStats().size);
                            }
                        }
                    }
                    catch (error) {
                        (0, logging_1.logWarning)('CACHE_UPDATE_FROM_BD_ERROR', 'Error actualizando cache desde BD, continuando', {
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
                (0, logging_1.logInfo)('THREAD_ACTIVITY_UPDATED', logMessage, {
                    userId,
                    tokenCount,
                    cacheUpdated: !!this.clientCache?.has(userId)
                });
                return true;
            }
            catch (error) {
                (0, logging_1.logError)('DATABASE_ERROR', `Error actualizando activity, usando memoria: ${error instanceof Error ? error.message : error}`, { userId, operation: 'updateThreadActivity' }, MOD);
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
        }
        else {
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
    async getThread(userId) {
        const getStart = Date.now(); // 🔧 NUEVO: Capturar tiempo inicio
        if (this.isConnected) {
            try {
                const client = await this.prisma.whatsApp.findUnique({
                    where: { phoneNumber: userId }
                });
                if (!client) {
                    // 🔧 NUEVO: Log compacto de operación DB para not found
                    (0, integrations_1.logDatabaseOperation)(userId, 'thread_fetch', Date.now() - getStart, 'not_found', false // no cache update
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
                (0, integrations_1.logDatabaseOperation)(userId, 'thread_fetch', Date.now() - getStart, `thread:${result.threadId?.substring(0, 8)}...`, false // no cache update
                );
                return result;
            }
            catch (error) {
                (0, logging_1.logError)('DATABASE_ERROR', `Error leyendo de PostgreSQL, usando cache: ${error instanceof Error ? error.message : error}`, { userId, operation: 'getThread' }, MOD);
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
        }
        else {
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
    async deleteThread(userId) {
        if (this.isConnected) {
            try {
                // Clear thread ID from database (but keep client record)
                await this.prisma.whatsApp.update({
                    where: { phoneNumber: userId },
                    data: {
                        threadId: null,
                        lastActivity: new Date()
                    }
                });
                return true;
            }
            catch (error) {
                (0, logging_1.logWarning)('THREAD_DELETE_ERROR', `⚠️ Error eliminando thread de PostgreSQL, usando cache`, { error: error instanceof Error ? error.message : error }, MOD);
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
        }
        else {
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
    async syncMemoryToDatabase() {
        // DEPRECADO: Cache unificado no necesita sync manual
        // El ClientDataCache mantiene consistencia automáticamente
        (0, logging_1.logInfo)('SYNC_DEPRECATED', `Sync deprecado - Cache unificado mantiene consistencia automática`, {}, MOD);
    }
    async forceSync() {
        await this.syncMemoryToDatabase();
    }
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            mode: this.isConnected ? 'PostgreSQL' : 'Cache Fallback',
            memoryItems: this.clientCache?.getStats().size || 0
        };
    }
    // --- Operaciones con Usuarios ---
    async findUserByPhoneNumber(phoneNumber) {
        if (this.isConnected) {
            try {
                return await this.prisma.whatsApp.findUnique({ where: { phoneNumber } });
            }
            catch (error) {
                (0, logging_1.logError)('DATABASE_ERROR', `Error buscando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`, { phoneNumber, operation: 'findUserByPhoneNumber' }, MOD);
                this.isConnected = false;
                return null;
            }
        }
        else {
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
    async getOrCreateUser(phoneNumber, name) {
        if (this.isConnected) {
            try {
                // RECONCILIACIÓN PREVIA: evitar constraint conflicts desde el origen
                const byPhone = await this.prisma.whatsApp.findUnique({ where: { phoneNumber } });
                // Para getOrCreateUser no hay chatId disponible, so solo verificar por phoneNumber
                let user;
                if (byPhone) {
                    // Actualizar la fila existente
                    user = await this.prisma.whatsApp.update({
                        where: { phoneNumber },
                        data: { name }
                    });
                    (0, logging_1.logInfo)('RECONCILE_UPDATE', 'Usuario actualizado por reconciliación', {
                        phoneNumber,
                        op: 'getOrCreateUser'
                    }, MOD);
                }
                else {
                    // No existe: crear nuevo (sin chatId para evitar conflicts)
                    user = await this.prisma.whatsApp.create({
                        data: { phoneNumber, name, lastActivity: new Date() }
                    });
                    (0, logging_1.logInfo)('RECONCILE_CREATE', 'Usuario creado por reconciliación', {
                        phoneNumber,
                        op: 'getOrCreateUser'
                    }, MOD);
                }
                // Si el usuario fue recién creado o tiene datos incompletos, intentar enriquecerlo
                if (this.shouldEnrichUser(user)) {
                    await this.enrichUserFromWhapi(phoneNumber);
                }
                return user;
            }
            catch (error) {
                (0, logging_1.logError)('DATABASE_ERROR', `Error creando usuario en PostgreSQL: ${error instanceof Error ? error.message : error}`, { phoneNumber, operation: 'createUser' }, MOD);
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
    async upsertClient(clientData) {
        if (this.isConnected) {
            try {
                // Primero obtener datos existentes para comparar discrepancias
                const existingClient = await this.prisma.whatsApp.findUnique({
                    where: { phoneNumber: clientData.phoneNumber }
                });
                // Preparar datos de actualización
                const updateData = {
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
                // USERNAME (from_name): ULTRA PERMISIVO - usar from_name tal como viene
                if (clientData.from_name && clientData.from_name !== existingClient?.userName) {
                    // Solo rechazar si es exactamente igual al phoneNumber, todo lo demás se acepta
                    updateData.userName = (clientData.from_name !== clientData.phoneNumber) ? clientData.from_name : null;
                    (0, logging_1.logInfo)('USERNAME_UPDATE_FROM_NAME', 'Actualizando userName desde from_name', {
                        phoneNumber: clientData.phoneNumber,
                        from_name: clientData.from_name,
                        existingUserName: existingClient?.userName,
                        newUserName: updateData.userName,
                        rejectedReason: (clientData.from_name === clientData.phoneNumber) ? 'equals_phoneNumber' : 'accepted'
                    });
                }
                else if (!existingClient?.userName) {
                    // Fallback: usar userName original si no hay from_name (ultra permisivo)
                    updateData.userName = (clientData.userName !== clientData.phoneNumber) ? clientData.userName : null;
                    (0, logging_1.logInfo)('USERNAME_UPDATE_FALLBACK', 'Actualizando userName desde fallback', {
                        phoneNumber: clientData.phoneNumber,
                        fallbackUserName: clientData.userName,
                        newUserName: updateData.userName,
                        rejectedReason: (clientData.userName === clientData.phoneNumber) ? 'equals_phoneNumber' : 'accepted',
                        reason: 'no_from_name_or_no_existing'
                    });
                }
                // ULTRA PERMISIVO: No hay limpieza adicional - se acepta tal como viene
                // RECONCILIACIÓN PREVIA: evitar constraint conflicts desde el origen
                const byPhone = await this.prisma.whatsApp.findUnique({ where: { phoneNumber: clientData.phoneNumber } });
                const cid = clientData.chatId;
                const byChat = !byPhone && cid ? await this.prisma.whatsApp.findUnique({ where: { chatId: cid } }) : null;
                // Detectar campos cruzados (log-only)
                if (byPhone && byChat && byPhone.phoneNumber !== byChat.phoneNumber) {
                    (0, logging_1.logWarning)('RECONCILE_CROSSED', 'Campos cruzados detectados en syncWhatsAppClient', {
                        phone: byPhone.phoneNumber,
                        chat: byChat.chatId,
                        incoming: clientData.phoneNumber
                    }, MOD);
                }
                let result;
                if (byPhone || byChat) {
                    // Actualizar la fila existente (sin tocar phoneNumber/chatId)
                    const existingPhone = (byPhone ?? byChat).phoneNumber;
                    const { phoneNumber, chatId, ...safeUpdateData } = updateData;
                    result = await this.prisma.whatsApp.update({
                        where: { phoneNumber: existingPhone },
                        data: safeUpdateData
                    });
                    (0, logging_1.logInfo)('RECONCILE_UPDATE', 'Cliente actualizado por reconciliación', {
                        phoneNumber: clientData.phoneNumber,
                        existingPhone,
                        op: 'syncWhatsAppClient',
                        hasChatId: !!cid
                    }, MOD);
                }
                else {
                    // No existe ninguno: crear con lógica ultra permisiva
                    result = await this.prisma.whatsApp.create({
                        data: {
                            phoneNumber: clientData.phoneNumber,
                            name: (clientData.chat_name && clientData.chat_name !== clientData.phoneNumber) ? clientData.chat_name : null,
                            userName: (clientData.from_name && clientData.from_name !== clientData.phoneNumber) ? clientData.from_name :
                                ((clientData.userName && clientData.userName !== clientData.phoneNumber) ? clientData.userName : null),
                            chatId: cid,
                            lastActivity: clientData.lastActivity,
                            threadTokenCount: 0
                        }
                    });
                    (0, logging_1.logInfo)('RECONCILE_CREATE', 'Cliente creado por reconciliación', {
                        phoneNumber: clientData.phoneNumber,
                        chatId: cid,
                        finalName: result.name,
                        finalUserName: result.userName,
                        chat_name_input: clientData.chat_name,
                        from_name_input: clientData.from_name,
                        op: 'syncWhatsAppClient'
                    }, MOD);
                }
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
                    }
                    catch (cacheError) {
                        console.warn(`Error syncing webhook data to clientCache: ${cacheError}`);
                    }
                }
                return result;
            }
            catch (error) {
                (0, logging_1.logError)('DATABASE_ERROR', `Error guardando cliente en BD: ${error instanceof Error ? error.message : error}`, { phoneNumber: clientData.phoneNumber, operation: 'saveClient' }, MOD);
                // Para constraint errors, no desconectar BD inmediatamente - es recoverable
                if (error instanceof Error && error.message.includes('Unique constraint failed')) {
                    (0, logging_1.logWarning)('CONSTRAINT_ERROR_RECOVERABLE', `Constraint error recoverable, manteniendo conexión BD`, {
                        phoneNumber: clientData.phoneNumber,
                        error: error.message
                    }, MOD);
                }
                else {
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
        }
        else {
            // Fallback to unified cache
            if (this.clientCache) {
                const cached = this.clientCache.get(clientData.phoneNumber) || this.createDefaultCacheEntry(clientData.phoneNumber);
                Object.assign(cached, clientData);
                this.clientCache.set(clientData.phoneNumber, cached);
            }
            (0, logging_1.logInfo)('CLIENT_CACHE_SAVE', `💾 Cliente guardado en cache unificado: ${clientData.phoneNumber}`, { phoneNumber: clientData.phoneNumber }, MOD);
        }
    }
    // --- Operaciones con Mensajes ---
    // Removido - hay otra implementación de saveMessage más abajo
    async getMessages(openaiThreadId, limit) {
        // Implementación simplificada - retorna array vacío
        return [];
    }
    // --- Operaciones de Limpieza ---
    async cleanup() {
        // Limpiar clientes inactivos después de 30 días
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await this.prisma.whatsApp.deleteMany({
            where: {
                lastActivity: { lt: thirtyDaysAgo }
            }
        });
    }
    // --- Estadísticas ---
    async getStats() {
        if (this.isConnected) {
            try {
                const clientCount = await this.prisma.whatsApp.count();
                return {
                    users: clientCount,
                    threads: clientCount,
                    messages: 0,
                    timestamp: new Date(),
                    mode: 'PostgreSQL',
                    cacheSize: this.clientCache?.getStats().size || 0
                };
            }
            catch (error) {
                (0, logging_1.logWarning)('STATS_ERROR', `⚠️ Error obteniendo estadísticas de PostgreSQL`, { error: error instanceof Error ? error.message : error }, MOD);
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
    async getClientByPhone(phoneNumber) {
        return await this.findUserByPhoneNumber(phoneNumber);
    }
    async updateClient(phoneNumber, data) {
        if (this.isConnected) {
            try {
                await this.prisma.whatsApp.update({
                    where: { phoneNumber },
                    data
                });
                (0, logging_1.logInfo)('DATABASE_UPDATE', `Cliente actualizado: ${phoneNumber}`, { phoneNumber, operation: 'updateClient' }, MOD);
            }
            catch (error) {
                (0, logging_1.logError)('DATABASE_ERROR', `Error actualizando cliente ${phoneNumber}`, { phoneNumber, operation: 'updateClient', error: error instanceof Error ? error.message : error }, MOD);
                throw error;
            }
        }
        else {
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
    async getClientsWithActionToday() {
        // Bot no debe interactuar con columnas CRM - retorna vacío
        return [];
    }
    // --- Thread Token Management ---
    async updateThreadTokenCount(phoneNumber, tokenCount) {
        if (this.isConnected) {
            try {
                // Obtener conteo actual de BD para detectar lag/inconsistencias
                const currentData = await this.prisma.whatsApp.findUnique({
                    where: { phoneNumber },
                    select: { threadTokenCount: true }
                });
                const currentDbCount = currentData?.threadTokenCount || 0;
                // Detectar inconsistencias significativas
                if (tokenCount > currentDbCount) {
                    const diff = tokenCount - currentDbCount;
                    if (diff > 500) { // Threshold para detectar lags significativos
                        (0, logging_1.logWarning)('TOKEN_DB_LAG_DETECTED', `Lag significativo detectado en BD tokens`, {
                            phoneNumber,
                            currentDbTokens: currentDbCount,
                            newTokens: tokenCount,
                            diff,
                            reason: 'delayed_update_catchup'
                        }, MOD);
                    }
                }
                await this.prisma.whatsApp.update({
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
                            (0, collectors_1.setCacheSize)(this.clientCache.getStats().size);
                        }
                    }
                    catch (error) {
                        console.warn(`Cache sync failed for token update ${phoneNumber}:`, error);
                    }
                }
                (0, logging_1.logInfo)('TOKEN_COUNT_UPDATE', `📊 Token count actualizado: ${phoneNumber} = ${tokenCount} tokens`, {
                    phoneNumber,
                    tokenCount,
                    previousTokens: currentDbCount,
                    increment: tokenCount - currentDbCount
                }, MOD);
            }
            catch (error) {
                (0, logging_1.logWarning)('TOKEN_COUNT_ERROR', `⚠️ Error actualizando token count para ${phoneNumber}`, { phoneNumber, tokenCount, error }, MOD);
                // Si hay error, marcar como desconectado para intentar reconectar
                this.isConnected = false;
            }
        }
        else {
            // Intentar reconectar antes de saltar
            (0, logging_1.logInfo)('BD_RECONNECT_ATTEMPT', `Intentando reconectar BD para token update: ${phoneNumber}`, { phoneNumber, tokenCount }, MOD);
            await this.connect();
            if (this.isConnected) {
                // Reintentar después de reconexión exitosa
                return this.updateThreadTokenCount(phoneNumber, tokenCount);
            }
            else {
                (0, logging_1.logWarning)('TOKEN_COUNT_SKIP', `Saltando actualización de tokens: BD desconectada`, { phoneNumber, tokenCount }, MOD);
            }
        }
    }
    // --- Helper ---
    mapToThreadRecord(thread) {
        return {
            threadId: thread.openaiId,
            chatId: thread.chatId || '',
            userName: thread.userName,
            lastActivity: thread.lastActivity,
            labels: thread.labels || [],
        };
    }
    // --- Enriquecimiento automático ---
    shouldEnrichUser(user) {
        // Enriquecer si el nombre es igual al teléfono (datos incompletos) o no hay etiquetas
        const nameEqualsPhone = user.name === user.phoneNumber;
        const hasNoLabels = !user.labels;
        return nameEqualsPhone || hasNoLabels;
    }
    async enrichUserFromWhapi(phoneNumber) {
        const enrichStart = Date.now(); // 🔧 NUEVO: Capturar tiempo inicio
        try {
            const chatId = `${phoneNumber}@s.whatsapp.net`;
            const whapiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
            const whapiToken = process.env.WHAPI_TOKEN;
            if (!whapiToken) {
                (0, logging_1.logWarning)('WHAPI_ENRICHMENT', 'WHAPI_TOKEN no disponible para enriquecimiento', { phoneNumber, operation: 'enrichUserFromWhapi' }, MOD);
                return;
            }
            const response = await (0, retry_utils_1.fetchWithRetry)(`${whapiUrl}/chats/${encodeURIComponent(chatId)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${whapiToken}`,
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                (0, logging_1.logWarning)('WHAPI_ENRICHMENT', `Error ${response.status} enriqueciendo usuario ${phoneNumber}`, { phoneNumber, statusCode: response.status, operation: 'enrichUserFromWhapi' }, MOD);
                return;
            }
            const chatInfo = await response.json();
            const labels = chatInfo.labels || [];
            // Solo procesar labels - names ya vienen del webhook
            if (labels.length > 0) {
                const existingClient = await this.prisma.whatsApp.findUnique({
                    where: { phoneNumber }
                });
                const updateData = {};
                // LABELS: Solo actualizar si están vacíos o hay discrepancia
                const labelsArray = labels.map((label) => label?.name || label).filter(Boolean);
                const newLabelsString = labelsArray.join('/');
                if (!existingClient?.labels || existingClient.labels !== newLabelsString) {
                    updateData.labels = newLabelsString;
                }
                // Solo hacer update si hay cambios
                if (Object.keys(updateData).length > 0) {
                    await this.prisma.whatsApp.update({
                        where: { phoneNumber },
                        data: updateData
                    });
                    (0, logging_1.logInfo)('USER_ENRICHMENT', `Labels actualizados automáticamente: ${phoneNumber} → ${labels.length} etiquetas`, { phoneNumber, labelsCount: labels.length, source: 'whapi_get', operation: 'enrichUserFromWhapi' }, MOD);
                    // 🔧 NUEVO: Log compacto de operación DB
                    (0, integrations_1.logDatabaseOperation)(phoneNumber, 'enrich', Date.now() - enrichStart, `labels=${labels.length}`, true // cache updated
                    );
                }
            }
        }
        catch (error) {
            (0, logging_1.logError)('WHAPI_ENRICHMENT', `Error enriqueciendo usuario ${phoneNumber}`, { phoneNumber, operation: 'enrichUserFromWhapi', error: error instanceof Error ? error.message : error }, MOD);
        }
    }
    // ========== MÉTODOS PARA RESPONSES API ==========
    async getConversation(userId, chatId) {
        try {
            // Usar la tabla WhatsApp existente (Chats)
            const phoneNumber = userId.replace('@s.whatsapp.net', '');
            const result = await this.prisma.whatsApp.findUnique({
                where: { phoneNumber }
            });
            if (!result)
                return null;
            // Mapear a ConversationRecord
            return {
                user_id: userId,
                chat_id: chatId,
                conversation_id: result.last_response_id || result.threadId || undefined,
                last_response_id: result.last_response_id || result.threadId || undefined,
                message_count: 0, // No necesitamos esto
                token_count: result.threadTokenCount || 0,
                last_activity: result.lastActivity,
                metadata: {}
            };
        }
        catch (error) {
            (0, logging_1.logError)('GET_CONVERSATION_ERROR', 'Error obteniendo conversación', {
                userId,
                chatId,
                error: error instanceof Error ? error.message : 'Unknown'
            });
            return null;
        }
    }
    async getRecentConversations(hoursBack = 24) {
        try {
            const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
            // Usar la tabla WhatsApp existente (Chats)
            const results = await this.prisma.whatsApp.findMany({
                where: {
                    lastActivity: {
                        gt: cutoffTime
                    }
                },
                orderBy: {
                    lastActivity: 'desc'
                }
            });
            // Mapear a ConversationRecord[]
            return results.map(result => ({
                user_id: result.phoneNumber + '@s.whatsapp.net',
                chat_id: result.chatId || '',
                conversation_id: result.last_response_id || result.threadId || undefined,
                last_response_id: result.last_response_id || result.threadId || undefined,
                message_count: 0,
                token_count: result.threadTokenCount || 0,
                last_activity: result.lastActivity,
                metadata: {}
            }));
        }
        catch (error) {
            (0, logging_1.logError)('GET_RECENT_CONVERSATIONS_ERROR', 'Error obteniendo conversaciones recientes', {
                hoursBack,
                error: error instanceof Error ? error.message : 'Unknown'
            });
            return [];
        }
    }
    async updateConversation(conversation) {
        try {
            const phoneNumber = conversation.user_id.replace('@s.whatsapp.net', '');
            // Usar upsert para crear si no existe o actualizar si existe
            await this.prisma.whatsApp.upsert({
                where: { phoneNumber },
                update: {
                    last_response_id: conversation.last_response_id || conversation.conversation_id,
                    threadTokenCount: conversation.token_count,
                    lastActivity: conversation.last_activity
                },
                create: {
                    phoneNumber,
                    chatId: conversation.chat_id,
                    last_response_id: conversation.last_response_id || conversation.conversation_id,
                    threadTokenCount: conversation.token_count,
                    lastActivity: conversation.last_activity,
                    name: phoneNumber // Nombre temporal
                }
            });
            (0, logging_1.logInfo)('CONVERSATION_UPDATED', 'Conversación actualizada', {
                userId: conversation.user_id,
                chatId: conversation.chat_id,
                responseId: conversation.last_response_id,
                tokenCount: conversation.token_count
            });
        }
        catch (error) {
            (0, logging_1.logError)('UPDATE_CONVERSATION_ERROR', 'Error actualizando conversación', {
                userId: conversation.user_id,
                chatId: conversation.chat_id,
                error: error instanceof Error ? error.message : 'Unknown'
            });
            throw error;
        }
    }
    async saveMessage(message) {
        // No necesitamos guardar mensajes individuales
        // OpenAI maneja el historial internamente con conversation_id
        (0, logging_1.logInfo)('MESSAGE_SAVE_SKIPPED', 'Guardado de mensaje omitido (manejado por OpenAI)', {
            userId: message.user_id,
            role: message.role,
            responseId: message.response_id
        });
    }
    async resetConversation(userId, chatId) {
        try {
            const phoneNumber = userId.replace('@s.whatsapp.net', '');
            // Resetear conversación en la tabla WhatsApp
            await this.prisma.whatsApp.update({
                where: { phoneNumber },
                data: {
                    threadId: null,
                    threadTokenCount: 0,
                    lastActivity: new Date()
                }
            });
            (0, logging_1.logInfo)('CONVERSATION_RESET', 'Conversación reseteada', {
                userId,
                chatId
            });
        }
        catch (error) {
            (0, logging_1.logError)('RESET_CONVERSATION_ERROR', 'Error reseteando conversación', {
                userId,
                chatId,
                error: error instanceof Error ? error.message : 'Unknown'
            });
        }
    }
}
exports.DatabaseService = DatabaseService;
