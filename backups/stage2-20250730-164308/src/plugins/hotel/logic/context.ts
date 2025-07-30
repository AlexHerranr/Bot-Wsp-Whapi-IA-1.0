// src/plugins/hotel/logic/context.ts
import { IContextProvider } from '../../../shared/interfaces';

// Simulación de dependencias que serán inyectadas
interface Profile { name?: string; whapiLabels?: { name: string }[] }
interface ChatInfo { name?: string; labels?: { name: string }[] }

export class HotelContext implements IContextProvider {
    private contextBaseCache: { date: string; time: string; timestamp: number } | null = null;

    public async getRelevantContext(
        userId: string,
        profile: Profile,
        chatInfo: ChatInfo,
        requestId?: string
    ): Promise<string> {
        const { date, time } = this.getPrecomputedContextBase();

        const clientName = profile?.name || 'Cliente';
        const contactName = chatInfo?.name || clientName;

        const profileLabels = profile?.whapiLabels?.map((l) => l.name) || [];
        const chatLabels = chatInfo?.labels?.map((l) => l.name) || [];
        const allLabels = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2);

        let context = `Fecha: ${date} | Hora: ${time} (Colombia)\n`;
        context += `Cliente: ${clientName} | Contacto WhatsApp: ${contactName}`;
        if (allLabels.length > 0) {
            context += ` | Status: ${allLabels.join(', ')}`;
        }
        context += `\n---\nMensaje del cliente:\n`;

        return context;
    }

    public needsRefresh(
        userId: string,
        lastContext: any,
        profile: Profile,
        chatInfo: ChatInfo
    ): boolean {
        // Lógica para determinar si el contexto necesita ser refrescado
        // (basado en tiempo, cambio de labels, etc.)
        return true; // Por ahora, siempre refresca
    }

    private getPrecomputedContextBase(): { date: string; time: string } {
        const now = Date.now();
        const CONTEXT_BASE_CACHE_TTL = 60 * 1000; // 1 minuto

        if (this.contextBaseCache && (now - this.contextBaseCache.timestamp) < CONTEXT_BASE_CACHE_TTL) {
            return { date: this.contextBaseCache.date, time: this.contextBaseCache.time };
        }

        const currentDate = new Date().toLocaleDateString('es-ES', { 
            timeZone: 'America/Bogota', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        const currentTime = new Date().toLocaleTimeString('en-US', { 
            timeZone: 'America/Bogota', 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });

        this.contextBaseCache = { date: currentDate, time: currentTime, timestamp: now };
        return { date: currentDate, time: currentTime };
    }
}