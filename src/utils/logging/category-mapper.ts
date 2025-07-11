/**
 * Category Mapper - Sistema de mapeo automático de categorías de logging
 * Soluciona el problema de categorías inválidas que aparecen en los logs
 */

// Categorías válidas actuales del sistema
export const VALID_CATEGORIES_SET = new Set([
    // --- System & Core ---
    'SERVER_START',
    'BOT_READY',
    'SYSTEM_RESTART',
    'SYSTEM_HEALTHY',
    'RECOVERY_START',
    'RECOVERY_COMPLETE',
    'WEBHOOK',
    'SYSTEM_CRASH', // <-- Nueva categoría para errores fatales
    'ERROR',
    'WARNING',
    'SUCCESS',
    'INFO',

    // --- Message Flow & WhatsApp ---
    'MESSAGE_RECEIVED',
    'MESSAGE_PROCESS',
    'WHATSAPP_SEND',
    'WHATSAPP_CHUNKS',
    'WHATSAPP_CHUNKS_COMPLETE',
    'MESSAGE_BUFFER',
    'BUFFER_TIMER_RESET',
    'PENDING_MESSAGE_REMOVED',

    // --- OpenAI & AI Processing ---
    'OPENAI_REQUEST',
    'OPENAI_RESPONSE',
    'OPENAI_RUN_COMPLETED',
    'OPENAI_FUNCTION_OUTPUT',
    
    // --- Function Calling ---
    'FUNCTION_CALLING_START',
    'FUNCTION_EXECUTING',
    'FUNCTION_HANDLER',
    'FUNCTION_SUBMITTED',
    'FUNCTION_PERFORMANCE',

    // --- Beds24 Integration ---
    'BEDS24_REQUEST',
    'BEDS24_API_CALL',
    'BEDS24_RESPONSE_DETAIL',
    'BEDS24_PROCESSING',
    'BEDS24_DEBUG_OUTPUT',

    // --- Thread & Context Management ---
    'THREAD_CREATED',
    'THREAD_PERSIST',
    'THREAD_CLEANUP',
    'THREAD_REUSE',
    'THREAD_STATE',
    'CONTEXT_LABELS',
    'CONTEXT_UPDATED',
    'CONVERSATION_START',
    'CONVERSATION_CONTINUE',
    'CONVERSATION_END',

    // --- User-specific & Debugging ---
    'USER_GREETING',
    'USER_QUESTION',
    'USER_INTENT_DETECTED',
    'USER_DEBUG',
    'CONTACT_API',
    'CONTACT_API_DETAILED',

    // --- Application Logic ---
    'AVAILABILITY_HANDLER',
    'AVAILABILITY_CHECK_START',
    'AVAILABILITY_CHECK_COMPLETE',
    'AVAILABILITY_FOUND',
    'AVAILABILITY_NONE',
    'BOOKING_INQUIRY',
    'BOOKING_REQUEST',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_MODIFIED',
    'BOT_SUGGESTION',
    'BOT_CLARIFICATION',
    'BOT_MESSAGE_TRACKED',
    
    // --- Performance & Rate Limiting ---
    'RUN_QUEUE',
    'RESPONSE_TIME',
    'API_LATENCY',
    'PROCESSING_COMPLETE',
    'RATE_LIMIT_HIT',
    'RATE_LIMIT_RESET',
    'DUPLICATE_MESSAGE',
    'SPAM_DETECTED'
]);

// Mapeo automático de categorías inválidas a válidas.
// Organizado por funcionalidad para facilitar el mantenimiento.
const CATEGORY_MAPPINGS: Record<string, string> = {
    // --- System & Recovery ---
    'THREADS_LOADED': 'THREAD_PERSIST',
    'THREAD_OPERATION': 'THREAD_PERSIST',
    'THREAD_CREATE': 'THREAD_CREATED',
    'THREAD_LOOKUP': 'THREAD_STATE',
    'THREAD_GET': 'THREAD_STATE',
    'THREAD_CHECK': 'THREAD_STATE',
    'MEMORY_CLEANUP_SCHEDULED': 'THREAD_CLEANUP',
    'SERVER_LISTENING': 'SERVER_START',
    'SYSTEM_INITIALIZED': 'SYSTEM_HEALTHY',
    'BOT_INITIALIZED': 'BOT_READY',
    'RECOVERY_POST_RESTART': 'RECOVERY_START',
    'PENDING_MESSAGES_FOUND': 'RECOVERY_START',
    'PENDING_MESSAGE_REPROCESS': 'RECOVERY_START',
    'RECOVERY_MESSAGES_FOUND': 'RECOVERY_COMPLETE',
    'PENDING_MESSAGES_RECOVERED': 'RECOVERY_COMPLETE',

    // --- Message Flow & WhatsApp ---
    'USER_DETECTED': 'MESSAGE_RECEIVED',
    'USER_INTERACTION': 'MESSAGE_RECEIVED',
    'NEW_USER': 'USER_GREETING',
    'MESSAGE_GROUPING': 'MESSAGE_PROCESS',
    'MESSAGE_PROCESSING': 'MESSAGE_PROCESS',
    'PENDING_MESSAGE_SAVED': 'MESSAGE_BUFFER',
    'MESSAGE_BUFFERED': 'MESSAGE_BUFFER',
    'MESSAGE_BUFFERING': 'MESSAGE_BUFFER',
    'BUFFER_CREATE': 'MESSAGE_BUFFER',
    'BUFFER_MANAGEMENT': 'MESSAGE_BUFFER',
    'TIMER_RESET': 'BUFFER_TIMER_RESET',
    'WHATSAPP_CHUNK': 'WHATSAPP_CHUNKS',
    'WHATSAPP_CHUNKING': 'WHATSAPP_CHUNKS',
    'WHATSAPP_SENDING': 'WHATSAPP_SEND',
    'WEBHOOK_PROCESSING': 'WEBHOOK',
    
    // --- User and Context ---
    'NEW_USER_LABELS': 'CONTEXT_LABELS',
    'USER_CONTEXT': 'CONTEXT_LABELS',
    'USER_IDENTIFICATION': 'USER_DEBUG',
    'USER_INTENT': 'USER_INTENT_DETECTED',

    // --- OpenAI & Functions ---
    'OPENAI_STATE': 'OPENAI_RESPONSE',
    'OPENAI_PROCESSING': 'OPENAI_REQUEST',
    'OPENAI_THREAD_CREATED': 'THREAD_CREATED',
    'OPENAI_THREAD_REUSED': 'THREAD_REUSE',
    'DURATION_DETECTED': 'OPENAI_RUN_COMPLETED',
    'FUNCTION_DETECTED': 'FUNCTION_HANDLER',
    'FUNCTION_CALLING': 'FUNCTION_CALLING_START',
    'FUNCTION_EXECUTED': 'FUNCTION_EXECUTING',
    'FUNCTION_EXECUTION': 'FUNCTION_EXECUTING',
    'FUNCTION_SUBMITTING': 'FUNCTION_SUBMITTED',
    'FUNCTION_RESULT': 'FUNCTION_HANDLER',
    'FUNCTION_COMPLETED': 'FUNCTION_HANDLER',
    'FUNCTION_OUTPUTS_DETAIL': 'OPENAI_FUNCTION_OUTPUT',
    'FUNCTION_SUBMIT_DEBUG': 'USER_DEBUG',
    
    // --- Beds24 Integration ---
    'BEDS24_DETECTED': 'BEDS24_PROCESSING',
    'BEDS24_RESPONSE_SUMMARY': 'BEDS24_RESPONSE_DETAIL',
    'BEDS24_AVAILABILITY': 'AVAILABILITY_HANDLER',
    'BEDS24_DATA_MAPPING': 'BEDS24_PROCESSING',
    'BEDS24_CLASSIFICATION': 'BEDS24_PROCESSING',
    'BEDS24_SPLITS': 'BEDS24_PROCESSING',
    'BEDS24_API_REQUEST': 'BEDS24_API_CALL',
    'BEDS24_API_RESPONSE': 'BEDS24_RESPONSE_DETAIL',
    'BEDS24_DATA_PROCESSING': 'BEDS24_PROCESSING',
    'BEDS24_OPTIMIZATION': 'BEDS24_API_CALL',
    'AVAILABILITY_CHECK': 'AVAILABILITY_CHECK_START',
    'AVAILABILITY_QUERY': 'AVAILABILITY_CHECK_START',
    'AVAILABILITY_RESULT': 'AVAILABILITY_CHECK_COMPLETE',
    'CALENDAR_CHECK': 'AVAILABILITY_CHECK_START',

    // --- Control Flow ---
    'RATE_LIMITED': 'RATE_LIMIT_HIT',
    'DUPLICATE_HANDLING': 'DUPLICATE_MESSAGE',
    'RATE_LIMITING': 'RATE_LIMIT_HIT',

    // --- General & Fallback from Parser ---
    'JSON_DATA': 'INFO',
    'ERROR_DETECTED': 'ERROR',
    'SYSTEM_CRASH': 'SYSTEM_CRASH'
};

// Cache para evitar warnings repetidos
const invalidCategoryWarnings = new Set<string>();

/**
 * Normaliza una categoría inválida a una válida
 * @param category - Categoría original
 * @returns Categoría normalizada válida
 */
export function normalizeCategory(category: string): string {
    // Limpiar categoría de espacios y caracteres especiales
    const cleanCategory = category.trim().toUpperCase();
    
    // 1. Verificar si ya es válida
    if (VALID_CATEGORIES_SET.has(cleanCategory)) {
        return cleanCategory;
    }
    
    // 2. Buscar mapeo directo
    if (CATEGORY_MAPPINGS[cleanCategory]) {
        return CATEGORY_MAPPINGS[cleanCategory];
    }
    
    // 3. Mapeo inteligente por contexto
    if (cleanCategory.includes('THREAD')) return 'THREAD_PERSIST';
    if (cleanCategory.includes('OPENAI')) return 'OPENAI_RESPONSE';
    if (cleanCategory.includes('BEDS24')) return 'BEDS24_PROCESSING';
    if (cleanCategory.includes('FUNCTION')) return 'FUNCTION_HANDLER';
    if (cleanCategory.includes('MESSAGE')) return 'MESSAGE_PROCESS';
    if (cleanCategory.includes('WHATSAPP')) return 'WHATSAPP_SEND';
    if (cleanCategory.includes('ERROR')) return 'ERROR';
    if (cleanCategory.includes('WARNING')) return 'WARNING';
    if (cleanCategory.includes('SUCCESS')) return 'SUCCESS';
    if (cleanCategory.includes('USER')) return 'USER_DEBUG';
    if (cleanCategory.includes('BUFFER')) return 'MESSAGE_BUFFER';
    if (cleanCategory.includes('WEBHOOK')) return 'WEBHOOK';
    if (cleanCategory.includes('SERVER')) return 'SERVER_START';
    if (cleanCategory.includes('BOT')) return 'BOT_READY';
    
    // 4. Último recurso - categoría genérica
    return 'INFO';
}

/**
 * Valida una categoría y muestra warning si es inválida (solo una vez)
 * @param originalCategory - Categoría original
 * @param normalizedCategory - Categoría normalizada
 */
export function validateAndWarnCategory(originalCategory: string, normalizedCategory: string): void {
    if (originalCategory !== normalizedCategory && !invalidCategoryWarnings.has(originalCategory)) {
        console.warn(`⚠️ Category normalized: ${originalCategory} → ${normalizedCategory}`);
        invalidCategoryWarnings.add(originalCategory);
    }
}

/**
 * Obtiene estadísticas de mapeo de categorías
 * @returns Estadísticas de uso del mapeo
 */
export function getCategoryMappingStats(): {
    totalMappings: number;
    warningsIssued: number;
    validCategories: number;
} {
    return {
        totalMappings: Object.keys(CATEGORY_MAPPINGS).length,
        warningsIssued: invalidCategoryWarnings.size,
        validCategories: VALID_CATEGORIES_SET.size
    };
}

/**
 * Limpia el cache de warnings (útil para testing)
 */
export function clearWarningsCache(): void {
    invalidCategoryWarnings.clear();
} 