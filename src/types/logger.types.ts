export type LogLevel = 'info' | 'warning' | 'error' | 'success' | 'debug';

export interface LogContext {
  [key: string]: any;
}

export interface LoggerConfig {
  level: LogLevel;
  context: string;
  message: string;
  data?: LogContext;
} 