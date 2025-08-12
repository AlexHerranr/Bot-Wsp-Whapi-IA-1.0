/**
 * Índice principal de funciones
 * Exporta todo lo necesario para usar el sistema de funciones
 */

// Exportar tipos
export * from './types/function-types.js';

// Exportar registro central
export * from './registry/function-registry.js';

// Exportar funciones específicas
// export * from './availability/beds24-availability.js'; // Moved to hotel plugin
// export * from './escalation/escalate-to-human.js'; // Moved to hotel plugin
// ELIMINADO: export * from './context/get-conversation-context.js'; - moved to external N8N flows

// Funciones de booking (documentadas, pendientes de implementación)
// export * from './booking/create-booking.js';
// export * from './booking/get-booking-details.js';
// export * from './booking/cancel-booking.js'; 