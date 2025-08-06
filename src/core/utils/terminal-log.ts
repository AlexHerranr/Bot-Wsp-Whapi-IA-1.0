// src/core/utils/terminal-log.ts
import { LogLevel, LogCategory } from '../../shared/types';
import { SHOW_FUNCTION_LOGS } from './constants';

// Interfaz para desacoplar el dashboard
export interface IDashboard {
    addLog(log: string): void;
}

// Configuración para los mensajes de inicio
export interface StartupConfig {
    host?: string;
    port?: number;
    webhookUrl?: string;
    showFunctionLogs?: boolean;
}

export class TerminalLog {
    private dashboard: IDashboard;
    private config: StartupConfig;
    private showFunctionLogs: boolean;

    constructor(dashboard: IDashboard, config: StartupConfig = {}) {
        this.dashboard = dashboard;
        this.config = config;
        this.showFunctionLogs = config.showFunctionLogs ?? SHOW_FUNCTION_LOGS;
    }

    /**
     * Log genérico con categoría y nivel
     */
    private log(level: LogLevel, category: LogCategory, message: string, toDashboard: boolean = false): void {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `[${timestamp}] ${message}`;
        
        console.log(formattedMessage);
        
        if (toDashboard) {
            this.dashboard.addLog(formattedMessage);
        }
    }

    // Logs principales con formato limpio
    message(user: string, text: string): void {
        const truncated = text.length > 60 ? text.substring(0, 60) + '...' : text;
        
        // Detectar si es transcripción de audio
        if (text.startsWith('(Nota de Voz Transcrita por Whisper)')) {
            const audioText = text.replace('(Nota de Voz Transcrita por Whisper)\n🎤 ', '').trim();
            const audioTruncated = audioText.length > 60 ? audioText.substring(0, 60) + '...' : audioText;
            console.log(`🎙️ ${user}: 🔊 → "${audioTruncated}"`);
        } else {
            console.log(`🗣️ ${user}: 💬 "${truncated}" → 🤖`);
        }
        // Dashboard ya maneja su propio console.log, no duplicar
        // this.dashboard.addLog(logMsg);
    }

    typing(user: string): void {
        console.log(`✍️ ${user} está escribiendo...`);
    }

    processing(user: string): void {
        // Eliminado intencionalmente - no mostrar en terminal
    }

    response(user: string, text: string, duration: number): void {
        const logMsg = `🤖 OpenAI → ${user} (${(duration/1000).toFixed(1)}s)`;
        console.log(logMsg);
        // Dashboard ya maneja su propio console.log, no duplicar
        // this.dashboard.addLog(logMsg);
    }

    // Logs de errores
    error(message: string): void {
        console.log(`❌ Error: ${message}`);
    }

    openaiError(user: string, error: string): void {
        console.log(`❌ Error enviar a OpenAI → ${user}: ${error}`);
    }

    imageError(user: string, error: string): void {
        console.log(`❌ Error al procesar imagen → ${user}: ${error}`);
    }

    voiceError(user: string, error: string): void {
        console.log(`❌ Error al procesar audio → ${user}: ${error}`);
    }

    functionError(functionName: string, error: string): void {
        console.log(`❌ Error en función ${functionName}: ${error}`);
    }

    whapiError(operation: string, error: string): void {
        console.log(`❌ Error WHAPI (${operation}): ${error}`);
    }

    // Logs de funciones (respeta SHOW_FUNCTION_LOGS)
    functionStart(name: string, args?: any): void {
        if (!this.showFunctionLogs) return;
        
        if (name === 'check_availability' && args) {
            const { startDate, endDate } = args;
            const start = startDate?.split('-').slice(1).join('/'); // MM/DD
            const end = endDate?.split('-').slice(1).join('/');     // MM/DD
            const nights = args.endDate && args.startDate ? 
                Math.round((new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / (1000 * 60 * 60 * 24)) : '?';
            this.log('info', 'FUNCTION', `⚙️ check_availability(${start}-${end}, ${nights} noches)`);
        } else {
            this.log('info', 'FUNCTION', `⚙️ ${name}()`);
        }
    }

    functionProgress(name: string, step: string, data?: any): void {
        // Eliminado - logs redundantes
    }

    functionCompleted(name: string, result?: any, duration?: number): void {
        // Se maneja en availabilityResult
    }

    // Logs de sistema
    startup(): void {
        console.clear();
        console.log('=== Bot TeAlquilamos Iniciado ===');
        console.log(`🚀 Servidor: ${this.config?.host || 'localhost'}:${this.config?.port || 3008}`);
        console.log(`🔗 Webhook: ${this.config?.webhookUrl || 'configurando...'}`);
        console.log('✅ Sistema listo');
        console.log('');
    }

    newConversation(user: string): void {
        console.log(`\n📨 Nueva conversación con ${user}`);
    }

    // Logs de media
    image(user: string): void {
        console.log(`📷 ${user}: [Imagen recibida]`);
    }

    voice(user: string): void {
        // Log eliminado según especificaciones - no mostrar "Nota de voz recibida"
        // const logMsg = `🎤 ${user}: [Nota de voz recibida]`;
        // console.log(logMsg);
    }

    recording(user: string): void {
        console.log(`${user}: 🎙️...`);
    }

    // Logs de generación de voz/TTS
    generatingVoice(user: string, messageLength: number): void {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} 🔊 [${user}] Generando respuesta de voz (${messageLength} chars)...`);
    }

    voiceSent(user: string, duration?: number): void {
        const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
        console.log(`🤖 OpenAI → 🔊 → ${user}${durationStr}`);
    }

    processingVoice(user: string): void {
        console.log(`🎤 Procesando nota de voz de ${user}...`);
    }

    // Logs de resultados
    availabilityResult(completas: number, splits: number, duration?: number): void {
        const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
        const logMsg = `🏠 ${completas} completa${completas !== 1 ? 's' : ''} + ${splits} alternativa${splits !== 1 ? 's' : ''}${durationStr}`;
        console.log(logMsg);
        // Dashboard ya maneja su propio console.log, no duplicar
        // this.dashboard.addLog(logMsg);
    }

    // Logs de APIs externas
    externalApi(service: string, action: string, result?: string): void {
        const timestamp = new Date().toLocaleTimeString();
        if (result) {
            console.log(`🔗 [${timestamp}] ${service} → ${action} → ${result}`);
        } else {
            console.log(`🔗 [${timestamp}] ${service} → ${action}...`);
        }
    }

    // Log de advertencia
    warning(message: string): void {
        console.log(`⚠️ Advertencia: ${message}`);
    }

    // Métodos adicionales para completar exactamente 20 métodos públicos

    /**
     * 19. Log de información general
     */
    info(message: string): void {
        this.log('info', 'MESSAGE', `ℹ️ ${message}`);
    }

    /**
     * 20. Log de debug - Solo va al sistema de logs técnicos, NO a terminal
     */
    debug(message: string): void {
        // Los logs DEBUG van al sistema de logs técnicos, no a terminal
        // Solo se muestran en terminal si SHOW_DEBUG_IN_TERMINAL está activado
        if (process.env.SHOW_DEBUG_IN_TERMINAL === 'true') {
            this.log('debug', 'MESSAGE', `🐛 DEBUG: ${message}`);
        }
        // Aquí iría la llamada al sistema de logs técnicos
    }

    /**
     * Método para obtener estadísticas de logging
     */
    getStats(): { showFunctionLogs: boolean; config: StartupConfig } {
        return {
            showFunctionLogs: this.showFunctionLogs,
            config: this.config
        };
    }
}