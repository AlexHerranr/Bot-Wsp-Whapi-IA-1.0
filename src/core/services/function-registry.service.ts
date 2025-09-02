// src/core/services/function-registry.service.ts
import { singleton } from 'tsyringe';
import { IFunctionRegistry, ToolCallFunction } from '../../shared/interfaces';

@singleton()
export class FunctionRegistryService implements IFunctionRegistry {
    private functions: Map<string, ToolCallFunction> = new Map();
    private registrationHistory: Array<{ name: string, timestamp: Date, source?: string }> = [];

    public register(name: string, func: ToolCallFunction, source?: string): void {
        if (this.functions.has(name)) {
            console.warn(`Function ${name} is being overridden. Previous registration will be replaced.`);
        }

        this.functions.set(name, func);
        this.registrationHistory.push({
            name,
            timestamp: new Date(),
            source: source || 'unknown'
        });

        // Solo log en consola, el log técnico lo maneja el plugin
        console.log(`✅ ${name} registered`);
    }

    public async execute(name: string, args: any, context?: any): Promise<string> {
        const func = this.functions.get(name);
        if (!func) {
            const availableFunctions = this.list();
            throw new Error(
                `Function '${name}' not found. Available functions: ${availableFunctions.join(', ')}`
            );
        }

        try {
            console.log(`🔧 Executing function: ${name}`);
            const startTime = Date.now();
            
            // Log detallado de function args/result si variable de entorno está activa
            if (process.env.DETAILED_FUNCTION_LOGS === 'true') {
                console.log(`🔍 Function ${name} args:`, JSON.stringify(args, null, 2));
            }
            
            const result = await func(args, context);
            
            const executionTime = Date.now() - startTime;
            console.log(`✅ Function ${name} completed in ${executionTime}ms`);
            
            // Log detallado del resultado si variable de entorno está activa
            if (process.env.DETAILED_FUNCTION_LOGS === 'true') {
                console.log(`🔍 Function ${name} result:`, JSON.stringify(result, null, 2));
            }
            
            return result;
        } catch (error: any) {
            console.error(`❌ Function ${name} failed:`, error.message);
            throw new Error(`Function execution failed: ${error.message}`);
        }
    }

    public has(name: string): boolean {
        return this.functions.has(name);
    }

    public list(): string[] {
        return Array.from(this.functions.keys()).sort();
    }

    public getRegistrationHistory(): Array<{ name: string, timestamp: Date, source?: string }> {
        return [...this.registrationHistory];
    }

    public getStats(): {
        totalFunctions: number;
        registrationHistory: number;
        availableFunctions: string[];
    } {
        return {
            totalFunctions: this.functions.size,
            registrationHistory: this.registrationHistory.length,
            availableFunctions: this.list()
        };
    }

    public clear(): void {
        this.functions.clear();
        this.registrationHistory = [];
        console.log('🧹 Function registry cleared');
    }

    public unregister(name: string): boolean {
        const existed = this.functions.delete(name);
        if (existed) {
            console.log(`🗑️ Function unregistered: ${name}`);
        }
        return existed;
    }
    
    // Nuevo método para Responses API
    public getFunction(name: string): { handler: ToolCallFunction; name: string; description?: string; parameters?: any } | undefined {
        const func = this.functions.get(name);
        if (!func) return undefined;
        
        return {
            handler: func,
            name: name,
            description: `Function ${name}`, // Esto debería venir de metadata
            parameters: {} // Esto debería venir de metadata
        };
    }
    
    // Nuevo método para obtener todas las funciones con metadata
    public getAllFunctions(): Array<{ name: string; handler: ToolCallFunction; description: string; parameters: any }> {
        const result: Array<{ name: string; handler: ToolCallFunction; description: string; parameters: any }> = [];
        
        for (const [name, func] of this.functions) {
            result.push({
                name,
                handler: func,
                description: `Function ${name}`, // Por defecto
                parameters: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            });
        }
        
        return result;
    }
}