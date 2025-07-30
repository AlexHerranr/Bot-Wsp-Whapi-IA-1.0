// src/core/services/openai.service.ts
import OpenAI from 'openai';
import { IOpenAIService } from '../../shared/interfaces';
import { OpenAIRun, FunctionCall } from '../../shared/types';
import { openAIWithRetry, withTimeout } from '../utils/retry-utils';
import { TerminalLog } from '../utils/terminal-log';
import { CacheManager } from '../state/cache-manager';

export interface OpenAIServiceConfig {
    apiKey: string;
    assistantId: string;
    maxRunTime?: number;
    pollingInterval?: number;
    maxPollingAttempts?: number;
    enableThreadCache?: boolean;
}

export interface ProcessingResult {
    success: boolean;
    response?: string;
    error?: string;
    functionCalls?: FunctionCall[];
    processingTime: number;
    tokensUsed?: number;
    threadId?: string;
    runId?: string;
}

export class OpenAIService implements IOpenAIService {
    private openai: OpenAI;
    private config: Required<OpenAIServiceConfig>;
    private log: TerminalLog;
    private cache?: CacheManager;

    constructor(
        config: OpenAIServiceConfig,
        terminalLog: TerminalLog,
        cacheManager?: CacheManager
    ) {
        this.config = {
            apiKey: config.apiKey,
            assistantId: config.assistantId,
            maxRunTime: config.maxRunTime ?? 120000, // 2 minutes
            pollingInterval: config.pollingInterval ?? 1000, // 1 second
            maxPollingAttempts: config.maxPollingAttempts ?? 120, // 2 minutes max
            enableThreadCache: config.enableThreadCache ?? true
        };

        this.openai = new OpenAI({ apiKey: this.config.apiKey });
        this.log = terminalLog;
        this.cache = cacheManager;
    }

    async processWithOpenAI(userId: string, combinedText: string, chatId: string, userName: string): Promise<void> {
        const result = await this.processMessage(userId, combinedText, chatId, userName);
        
        if (!result.success) {
            this.log.openaiError(userName, result.error || 'Unknown processing error');
            throw new Error(result.error || 'OpenAI processing failed');
        }

        // Log successful processing
        this.log.response(userName, result.response || 'Response generated', result.processingTime);
    }

    async processMessage(userId: string, message: string, chatId: string, userName: string): Promise<ProcessingResult> {
        const startTime = Date.now();

        try {
            this.log.info(`Starting OpenAI processing for ${userName}`);

            // Step 1: Get or create thread
            const threadId = await this.getOrCreateThread(userId, chatId);

            // Step 2: Add message to thread
            await this.addMessageToThread(threadId, message);

            // Step 3: Create and monitor run
            const runResult = await this.createAndMonitorRun(threadId, userName);

            if (!runResult.success) {
                return {
                    success: false,
                    error: runResult.error,
                    processingTime: Date.now() - startTime,
                    threadId
                };
            }

            // Step 4: Handle function calls if present
            if (runResult.functionCalls && runResult.functionCalls.length > 0) {
                const functionResult = await this.handleFunctionCalls(
                    threadId, 
                    runResult.runId!, 
                    runResult.functionCalls,
                    userName
                );

                if (!functionResult.success) {
                    return {
                        success: false,
                        error: functionResult.error,
                        processingTime: Date.now() - startTime,
                        threadId,
                        runId: runResult.runId
                    };
                }
            }

            // Step 5: Get final response
            const response = await this.getThreadResponse(threadId);

            return {
                success: true,
                response,
                processingTime: Date.now() - startTime,
                tokensUsed: runResult.tokensUsed,
                threadId,
                runId: runResult.runId
            };

        } catch (error) {
            this.log.openaiError(userName, error instanceof Error ? error.message : 'Unknown error');
            
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown processing error',
                processingTime: Date.now() - startTime
            };
        }
    }

    private async getOrCreateThread(userId: string, chatId: string): Promise<string> {
        const cacheKey = `thread:${userId}:${chatId}`;
        
        // Try to get cached thread
        if (this.config.enableThreadCache && this.cache) {
            const cachedThreadId = this.cache.get<string>(cacheKey);
            if (cachedThreadId) {
                this.log.debug(`Using cached thread ${cachedThreadId} for ${userId}`);
                return cachedThreadId;
            }
        }

        // Create new thread
        const thread = await openAIWithRetry(
            () => this.openai.beta.threads.create(),
            {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 5000
            }
        );

        this.log.debug(`Created new thread ${thread.id} for ${userId}`);

        // Cache thread if enabled
        if (this.config.enableThreadCache && this.cache) {
            this.cache.set(cacheKey, thread.id, 3600000); // 1 hour cache
        }

        return thread.id;
    }

    private async addMessageToThread(threadId: string, message: string): Promise<void> {
        await openAIWithRetry(
            () => this.openai.beta.threads.messages.create(threadId, {
                role: 'user',
                content: message
            }),
            {
                maxRetries: 3,
                baseDelay: 500,
                maxDelay: 3000
            }
        );
    }

    private async createAndMonitorRun(threadId: string, userName: string): Promise<{
        success: boolean;
        error?: string;
        runId?: string;
        functionCalls?: FunctionCall[];
        tokensUsed?: number;
    }> {
        try {
            // Create run
            const run = await openAIWithRetry(
                () => this.openai.beta.threads.runs.create(threadId, {
                    assistant_id: this.config.assistantId
                }),
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000
                }
            );

            this.log.debug(`Created run ${run.id} for thread ${threadId}`);

            // Monitor run with polling and exponential backoff
            const result = await this.pollRunStatus(threadId, run.id, userName);
            
            return {
                success: result.success,
                error: result.error,
                runId: run.id,
                functionCalls: result.functionCalls,
                tokensUsed: result.tokensUsed
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create run'
            };
        }
    }

    private async pollRunStatus(threadId: string, runId: string, userName: string): Promise<{
        success: boolean;
        error?: string;
        functionCalls?: FunctionCall[];
        tokensUsed?: number;
    }> {
        let attempts = 0;
        let backoffDelay = this.config.pollingInterval;

        while (attempts < this.config.maxPollingAttempts) {
            try {
                const run = await openAIWithRetry(
                    () => this.openai.beta.threads.runs.retrieve(threadId, runId),
                    {
                        maxRetries: 2,
                        baseDelay: 500,
                        maxDelay: 2000
                    }
                );

                this.log.debug(`Run ${runId} status: ${run.status} (attempt ${attempts + 1})`);

                switch (run.status) {
                    case 'completed':
                        return {
                            success: true,
                            tokensUsed: run.usage?.total_tokens
                        };

                    case 'requires_action':
                        if (run.required_action?.type === 'submit_tool_outputs') {
                            const functionCalls = run.required_action.submit_tool_outputs.tool_calls.map(tc => ({
                                id: tc.id,
                                function: {
                                    name: tc.function.name,
                                    arguments: tc.function.arguments
                                }
                            }));

                            return {
                                success: true,
                                functionCalls
                            };
                        }
                        break;

                    case 'failed':
                    case 'cancelled':
                    case 'expired':
                        return {
                            success: false,
                            error: `Run ${run.status}: ${run.last_error?.message || 'No additional details'}`
                        };

                    case 'queued':
                    case 'in_progress':
                        // Continue polling
                        break;

                    default:
                        this.log.warning(`Unknown run status: ${run.status}`);
                        continue;
                }

                // Exponential backoff with jitter
                await this.sleep(backoffDelay + Math.random() * 1000);
                backoffDelay = Math.min(backoffDelay * 1.5, 5000); // Max 5 seconds
                attempts++;

            } catch (error) {
                this.log.error(`Error polling run status: ${error instanceof Error ? error.message : 'Unknown'}`);
                attempts++;
                
                if (attempts >= this.config.maxPollingAttempts) {
                    return {
                        success: false,
                        error: `Polling failed after ${attempts} attempts`
                    };
                }

                // Wait before retry
                await this.sleep(backoffDelay);
                backoffDelay = Math.min(backoffDelay * 2, 10000);
            }
        }

        return {
            success: false,
            error: `Run timed out after ${this.config.maxPollingAttempts} attempts`
        };
    }

    private async handleFunctionCalls(
        threadId: string, 
        runId: string, 
        functionCalls: FunctionCall[],
        userName: string
    ): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            this.log.info(`Processing ${functionCalls.length} function calls for ${userName}`);

            const toolOutputs = [];

            for (const functionCall of functionCalls) {
                this.log.functionStart(functionCall.function.name, 
                    JSON.parse(functionCall.function.arguments)
                );

                try {
                    // Here you would integrate with your function registry
                    // For now, we'll simulate function execution
                    const result = await this.executeFunctionCall(functionCall);
                    
                    toolOutputs.push({
                        tool_call_id: functionCall.id,
                        output: JSON.stringify(result)
                    });

                } catch (error) {
                    this.log.functionError(
                        functionCall.function.name, 
                        error instanceof Error ? error.message : 'Unknown error'
                    );

                    toolOutputs.push({
                        tool_call_id: functionCall.id,
                        output: JSON.stringify({
                            error: error instanceof Error ? error.message : 'Function execution failed'
                        })
                    });
                }
            }

            // Submit tool outputs
            await openAIWithRetry(
                () => this.openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
                    tool_outputs: toolOutputs
                }),
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000
                }
            );

            // Continue monitoring the run
            const result = await this.pollRunStatus(threadId, runId, userName);
            
            return {
                success: result.success,
                error: result.error
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Function handling failed'
            };
        }
    }

    private async executeFunctionCall(functionCall: FunctionCall): Promise<any> {
        // This is a placeholder for function execution
        // In a real implementation, you would integrate with your function registry
        // and execute the actual function
        
        this.log.debug(`Executing function: ${functionCall.function.name}`);
        
        // Simulate function execution with some delay
        await this.sleep(100);
        
        return {
            success: true,
            message: `Function ${functionCall.function.name} executed successfully`,
            timestamp: new Date().toISOString()
        };
    }

    private async getThreadResponse(threadId: string): Promise<string> {
        const messages = await openAIWithRetry(
            () => this.openai.beta.threads.messages.list(threadId, {
                order: 'desc',
                limit: 1
            }),
            {
                maxRetries: 3,
                baseDelay: 500,
                maxDelay: 2000
            }
        );

        const lastMessage = messages.data[0];
        
        if (!lastMessage || lastMessage.role !== 'assistant') {
            throw new Error('No assistant response found');
        }

        // Extract text content from the message
        const textContent = lastMessage.content.find(content => content.type === 'text');
        
        if (!textContent) {
            throw new Error('No text content in assistant response');
        }

        return (textContent as any).text.value;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility methods

    async getThreadMessages(threadId: string, limit: number = 10): Promise<any[]> {
        const messages = await openAIWithRetry(
            () => this.openai.beta.threads.messages.list(threadId, {
                order: 'desc',
                limit
            }),
            {
                maxRetries: 2,
                baseDelay: 500
            }
        );

        return messages.data;
    }

    async deleteThread(threadId: string): Promise<boolean> {
        try {
            await openAIWithRetry(
                () => this.openai.beta.threads.del(threadId),
                {
                    maxRetries: 2,
                    baseDelay: 500
                }
            );

            // Remove from cache if enabled
            if (this.config.enableThreadCache && this.cache) {
                // We would need userId and chatId to construct the cache key
                // For now, we'll skip cache cleanup
                this.log.debug(`Thread ${threadId} deleted`);
            }

            return true;
        } catch (error) {
            this.log.error(`Failed to delete thread ${threadId}: ${error instanceof Error ? error.message : 'Unknown'}`);
            return false;
        }
    }

    async cancelRun(threadId: string, runId: string): Promise<boolean> {
        try {
            await openAIWithRetry(
                () => this.openai.beta.threads.runs.cancel(threadId, runId),
                {
                    maxRetries: 2,
                    baseDelay: 500
                }
            );

            this.log.info(`Run ${runId} cancelled for thread ${threadId}`);
            return true;
        } catch (error) {
            this.log.error(`Failed to cancel run ${runId}: ${error instanceof Error ? error.message : 'Unknown'}`);
            return false;
        }
    }

    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
        try {
            // Test OpenAI API connectivity
            const models = await openAIWithRetry(
                () => this.openai.models.list(),
                { maxRetries: 1, baseDelay: 1000 }
            );

            // Test assistant availability
            const assistant = await openAIWithRetry(
                () => this.openai.beta.assistants.retrieve(this.config.assistantId),
                { maxRetries: 1, baseDelay: 1000 }
            );

            return {
                status: 'healthy',
                details: {
                    apiConnectivity: 'ok',
                    assistantId: this.config.assistantId,
                    assistantName: assistant.name,
                    modelsAvailable: models.data.length,
                    threadCacheEnabled: this.config.enableThreadCache,
                    maxRunTime: this.config.maxRunTime,
                    pollingInterval: this.config.pollingInterval
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    assistantId: this.config.assistantId,
                    apiConnectivity: 'failed'
                }
            };
        }
    }

    getConfig(): Required<OpenAIServiceConfig> {
        return { ...this.config };
    }
}