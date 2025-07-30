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
        
        // Hotel-specific business context
        context += '\n\n=== INFORMACIÓN DEL NEGOCIO ===\n';
        context += 'Nombre: TeAlquilamos\n';
        context += 'Tipo: Hotel boutique en Cartagena, Colombia\n';
        context += 'Especialidad: Alquiler temporal de habitaciones y apartamentos\n';
        context += 'IMPORTANTE: Analiza el historial previo para dar respuestas contextualizadas. ';
        context += 'Si el cliente ya ha mostrado interés o hecho consultas anteriores, ';
        context += 'referéncialos apropiadamente y continúa la conversación de manera natural.\n\n';
        
        // Hotel labels management context
        if (chatInfo && chatInfo.labels && chatInfo.labels.length > 0) {
            context += '=== GESTIÓN DE ETIQUETAS ===\n';
            context += 'El cliente tiene etiquetas asignadas en WhatsApp Business. ';
            context += 'Puedes actualizar estas etiquetas usando la función "update_client_labels" ';
            context += 'cuando el estado del cliente cambie (ej: de "cotizando" a "confirmado").\n\n';
        }
        
        context += `---\nMensaje del cliente:\n`;

        return context;
    }

    public needsRefresh(
        userId: string,
        lastContext: any,
        profile: Profile,
        chatInfo: ChatInfo
    ): boolean {
        // Hotel-specific refresh logic
        const now = Date.now();
        const CONTEXT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
        
        if (!lastContext || !lastContext.timestamp) {
            return true;
        }
        
        // Force refresh if context is older than 5 minutes
        if (now - lastContext.timestamp > CONTEXT_REFRESH_INTERVAL) {
            return true;
        }
        
        // Force refresh if labels have changed
        const currentLabels = [...(profile?.whapiLabels || []), ...(chatInfo?.labels || [])];
        const lastLabels = lastContext.labels || [];
        
        if (currentLabels.length !== lastLabels.length || 
            !currentLabels.every(label => lastLabels.includes(label.name))) {
            return true;
        }
        
        return false;
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