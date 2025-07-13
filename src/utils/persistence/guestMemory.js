import * as fs from 'fs';
import * as path from 'path';
import { enhancedLog } from '../core/index.js';
import { whapiLabels } from '../whapi/index.js';
import { threadPersistence } from './threadPersistence.js';
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
        
        // 🔧 ETAPA 2: Limpieza automática del cache cada 10 minutos
        setInterval(() => {
            this.cleanExpiredCache();
        }, 600000); // 10 minutos
        
        enhancedLog('info', 'GUEST_MEMORY', 
            `Sistema de cache de labels inicializado (TTL: ${this.LABEL_CACHE_TTL/1000}s, limpieza: 10min)`);
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
    
    // Marcar cambios y programar guardado con debounce
    markAsChanged() {
        this.hasChanges = true;
        
        // DESACTIVADO: Guardado automático (genera muchos logs)
        // Solo se guardará al cerrar el bot
    }
    
    // Obtener o crear perfil SIMPLIFICADO con sincronización de Whapi
    async getOrCreateProfile(userId, forceSync = false) {
        const existing = this.profiles.get(userId);
        if (!existing) {
            // Crear perfil básico
            const newProfile = {
                id: userId,
                name: null,
                phone: userId,
                label: 'nuevo',
                whapiLabels: [], // Etiquetas desde Whapi
                firstInteraction: new Date().toISOString(),
                lastInteraction: new Date().toISOString()
            };
            
            // Intentar obtener información desde Whapi
            try {
                const chatInfo = await whapiLabels.getChatInfo(userId);
                if (chatInfo) {
                    // Sincronizar con datos de Whapi
                    if (chatInfo.name) {
                        newProfile.name = chatInfo.name;
                    }
                    
                    if (chatInfo.labels && chatInfo.labels.length > 0) {
                        newProfile.whapiLabels = chatInfo.labels;
                        // Usar la primera etiqueta como label principal
                        newProfile.label = chatInfo.labels[0].name;
                        
                        enhancedLog('info', 'GUEST_MEMORY', 
                            `Sincronizado con Whapi: ${chatInfo.labels.length} etiquetas para ${userId}`);
                    }
                }
            } catch (error) {
                enhancedLog('warning', 'GUEST_MEMORY', 
                    `No se pudo sincronizar con Whapi para ${userId}: ${error.message}`);
            }
            
            this.profiles.set(userId, newProfile);
            // 🔧 FIX: Usar wrapper centralizado para nuevo perfil
            await this.syncIfNeeded(userId, forceSync, true); // isNewThread = true para perfiles nuevos
            
            enhancedLog('info', 'GUEST_MEMORY', 
                `Nuevo perfil creado para ${userId} con ${newProfile.whapiLabels.length} etiquetas`);
            
            // Marcar cambios en lugar de guardar inmediatamente
            this.markAsChanged();
        } else {
            // Solo actualizar última interacción
            const profile = this.profiles.get(userId);
            profile.lastInteraction = new Date().toISOString();
            this.markAsChanged(); // Solo marcar cambio
            
            // 🔧 FIX: Usar wrapper centralizado para perfil existente
            await this.syncIfNeeded(userId, forceSync); // Solo si thread es viejo (manejado por wrapper)
        }
        
        if (existing) {
            return existing;
        }
        
        return this.profiles.get(userId);
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
    
    // Sincronizar etiquetas de Whapi con el perfil local
    async syncWhapiLabels(userId) {
        // 🔧 ETAPA 3: Incrementar métrica de llamadas de sync
        incrementSyncCalls();
        
        // 🔧 ETAPA 9: Verificar si thread es viejo antes de sincronizar
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
        
        try {
            const profile = this.profiles.get(userId);
            if (!profile) return null;
            
            const chatInfo = await whapiLabels.getChatInfo(userId);
            if (chatInfo && chatInfo.labels) {
                profile.whapiLabels = chatInfo.labels;
                
                // Actualizar label principal si hay etiquetas
                if (chatInfo.labels.length > 0) {
                    profile.label = chatInfo.labels[0].name;
                }
                
                this.profiles.set(userId, profile);
                this.markAsChanged(); // Usar debounce para sincronización
                
                enhancedLog('success', 'GUEST_MEMORY', 
                    `Etiquetas sincronizadas para ${userId}: ${chatInfo.labels.length} etiquetas`, {
                        userId,
                        isThreadOld,
                        labelsCount: chatInfo.labels.length,
                        labels: chatInfo.labels.map(l => l.name)
                    });
                
                return profile;
            }
            
        } catch (error) {
            enhancedLog('error', 'GUEST_MEMORY', 
                `Error sincronizando etiquetas para ${userId}: ${error.message}`, {
                    userId,
                    isThreadOld
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
            reason: force ? 'forced' : (isNewThread ? 'new_thread' : 'old_thread'),
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
}

export const guestMemory = new GuestMemory();
