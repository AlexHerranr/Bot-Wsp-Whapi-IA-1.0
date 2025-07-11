// src/utils/logging/category-mapper.ts

/**
 * @description Define las categorías de log válidas y sus propiedades.
 * Organizado por componente para claridad.
 */
export const VALID_CATEGORIES = {
    // Sistema y Core
    'SERVER_START': { level: 'SUCCESS', component: 'system' },
    'BOT_READY': { level: 'SUCCESS', component: 'system' },
    'HEALTH_CHECK': { level: 'INFO', component: 'system' },
    'SHUTDOWN': { level: 'INFO', component: 'system' },
    'CLEANUP': { level: 'INFO', component: 'system' },

    // Flujo de Mensajes y WhatsApp
    'WEBHOOK': { level: 'INFO', component: 'whatsapp-api' },
    'MESSAGE_RECEIVED': { level: 'INFO', component: 'messaging' },
    'MESSAGE_BUFFER': { level: 'INFO', component: 'messaging' },
    'MESSAGE_PROCESS': { level: 'INFO', component: 'messaging' },
    'WHATSAPP_SEND': { level: 'INFO', component: 'whatsapp-api' },
    'WHATSAPP_CHUNKS': { level: 'INFO', component: 'whatsapp-api' },
    'WHATSAPP_CHUNKS_COMPLETE': { level: 'SUCCESS', component: 'whatsapp-api' },
    'MESSAGE_COMPLETE': { level: 'SUCCESS', component: 'messaging' },

    // OpenAI y Procesamiento de IA
    'OPENAI_REQUEST': { level: 'INFO', component: 'ai-processing' },
    'OPENAI_RESPONSE': { level: 'SUCCESS', component: 'ai-processing' },
    'OPENAI_ERROR': { level: 'ERROR', component: 'ai-processing' },
    'OPENAI_RUN_STARTED': { level: 'INFO', component: 'ai-processing' },
    'OPENAI_RUN_COMPLETED': { level: 'SUCCESS', component: 'ai-processing' },
    'OPENAI_RUN_ACTIVE': { level: 'WARNING', component: 'ai-processing' },
    'OPENAI_RUN_CANCEL': { level: 'WARNING', component: 'ai-processing' },
    'OPENAI_RUN_CANCEL_ERROR': { level: 'WARNING', component: 'ai-processing' },
    'OPENAI_RUN_CLEANUP': { level: 'INFO', component: 'ai-processing' },
    'OPENAI_FUNCTION_OUTPUT': { level: 'INFO', component: 'ai-processing' },

    // Function Calling
    'FUNCTION_CALLING_START': { level: 'INFO', component: 'function-calling' },
    'FUNCTION_EXECUTING': { level: 'INFO', component: 'function-calling' },
    'FUNCTION_HANDLER': { level: 'SUCCESS', component: 'function-calling' },
    'FUNCTION_SUBMITTED': { level: 'INFO', component: 'function-calling' },
    'FUNCTION_ERROR': { level: 'ERROR', component: 'function-calling' },

    // Gestión de Threads
    'THREAD_STATE': { level: 'INFO', component: 'thread-management' },
    'THREAD_CREATED': { level: 'SUCCESS', component: 'thread-management' },
    'THREAD_REUSE': { level: 'SUCCESS', component: 'thread-management' },
    'THREAD_PERSIST': { level: 'INFO', component: 'thread-management' },
    'THREAD_CLEANUP': { level: 'INFO', component: 'thread-management' },

    // Integración con Beds24
    'BEDS24_REQUEST': { level: 'INFO', component: 'beds24-integration' },
    'BEDS24_API_CALL': { level: 'INFO', component: 'beds24-integration' },
    'BEDS24_PROCESSING': { level: 'INFO', component: 'beds24-integration' },
    'BEDS24_RESPONSE_DETAIL': { level: 'INFO', component: 'beds24-integration' },

    // Lógica de Disponibilidad
    'AVAILABILITY_HANDLER': { level: 'INFO', component: 'availability' },

    // Servicio de Contactos y Contexto
    'CONTACT_API': { level: 'SUCCESS', component: 'contact-service' },
    'CONTACT_API_DETAILED': { level: 'INFO', component: 'contact-service' },
    'CONTEXT_LABELS': { level: 'INFO', component: 'contact-service' },

    // Generales y de Debugging
    'USER_DEBUG': { level: 'INFO', component: 'debug' },
    'USER_GREETING': { level: 'INFO', component: 'user-experience' },
    'ERROR': { level: 'ERROR', component: 'system' },
    'WARNING': { level: 'WARNING', component: 'system' },
    'INFO': { level: 'INFO', component: 'system' },
    'SUCCESS': { level: 'SUCCESS', component: 'system' }
};

export type ValidCategory = keyof typeof VALID_CATEGORIES;

/**
 * @description Mapea categorías antiguas o inconsistentes a las nuevas categorías estandarizadas.
 * Esto permite una refactorización progresiva sin romper el logging.
 */
const CATEGORY_MAPPINGS: { [key: string]: ValidCategory } = {
    // Mapeos de categorías antiguas a nuevas
    'NEW_USER': 'USER_GREETING',
    'BUFFER_CREATE': 'MESSAGE_BUFFER',
    'MESSAGE_BUFFERED': 'MESSAGE_BUFFER',
    'PENDING_MESSAGE_SAVED': 'MESSAGE_BUFFER',
    'ACTIVE_RUNS_CONFLICT': 'OPENAI_RUN_ACTIVE',
    'CONFLICT_RUN_CANCELLED': 'OPENAI_RUN_CANCEL',
    'THREADS_LOADED': 'THREAD_PERSIST',
    'THREAD_LOOKUP': 'THREAD_STATE',
    'THREAD_GET': 'THREAD_STATE',
    'THREAD_CHECK': 'THREAD_STATE',
    'BEDS24_DATA_MAPPING': 'BEDS24_PROCESSING',
    'BEDS24_CLASSIFICATION': 'BEDS24_PROCESSING',
    'BEDS24_RESPONSE_SUMMARY': 'BEDS24_RESPONSE_DETAIL',
    'FUNCTION_EXECUTED': 'FUNCTION_EXECUTING',
    'FUNCTION_OUTPUTS_DETAIL': 'OPENAI_FUNCTION_OUTPUT',
    'FUNCTION_SUBMITTING': 'FUNCTION_SUBMITTED',
    'FUNCTION_SUBMIT_DEBUG': 'USER_DEBUG',
    'WHATSAPP_CHUNK': 'WHATSAPP_CHUNKS',
    'NEW_USER_LABELS': 'CONTEXT_LABELS',

    // Mapeos de limpieza
    'MEMORY_CLEANUP_SCHEDULED': 'THREAD_CLEANUP',
    'SERVER_LISTENING': 'SERVER_START',
    'PENDING_MESSAGE_REPROCESS': 'MESSAGE_PROCESS',
    'PENDING_MESSAGES_FOUND': 'WARNING',
    'PENDING_MESSAGES_RECOVERED': 'INFO',
    'PENDING_MESSAGE_REMOVED': 'MESSAGE_COMPLETE',
    'RECOVERY_START': 'INFO',
    'RECOVERY_COMPLETE': 'SUCCESS'
};

const warningCache = new Set<string>();

/**
 * Normaliza una categoría de log. Si no es válida, intenta mapearla o la asigna a 'INFO'.
 * @param category La categoría original a normalizar.
 * @returns La categoría normalizada y válida.
 */
export function normalizeCategory(category: string): ValidCategory {
    const upperCategory = category.toUpperCase();

    if (VALID_CATEGORIES[upperCategory as ValidCategory]) {
        return upperCategory as ValidCategory;
    }

    const mapped = CATEGORY_MAPPINGS[upperCategory];
    if (mapped) {
        if (!warningCache.has(upperCategory)) {
            console.warn(`⚠️ Log Category Normalized: '${upperCategory}' -> '${mapped}'`);
            warningCache.add(upperCategory);
        }
        return mapped;
    }

    if (!warningCache.has(upperCategory)) {
       console.warn(`⚠️ Unmapped Log Category: '${upperCategory}'. Defaulting to 'INFO'.`);
       warningCache.add(upperCategory);
    }
    
    return 'INFO';
} 