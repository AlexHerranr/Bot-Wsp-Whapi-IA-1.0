"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientDataCache = void 0;
// src/core/state/client-data-cache.ts
const lru_cache_1 = require("lru-cache");
class ClientDataCache {
    constructor(maxClients = 1000, clientTTL = 12 * 60 * 60 * 1000 /* 12 horas */) {
        this.cache = new lru_cache_1.LRUCache({
            max: maxClients,
            ttl: clientTTL,
        });
    }
    /**
     * Obtener datos del cliente desde caché
     */
    get(phoneNumber) {
        return this.cache.get(phoneNumber) || null;
    }
    /**
     * Guardar datos del cliente en caché
     */
    set(phoneNumber, data) {
        const clientData = {
            ...data,
            cachedAt: new Date(),
            needsSync: false
        };
        this.cache.set(phoneNumber, clientData);
    }
    /**
     * Verificar si los datos del webhook difieren del caché
     */
    needsUpdate(phoneNumber, webhookChatName, webhookFromName, webhookLabels) {
        const cached = this.get(phoneNumber);
        if (!cached)
            return true; // No hay caché, necesita consultar BD
        // ULTRA PERMISIVO: Comparar chat_name del webhook con caché (nombre guardado)
        if (webhookChatName && webhookChatName.trim() !== '' && webhookChatName !== phoneNumber) {
            if (cached.name !== webhookChatName) {
                return true; // Nombre diferente, necesita actualizar
            }
        }
        // ULTRA PERMISIVO: Comparar from_name del webhook con caché (display name)  
        if (webhookFromName && webhookFromName.trim() !== '' && webhookFromName !== phoneNumber) {
            if (cached.userName !== webhookFromName) {
                return true; // UserName diferente, necesita actualizar
            }
        }
        // Comparar etiquetas del webhook con caché (si están disponibles)
        if (webhookLabels && webhookLabels.length > 0) {
            const cachedLabelsSet = new Set(cached.labels);
            const webhookLabelsSet = new Set(webhookLabels);
            // Si hay diferencias en las etiquetas
            if (cachedLabelsSet.size !== webhookLabelsSet.size ||
                [...webhookLabelsSet].some(label => !cachedLabelsSet.has(label))) {
                return true; // Etiquetas diferentes, necesita actualizar
            }
        }
        // Verificar si los datos están "stale" (más de 12 horas)
        const twelveHours = 12 * 60 * 60 * 1000;
        if (Date.now() - cached.cachedAt.getTime() > twelveHours) {
            return true; // Datos antiguos, refrescar
        }
        return false; // No necesita actualizar
    }
    /**
     * Marcar un cliente como que necesita sincronización con BD
     */
    markForSync(phoneNumber) {
        const cached = this.get(phoneNumber);
        if (cached) {
            cached.needsSync = true;
            this.cache.set(phoneNumber, cached);
        }
    }
    /**
     * Actualizar datos desde BD en caché
     */
    updateFromDatabase(phoneNumber, dbData) {
        this.set(phoneNumber, {
            phoneNumber,
            ...dbData
        });
    }
    /**
     * Actualizar solo el conteo de tokens en caché
     */
    updateThreadTokenCount(phoneNumber, tokenCount) {
        const cached = this.get(phoneNumber);
        if (cached) {
            cached.threadTokenCount = tokenCount;
            cached.needsSync = false; // Ya está actualizado
            this.cache.set(phoneNumber, cached);
        }
    }
    /**
     * Limpiar entrada del caché
     */
    delete(phoneNumber) {
        this.cache.delete(phoneNumber);
    }
    /**
     * Invalidar entrada del caché (fuerza actualización en próximo acceso)
     * Para usar con hooks externos
     */
    invalidate(phoneNumber) {
        this.cache.delete(phoneNumber);
    }
    /**
     * Verificar si existe en caché
     */
    has(phoneNumber) {
        return this.cache.has(phoneNumber);
    }
    /**
     * Obtener estadísticas del caché
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.cache.max || 0
        };
    }
    /**
     * Limpiar todo el caché
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Limpiar entradas que necesitan sincronización
     */
    cleanup() {
        let cleaned = 0;
        for (const [phoneNumber, data] of this.cache.entries()) {
            if (data.needsSync) {
                this.cache.delete(phoneNumber);
                cleaned++;
            }
        }
        return cleaned;
    }
    /**
     * CONTEXTUALIZACIÓN INTELIGENTE: Verificar si necesita enviar contexto completo
     */
    needsContextUpdate(phoneNumber, currentName, currentUserName, currentLabels) {
        const cached = this.get(phoneNumber);
        if (!cached)
            return true; // Nuevo usuario, necesita contexto completo
        // Si nunca se envió contexto post-reinicio
        if (!cached.contextSent)
            return true;
        // Calcular hash actual del contexto (incluye AMBOS nombres)
        const currentContextHash = this.calculateContextHash(currentName, currentUserName, currentLabels);
        // Si cambió cualquiera de los nombres o tags
        if (cached.lastContextHash !== currentContextHash)
            return true;
        return false; // No necesita contexto, ya está enviado y sin cambios
    }
    /**
     * CONTEXTUALIZACIÓN INTELIGENTE: Marcar contexto como enviado
     */
    markContextSent(phoneNumber, name, userName, labels) {
        const cached = this.get(phoneNumber);
        if (cached) {
            cached.contextSent = true;
            cached.lastContextHash = this.calculateContextHash(name, userName, labels);
            cached.cachedAt = new Date(); // Actualizar timestamp
            this.cache.set(phoneNumber, cached);
        }
    }
    /**
     * CONTEXTUALIZACIÓN INTELIGENTE: Calcular hash del contexto
     */
    calculateContextHash(name, userName, labels) {
        // INCLUIR AMBOS NOMBRES: chat_name (name) + from_name (userName) + labels
        const contextString = `${name || 'null'}|${userName || 'null'}|${labels.sort().join(',')}`;
        // Hash simple pero efectivo
        let hash = 0;
        for (let i = 0; i < contextString.length; i++) {
            const char = contextString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }
}
exports.ClientDataCache = ClientDataCache;
