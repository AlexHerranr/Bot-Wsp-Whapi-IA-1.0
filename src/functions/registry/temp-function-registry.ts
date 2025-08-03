// Implementación temporal de FunctionRegistry para pruebas
import { IFunctionRegistry, ToolCallFunction } from '../../shared/interfaces';

export class TempFunctionRegistry implements IFunctionRegistry {
    private functions: Map<string, ToolCallFunction> = new Map();

    register(name: string, func: ToolCallFunction, source?: string): void {
        this.functions.set(name, func);
    }

    async execute(name: string, args: any, context?: any): Promise<string> {
        const func = this.functions.get(name);
        if (!func) {
            throw new Error(`Function ${name} not found`);
        }
        
        // Mock de ejecución - simular check_availability
        if (name === 'check_availability') {
            return JSON.stringify({
                success: true,
                rooms: [
                    { id: 'room1', name: 'Habitación Deluxe', available: true }
                ]
            });
        }
        
        return JSON.stringify({ success: true, result: 'Mock result' });
    }

    has(name: string): boolean {
        return this.functions.has(name);
    }

    list(): string[] {
        return Array.from(this.functions.keys());
    }

    getFunction(name: string): ToolCallFunction | undefined {
        return this.functions.get(name);
    }

    getAllFunctions(): ToolCallFunction[] {
        return Array.from(this.functions.values());
    }

    getStats(): { totalFunctions: number; availableFunctions: string[]; registrationHistory: number } {
        return {
            totalFunctions: this.functions.size,
            availableFunctions: Array.from(this.functions.keys()),
            registrationHistory: this.functions.size
        };
    }

    getRegistrationHistory(): Array<{ name: string; source?: string; timestamp: Date }> {
        return Array.from(this.functions.keys()).map(name => ({
            name,
            timestamp: new Date(),
            source: 'temp-registry'
        }));
    }
}