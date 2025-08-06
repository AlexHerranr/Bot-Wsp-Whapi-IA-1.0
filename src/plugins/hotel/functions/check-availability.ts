// src/plugins/hotel/functions/check-availability.ts
import { Beds24Client } from '../services/beds24-client';
import { logError, logInfo } from '../../../utils/logging';
// 🔧 NUEVO: Importar logging compacto
import { logFunctionPerformance } from '../../../utils/logging/integrations';

// Función helper movida al final - ya no es necesaria aquí, beds24-client la tiene

export async function checkAvailability(args: {
    startDate: string;
    endDate: string;
    numAdults: number;
}): Promise<string> {
    const startTime = Date.now(); // 🔧 NUEVO: Mover startTime al scope de función
    
    try {
        // Validar fechas pasadas ANTES de llamar a Beds24
        const today = new Date();
        const startDate = new Date(args.startDate);
        today.setHours(0, 0, 0, 0); // Reset time to compare only dates
        startDate.setHours(0, 0, 0, 0);

        if (startDate < today) {
            const formattedToday = formatDate(today.toISOString().split('T')[0]);
            const formattedStart = formatDate(args.startDate);
            const formattedEnd = formatDate(args.endDate);
            return `Nota interna: Corrige las fechas antes de responder. Hoy es ${formattedToday}, y las fechas consultadas (${formattedStart} a ${formattedEnd}) son pasadas. Verifica con el cliente si quiso decir fechas futuras o confirma las correctas.`;
        }

        // Validar número de adultos (OBLIGATORIO)
        if (!args.numAdults) {
            return `Nota interna: Falta el número de adultos. Pregunta al cliente cuántas personas se hospedarán antes de consultar disponibilidad.`;
        }
        
        const numAdults = args.numAdults;
        if (numAdults < 1) {
            return `Nota interna: Número de adultos inválido (debe ser al menos 1). Pregunta al cliente cuántos adultos.`;
        }
        if (numAdults > 50) {
            return `Nota interna: Grupo muy grande (más de 50 adultos). Para grupos tan grandes, sugiere al cliente llamar al 3023371476 para coordinación especial.`;
        }

        // Llamar a Beds24Client que ahora retorna string formateado
        const beds24 = new Beds24Client();
        let apiTime = 0;
        let dbTime = 0;
        
        // Track API call time (Beds24Client internally tracks this)
        const result = await beds24.searchAvailability({
            arrival: args.startDate,
            departure: args.endDate,
            numAdults: numAdults,
        });

        const duration = Date.now() - startTime;
        const apartmentCount = (result.match(/🏠/g) || []).length;
        const hasFixedCharges = result.includes('$') && result.includes('Total:');
        const hasAgeInfo = result.includes('incluido mayores');
        
        // 🔧 NUEVO: Log compacto de function performance
        // Estimar tiempos (beds24Client no expone breakdown, pero podemos aproximar)
        apiTime = Math.round(duration * 0.7); // ~70% API call
        dbTime = Math.round(duration * 0.2);  // ~20% DB lookup
        
        logFunctionPerformance(
            'system', // userId no disponible en esta función
            'check_availability',
            duration,
            apiTime,
            dbTime,
            1, // calls
            0  // errors
        );
        
        // Log técnico resumido en una línea
        logInfo('HOTEL_AVAILABILITY', `${args.startDate}_${args.endDate}_${numAdults}adl | ${apartmentCount}apts | ${duration}ms | BD:${hasFixedCharges?'OK':'MISS'} | Ages:${hasAgeInfo?'OK':'MISS'} | ${result.length}chars`);

        return result; // Ya viene formateado o con mensaje de error

    } catch (error: any) {
        const duration = Date.now() - startTime;
        
        logError('CHECK_AVAILABILITY_ERROR', 'Error inesperado en check_availability', { 
            error: error.message || error,
            args 
        });
        
        // 🔧 NUEVO: Log compacto de function performance con error
        logFunctionPerformance(
            'system',
            'check_availability',
            duration,
            0, // apiTime - no completado
            0, // dbTime - no completado
            1, // calls
            1  // errors
        );
        
        if (error.message && (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('ECONNRESET'))) {
            return 'Error de conexión al verificar disponibilidad, intentados 3 reintentos. Intenta de nuevo más tarde o sugiere al cliente llamar al 3023371476.';
        }
        return 'Error inesperado al verificar disponibilidad. Intenta de nuevo.';
    }
}

// Helper para formatear fechas a DD/MM/YYYY
function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}