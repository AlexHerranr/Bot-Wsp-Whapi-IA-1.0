// src/plugins/hotel/logic/validation.ts
import levenshtein from 'fast-levenshtein';

interface RetryState {
    retryCount: number;
    lastRetryTime: number;
}

export class HotelValidation {
    private userRetryState: Map<string, RetryState> = new Map();

    public isQuoteOrPriceMessage(message: string): boolean {
        const sensitivePatterns = [
            /\$\d+[.,]?\d*/g,              // $840.000, $210,000
            /\d+[.,]?\d*\s*(cop|pesos?)/gi,  // 840000 COP, 210 pesos
            /\d+\s*noches?/gi,              // 4 noches
            /https?:\/\/\S+/i,              // URLs
            /wa\.me\/p/i                    // WhatsApp links
        ];
        return sensitivePatterns.some(pattern => pattern.test(message));
    }

    public validateAndCorrectResponse(
        responseText: string,
        toolOutputs: string[]
    ): {
        correctedResponse: string;
        hadErrors: boolean;
        needsRetry: boolean;
        discrepancies: string[];
    } {
        // Esta es una implementación simplificada basada en el código original.
        // Se puede hacer más robusta en el futuro.
        let correctedResponse = responseText;
        const discrepancies: string[] = [];
        let needsRetry = false;

        // Lógica de validación... (aquí iría la comparación con Levenshtein si se implementa)
        // Por ahora, devolvemos una estructura básica.

        console.log("Validation logic executed for:", responseText.substring(0, 50));

        return {
            correctedResponse,
            hadErrors: discrepancies.length > 0,
            needsRetry,
            discrepancies
        };
    }

    public canRetry(userId: string): boolean {
        const now = Date.now();
        const retryState = this.userRetryState.get(userId);
        return !retryState || (now - retryState.lastRetryTime > 300000); // 5 minutos
    }

    public markRetry(userId: string): void {
        this.userRetryState.set(userId, {
            retryCount: 1,
            lastRetryTime: Date.now()
        });
    }
}