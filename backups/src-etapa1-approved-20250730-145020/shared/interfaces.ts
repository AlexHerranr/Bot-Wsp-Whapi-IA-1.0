// Interfaces para la arquitectura modular y de plugins
export interface ToolCallFunction {
  (args: any, context?: any): Promise<string>;
}

export interface IFunctionRegistry {
  register(name: string, func: ToolCallFunction): void;
  execute(name: string, args: any, context?: any): Promise<string>;
  has(name: string): boolean;
  list(): string[];
}

export interface ICacheManager {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export interface ILabelManager {
  getLabels(userId: string): Promise<string[]>;
  setLabels(userId: string, labels: string[]): Promise<void>;
}

export interface IContextProvider {
  getRelevantContext(userId: string, profile: any, chatInfo: any, requestId?: string): Promise<string>;
  needsRefresh(userId: string, lastContext: any, profile: any, chatInfo: any): boolean;
}