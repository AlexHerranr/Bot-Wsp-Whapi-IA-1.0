/**
 * Registro central de funciones de OpenAI
 * Permite gestionar todas las funciones de manera centralizada
 */

import type { FunctionDefinition } from '../types/function-types.js';

// Importar definiciones de funciones
import { checkAvailabilityFunction } from '../availability/beds24-availability.js';
import { escalateToHumanFunction } from '../escalation/escalate-to-human.js';
import { injectHistoryFunction } from '../history/inject-history.js';
import { getConversationContextFunction } from '../context/get-conversation-context.js';
import { generateBookingConfirmationPDFFunction } from '../pdf/generate-booking-confirmation.js';
import { generatePaymentReceiptPDFFunction } from '../pdf/generate-payment-receipt.js';

/**
 * Registro de todas las funciones disponibles
 */
export const FUNCTION_REGISTRY: Record<string, FunctionDefinition> = {
  // Funciones de disponibilidad
  check_availability: checkAvailabilityFunction,
  
  // Funciones de escalamiento
  escalate_to_human: escalateToHumanFunction,
  
  // Funciones de contexto e historial
  // inject_history: injectHistoryFunction, // DESACTIVADO: OpenAI ya no necesita inyectar automáticamente
  get_conversation_context: getConversationContextFunction, // ✅ ACTIVO: OpenAI solicita contexto bajo demanda
  
  // Funciones de generación de PDFs
  generate_booking_confirmation_pdf: generateBookingConfirmationPDFFunction,
  generate_payment_receipt_pdf: generatePaymentReceiptPDFFunction,
  
  // Funciones de booking (documentadas, pendientes de implementación)
  // create_booking: createBookingFunction,
  // get_booking_details: getBookingDetailsFunction,
  // cancel_booking: cancelBookingFunction,
};

/**
 * Obtener función por nombre
 */
export function getFunction(name: string): FunctionDefinition | undefined {
  return FUNCTION_REGISTRY[name];
}

/**
 * Obtener todas las funciones habilitadas
 */
export function getEnabledFunctions(): FunctionDefinition[] {
  return Object.values(FUNCTION_REGISTRY).filter(fn => fn.enabled);
}

/**
 * Obtener funciones por categoría
 */
export function getFunctionsByCategory(category: string): FunctionDefinition[] {
  return Object.values(FUNCTION_REGISTRY).filter(fn => fn.category === category);
}

/**
 * Generar esquemas para OpenAI
 */
export function generateOpenAISchemas(): any[] {
  return getEnabledFunctions().map(fn => ({
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters
  }));
}

/**
 * Ejecutar función por nombre
 */
export async function executeFunction(name: string, args: any, requestId?: string): Promise<any> {
  const functionDef = getFunction(name);
  
  if (!functionDef) {
    throw new Error(`Función '${name}' no encontrada`);
  }
  
  if (!functionDef.enabled) {
    throw new Error(`Función '${name}' está deshabilitada`);
  }
  
  // 🔧 ETAPA 3: Pasar requestId a funciones que lo soporten
  if (requestId && typeof functionDef.handler === 'function') {
    // Intentar llamar con requestId si la función lo acepta
    try {
      return await (functionDef.handler as any)(args, requestId);
    } catch (error) {
      // Si falla, intentar sin requestId (compatibilidad hacia atrás)
      return await functionDef.handler(args);
    }
  }
  
  return await functionDef.handler(args);
}

/**
 * Obtener estadísticas del registro
 */
export function getRegistryStats() {
  const allFunctions = Object.values(FUNCTION_REGISTRY);
  const enabledFunctions = allFunctions.filter(fn => fn.enabled);
  
  const categoryCounts = allFunctions.reduce((acc, fn) => {
    acc[fn.category] = (acc[fn.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    total: allFunctions.length,
    enabled: enabledFunctions.length,
    disabled: allFunctions.length - enabledFunctions.length,
    categories: categoryCounts,
    functions: allFunctions.map(fn => ({
      name: fn.name,
      category: fn.category,
      enabled: fn.enabled,
      version: fn.version
    }))
  };
}

/**
 * Habilitar/deshabilitar función
 */
export function toggleFunction(name: string, enabled: boolean): boolean {
  const functionDef = getFunction(name);
  
  if (!functionDef) {
    return false;
  }
  
  functionDef.enabled = enabled;
  return true;
}

/**
 * Validar que todas las funciones estén correctamente configuradas
 */
export function validateRegistry(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [name, fn] of Object.entries(FUNCTION_REGISTRY)) {
    // Validar estructura básica
    if (!fn.name || !fn.description || !fn.handler) {
      errors.push(`Función '${name}' tiene estructura inválida`);
    }
    
    // Validar parámetros
    if (!fn.parameters || !fn.parameters.type || !fn.parameters.properties) {
      errors.push(`Función '${name}' tiene parámetros inválidos`);
    }
    
    // Validar categoría
    if (!fn.category) {
      errors.push(`Función '${name}' no tiene categoría definida`);
    }
    
    // Validar que el nombre coincida
    if (fn.name !== name) {
      errors.push(`Función '${name}' tiene nombre inconsistente: ${fn.name}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Validar registro al cargar
const validation = validateRegistry();
if (!validation.valid) {
  console.warn('⚠️ Errores en el registro de funciones:', validation.errors);
} 