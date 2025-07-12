import { enhancedLog } from '../core/index.js';

const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';

class WhapiLabelsManager {
    constructor() {
        this.availableLabels = new Map(); // Cache de etiquetas disponibles
        this.lastLabelsUpdate = null;
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutos cache
    }

    /**
     * Obtener todas las etiquetas disponibles en WhatsApp Business
     */
    async getAvailableLabels() {
        try {
            // Verificar cache
            if (this.lastLabelsUpdate && 
                (Date.now() - this.lastLabelsUpdate) < this.CACHE_TTL) {
                return Array.from(this.availableLabels.values());
            }

            enhancedLog('info', 'WHAPI_LABELS', 'Obteniendo etiquetas disponibles de Whapi');

            const endpoint = `${WHAPI_API_URL}/labels?token=${WHAPI_TOKEN}`;
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const labels = await response.json();
            
            // Actualizar cache
            this.availableLabels.clear();
            if (Array.isArray(labels)) {
                labels.forEach(label => {
                    this.availableLabels.set(label.id, label);
                });
            }
            
            this.lastLabelsUpdate = Date.now();

            enhancedLog('success', 'WHAPI_LABELS', 
                `Obtenidas ${labels.length} etiquetas disponibles`);

            return labels;

        } catch (error) {
            enhancedLog('error', 'WHAPI_LABELS', 
                `Error obteniendo etiquetas: ${error.message}`);
            return [];
        }
    }

    /**
     * Obtener información de un chat específico (incluyendo sus etiquetas)
     */
    async getChatInfo(userId) {
        try {
            enhancedLog('info', 'WHAPI_LABELS', 
                `Obteniendo info del chat para ${userId}`);

            const chatId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
            const endpoint = `${WHAPI_API_URL}/chats/${encodeURIComponent(chatId)}?token=${WHAPI_TOKEN}`;
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    enhancedLog('warning', 'WHAPI_LABELS', 
                        `Chat no encontrado para ${userId}`);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const chatData = await response.json();
            
            enhancedLog('success', 'WHAPI_LABELS', 
                `Info del chat obtenida. Etiquetas: ${chatData.labels?.length || 0}`);

            return {
                id: chatData.id,
                name: chatData.name,
                labels: chatData.labels || [],  // Asegurar formato array de {id, name, color}
                lastMessage: chatData.last_message
            };

        } catch (error) {
            enhancedLog('error', 'WHAPI_LABELS', 
                `Error obteniendo info del chat: ${error.message}`);
            return null;
        }
    }

    /**
     * Agregar etiqueta a un chat
     */
    async addLabelToChat(userId, labelId) {
        try {
            enhancedLog('info', 'WHAPI_LABELS', 
                `Agregando etiqueta ${labelId} al chat ${userId}`);

            const chatId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
            const endpoint = `${WHAPI_API_URL}/labels/${labelId}/${encodeURIComponent(chatId)}?token=${WHAPI_TOKEN}`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            enhancedLog('success', 'WHAPI_LABELS', 
                `Etiqueta ${labelId} agregada exitosamente a ${userId}`);

            return result;

        } catch (error) {
            enhancedLog('error', 'WHAPI_LABELS', 
                `Error agregando etiqueta: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remover etiqueta de un chat
     */
    async removeLabelFromChat(userId, labelId) {
        try {
            enhancedLog('info', 'WHAPI_LABELS', 
                `Removiendo etiqueta ${labelId} del chat ${userId}`);

            const chatId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
            const endpoint = `${WHAPI_API_URL}/labels/${labelId}/${encodeURIComponent(chatId)}?token=${WHAPI_TOKEN}`;
            
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            enhancedLog('success', 'WHAPI_LABELS', 
                `Etiqueta ${labelId} removida exitosamente de ${userId}`);

            return result;

        } catch (error) {
            enhancedLog('error', 'WHAPI_LABELS', 
                `Error removiendo etiqueta: ${error.message}`);
            throw error;
        }
    }

    /**
     * Actualizar etiquetas de un chat (remover una, agregar otra)
     */
    async updateChatLabels(userId, removeLabels = [], addLabels = []) {
        try {
            enhancedLog('info', 'WHAPI_LABELS', 
                `Actualizando etiquetas para ${userId}. Remover: [${removeLabels.join(',')}], Agregar: [${addLabels.join(',')}]`);

            const results = {
                removed: [],
                added: [],
                errors: []
            };

            // Remover etiquetas
            for (const labelId of removeLabels) {
                try {
                    await this.removeLabelFromChat(userId, labelId);
                    results.removed.push(labelId);
                } catch (error) {
                    results.errors.push(`Error removiendo ${labelId}: ${error.message}`);
                }
            }

            // Agregar nuevas etiquetas
            for (const labelId of addLabels) {
                try {
                    await this.addLabelToChat(userId, labelId);
                    results.added.push(labelId);
                } catch (error) {
                    results.errors.push(`Error agregando ${labelId}: ${error.message}`);
                }
            }

            enhancedLog('success', 'WHAPI_LABELS', 
                `Etiquetas actualizadas. Removidas: ${results.removed.length}, Agregadas: ${results.added.length}, Errores: ${results.errors.length}`);

            return results;

        } catch (error) {
            enhancedLog('error', 'WHAPI_LABELS', 
                `Error actualizando etiquetas: ${error.message}`);
            throw error;
        }
    }

    /**
     * Crear nueva etiqueta en WhatsApp Business
     */
    async createLabel(name, color = 'blue') {
        try {
            enhancedLog('info', 'WHAPI_LABELS', 
                `Creando nueva etiqueta: ${name} (${color})`);

            const endpoint = `${WHAPI_API_URL}/labels?token=${WHAPI_TOKEN}`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    color: color
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Invalidar cache para refrescar etiquetas
            this.lastLabelsUpdate = null;
            
            enhancedLog('success', 'WHAPI_LABELS', 
                `Etiqueta "${name}" creada exitosamente`);

            return result;

        } catch (error) {
            enhancedLog('error', 'WHAPI_LABELS', 
                `Error creando etiqueta: ${error.message}`);
            throw error;
        }
    }

    /**
     * Buscar etiqueta por nombre
     */
    async findLabelByName(name) {
        const labels = await this.getAvailableLabels();
        return labels.find(label => 
            label.name.toLowerCase() === name.toLowerCase()
        );
    }

    /**
     * Obtener estadísticas de etiquetas
     */
    async getLabelsStats() {
        try {
            const labels = await this.getAvailableLabels();
            
            const stats = {
                totalLabels: labels.length,
                labelsByColor: {},
                mostUsedLabels: labels
                    .sort((a, b) => (b.count || 0) - (a.count || 0))
                    .slice(0, 5)
            };

            labels.forEach(label => {
                const color = label.color || 'unknown';
                stats.labelsByColor[color] = (stats.labelsByColor[color] || 0) + 1;
            });

            return stats;

        } catch (error) {
            enhancedLog('error', 'WHAPI_LABELS', 
                `Error obteniendo estadísticas: ${error.message}`);
            return null;
        }
    }
}

// Exportar instancia singleton
export const whapiLabels = new WhapiLabelsManager(); 