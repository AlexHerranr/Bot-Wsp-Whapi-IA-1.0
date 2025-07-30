// src/plugins/hotel/services/beds24-client.ts
import { fetchWithRetry } from '../../../core/utils/retry-utils';

// Simulación de la respuesta de la API de Beds24
interface Beds24Availability {
    name: string;
    totalPrice: number;
    isSplit: boolean;
}

export class Beds24Client {
    private apiKey: string;
    private propKey: string;
    private baseUrl = 'https://api.beds24.com'; // URL de ejemplo

    constructor(apiKey: string, propKey: string) {
        this.apiKey = apiKey;
        this.propKey = propKey;
    }

    public async searchAvailability(options: {
        arrival: string;
        departure: string;
        numAdults: number;
    }): Promise<Beds24Availability[]> {
        console.log(`Buscando disponibilidad en Beds24: ${options.arrival} - ${options.departure}`);

        // Aquí iría la lógica real de la llamada a la API de Beds24
        // Por ahora, simulamos una respuesta para mantener el flujo.

        // const response = await fetchWithRetry(`${this.baseUrl}/...`);
        // const data = await response.json();

        // Respuesta simulada:
        return [
            { name: 'Apartamento Deluxe', totalPrice: 840000, isSplit: false },
            { name: 'Suite Presidencial', totalPrice: 1250000, isSplit: false },
        ];
    }
}