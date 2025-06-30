// src/handlers/availability-handler.js

import dotenv from 'dotenv';
dotenv.config();

/**
 * Handler para consultar disponibilidad de habitaciones
 * Se integra con n8n que a su vez consulta Beds24 o Google Sheets
 */
export async function checkAvailability(params) {
    console.log('[Function Call] Verificando disponibilidad:', params);
    
    try {
        // Validar parámetros requeridos
        if (!params.check_in || !params.check_out || !params.guests) {
            return {
                error: true,
                message: "Faltan parámetros requeridos (check_in, check_out, guests)"
            };
        }
        
        // Formatear fechas si es necesario
        const checkIn = new Date(params.check_in);
        const checkOut = new Date(params.check_out);
        
        // Validar que las fechas sean válidas
        if (checkIn >= checkOut) {
            return {
                error: true,
                message: "La fecha de salida debe ser posterior a la fecha de entrada"
            };
        }
        
        // Calcular número de noches
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        
        // Llamar al webhook de n8n
        const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL + '/check-availability', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.N8N_API_KEY || ''}`
            },
            body: JSON.stringify({
                check_in: params.check_in,
                check_out: params.check_out,
                guests: params.guests,
                room_type: params.room_type || 'cualquiera',
                nights: nights
            })
        });
        
        if (!n8nResponse.ok) {
            throw new Error(`n8n respondió con error: ${n8nResponse.status}`);
        }
        
        const availability = await n8nResponse.json();
        
        // Formatear respuesta para OpenAI
        return formatAvailabilityResponse(availability, nights);
        
    } catch (error) {
        console.error('[Function Call] Error:', error);
        return {
            error: true,
            message: "Error al consultar disponibilidad. Por favor intente nuevamente."
        };
    }
}

/**
 * Handler para crear una pre-reserva
 */
export async function createBooking(params) {
    console.log('[Function Call] Creando pre-reserva:', params);
    
    try {
        const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL + '/create-booking', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.N8N_API_KEY || ''}`
            },
            body: JSON.stringify(params)
        });
        
        const booking = await n8nResponse.json();
        
        return {
            success: true,
            booking_id: booking.id,
            confirmation_code: booking.confirmation_code,
            total_amount: booking.total_amount,
            payment_link: booking.payment_link,
            expires_at: booking.expires_at
        };
        
    } catch (error) {
        console.error('[Function Call] Error creando reserva:', error);
        return {
            error: true,
            message: "Error al crear la reserva. Por favor intente nuevamente."
        };
    }
}

/**
 * Handler para obtener precio de una habitación específica
 */
export async function getRoomPrice(params) {
    console.log('[Function Call] Consultando precio:', params);
    
    try {
        const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL + '/get-room-price', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.N8N_API_KEY || ''}`
            },
            body: JSON.stringify(params)
        });
        
        const pricing = await n8nResponse.json();
        
        return {
            room_type: pricing.room_type,
            base_price: pricing.base_price,
            total_nights: pricing.nights,
            subtotal: pricing.subtotal,
            taxes: pricing.taxes,
            total: pricing.total,
            currency: "COP"
        };
        
    } catch (error) {
        console.error('[Function Call] Error consultando precio:', error);
        return {
            error: true,
            message: "Error al consultar el precio."
        };
    }
}

/**
 * Formatea la respuesta de disponibilidad para OpenAI
 */
function formatAvailabilityResponse(data, nights) {
    if (!data.available || data.rooms.length === 0) {
        return {
            available: false,
            message: "No hay habitaciones disponibles para esas fechas",
            suggested_dates: data.alternative_dates || [],
            total_nights: nights
        };
    }
    
    return {
        available: true,
        total_nights: nights,
        rooms: data.rooms.map(room => ({
            id: room.id,
            name: room.name,
            type: room.type,
            price_per_night: room.price_per_night,
            total_price: room.price_per_night * nights,
            capacity: {
                adults: room.max_adults,
                children: room.max_children,
                total: room.max_guests
            },
            amenities: room.amenities || [],
            description: room.description,
            images: room.images || []
        })),
        special_offers: data.special_offers || [],
        policies: {
            cancellation: data.cancellation_policy || "Cancelación gratuita hasta 48h antes",
            check_in: data.check_in_time || "15:00",
            check_out: data.check_out_time || "11:00"
        }
    };
}

// Exportar todas las funciones disponibles para OpenAI
export const availabilityFunctions = {
    check_availability: checkAvailability,
    create_booking: createBooking,
    get_room_price: getRoomPrice
};