// src/core/state/client-data-cache.ts
import { LRUCache } from 'lru-cache';

export interface ClientData {
    phoneNumber: string;
    name: string | null;
    userName: string | null;
    labels: string[];
    chatId: string | null;
    lastActivity: Date;
    threadTokenCount?: number;  // Conteo de tokens del thread
    // Metadata del caché
    cachedAt: Date;
    needsSync: boolean;
}

export class ClientDataCache {
    private cache: LRUCache<string, ClientData>;

    constructor(maxClients: number = 1000, clientTTL: number = 12 * 60 * 60 * 1000 /* 12 horas */) {
        this.cache = new LRUCache({
            max: maxClients,
            ttl: clientTTL,
        });
    }

    /**
     * Obtener datos del cliente desde caché
     */
    public get(phoneNumber: string): ClientData | null {
        return this.cache.get(phoneNumber) || null;
    }

    /**
     * Guardar datos del cliente en caché
     */
    public set(phoneNumber: string, data: Omit<ClientData, 'cachedAt' | 'needsSync'>): void {
        const clientData: ClientData = {
            ...data,
            cachedAt: new Date(),
            needsSync: false
        };
        this.cache.set(phoneNumber, clientData);
    }

    /**
     * Verificar si los datos del webhook difieren del caché
     */
    public needsUpdate(phoneNumber: string, webhookName?: string, webhookLabels?: string[]): boolean {
        const cached = this.get(phoneNumber);
        if (!cached) return true; // No hay caché, necesita consultar BD

        // Comparar nombre del webhook con caché
        if (webhookName && webhookName !== 'Usuario' && webhookName !== phoneNumber) {
            if (cached.name !== webhookName || cached.userName !== webhookName) {
                return true; // Nombre diferente, necesita actualizar
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
    public markForSync(phoneNumber: string): void {
        const cached = this.get(phoneNumber);
        if (cached) {
            cached.needsSync = true;
            this.cache.set(phoneNumber, cached);
        }
    }

    /**
     * Actualizar datos desde BD en caché
     */
    public updateFromDatabase(phoneNumber: string, dbData: {
        name: string | null;
        userName: string | null;
        labels: string[];
        chatId: string | null;
        lastActivity: Date;
        threadTokenCount?: number;
    }): void {
        this.set(phoneNumber, {
            phoneNumber,
            ...dbData
        });
    }

    /**
     * Actualizar solo el conteo de tokens en caché
     */
    public updateThreadTokenCount(phoneNumber: string, tokenCount: number): void {
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
    public delete(phoneNumber: string): void {
        this.cache.delete(phoneNumber);
    }

    /**
     * Invalidar entrada del caché (fuerza actualización en próximo acceso)
     * Para usar con hooks externos
     */
    public invalidate(phoneNumber: string): void {
        this.cache.delete(phoneNumber);
    }

    /**
     * Verificar si existe en caché
     */
    public has(phoneNumber: string): boolean {
        return this.cache.has(phoneNumber);
    }

    /**
     * Obtener estadísticas del caché
     */
    public getStats(): { size: number; maxSize: number; hitRate?: number } {
        return {
            size: this.cache.size,
            maxSize: this.cache.max || 0
        };
    }

    /**
     * Limpiar todo el caché
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * Limpiar entradas que necesitan sincronización
     */
    public cleanup(): number {
        let cleaned = 0;
        for (const [phoneNumber, data] of this.cache.entries()) {
            if (data.needsSync) {
                this.cache.delete(phoneNumber);
                cleaned++;
            }
        }
        return cleaned;
    }
}