import * as fs from 'fs';
import * as path from 'path';
import { logInfo, logError, logWarning, logSuccess } from '../logger.js';

interface PendingMessage {
    userId: string;
    chatId: string;
    userName: string;
    messages: string[];
    timestamp: number;
    environment?: string;
}

class PendingMessagesPersistence {
    private filePath: string;
    private autoSaveInterval: NodeJS.Timeout | null = null;
    
    constructor() {
        // Usar directorio tmp para los mensajes pendientes
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        
        this.filePath = path.join(tmpDir, 'pending-messages.json');
        
        // Inicializar archivo si no existe
        if (!fs.existsSync(this.filePath)) {
            this.saveToFile({});
        }
    }
    
    // Guardar mensaje pendiente
    savePendingMessage(userId: string, buffer: any): void {
        try {
            const pendingMessages = this.loadFromFile();
            
            pendingMessages[userId] = {
                userId,
                chatId: buffer.chatId,
                userName: buffer.name || userId,
                messages: buffer.messages,
                timestamp: Date.now(),
                environment: process.env.ENVIRONMENT || 'local'
            };
            
            this.saveToFile(pendingMessages);
            
            logInfo('PENDING_MESSAGE_SAVED', `Mensaje pendiente guardado para recuperación`, {
                userId,
                messageCount: buffer.messages.length,
                preview: buffer.messages[0]?.substring(0, 50)
            });
        } catch (error) {
            logError('PENDING_MESSAGE_SAVE_ERROR', `Error guardando mensaje pendiente`, {
                userId,
                error: error.message
            });
        }
    }
    
    // Eliminar mensaje pendiente (cuando se procesa exitosamente)
    removePendingMessage(userId: string): void {
        try {
            const pendingMessages = this.loadFromFile();
            
            if (pendingMessages[userId]) {
                delete pendingMessages[userId];
                this.saveToFile(pendingMessages);
                
                logInfo('PENDING_MESSAGE_REMOVED', `Mensaje pendiente eliminado después de procesar`, {
                    userId
                });
            }
        } catch (error) {
            logError('PENDING_MESSAGE_REMOVE_ERROR', `Error eliminando mensaje pendiente`, {
                userId,
                error: error.message
            });
        }
    }
    
    // Recuperar todos los mensajes pendientes
    getAllPendingMessages(): Record<string, PendingMessage> {
        try {
            return this.loadFromFile();
        } catch (error) {
            logError('PENDING_MESSAGES_LOAD_ERROR', `Error cargando mensajes pendientes`, {
                error: error.message
            });
            return {};
        }
    }
    
    // Procesar mensajes pendientes al inicio
    async processPendingMessages(processCallback: (userId: string, pendingData: PendingMessage) => Promise<void>): Promise<void> {
        const pendingMessages = this.getAllPendingMessages();
        const pendingCount = Object.keys(pendingMessages).length;
        
        if (pendingCount === 0) {
            logInfo('NO_PENDING_MESSAGES', 'No hay mensajes pendientes para recuperar');
            return;
        }
        
        console.log(`🔄 Recuperando ${pendingCount} mensajes pendientes del reinicio anterior...`);
        logWarning('PENDING_MESSAGES_FOUND', `${pendingCount} mensajes pendientes encontrados`, {
            users: Object.keys(pendingMessages)
        });
        
        let recovered = 0;
        let failed = 0;
        
        for (const [userId, pendingData] of Object.entries(pendingMessages)) {
            try {
                const ageMinutes = Math.floor((Date.now() - pendingData.timestamp) / 1000 / 60);
                
                // Solo procesar mensajes de menos de 30 minutos
                if (ageMinutes > 30) {
                    logWarning('PENDING_MESSAGE_TOO_OLD', `Mensaje pendiente muy antiguo, descartando`, {
                        userId,
                        ageMinutes,
                        userName: pendingData.userName
                    });
                    this.removePendingMessage(userId);
                    continue;
                }
                
                console.log(`📨 Recuperando mensaje de ${pendingData.userName} (hace ${ageMinutes}min)...`);
                
                // Procesar el mensaje pendiente
                await processCallback(userId, pendingData);
                
                // Eliminar después de procesar exitosamente
                this.removePendingMessage(userId);
                recovered++;
                
                // Pequeña pausa entre procesamiento
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                failed++;
                logError('PENDING_MESSAGE_PROCESS_ERROR', `Error procesando mensaje pendiente`, {
                    userId,
                    userName: pendingData.userName,
                    error: error.message
                });
            }
        }
        
        if (recovered > 0) {
            console.log(`✅ ${recovered} mensajes pendientes recuperados exitosamente`);
            logSuccess('PENDING_MESSAGES_RECOVERED', `Mensajes pendientes recuperados`, {
                total: pendingCount,
                recovered,
                failed
            });
        }
    }
    
    // Limpiar mensajes muy antiguos (más de 1 hora)
    cleanOldPendingMessages(): void {
        try {
            const pendingMessages = this.loadFromFile();
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            let cleaned = 0;
            
            for (const [userId, data] of Object.entries(pendingMessages)) {
                if (data.timestamp < oneHourAgo) {
                    delete pendingMessages[userId];
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                this.saveToFile(pendingMessages);
                logInfo('OLD_PENDING_CLEANED', `Mensajes pendientes antiguos limpiados`, {
                    cleaned
                });
            }
        } catch (error) {
            logError('PENDING_CLEAN_ERROR', `Error limpiando mensajes antiguos`, {
                error: error.message
            });
        }
    }
    
    // Métodos privados para manejo de archivos
    private loadFromFile(): Record<string, PendingMessage> {
        try {
            const data = fs.readFileSync(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }
    
    private saveToFile(data: Record<string, PendingMessage>): void {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }
    
    // Obtener estadísticas
    getStats(): { total: number; oldest?: number } {
        const pendingMessages = this.getAllPendingMessages();
        const timestamps = Object.values(pendingMessages).map(p => p.timestamp);
        
        return {
            total: Object.keys(pendingMessages).length,
            oldest: timestamps.length > 0 ? Math.min(...timestamps) : undefined
        };
    }
}

// Exportar instancia única
export const pendingMessagesPersistence = new PendingMessagesPersistence(); 