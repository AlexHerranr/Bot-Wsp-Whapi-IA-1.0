import { conversationHistory } from './conversationHistory.js';
import { enhancedLog } from '../core/index.js';
import { guestMemory } from '../persistence/index.js';
import { threadPersistence } from '../persistence/index.js';
import { whapiLabels } from '../whapi/index.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config();

interface ContextMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface WhapiCache {
    userId: string;
    chatId: string;
    messages: any[];
    totalMessages: number;
    lastUpdate: string;
    apiResponse: any;
}

const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';
const CACHE_DIR = path.join(process.cwd(), 'tmp');

export class ContextManager {
    // Límites simplificados
    private readonly MAX_WHAPI_MESSAGES = 100; // Máximo de mensajes a obtener de Whapi
    private readonly MAX_CONTEXT_MESSAGES = 20; // Máximo de mensajes a enviar a OpenAI
    private readonly CACHE_EXPIRY_HOURS = 24; // Cache válido por 24 horas
    
    /**
     * Obtener contexto histórico para usuarios nuevos con historial en WhatsApp
     */
    async getHistoricalContext(userId: string): Promise<string | null> {
        try {
            enhancedLog('info', 'CONTEXT_MANAGER', 
                `Obteniendo contexto histórico para ${userId}`);
            
            // DEBUG: Mostrar exactamente qué userId estamos procesando
            enhancedLog('info', 'CONTEXT_DEBUG', 
                `DEBUG - userId recibido: "${userId}" (length: ${userId.length})`);

            // Obtener histórico de mensajes (con cache)
            const messages = await this.getWhatsAppHistory(userId);
            if (!messages || messages.length === 0) {
                enhancedLog('info', 'CONTEXT_MANAGER', 
                    `No se encontró historial para ${userId}`);
                return null;
            }

            // Obtener información del cliente y sus etiquetas
            const profile = await guestMemory.getOrCreateProfile(userId);
            
            // Obtener información del chat desde Whapi (incluyendo etiquetas actualizadas)
            const chatInfo = await whapiLabels.getChatInfo(userId);
            
            // Formatear el contexto histórico
            const context = this.formatHistoricalContext(messages, profile, chatInfo);
            
            enhancedLog('success', 'CONTEXT_MANAGER', 
                `Contexto histórico creado: ${messages.length} mensajes, ${chatInfo?.labels?.length || 0} etiquetas`);

            return context;

        } catch (error) {
            enhancedLog('error', 'CONTEXT_MANAGER', 
                `Error obteniendo contexto histórico: ${error.message}`);
            return null;
        }
    }

    /**
     * Obtener información enriquecida del cliente para el contexto actual
     */
    async getEnrichedClientContext(userId: string): Promise<string> {
        try {
            // Solo obtener perfil local, NO consultar Whapi en cada mensaje
            const profile = guestMemory.getProfile(userId);
            
            if (!profile) {
                return `[CONTEXTO: Cliente nuevo sin historial previo]`;
            }

            // Usar etiquetas que ya tenemos en cache (no consultar Whapi cada vez)
            let labelsInfo = '';
            if (profile.whapiLabels && profile.whapiLabels.length > 0) {
                const labelNames = profile.whapiLabels.map(label => label.name).join(', ');
                labelsInfo = `Etiquetas: ${labelNames}, `;
            }

            const clientName = profile.name || 'Cliente';
            const status = profile.label || 'nuevo';
            
            return `[CONTEXTO: Cliente: ${clientName}, ${labelsInfo}Estado: ${status}]`;

        } catch (error) {
            enhancedLog('warning', 'CONTEXT_MANAGER', 
                `Error obteniendo contexto enriquecido: ${error.message}`);
            return `[CONTEXTO: Error obteniendo información del cliente]`;
        }
    }

    /**
     * Obtener historial de mensajes de WhatsApp con sistema de cache
     */
    private async getWhatsAppHistory(userId: string): Promise<any[] | null> {
        try {
            const chatId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
            
            // Verificar si existe cache válido
            const cachedData = this.getCachedMessages(userId);
            if (cachedData && this.isCacheValid(cachedData)) {
                enhancedLog('info', 'CONTEXT_CACHE', 
                    `Usando cache para ${userId}: ${cachedData.messages.length} mensajes`);
                return cachedData.messages;
            }
            
            // ENDPOINT CORREGIDO: Usar formato que funciona según pruebas de debug (con token en URL)
            const endpoint = `${WHAPI_API_URL}/messages/list/${encodeURIComponent(chatId)}?count=100&token=${WHAPI_TOKEN}`;
            
            // LOG DE DEBUG: Mostrar endpoint y configuración
            enhancedLog('info', 'API_DEBUG', 
                `Consultando historial en: ${endpoint}`);
            enhancedLog('info', 'API_DEBUG', 
                `Chat ID: ${chatId}`);
            
            // FETCH CON TIMEOUT para evitar colgarse
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            // LOG DE DEBUG: Mostrar respuesta HTTP
            enhancedLog('info', 'API_DEBUG', 
                `Respuesta HTTP: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                if (response.status === 404) {
                    enhancedLog('info', 'CONTEXT_MANAGER', 
                        `No se encontraron mensajes para ${userId}`);
                    return null;
                }
                
                // LOG DE DEBUG: Mostrar error detallado
                const errorText = await response.text();
                enhancedLog('error', 'API_DEBUG', 
                    `Error HTTP ${response.status}: ${errorText}`);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as any;
            
            // LOG DE DEBUG: Mostrar estructura de respuesta
            enhancedLog('info', 'API_DEBUG', 
                `Respuesta de API: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
            
            // VALIDACIÓN DE TIPOS MEJORADA
            let messages: any[] = [];
            
            if (data && typeof data === 'object') {
                if (data.messages && Array.isArray(data.messages)) {
                    messages = data.messages;
                } else if (Array.isArray(data)) {
                    messages = data;
                }
            }
            
            // Verificar si hay mensajes
            if (messages.length === 0) {
                enhancedLog('warning', 'CONTEXT_MANAGER', 
                    `API respondió correctamente pero sin mensajes para ${userId}`);
                return null;
            }

            // GUARDAR EN CACHE
            await this.saveCachedMessages(userId, chatId, messages, data);

            enhancedLog('success', 'CONTEXT_MANAGER', 
                `Obtenidos ${messages.length} mensajes de historial para ${userId} (guardados en cache)`);

            return messages;

        } catch (error) {
            if (error.name === 'AbortError') {
                enhancedLog('error', 'CONTEXT_MANAGER', 
                    `Timeout obteniendo mensajes para ${userId} (10s)`);
            } else {
                enhancedLog('error', 'CONTEXT_MANAGER', 
                    `Error obteniendo mensajes: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Obtener mensajes desde cache
     */
    private getCachedMessages(userId: string): WhapiCache | null {
        try {
            const cacheFile = path.join(CACHE_DIR, `whapi_cache_${userId}.json`);
            if (!fs.existsSync(cacheFile)) {
                return null;
            }
            
            const data = fs.readFileSync(cacheFile, 'utf-8');
            return JSON.parse(data) as WhapiCache;
        } catch (error) {
            enhancedLog('warning', 'CONTEXT_CACHE', 
                `Error leyendo cache para ${userId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Guardar mensajes en cache
     */
    private async saveCachedMessages(userId: string, chatId: string, messages: any[], apiResponse: any): Promise<void> {
        try {
            // Asegurar que el directorio tmp existe
            if (!fs.existsSync(CACHE_DIR)) {
                fs.mkdirSync(CACHE_DIR, { recursive: true });
            }

            const cacheData: WhapiCache = {
                userId,
                chatId,
                messages,
                totalMessages: messages.length,
                lastUpdate: new Date().toISOString(),
                apiResponse
            };

            const cacheFile = path.join(CACHE_DIR, `whapi_cache_${userId}.json`);
            fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');
            
            enhancedLog('success', 'CONTEXT_CACHE', 
                `Cache guardado para ${userId}: ${messages.length} mensajes en ${cacheFile}`);
        } catch (error) {
            enhancedLog('error', 'CONTEXT_CACHE', 
                `Error guardando cache para ${userId}: ${error.message}`);
        }
    }

    /**
     * Verificar si el cache es válido (no ha expirado)
     */
    private isCacheValid(cacheData: WhapiCache): boolean {
        const cacheDate = new Date(cacheData.lastUpdate);
        const now = new Date();
        const hoursAgo = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
        
        return hoursAgo < this.CACHE_EXPIRY_HOURS;
    }

    /**
     * Obtener cache de mensajes para visualización
     */
    public getCachedMessagesForViewing(userId: string): WhapiCache | null {
        return this.getCachedMessages(userId);
    }

    /**
     * Formatear contexto histórico incluyendo etiquetas de Whapi
     */
    private formatHistoricalContext(messages: any[], profile: any, chatInfo: any): string {
        // 1. INFORMACIÓN DEL CLIENTE
        let context = '=== INFORMACIÓN DEL CLIENTE ===\n';
        
        if (profile.name) {
            context += `Nombre: ${profile.name}\n`;
        }
        context += `Teléfono: ${profile.phone}\n`;
        
        // Agregar etiquetas de WhatsApp Business
        if (chatInfo && chatInfo.labels && chatInfo.labels.length > 0) {
            context += `Etiquetas de WhatsApp Business:\n`;
            chatInfo.labels.forEach(label => {
                context += `  - ${label.name} (${label.color || 'sin color'})\n`;
            });
        }
        
        if (profile.label && profile.label !== 'nuevo') {
            context += `Estado del cliente: ${profile.label}\n`;
        }
        
        context += `Primera interacción: ${new Date(profile.firstInteraction).toLocaleString('es-CO')}\n`;
        context += '\n';

        // 2. HISTORIAL DE MENSAJES DE WHATSAPP
        context += '=== HISTORIAL PREVIO DE WHATSAPP ===\n';
        context += `Los siguientes son los últimos ${messages.length} mensajes del historial de WhatsApp con este cliente:\n\n`;

        // Ordenar mensajes por fecha (más antiguos primero)
        const sortedMessages = messages
            .filter(msg => msg.type === 'text' && msg.text?.body)
            .sort((a, b) => new Date(a.timestamp * 1000).getTime() - new Date(b.timestamp * 1000).getTime())
            .slice(-50); // Solo los últimos 50 para no sobrecargar

        sortedMessages.forEach(msg => {
            const date = new Date(msg.timestamp * 1000).toLocaleString('es-CO');
            const sender = msg.from_me ? 'TeAlquilamos' : (profile.name || 'Cliente');
            context += `[${date}] ${sender}: ${msg.text.body}\n`;
        });

        // 3. INFORMACIÓN DEL NEGOCIO
        context += '\n=== INFORMACIÓN DEL NEGOCIO ===\n';
        context += 'Nombre: TeAlquilamos\n';
        context += 'Tipo: Hotel boutique en Cartagena, Colombia\n';
        context += 'Especialidad: Alquiler temporal de habitaciones y apartamentos\n';
        context += 'IMPORTANTE: Analiza el historial previo para dar respuestas contextualizadas. ';
        context += 'Si el cliente ya ha mostrado interés o hecho consultas anteriores, ';
        context += 'referéncialos apropiadamente y continúa la conversación de manera natural.\n\n';
        
        // 4. INSTRUCCIONES SOBRE ETIQUETAS
        if (chatInfo && chatInfo.labels && chatInfo.labels.length > 0) {
            context += '=== GESTIÓN DE ETIQUETAS ===\n';
            context += 'El cliente tiene etiquetas asignadas en WhatsApp Business. ';
            context += 'Puedes actualizar estas etiquetas usando la función "update_client_labels" ';
            context += 'cuando el estado del cliente cambie (ej: de "cotizando" a "confirmado").\n\n';
        }

        return context;
    }
    
    /**
     * Método para saber si necesitamos contexto histórico
     */
    needsHistoricalContext(userId: string): boolean {
        // Solo necesitamos contexto histórico si NO existe thread
        const threadInfo = threadPersistence.getThread(userId);
        return !threadInfo;
    }
    
    /**
     * Obtener información del perfil
     */
    getProfile(userId: string): any {
        return guestMemory.getProfile(userId);
    }
}

// Exportar instancia singleton
export const contextManager = new ContextManager();