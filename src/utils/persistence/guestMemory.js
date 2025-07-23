import * as fs from 'fs';
import * as path from 'path';
import { enhancedLog } from '../core/index.js';
import { whapiLabels } from '../whapi/index.js';
import { threadPersistence } from './threadPersistence.js';
// 🔧 DESACTIVADO: Importación circular - getCachedChatInfo movido a whapi/index.js
// import { getCachedChatInfo } from '../../app-unified.js';
import { 
    incrementLabelCacheHits, 
    incrementLabelCacheMisses, 
    setLabelCacheSize, 
    incrementLabelCacheInvalidations,
    incrementSyncCalls,
    incrementDuplicatesAvoided
} from '../../routes/metrics.js';

class GuestMemory {
    constructor() {
        this.profiles = new Map();
        this.PROFILES_FILE = path.join(process.cwd(), 'tmp', 'guest_profiles.json');
        this.hasChanges = false; // Flag para controlar guardado
        this.saveTimeout = null; // Timeout para debounce
        
        // 🔧 ETAPA 2: Sistema de cache para labels
        this.labelCache = new Map(); // userId → { labels: [], timestamp: Date }
        this.LABEL_CACHE_TTL = 300000; // 5 minutos en milisegundos
        
        // 🔧 FIX #3: Protección contra race conditions
        this.creatingProfiles = new Set(); // Lock para evitar duplicados
        
        //  NUEVO: Cargar perfiles al inicializar
        this.loadProfiles();
        
        // 🔧 ETAPA 2: Limpieza automática del cache cada 10 minutos
        setInterval(() => {
            this.cleanExpiredCache();
        }, 600000); // 10 minutos
        
        // 🔧 FIX #2: Restaurar guardado automático con handlers de cierre
        process.on('SIGINT', () => {
            enhancedLog('info', 'GUEST_MEMORY', 'Guardando perfiles antes de cerrar (SIGINT)');
            this.saveProfiles();
        });
        
        process.on('SIGTERM', () => {
            enhancedLog('info', 'GUEST_MEMORY', 'Guardando perfiles antes de cerrar (SIGTERM)');
            this.saveProfiles();
        });
    }
    
    // Asegurar que el directorio existe
    ensureDirectoryExists() {
        const dir = path.dirname(this.PROFILES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    // Cargar perfiles desde archivo
    loadProfiles() {
        try {
            this.ensureDirectoryExists();
            
            if (fs.existsSync(this.PROFILES_FILE)) {
                const data = fs.readFileSync(this.PROFILES_FILE, 'utf-8');
                const profilesArray = JSON.parse(data);
                
                // Convertir array a Map
                this.profiles = new Map(profilesArray);
                
                enhancedLog('success', 'GUEST_MEMORY', 
                    `${this.profiles.size} perfiles de invitados cargados`);
            } else {
                enhancedLog('info', 'GUEST_MEMORY', 
                    'No se encontraron perfiles guardados, iniciando vacío');
            }
        } catch (error) {
            enhancedLog('error', 'GUEST_MEMORY', 
                `Error cargando perfiles: ${error.message}`);
        }
    }
    
    // Guardar perfiles con debounce (evitar guardados múltiples)
    saveProfiles() {
        if (!this.hasChanges) return; // No guardar si no hay cambios
        
        try {
            this.ensureDirectoryExists();
            
            // Convertir Map a array para JSON
            const profilesArray = Array.from(this.profiles.entries());
            
            fs.writeFileSync(this.PROFILES_FILE, JSON.stringify(profilesArray, null, 2));
            
            this.hasChanges = false; // Reset flag
            
            enhancedLog('success', 'GUEST_MEMORY', 
                `${this.profiles.size} perfiles guardados`);
        } catch (error) {
            enhancedLog('error', 'GUEST_MEMORY', 
                `Error guardando perfiles: ${error.message}`);
        }
    }
    
    // 🔧 FIX #2: Restaurar guardado automático con debounce
    markAsChanged() {
        this.hasChanges = true;
        
        // Guardar con debounce cada 30 segundos
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveProfiles();
        }, 30000); // 30 segundos
    }
    
    // 🔧 FIX #3: Obtener o crear perfil con protección contra race conditions
    async getOrCreateProfile(userId, forceSync = false) {
        // Verificar si ya se está creando este perfil
        if (this.creatingProfiles.has(userId)) {
            enhancedLog('debug', 'GUEST_MEMORY', 
                `Perfil ${userId} ya se está creando, esperando...`);
            // Esperar hasta que termine
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.getOrCreateProfile(userId, forceSync);
        }
        
        const existing = this.profiles.get(userId);
        if (!existing) {
            // 🔧 FIX #3: Lock para evitar duplicados
            this.creatingProfiles.add(userId);
            
            try {
                // Crear perfil básico con SOLO datos reales
                const newProfile = {
                    id: userId,                    // Webhook message.from
                    name: null,                    // Webhook message.chat_name
                    phone: userId,                 // Webhook message.from
                    chatId: `${userId}@s.whatsapp.net`, // Chat ID completo para endpoints
                    label: 'nuevo',                // WHAPI labels[0].name
                    whapiLabels: [],               // WHAPI labels
                    firstInteraction: new Date().toISOString(), // Timestamp creación
                    lastInteraction: new Date().toISOString(),  // Timestamp último mensaje
                    whatsappName: null,            // WHAPI name
                    lastMessage: null,             // WHAPI last_message
                    lastThread: null,              // Thread ID de OpenAI
                    lastThreadUpdate: null,        // Última actualización del thread
                    lastAssistant: null,           // Último assistant usado
                    threadMessageCount: 0          // Contador de mensajes en el thread
                };
                
                this.profiles.set(userId, newProfile);
                
                // 🔧 FIX: Usar wrapper centralizado para nuevo perfil
                await this.syncIfNeeded(userId, forceSync, false); // isNewThread = false porque el thread ya existe
                
                enhancedLog('info', 'GUEST_MEMORY', 
                    `Nuevo perfil creado para ${userId} con ${newProfile.whapiLabels.length} etiquetas`);
                
                // Marcar cambios en lugar de guardar inmediatamente
                this.markAsChanged();
                
                // 🔧 FIX #4: Retornar DESPUÉS de todas las actualizaciones
                return this.profiles.get(userId);
            } finally {
                // 🔧 FIX #3: Unlock
                this.creatingProfiles.delete(userId);
            }
        } else {
            // Solo actualizar última interacción
            const profile = this.profiles.get(userId);
            profile.lastInteraction = new Date().toISOString();
            this.markAsChanged(); // Solo marcar cambio
            
            // 🔧 FIX: Usar wrapper centralizado para perfil existente
            await this.syncIfNeeded(userId, forceSync); // Solo si thread es viejo (manejado por wrapper)
            
            // 🔧 FIX #4: Retornar DESPUÉS de todas las actualizaciones
            return this.profiles.get(userId);
        }
    }
    
    // Obtener perfil (sin crear)
    getProfile(userId) {
        return this.profiles.get(userId) || null;
    }
    
    // Actualizar perfil
    updateProfile(userId, updates) {
        const profile = this.profiles.get(userId);
        if (profile) {
            Object.assign(profile, updates);
            this.profiles.set(userId, profile);
            
            // 🔧 ETAPA 2: Invalidar cache si se actualizaron labels
            if (updates.whapiLabels || updates.label) {
                this.labelCache.delete(userId);
                // 🔧 ETAPA 2: Incrementar métrica de invalidación
                incrementLabelCacheInvalidations();
                
                enhancedLog('info', 'LABEL_CACHE_INVALIDATED', `Cache invalidated for ${userId}`, {
                    userId,
                    reason: 'profile_updated',
                    updatedFields: Object.keys(updates)
                });
            }
            
            // Mantener guardado inmediato para actualizaciones manuales
            this.saveProfiles();
            
            enhancedLog('info', 'GUEST_MEMORY', 
                `Perfil actualizado para ${userId}: ${Object.keys(updates).join(', ')}`);
        }
    }
    
    // 🔧 FIX #1: Implementar syncWhapiLabels funcional
    async syncWhapiLabels(userId) {
        // 🔧 ETAPA 3: Incrementar métrica de llamadas de sync
        incrementSyncCalls();
        
        try {
            const profile = this.profiles.get(userId);
            if (!profile) return null;
            
            // 🔧 NUEVO: Para perfiles nuevos, obtener etiquetas inmediatamente
            const isNewProfile = profile.whapiLabels.length === 0;
            
            // 🔧 ETAPA 9: Verificar si thread es viejo antes de sincronizar (solo para perfiles existentes)
            if (!isNewProfile) {
                const isThreadOld = threadPersistence.isThreadOld(userId);
                
                if (!isThreadOld) {
                    enhancedLog('debug', 'GUEST_MEMORY', 
                        `Sincronización de labels SKIPPED para ${userId} - thread no es viejo`, {
                            userId,
                            isThreadOld,
                            reason: 'thread_not_old'
                        });
                    return null;
                }
            }
            
            // 🔧 FIX #1: Usar whapiLabels directamente (ya está importado)
            const chatInfo = await whapiLabels.getChatInfo(userId);
            if (chatInfo) {
                // Actualizar SOLO datos REALES de WHAPI
                if (chatInfo.name) {
                    profile.whatsappName = chatInfo.name;
                    profile.name = chatInfo.name;
                }
                
                if (chatInfo.labels) {
                    profile.whapiLabels = chatInfo.labels;
                    
                    if (chatInfo.labels.length > 0) {
                        profile.label = chatInfo.labels[0].name;
                    }
                }
                
                if (chatInfo.lastMessage) {
                    profile.lastMessage = chatInfo.lastMessage;
                }
                
                if (!profile.chatId) {
                    profile.chatId = `${userId}@s.whatsapp.net`;
                }
                
                this.profiles.set(userId, profile);
                this.markAsChanged();
                
                enhancedLog('success', 'GUEST_MEMORY', 
                    `Perfil sincronizado para ${userId}: ${chatInfo.name || 'Sin nombre'}`, {
                        userId,
                        isNewProfile,
                        labelsCount: chatInfo.labels?.length || 0,
                        labels: chatInfo.labels?.map(l => l.name) || [],
                        hasLastMessage: !!chatInfo.lastMessage
                    });
                
                return profile; // ✅ Retornar perfil actualizado
            }
            
        } catch (error) {
            enhancedLog('error', 'GUEST_MEMORY', 
                `Error sincronizando perfil para ${userId}: ${error.message}`, {
                    userId
                });
        }
        
        return null;
    }
    
    // Extraer SOLO información básica
    async extractAndSaveContext(userId, userMessage, aiResponse) {
        try {
            const profile = await this.getOrCreateProfile(userId);
            let updated = false;
            
            // 1. Extraer nombre si no lo tenemos
            if (!profile.name) {
                const namePatterns = [
                    /(?:soy|me llamo|mi nombre es)\s+([A-Z][a-záéíóú]+(?:\s+[A-Z][a-záéíóú]+)?)/i,
                    /^([A-Z][a-záéíóú]+(?:\s+[A-Z][a-záéíóú]+)?)\s+(?:aquí|acá|presente)/i
                ];
                
                for (const pattern of namePatterns) {
                    const match = userMessage.match(pattern);
                    if (match) {
                        profile.name = match[1].trim();
                        updated = true;
                        enhancedLog('info', 'GUEST_MEMORY', 
                            `Nombre extraído: ${profile.name}`);
                        break;
                    }
                }
            }
            
            // 2. NO actualizar etiquetas automáticamente aquí
            // Las etiquetas solo se cambian via Function Calling de OpenAI
            
            // Marcar cambios si hubo actualizaciones
            if (updated) {
                this.profiles.set(userId, profile);
                this.markAsChanged(); // Usar debounce para extracción
                
                enhancedLog('success', 'GUEST_MEMORY', 
                    `Contexto básico extraído para ${userId}`);
            }
            
        } catch (error) {
            enhancedLog('error', 'GUEST_MEMORY', 
                `Error extrayendo contexto: ${error.message}`);
        }
    }
    
    // Obtener estadísticas simplificadas con etiquetas de Whapi
    getStats() {
        const stats = {
            totalProfiles: this.profiles.size,
            byLabel: {
                nuevo: 0,
                cotizando: 0,
                confirmado: 0,
                exCliente: 0,
                colega: 0
            },
            whapiLabelsCount: {},
            profilesWithWhapi: 0
        };
        
        for (const [userId, profile] of this.profiles.entries()) {
            // Contar por label local
            const label = profile.label || 'nuevo';
            if (stats.byLabel[label] !== undefined) {
                stats.byLabel[label]++;
            }
            
            // Contar etiquetas de Whapi
            if (profile.whapiLabels && profile.whapiLabels.length > 0) {
                stats.profilesWithWhapi++;
                
                profile.whapiLabels.forEach(whapiLabel => {
                    const labelName = whapiLabel.name;
                    stats.whapiLabelsCount[labelName] = (stats.whapiLabelsCount[labelName] || 0) + 1;
                });
            }
        }
        
        return stats;
    }
    
    // Obtener información completa de un perfil con sus etiquetas
    async getFullProfile(userId, forceSync = false) {
        const profile = this.getProfile(userId);
        if (!profile) return null;
        
        // 🔧 FIX: Usar wrapper centralizado en lugar de sync directo
        await this.syncIfNeeded(userId, forceSync);
        
        return this.profiles.get(userId);
    }
    
    // 🔧 ETAPA 2: Limpiar cache expirado
    cleanExpiredCache() {
        const now = Date.now();
        let expiredCount = 0;
        
        for (const [userId, cached] of this.labelCache.entries()) {
            if (now - cached.timestamp > this.LABEL_CACHE_TTL) {
                this.labelCache.delete(userId);
                expiredCount++;
            }
        }
        
        // 🔧 ETAPA 2: Actualizar métrica del tamaño del cache después de limpieza
        setLabelCacheSize(this.labelCache.size);
        
        if (expiredCount > 0) {
            enhancedLog('info', 'LABEL_CACHE_CLEANED', `Cleaned ${expiredCount} expired cache entries`, {
                expiredCount,
                remainingCacheSize: this.labelCache.size
            });
        }
        
        return expiredCount;
    }
    
    // 🔧 ETAPA 2: Obtener estadísticas del cache
    getCacheStats() {
        const now = Date.now();
        const stats = {
            totalEntries: this.labelCache.size,
            validEntries: 0,
            expiredEntries: 0,
            averageAge: 0,
            oldestEntry: null,
            newestEntry: null
        };
        
        let totalAge = 0;
        
        for (const [userId, cached] of this.labelCache.entries()) {
            const age = now - cached.timestamp;
            totalAge += age;
            
            if (age < this.LABEL_CACHE_TTL) {
                stats.validEntries++;
            } else {
                stats.expiredEntries++;
            }
            
            if (!stats.oldestEntry || age > stats.oldestEntry.age) {
                stats.oldestEntry = { userId, age, ageSeconds: Math.round(age / 1000) };
            }
            
            if (!stats.newestEntry || age < stats.newestEntry.age) {
                stats.newestEntry = { userId, age, ageSeconds: Math.round(age / 1000) };
            }
        }
        
        if (stats.totalEntries > 0) {
            stats.averageAge = Math.round(totalAge / stats.totalEntries / 1000); // en segundos
        }
        
        return stats;
    }
    
    // 🔧 ETAPA 1 + 2: Wrapper centralizado con cache para sincronización de labels
    async syncIfNeeded(userId, force = false, isNewThread = false, requestId = null) {
        const isThreadOld = threadPersistence.isThreadOld(userId);
        
        // 🔧 NUEVO: Logging más claro para debug
        enhancedLog('debug', 'SYNC_IF_NEEDED', `Evaluando sync para ${userId}`, {
            userId,
            force,
            isNewThread,
            isThreadOld,
            requestId
        });
        
        // 🔧 ETAPA 2: Verificar cache primero (si no es force)
        if (!force) {
            const cached = this.labelCache.get(userId);
            if (cached && (Date.now() - cached.timestamp < this.LABEL_CACHE_TTL)) {
                // 🔧 ETAPA 2: Incrementar métrica de cache hit
                incrementLabelCacheHits();
                // 🔧 ETAPA 3: Incrementar métrica de duplicados evitados
                incrementDuplicatesAvoided();
                
                enhancedLog('info', 'LABEL_CACHE_HIT', `Using cached labels for ${userId}`, {
                    userId,
                    cacheAge: Date.now() - cached.timestamp,
                    labelsCount: cached.labels.length,
                    cacheAgeSeconds: Math.round((Date.now() - cached.timestamp) / 1000),
                    requestId
                });
                return cached.labels; // ¡No llamar a Whapi!
            } else {
                // 🔧 ETAPA 2: Incrementar métrica de cache miss
                incrementLabelCacheMisses();
            }
        }
        
        if (!force && !isThreadOld && !isNewThread) {
            enhancedLog('debug', 'SYNC_SKIPPED', `No sync needed for ${userId}`, { 
                userId,
                reason: 'not_old_or_new',
                isThreadOld,
                isNewThread,
                force,
                requestId
            });
            return null;
        }
        
        enhancedLog('info', 'SYNC_NEEDED', `Sync needed for ${userId}`, {
            userId,
            reason: force ? 'forced' : (isNewThread ? 'new_profile' : 'old_thread'),
            isThreadOld,
            isNewThread,
            force,
            requestId
        });
        
        // Hacer sync normal
        const result = await this.syncWhapiLabels(userId);
        
        // 🔧 ETAPA 2: Guardar en cache después del sync exitoso
        if (result && result.whapiLabels) {
            this.labelCache.set(userId, {
                labels: result.whapiLabels,
                timestamp: Date.now()
            });
            
            // 🔧 ETAPA 2: Actualizar métrica del tamaño del cache
            setLabelCacheSize(this.labelCache.size);
            
            enhancedLog('info', 'LABEL_CACHE_STORED', `Stored labels in cache for ${userId}`, {
                userId,
                labelsCount: result.whapiLabels.length,
                cacheSize: this.labelCache.size,
                requestId
            });
        }
        
        return result;
    }

    // 🔧 NUEVO: Actualizar información completa del thread
    updateThreadInfo(userId, threadInfo) {
        const profile = this.profiles.get(userId);
        if (profile) {
            profile.lastThread = threadInfo.threadId || profile.lastThread;
            profile.lastThreadUpdate = new Date().toISOString();
            profile.lastAssistant = threadInfo.assistantId || profile.lastAssistant;
            profile.threadMessageCount = threadInfo.messageCount || profile.threadMessageCount;
            
            this.markAsChanged();
            
            enhancedLog('info', 'GUEST_MEMORY', 
                `Thread actualizado para ${userId}: ${threadInfo.threadId}`, {
                    threadId: threadInfo.threadId,
                    assistantId: threadInfo.assistantId,
                    messageCount: threadInfo.messageCount
                });
        }
    }
    
    // 🔧 NUEVO: Actualizar solo el thread ID
    updateLastThread(userId, threadId) {
        const profile = this.profiles.get(userId);
        if (profile) {
            profile.lastThread = threadId;
            profile.lastThreadUpdate = new Date().toISOString();
            this.markAsChanged();
            
            enhancedLog('info', 'GUEST_MEMORY', 
                `Thread ID actualizado para ${userId}: ${threadId}`);
        }
    }
    
    // 🔧 NUEVO: Actualizar assistant usado
    updateLastAssistant(userId, assistantId) {
        const profile = this.profiles.get(userId);
        if (profile) {
            profile.lastAssistant = assistantId;
            this.markAsChanged();
            
            enhancedLog('info', 'GUEST_MEMORY', 
                `Assistant actualizado para ${userId}: ${assistantId}`);
        }
    }
    
    // 🔧 NUEVO: Incrementar contador de mensajes
    incrementThreadMessageCount(userId) {
        const profile = this.profiles.get(userId);
        if (profile) {
            profile.threadMessageCount = (profile.threadMessageCount || 0) + 1;
            profile.lastThreadUpdate = new Date().toISOString();
            this.markAsChanged();
        }
    }
    
    // 🔧 NUEVO: Obtener información completa del thread
    getThreadInfo(userId) {
        const profile = this.profiles.get(userId);
        if (!profile) return null;
        
        return {
            threadId: profile.lastThread,
            assistantId: profile.lastAssistant,
            messageCount: profile.threadMessageCount || 0,
            lastUpdate: profile.lastThreadUpdate,
            daysSinceUpdate: profile.lastThreadUpdate ? 
                Math.floor((Date.now() - new Date(profile.lastThreadUpdate).getTime()) / (1000 * 60 * 60 * 24)) : 
                null
        };
    }
    
    // 🔧 NUEVO: Obtener último thread del usuario
    getLastThread(userId) {
        const profile = this.profiles.get(userId);
        return profile ? profile.lastThread : null;
    }
    
    // 🔧 NUEVO: Obtener último assistant usado
    getLastAssistant(userId) {
        const profile = this.profiles.get(userId);
        return profile ? profile.lastAssistant : null;
    }
}

export const guestMemory = new GuestMemory();
