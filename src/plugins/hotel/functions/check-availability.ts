// src/plugins/hotel/functions/check-availability.ts
import { Beds24Client } from '../services/beds24-client';

function calculateNights(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export async function checkAvailability(args: {
    startDate: string;
    endDate: string;
    guests?: number;
}): Promise<string> {
    const beds24 = new Beds24Client(process.env.BEDS24_API_KEY!, process.env.BEDS24_PROP_KEY!);

    try {
        const nights = calculateNights(args.startDate, args.endDate);
        const results = await beds24.searchAvailability({
            arrival: args.startDate,
            departure: args.endDate,
            numAdults: args.guests || 1,
        });

        if (!results || results.length === 0) {
            return 'No hay disponibilidad para las fechas solicitadas.';
        }

        let response = 'Apartamentos disponibles:\n';
        results.forEach(apt => {
            response += `- ${apt.name}: ${apt.totalPrice.toLocaleString()} por ${nights} noches.\n`;
        });

        return response.trim();
    } catch (error: any) {
        console.error('Error en check_availability:', error);
        return 'Hubo un error al verificar la disponibilidad. Por favor, intenta de nuevo.';
    }
}