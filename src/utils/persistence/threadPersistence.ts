import * as fs from 'fs';
import * as path from 'path';
import { enhancedLog } from '../core/index.js';

interface ThreadRecord {
    threadId: string;
    chatId: string;        // WhatsApp chat ID completo (con @s.whatsapp.net)
    userName: string;      // Nombre del usuario
    createdAt: string;
    lastActivity: string;
    previousThreads?: string[]; // IDs de threads anteriores
}

export class ThreadPersistenceManager {
    private threads: Map<string, ThreadRecord>;
    private readonly THREADS_FILE = 'tmp/threads.json';
    private readonly BACKUP_DIR = 'tmp/backups';
    private readonly SAVE_INTERVAL = 30000; // 30 segundos
    // Eliminado: Ya no contamos mensajes
    
    constructor() {
        this.threads = new Map();
        this.ensureDirectories();
        this.loadThreads();
        this.setupAutoSave();
        this.setupGracefulShutdown();
    }
    
    // Asegurar que los directorios existen
    private ensureDirectories() {
        const dirs = ['tmp', this.BACKUP_DIR];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                enhancedLog('info', 'THREAD_PERSIST', `Directorio creado: ${dir}`);
            }
        });
    }
    
    // Cargar threads desde archivo
    private loadThreads() {
        try {
            if (fs.existsSync(this.THREADS_FILE)) {
                const data = fs.readFileSync(this.THREADS_FILE, 'utf-8');
                const parsed = JSON.parse(data);
                
                // ARREGLO: Convertir array a Map correctamente
                this.threads = new Map(parsed);
                
                enhancedLog('success', 'THREAD_PERSIST', 
                    `${this.threads.size} threads cargados desde archivo`);
                
                // LOG DE DEBUG: Mostrar threads cargados
                for (const [userId, record] of this.threads.entries()) {
                    enhancedLog('info', 'THREAD_DEBUG', 
                        `Thread cargado: ${userId} (${record.userName || 'Sin nombre'}) -> ${record.threadId}`);
                }
                
                // Verificar integridad
                this.validateThreads();
            } else {
                enhancedLog('info', 'THREAD_PERSIST', 
                    'No se encontró archivo de threads, iniciando vacío');
            }
        } catch (error) {
            enhancedLog('error', 'THREAD_PERSIST', 
                `Error cargando threads: ${error.message}`);
            
            // Intentar cargar desde backup
            this.loadFromBackup();
        }
    }
    
    // Validar threads cargados
    private validateThreads() {
        let removed = 0;
        let migrated = 0;
        
        for (const [userId, record] of this.threads.entries()) {
            if (!record.threadId || !record.createdAt) {
                this.threads.delete(userId);
                removed++;
                enhancedLog('warning', 'THREAD_PERSIST', 
                    `Thread inválido removido para usuario ${userId}`);
            }
            
            // Migrar threads antiguos sin chatId o userName
            if (!record.chatId) {
                record.chatId = `${userId}@s.whatsapp.net`;
                record.userName = record.userName || 'Usuario';
                migrated++;
                enhancedLog('info', 'THREAD_PERSIST', 
                    `Thread migrado para ${userId}: agregado chatId y userName`);
            }
        }
        
        if (removed > 0) {
            enhancedLog('info', 'THREAD_PERSIST', 
                `${removed} threads inválidos removidos`);
        }
        
        if (migrated > 0) {
            enhancedLog('info', 'THREAD_PERSIST', 
                `${migrated} threads migrados a nueva estructura`);
            this.saveThreads(); // Guardar inmediatamente después de migrar
        }
    }
    
    // Cargar desde backup
    private loadFromBackup() {
        try {
            const backups = fs.readdirSync(this.BACKUP_DIR)
                .filter(f => f.endsWith('.json'))
                .sort()
                .reverse();
            
            if (backups.length > 0) {
                const latestBackup = path.join(this.BACKUP_DIR, backups[0]);
                const data = fs.readFileSync(latestBackup, 'utf-8');
                const parsed = JSON.parse(data);
                
                this.threads = new Map(parsed);
                
                enhancedLog('success', 'THREAD_PERSIST', 
                    `Threads restaurados desde backup: ${latestBackup}`);
            }
        } catch (error) {
            enhancedLog('error', 'THREAD_PERSIST', 
                `Error cargando backup: ${error.message}`);
        }
    }
    
    // Guardar threads
    saveThreads() {
        try {
            // Crear backup antes de guardar
            if (fs.existsSync(this.THREADS_FILE)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(this.BACKUP_DIR, `threads-${timestamp}.json`);
                fs.copyFileSync(this.THREADS_FILE, backupFile);
                
                // Mantener solo los últimos 10 backups
                this.cleanOldBackups();
            }
            
            // Convertir Map a array para JSON
            const data = Array.from(this.threads.entries());
            
            // Guardar con formato legible
            fs.writeFileSync(this.THREADS_FILE, JSON.stringify(data, null, 2));
            
            enhancedLog('success', 'THREAD_PERSIST', 
                `${this.threads.size} threads guardados`);
            
        } catch (error) {
            enhancedLog('error', 'THREAD_PERSIST', 
                `Error guardando threads: ${error.message}`);
        }
    }
    
    // Limpiar backups antiguos
    private cleanOldBackups() {
        try {
            const backups = fs.readdirSync(this.BACKUP_DIR)
                .filter(f => f.endsWith('.json'))
                .sort();
            
            while (backups.length > 10) {
                const oldBackup = backups.shift();
                if (oldBackup) {
                    fs.unlinkSync(path.join(this.BACKUP_DIR, oldBackup));
                }
            }
        } catch (error) {
            enhancedLog('warning', 'THREAD_PERSIST', 
                `Error limpiando backups: ${error.message}`);
        }
    }
    
    // Configurar auto-guardado optimizado
    private setupAutoSave() {
        // Cambiar de 30 segundos a 5 minutos, y solo si hay cambios
        const SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutos
        let hasChanges = false;
        
        setInterval(() => {
            if (hasChanges && this.threads.size > 0) {
                this.saveThreads();
                hasChanges = false; // Reset flag
                enhancedLog('info', 'THREAD_PERSIST', 
                    'Auto-guardado ejecutado (había cambios pendientes)');
            }
        }, SAVE_INTERVAL);
        
        // Marcar que hay cambios cuando se modifican threads
        this.markAsChanged = () => { hasChanges = true; };
        
        enhancedLog('info', 'THREAD_PERSIST', 
            `Auto-guardado optimizado configurado cada ${SAVE_INTERVAL/60000} minutos`);
    }
    
    private markAsChanged: () => void = () => {};
    
    // Configurar guardado al cerrar
    private setupGracefulShutdown() {
        const saveOnExit = () => {
            enhancedLog('info', 'THREAD_PERSIST', 
                'Guardando threads antes de cerrar...');
            this.saveThreads();
            process.exit(0);
        };
        
        process.on('SIGINT', saveOnExit);
        process.on('SIGTERM', saveOnExit);
        process.on('beforeExit', () => this.saveThreads());
    }
    
    // Obtener thread de un usuario
    getThread(userId: string): ThreadRecord | null {
        return this.threads.get(userId) || null;
    }
    
    // Guardar o actualizar thread con información completa
    setThread(userId: string, threadId: string, chatId?: string, userName?: string) {
        const existing = this.threads.get(userId);
        
        const record: ThreadRecord = {
            threadId,
            chatId: chatId || existing?.chatId || `${userId}@s.whatsapp.net`,
            userName: userName || existing?.userName || 'Usuario',
            createdAt: existing?.createdAt || new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            previousThreads: existing?.previousThreads || []
        };
        
        this.threads.set(userId, record);
        
        // Solo marcar cambios para auto-save optimizado
        this.markAsChanged();
        
        enhancedLog('info', 'THREAD_PERSIST', 
            `Thread ${existing ? 'actualizado' : 'creado'} para ${userId} (${record.userName}): ${threadId}`);
    }
    
    // Eliminado: Sistema de rotación de threads (ya no contamos mensajes)
    
    // Obtener estadísticas
    getStats() {
        const now = new Date();
        let activeThreads = 0;
        
        for (const [userId, record] of this.threads.entries()) {
            // Thread activo = usado en los últimos 7 días
            const lastActivity = new Date(record.lastActivity);
            const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSinceActivity <= 7) {
                activeThreads++;
            }
        }
        
        return {
            totalThreads: this.threads.size,
            activeThreads
        };
    }
    
    // Obtener información detallada de un thread
    getThreadInfo(userId: string) {
        const record = this.threads.get(userId);
        if (!record) return null;
        
        const now = new Date();
        const lastActivity = new Date(record.lastActivity);
        const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        
        return {
            userId,
            threadId: record.threadId,
            chatId: record.chatId,
            userName: record.userName,
            createdAt: record.createdAt,
            lastActivity: record.lastActivity,
            previousThreads: record.previousThreads || [],
            daysSinceActivity: Math.floor(daysSinceActivity),
            isActive: daysSinceActivity <= 7
        };
    }
    
    // Obtener todos los userIds con threads
    getAllUserIds(): string[] {
        return Array.from(this.threads.keys());
    }
    
    // Obtener información de todos los threads (para debug)
    getAllThreadsInfo(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [userId, record] of this.threads.entries()) {
            result[userId] = {
                threadId: record.threadId,
                chatId: record.chatId,
                userName: record.userName,
                lastActivity: record.lastActivity,
                createdAt: record.createdAt,
                previousThreads: record.previousThreads?.length || 0
            };
        }
        return result;
    }
}

// Exportar instancia singleton
export const threadPersistence = new ThreadPersistenceManager();