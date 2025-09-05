"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelValidation = void 0;
// src/plugins/hotel/logic/validation.ts
const fast_levenshtein_1 = require("fast-levenshtein");
class HotelValidation {
    constructor() {
        this.userRetryState = new Map();
    }
    isQuoteOrPriceMessage(message) {
        // Generic rule: 4+ consecutive digits, but exclude years (2025-2030)
        const fourPlusDigits = message.match(/\d{4,}/g) || [];
        const hasNonYearNumbers = fourPlusDigits.some(num => {
            const numValue = parseInt(num);
            // Exclude years from 2025-2030 (current relevant range)
            return numValue < 2025 || numValue > 2030;
        });
        if (hasNonYearNumbers) {
            return true;
        }
        // Keep specific patterns for critical cases with fewer digits
        const sensitivePatterns = [
            /\$\d+[.,]?\d*/g, // $840.000, $210,000
            /\d+[.,]?\d*\s*(cop|pesos?)/gi, // 840000 COP, 210 pesos
            /https?:\/\/\S+/i, // URLs
            /wa\.me\/p/i // WhatsApp links
        ];
        return sensitivePatterns.some(pattern => pattern.test(message));
    }
    /**
     * Extracts apartment names from text (Colombian format)
     */
    extractApartmentNames(text) {
        const apartmentRegex = /(?:apartamento|apartaestudio|apto\.?)\s+(\d{3,4}(?:-[a-z])?)/gi;
        const matches = text.matchAll(apartmentRegex);
        return Array.from(matches, match => match[1]);
    }
    /**
     * Extracts prices from text (Colombian peso format)
     */
    extractPrices(text) {
        const priceRegex = /\$[\d,]+(?:,000)?(?:\s*COP)?/gi;
        return text.match(priceRegex) || [];
    }
    validateAndCorrectResponse(responseText, toolOutputs) {
        if (toolOutputs.length === 0) {
            return {
                correctedResponse: responseText,
                discrepancies: [],
                hadErrors: false,
                needsRetry: false
            };
        }
        const discrepancies = [];
        let correctedResponse = responseText;
        let hasComplexErrors = false;
        // Extract apartment names and prices from both response and tool outputs
        const responseApartments = this.extractApartmentNames(responseText);
        const responsePrices = this.extractPrices(responseText);
        // Combine all tool outputs for comparison
        const combinedToolOutput = toolOutputs.join(' ');
        const toolApartments = this.extractApartmentNames(combinedToolOutput);
        const toolPrices = this.extractPrices(combinedToolOutput);
        // Validate apartment names consistency
        responseApartments.forEach(apartment => {
            if (!toolApartments.includes(apartment)) {
                discrepancies.push(`Apartment ${apartment} not found in tool output`);
                // Try to find closest match using basic string similarity
                const closest = this.findClosestMatch(apartment, toolApartments);
                if (closest && fast_levenshtein_1.default.get(apartment, closest) <= 2) {
                    correctedResponse = correctedResponse.replace(apartment, closest);
                }
                else {
                    hasComplexErrors = true;
                }
            }
        });
        // Validate price consistency (basic check)
        if (responsePrices.length !== toolPrices.length && toolPrices.length > 0) {
            discrepancies.push(`Price count mismatch: response has ${responsePrices.length}, tool output has ${toolPrices.length}`);
            hasComplexErrors = true;
        }
        // Log técnico removido - solo para sistema de logs interno
        const hadErrors = discrepancies.length > 0;
        // Clear userRetryState after successful validation to allow retries in long sessions
        if (!hadErrors && this.userRetryState.size > 0) {
            // Clear retry state for successful validations (simulate userId parameter)
            // Note: In real implementation, userId should be passed to this method
            this.userRetryState.clear();
        }
        return {
            correctedResponse,
            hadErrors,
            needsRetry: hasComplexErrors,
            discrepancies
        };
    }
    findClosestMatch(target, candidates) {
        if (candidates.length === 0)
            return null;
        let closest = candidates[0];
        let minDistance = fast_levenshtein_1.default.get(target, closest);
        for (const candidate of candidates.slice(1)) {
            const distance = fast_levenshtein_1.default.get(target, candidate);
            if (distance < minDistance) {
                minDistance = distance;
                closest = candidate;
            }
        }
        return closest;
    }
    canRetry(userId) {
        const now = Date.now();
        const retryState = this.userRetryState.get(userId);
        const RETRY_COOLDOWN = 5 * 60 * 1000; // 5 minutes
        return !retryState || (now - retryState.lastRetryTime > RETRY_COOLDOWN);
    }
    markRetry(userId) {
        this.userRetryState.set(userId, {
            retryCount: 1,
            lastRetryTime: Date.now()
        });
    }
}
exports.HotelValidation = HotelValidation;
