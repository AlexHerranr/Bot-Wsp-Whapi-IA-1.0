import * as fs from 'fs';
import * as path from 'path';
import { enhancedLog } from '../core/index.js';
import { getConfig } from '../../config/environment';

interface GuestRecord {
    userId: string;           // ID numérico del usuario (ej: "573003913251")
    phoneNumber: string;      // Número de teléfono completo
    chatId: string;          // WhatsApp chat ID completo (con @s.whatsapp.net)
    name: string;            // Nombre del huésped
    displayName?: string;    // Nombre para mostrar (puede ser diferente)
    labels: string[];        // Etiquetas del usuario
    createdAt: string;       // Fecha de creación del registro
    lastActivity: string;    // Última actividad del usuario
    lastMessage?: string;    // Último mensaje recibido
    messageCount: number;    // Contador de mensajes
    isActive: boolean;       // Si el usuario está activo
    notes?: string;          // Notas adicionales sobre el huésped
    preferences?: {          // Preferencias del huésped
        language?: string;
        timezone?: string;
        communicationStyle?: string;
    };
}

export class GuestDatabaseManager {
    private guests: Map<string, GuestRecord>;
    private readonly GUESTS_FILE = 'tmp/guests.json';
    private readonly BACKUP_DIR = 'tmp/backups';
    private readonly SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutos
    
    constructor() {
        this.guests = new Map();
        this.ensureDirectories();
        this.loadGuests();
        this.setupAutoSave();
        this.setupGracefulShutdown();
    }
    
    // Asegurar que los directorios existen
    private ensureDirectories() {
        const dirs = ['tmp', this.BACKUP_DIR];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                enhancedLog('info', 'GUEST_DB', `Directorio creado: ${dir}`);
            }
        });
    }
    
    // Cargar huéspedes desde archivo
    private loadGuests() {
        try {
            if (fs.existsSync(this.GUESTS_FILE)) {
                const data = fs.readFileSync(this.GUESTS_FILE, 'utf-8');
                const parsed = JSON.parse(data);
                
                // Convertir array a Map
                this.guests = new Map(parsed);
                
                enhancedLog('info', 'GUEST_DB', `${this.guests.size} huéspedes cargados desde archivo`, {
                    guestsCount: this.guests.size,
                    source: 'file_load',
                    file: this.GUESTS_FILE
                });
                
                // Validar datos cargados
                this.validateGuests();
            } else {
                enhancedLog('info', 'GUEST_DB', 'No se encontró archivo de huéspedes, iniciando vacío');
            }
        } catch (error) {
            enhancedLog('error', 'GUEST_DB', `Error cargando huéspedes: ${error.message}`);
            this.loadFromBackup();
        }
    }
    
    // Validar huéspedes cargados
    private validateGuests() {
        let removed = 0;
        let migrated = 0;
        
        for (const [userId, record] of this.guests.entries()) {
            if (!record.userId || !record.createdAt) {
                this.guests.delete(userId);
                removed++;
                enhancedLog('warning', 'GUEST_DB', `Huésped inválido removido: ${userId}`);
            }
            
            // Migrar registros antiguos sin campos obligatorios
            if (!record.phoneNumber) {
                record.phoneNumber = record.userId;
                migrated++;
            }
            
            if (!record.chatId) {
                record.chatId = `${record.userId}@s.whatsapp.net`;
                migrated++;
            }
            
            if (!record.labels) {
                record.labels = [];
                migrated++;
            }
            
            if (!record.messageCount) {
                record.messageCount = 0;
                migrated++;
            }
            
            if (record.isActive === undefined) {
                record.isActive = true;
                migrated++;
            }
        }
        
        if (removed > 0 || migrated > 0) {
            enhancedLog('info', 'GUEST_DB', `Validación completada: ${removed} removidos, ${migrated} migrados`);
            this.markAsChanged();
        }
    }
    
    // Cargar desde backup
    private loadFromBackup() {
        try {
            const backups = fs.readdirSync(this.BACKUP_DIR)
                .filter(f => f.startsWith('guests-') && f.endsWith('.json'))
                .sort()
                .reverse();
            
            if (backups.length > 0) {
                const latestBackup = path.join(this.BACKUP_DIR, backups[0]);
                const data = fs.readFileSync(latestBackup, 'utf-8');
                const parsed = JSON.parse(data);
                
                this.guests = new Map(parsed);
                
                enhancedLog('info', 'GUEST_DB', `Cargado desde backup: ${latestBackup}`, {
                    guestsCount: this.guests.size,
                    backupFile: backups[0]
                });
            }
        } catch (error) {
            enhancedLog('error', 'GUEST_DB', `Error cargando desde backup: ${error.message}`);
        }
    }
    
    // Guardar huéspedes
    saveGuests() {
        try {
            // Crear backup antes de guardar
            if (fs.existsSync(this.GUESTS_FILE)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(this.BACKUP_DIR, `guests-${timestamp}.json`);
                fs.copyFileSync(this.GUESTS_FILE, backupFile);
                
                // Mantener solo los últimos 10 backups
                this.cleanOldBackups();
            }
            
            // Convertir Map a array para JSON
            const data = Array.from(this.guests.entries());
            
            // Guardar con formato legible
            fs.writeFileSync(this.GUESTS_FILE, JSON.stringify(data, null, 2));
            
            enhancedLog('info', 'GUEST_DB', `${this.guests.size} huéspedes guardados`, {
                guestsCount: this.guests.size,
                source: 'save_operation',
                file: this.GUESTS_FILE
            });
            
        } catch (error) {
            enhancedLog('error', 'GUEST_DB', `Error guardando huéspedes: ${error.message}`);
        }
    }
    
    // Limpiar backups antiguos
    private cleanOldBackups() {
        try {
            const backups = fs.readdirSync(this.BACKUP_DIR)
                .filter(f => f.startsWith('guests-') && f.endsWith('.json'))
                .sort();
            
            while (backups.length > 10) {
                const oldBackup = backups.shift();
                if (oldBackup) {
                    fs.unlinkSync(path.join(this.BACKUP_DIR, oldBackup));
                }
            }
        } catch (error) {
            enhancedLog('warning', 'GUEST_DB', `Error limpiando backups: ${error.message}`);
        }
    }
    
    // Configurar auto-guardado
    private setupAutoSave() {
        let hasChanges = false;
        
        setInterval(() => {
            if (hasChanges && this.guests.size > 0) {
                this.saveGuests();
                hasChanges = false;
                enhancedLog('info', 'GUEST_DB', 'Auto-guardado ejecutado (había cambios pendientes)');
            }
        }, this.SAVE_INTERVAL);
        
        this.markAsChanged = () => { hasChanges = true; };
        
        enhancedLog('info', 'GUEST_DB', `Auto-guardado configurado cada ${this.SAVE_INTERVAL/60000} minutos`);
    }
    
    private markAsChanged: () => void = () => {};
    
    // Configurar guardado al cerrar
    private setupGracefulShutdown() {
        const saveOnExit = () => {
            enhancedLog('info', 'GUEST_DB', 'Guardando huéspedes antes de cerrar...');
            this.saveGuests();
            process.exit(0);
        };
        
        process.on('SIGINT', saveOnExit);
        process.on('SIGTERM', saveOnExit);
        process.on('beforeExit', () => this.saveGuests());
    }
    
    // Obtener huésped por ID
    getGuest(userId: string): GuestRecord | null {
        return this.guests.get(userId) || null;
    }
    
    // Crear o actualizar huésped
    setGuest(userId: string, data: {
        phoneNumber?: string;
        chatId?: string;
        name: string;
        displayName?: string;
        labels?: string[];
        lastMessage?: string;
        notes?: string;
        preferences?: any;
    }): void {
        const existing = this.guests.get(userId);
        const now = new Date().toISOString();
        
        const record: GuestRecord = {
            userId,
            phoneNumber: data.phoneNumber || userId,
            chatId: data.chatId || `${userId}@s.whatsapp.net`,
            name: data.name,
            displayName: data.displayName || data.name,
            labels: data.labels || [],
            createdAt: existing?.createdAt || now,
            lastActivity: now,
            lastMessage: data.lastMessage || existing?.lastMessage,
            messageCount: existing ? existing.messageCount + 1 : 1,
            isActive: true,
            notes: data.notes || existing?.notes,
            preferences: data.preferences || existing?.preferences
        };
        
        this.guests.set(userId, record);
        this.markAsChanged();
        
        enhancedLog('info', 'GUEST_DB', `Huésped ${data.name} actualizado`, {
            userId,
            name: data.name,
            messageCount: record.messageCount
        });
    }
    
    // Actualizar metadatos del huésped
    updateGuestMetadata(userId: string, updates: {
        name?: string;
        displayName?: string;
        labels?: string[];
        notes?: string;
        preferences?: any;
        isActive?: boolean;
    }): boolean {
        const existing = this.guests.get(userId);
        if (!existing) {
            enhancedLog('warning', 'GUEST_DB', `No se encontró huésped para actualizar: ${userId}`);
            return false;
        }
        
        const updated = { ...existing, ...updates, lastActivity: new Date().toISOString() };
        this.guests.set(userId, updated);
        this.markAsChanged();
        
        enhancedLog('info', 'GUEST_DB', `Metadatos actualizados para ${existing.name}`, {
            userId,
            updates: Object.keys(updates)
        });
        
        return true;
    }
    
    // Actualizar etiquetas
    updateGuestLabels(userId: string, labels: string[]): boolean {
        return this.updateGuestMetadata(userId, { labels });
    }
    
    // Registrar actividad (mensaje)
    recordActivity(userId: string, message?: string): void {
        const existing = this.guests.get(userId);
        if (existing) {
            existing.lastActivity = new Date().toISOString();
            existing.messageCount++;
            if (message) {
                existing.lastMessage = message;
            }
            this.markAsChanged();
        }
    }
    
    // Obtener estadísticas
    getStats() {
        const total = this.guests.size;
        const active = Array.from(this.guests.values()).filter(g => g.isActive).length;
        const totalMessages = Array.from(this.guests.values()).reduce((sum, g) => sum + g.messageCount, 0);
        
        return {
            totalGuests: total,
            activeGuests: active,
            inactiveGuests: total - active,
            totalMessages,
            averageMessagesPerGuest: total > 0 ? Math.round(totalMessages / total) : 0
        };
    }
    
    // Obtener información completa del huésped
    getGuestInfo(userId: string) {
        const guest = this.getGuest(userId);
        if (!guest) return null;
        
        return {
            ...guest,
            daysSinceCreated: Math.floor((Date.now() - new Date(guest.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            daysSinceLastActivity: Math.floor((Date.now() - new Date(guest.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        };
    }
    
    // Obtener todos los IDs de usuarios
    getAllUserIds(): string[] {
        return Array.from(this.guests.keys());
    }
    
    // Obtener información de todos los huéspedes
    getAllGuestsInfo(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [userId, guest] of this.guests.entries()) {
            result[userId] = this.getGuestInfo(userId);
        }
        return result;
    }
    
    // Obtener todos los huéspedes
    getAllGuests(): Record<string, GuestRecord> {
        const result: Record<string, GuestRecord> = {};
        for (const [userId, guest] of this.guests.entries()) {
            result[userId] = guest;
        }
        return result;
    }
    
    // Buscar huéspedes por criterios
    searchGuests(criteria: {
        name?: string;
        labels?: string[];
        isActive?: boolean;
        minMessages?: number;
    }): GuestRecord[] {
        return Array.from(this.guests.values()).filter(guest => {
            if (criteria.name && !guest.name.toLowerCase().includes(criteria.name.toLowerCase())) {
                return false;
            }
            if (criteria.labels && criteria.labels.length > 0) {
                const hasLabel = criteria.labels.some(label => guest.labels.includes(label));
                if (!hasLabel) return false;
            }
            if (criteria.isActive !== undefined && guest.isActive !== criteria.isActive) {
                return false;
            }
            if (criteria.minMessages && guest.messageCount < criteria.minMessages) {
                return false;
            }
            return true;
        });
    }
    
    // Eliminar huésped
    removeGuest(userId: string, reason?: string): boolean {
        const existed = this.guests.has(userId);
        if (existed) {
            this.guests.delete(userId);
            this.markAsChanged();
            enhancedLog('info', 'GUEST_DB', `Huésped removido: ${userId}`, {
                reason: reason || 'manual_removal'
            });
        }
        return existed;
    }
    
    // Limpiar todos los huéspedes
    clearAllGuests(): void {
        const count = this.guests.size;
        this.guests.clear();
        this.markAsChanged();
        
        enhancedLog('warning', 'GUEST_DB', `Todos los huéspedes limpiados (${count} eliminados)`);
        this.saveGuests();
    }
    
    // Verificar si un huésped es antiguo
    isGuestOld(userId: string, months: number = 12): boolean {
        const guest = this.getGuest(userId);
        if (!guest) return true;
        
        const lastActivity = new Date(guest.lastActivity);
        const threshold = new Date();
        threshold.setMonth(threshold.getMonth() - months);
        
        return lastActivity < threshold;
    }
    
    // Limpiar huéspedes antiguos
    cleanupOldGuests(months: number = 12): number {
        let removed = 0;
        for (const userId of this.getAllUserIds()) {
            if (this.isGuestOld(userId, months)) {
                this.removeGuest(userId, 'old_guest_cleanup');
                removed++;
            }
        }
        
        if (removed > 0) {
            enhancedLog('info', 'GUEST_DB', `${removed} huéspedes antiguos eliminados (> ${months} meses)`);
            this.saveGuests();
        }
        
        return removed;
    }
    
    // Inicializar cleanup
    initializeCleanup(): void {
        try {
            const config = getConfig();
            const months = config.historyInjectMonths || 12;
            this.cleanupOldGuests(months);
            enhancedLog('info', 'GUEST_DB', `Cleanup inicializado con ${months} meses`);
        } catch (error) {
            this.cleanupOldGuests(12);
            enhancedLog('info', 'GUEST_DB', 'Cleanup inicializado con valor por defecto (12 meses)');
        }
    }
}

// Exportar instancia singleton
export const guestDatabase = new GuestDatabaseManager(); 