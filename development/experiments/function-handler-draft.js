// src/handlers/function-handler.js

import { availabilityFunctions } from './availability-handler.js';

export class FunctionHandler {
    constructor() {
        // Mapeo de funciones disponibles
        this.functions = {
            // Funciones de disponibilidad y reservas
            check_availability: availabilityFunctions.check_availability,
            create_booking: availabilityFunctions.create_booking,
            get_room_price: availabilityFunctions.get_room_price,
            
            // Funciones existentes (ejemplo)
            get_current_time: this.getCurrentTime,
            get_weather: this.getWeather
        };
    }
    
    /**
     * Maneja la ejecución de funciones llamadas por OpenAI
     */
    async handleFunction(functionName, args) {
        console.log(`[FunctionHandler] Ejecutando: ${functionName}`, args);
        
        if (!this.functions[functionName]) {
            return {
                error: true,
                message: `Función no encontrada: ${functionName}`
            };
        }
        
        try {
            const result = await this.functions[functionName](args);
            console.log(`[FunctionHandler] Resultado:`, result);
            return result;
        } catch (error) {
            console.error(`[FunctionHandler] Error:`, error);
            return {
                error: true,
                message: `Error ejecutando ${functionName}: ${error.message}`
            };
        }
    }
    
    /**
     * Función de ejemplo: obtener hora actual
     */
    async getCurrentTime() {
        const now = new Date();
        return {
            datetime: now.toISOString(),
            timezone: "America/Bogota",
            formatted: now.toLocaleString('es-CO', { 
                timeZone: 'America/Bogota',
                dateStyle: 'full',
                timeStyle: 'short'
            })
        };
    }
    
    /**
     * Función de ejemplo: obtener clima (mock)
     */
    async getWeather(args) {
        // En producción, esto llamaría a una API real de clima
        return {
            location: args.location || "Cartagena",
            temperature: 28,
            condition: "Soleado",
            humidity: 75,
            forecast: "Clima tropical típico, se esperan lluvias por la tarde"
        };
    }
}