// src/core/utils/terminal-log.ts

// Interfaz para desacoplar el dashboard
export interface IDashboard {
    addLog(log: string): void;
}

// Necesitaremos la configuración para los mensajes de inicio
// Por ahora, la pasaremos como un objeto simple.
interface StartupConfig {
    host?: string;
    port?: number;
    webhookUrl?: string;
}

export class TerminalLog {
    private dashboard: IDashboard;
    private config: StartupConfig;

    constructor(dashboard: IDashboard, config: StartupConfig = {}) {
        this.dashboard = dashboard;
        this.config = config;
    }

    // Logs principales con formato limpio
    message(user: string, text: string): void {
        const logMsg = `👤 ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}}"`;
        console.log(logMsg);
        this.dashboard.addLog(logMsg);
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
        this.dashboard.addLog(logMsg);
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

    // Logs de funciones
    functionStart(name: string, args?: any): void {
        if (name === 'check_availability' && args) {
            const { startDate, endDate } = args;
            const start = startDate?.split('-').slice(1).join('/'); // MM/DD
            const end = endDate?.split('-').slice(1).join('/');     // MM/DD
            const nights = args.endDate && args.startDate ? 
                Math.round((new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / (1000 * 60 * 60 * 24)) : '?';
            console.log(`⚙️ check_availability(${start}-${end}, ${nights} noches)`);
        } else {
            console.log(`⚙️ ${name}()`);
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
        console.log('\n=== Bot TeAlquilamos Iniciado ===');
        console.log(`🚀 Servidor: ${this.config?.host || 'localhost'}:${this.config?.port || 3008}`);
        console.log(`🔗 Webhook: ${this.config?.webhookUrl || 'configurando...'}`);
        console.log('✅ Sistema listo\n');
    }

    newConversation(user: string): void {
        console.log(`\n📨 Nueva conversación con ${user}`);
    }

    // Logs de media
    image(user: string): void {
        console.log(`📷 ${user}: [Imagen recibida]`);
    }

    voice(user: string): void {
        const logMsg = `🎤 ${user}: [Nota de voz recibida]`;
        console.log(logMsg);
        this.dashboard.addLog(logMsg);
    }

    recording(user: string): void {
        console.log(`🎙️ ${user} está grabando...`);
    }

    // Logs de resultados
    availabilityResult(completas: number, splits: number, duration?: number): void {
        const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
        const logMsg = `🏠 ${completas} completa${completas !== 1 ? 's' : ''} + ${splits} alternativa${splits !== 1 ? 's' : ''}${durationStr}`;
        console.log(logMsg);
        this.dashboard.addLog(logMsg);
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
}