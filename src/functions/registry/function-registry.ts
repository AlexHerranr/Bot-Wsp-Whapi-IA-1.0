/**
 * Registro central de funciones de OpenAI
 * Permite gestionar todas las funciones de manera centralizada
 */

import type { FunctionDefinition } from '../types/function-types.js';

// Importar definiciones de funciones
// import { checkAvailabilityFunction } from '../availability/beds24-availability.js'; // Moved to hotel plugin
// import { escalateToHumanFunction } from '../escalation/escalate-to-human.js'; // Moved to hotel plugin
// ELIMINADO: Context injection functionality moved to external N8N flows

// Funciones de booking
import { checkBookingDetailsFunction } from '../booking/check-booking-details.js';

/**
 * Registro de todas las funciones disponibles
 */
export const FUNCTION_REGISTRY: Record<string, FunctionDefinition> = {
  // Funciones de disponibilidad moved to hotel plugin
  // check_availability: checkAvailabilityFunction,
  
  // Funciones de escalamiento moved to hotel plugin
  // escalate_to_human: escalateToHumanFunction,
  
  // Funciones de contexto e historial - ELIMINADAS
  // inject_history: ELIMINADO - movido a flujos externos N8N
  // get_conversation_context: ELIMINADO - movido a flujos externos N8N
  
  // Funciones de booking
  check_booking_details: checkBookingDetailsFunction,
  // create_booking: createBookingFunction,  // TODO: implementar
  // cancel_booking: cancelBookingFunction,  // TODO: implementar
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