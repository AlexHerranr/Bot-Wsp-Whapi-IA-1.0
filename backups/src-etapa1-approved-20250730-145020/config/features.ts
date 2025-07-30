/**
 * 🚀 CONFIGURACIÓN DE FEATURE FLAGS
 * Control de funciones de desarrollo futuro
 * 
 * Propósito: Habilitar/deshabilitar funciones experimentales
 * sin necesidad de modificar código
 */

export interface FeatureFlags {
  // Funciones de etiquetas
  ENABLE_LABELS_MANAGEMENT: boolean;
  ENABLE_UPDATE_CLIENT_LABELS: boolean;
  ENABLE_GET_AVAILABLE_LABELS: boolean;
  
  // Funciones de cleanup
  ENABLE_UNIFIED_CLEANUP: boolean;
  ENABLE_HIGH_TOKEN_CLEANUP: boolean;
  
  // Funciones de buffering
  ENABLE_INTELLIGENT_BUFFERING: boolean;
  
  // Funciones experimentales
  ENABLE_EXPERIMENTAL_FEATURES: boolean;
}

/**
 * Configuración por defecto de feature flags
 */
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  // Funciones de etiquetas (deshabilitadas por defecto)
  ENABLE_LABELS_MANAGEMENT: false,
  ENABLE_UPDATE_CLIENT_LABELS: false,
  ENABLE_GET_AVAILABLE_LABELS: false,
  
  // Funciones de cleanup (deshabilitadas por defecto)
  ENABLE_UNIFIED_CLEANUP: false,
  ENABLE_HIGH_TOKEN_CLEANUP: false,
  
  // Funciones de buffering (deshabilitadas por defecto)
  ENABLE_INTELLIGENT_BUFFERING: false,
  
  // Funciones experimentales (deshabilitadas por defecto)
  ENABLE_EXPERIMENTAL_FEATURES: false,
};

/**
 * Obtener configuración de feature flags
 * 
 * @param environment - Entorno (development, production, etc.)
 * @returns Configuración de feature flags
 */
export function getFeatureFlags(environment: string = process.env.NODE_ENV || 'development'): FeatureFlags {
  const flags = { ...DEFAULT_FEATURE_FLAGS };
  
  // Sobrescribir con variables de entorno si existen
  if (process.env.ENABLE_LABELS_MANAGEMENT === 'true') {
    flags.ENABLE_LABELS_MANAGEMENT = true;
  }
  
  if (process.env.ENABLE_UPDATE_CLIENT_LABELS === 'true') {
    flags.ENABLE_UPDATE_CLIENT_LABELS = true;
  }
  
  if (process.env.ENABLE_GET_AVAILABLE_LABELS === 'true') {
    flags.ENABLE_GET_AVAILABLE_LABELS = true;
  }
  
  if (process.env.ENABLE_UNIFIED_CLEANUP === 'true') {
    flags.ENABLE_UNIFIED_CLEANUP = true;
  }
  
  if (process.env.ENABLE_HIGH_TOKEN_CLEANUP === 'true') {
    flags.ENABLE_HIGH_TOKEN_CLEANUP = true;
  }
  
  if (process.env.ENABLE_INTELLIGENT_BUFFERING === 'true') {
    flags.ENABLE_INTELLIGENT_BUFFERING = true;
  }
  
  if (process.env.ENABLE_EXPERIMENTAL_FEATURES === 'true') {
    flags.ENABLE_EXPERIMENTAL_FEATURES = true;
  }
  
  // Configuraciones específicas por entorno
  if (environment === 'development') {
    // En desarrollo, habilitar algunas funciones para testing
    flags.ENABLE_EXPERIMENTAL_FEATURES = true;
  }
  
  if (environment === 'testing') {
    // En testing, habilitar todas las funciones
    Object.keys(flags).forEach(key => {
      flags[key as keyof FeatureFlags] = true;
    });
  }
  
  return flags;
}

/**
 * Verificar si una función está habilitada
 * 
 * @param flagName - Nombre del flag
 * @param environment - Entorno
 * @returns Si la función está habilitada
 */
export function isFeatureEnabled(flagName: keyof FeatureFlags, environment?: string): boolean {
  const flags = getFeatureFlags(environment);
  return flags[flagName];
}

/**
 * Obtener lista de funciones habilitadas
 * 
 * @param environment - Entorno
 * @returns Lista de funciones habilitadas
 */
export function getEnabledFeatures(environment?: string): string[] {
  const flags = getFeatureFlags(environment);
  return Object.entries(flags)
    .filter(([_, enabled]) => enabled)
    .map(([name, _]) => name);
}

/**
 * Log de configuración de features
 * 
 * @param environment - Entorno
 */
export function logFeatureFlags(environment?: string): void {
  const flags = getFeatureFlags(environment);
  const enabled = getEnabledFeatures(environment);
  
  console.log('🚀 Feature Flags Configurados:');
  console.log(`   Entorno: ${environment || process.env.NODE_ENV || 'development'}`);
  console.log(`   Funciones habilitadas: ${enabled.length}`);
  
  if (enabled.length > 0) {
    console.log('   ✅ Habilitadas:');
    enabled.forEach(feature => {
      console.log(`      - ${feature}`);
    });
  }
  
  const disabled = Object.entries(flags)
    .filter(([_, enabled]) => !enabled)
    .map(([name, _]) => name);
  
  if (disabled.length > 0) {
    console.log('   ❌ Deshabilitadas:');
    disabled.forEach(feature => {
      console.log(`      - ${feature}`);
    });
  }
}

// Exportar configuración por defecto
export const FEATURE_FLAGS = getFeatureFlags(); 