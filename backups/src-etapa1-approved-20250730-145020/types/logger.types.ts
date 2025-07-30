// Tipos de log unificados - acepta tanto mayúsculas como minúsculas
export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG' | 'info' | 'success' | 'warning' | 'error' | 'debug';

// Función para normalizar niveles de log
export const normalizeLogLevel = (level: string): 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG' => {
  const normalized = level.toUpperCase() as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';
  
  // Validar que sea un nivel válido
  if (['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'DEBUG'].includes(normalized)) {
    return normalized;
  }
  
  // Fallback a INFO si no es válido
  return 'INFO';
};

export interface LogContext {
  [key: string]: any;
}

export interface LoggerConfig {
  level: LogLevel;
  context: string;
  message: string;
  data?: LogContext;
} 