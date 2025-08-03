// Interfaces para la arquitectura modular y de plugins
import { MediaProcessingResult, MediaType } from './types';

export interface ToolCallFunction {
  (args: any, context?: any): Promise<string>;
}

export interface IFunctionRegistry {
  register(name: string, func: ToolCallFunction, source?: string): void;
  execute(name: string, args: any, context?: any): Promise<string>;
  has(name: string): boolean;
  list(): string[];
  getStats(): { totalFunctions: number; availableFunctions: string[]; registrationHistory: number };
  getRegistrationHistory(): Array<{ name: string; source?: string; timestamp: Date }>;
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

export interface IBufferManager {
  addMessage(userId: string, messageText: string, chatId: string, userName: string): void;
  setIntelligentTimer(userId: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void;
  getBuffer(userId: string): any;
  cleanup(maxAge?: number): number;
  getStats?(): { active: number };
}

export interface IUserManager {
  getOrCreateState(userId: string): any;
  updateState(userId: string, updates: Partial<any>): void;
  resetState(userId: string): void;
  cleanup(maxAge?: number): number;
  getStats?(): { active: number };
}

export interface IMediaService {
  transcribeAudio(audioUrl: string, userId: string): Promise<MediaProcessingResult>;
  analyzeImage(imageUrl: string, userId: string, prompt?: string): Promise<MediaProcessingResult>;
  processMedia(mediaUrl: string, mediaType: MediaType, userId: string, additionalPrompt?: string): Promise<MediaProcessingResult>;
}

export interface IOpenAIService {
  processWithOpenAI(userId: string, combinedText: string, chatId: string, userName: string): Promise<void>;
}

export interface IWebhookProcessor {
  process(payload: unknown): Promise<void>;
}

export interface IRetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}