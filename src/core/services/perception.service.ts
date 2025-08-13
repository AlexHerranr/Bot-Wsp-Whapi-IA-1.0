// src/core/services/perception.service.ts
import OpenAI from 'openai';
import { logInfo, logWarning, logError } from '../../utils/logging';

export interface CaptionResult {
    classification: "payment_proof" | "support_document" | "rejected";
    subtype?: string;
    thread_text: string;
    summary?: string;
    extracted?: {
        date_iso?: string;
        time_24h?: string;
        currency?: string;
        amount_total?: number;
        amount_subtotal?: number;
        amount_tax?: number;
        reference?: string;
        authorization_code?: string;
        operation_type?: string;
        payer_name?: string;
        payee_name?: string;
        bank_name?: string;
        account_last_digits?: string;
        items?: Array<{
            description: string;
            qty?: number;
            unit_price?: number;
            line_total?: number;
        }>;
    };
    ocr_text?: string;
    confidence?: number;
    safety_flags?: string[];
}

const CAPTIONER_SYSTEM = [
    "Eres una capa de percepción para un bot de reservas hoteleras.",
    "Solo aceptas comprobantes de pago y documentos de soporte.",
    "Tu salida debe ser SIEMPRE JSON válido con la estructura solicitada.",
    "No inventes datos; deja campos vacíos si no se ven."
].join(" ");

const CAPTIONER_USER_PREFIX = [
    "Analiza la imagen. Decide si es 'payment_proof', 'support_document' o 'rejected'.",
    "Si es aceptada, extrae y normaliza campos (fechas, montos, referencias).",
    "Genera 'thread_text' EXACTAMENTE con el formato indicado.",
    "Responde EXCLUSIVAMENTE en JSON válido."
].join(" ");

export class PerceptionService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async analyzePaymentImage(
        imageUrl: string,
        userId: string,
        maxOutputTokens: number = 900
    ): Promise<CaptionResult> {
        const startTime = Date.now();
        
        try {
            logInfo('PERCEPTION_START', 'Iniciando análisis de percepción', {
                userId,
                imageUrl: imageUrl.substring(0, 50) + '...',
                maxTokens: maxOutputTokens
            }, 'perception.service.ts');

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: CAPTIONER_SYSTEM
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: CAPTIONER_USER_PREFIX
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageUrl,
                                    detail: 'high' // Alta calidad para OCR
                                }
                            },
                            {
                                type: 'text',
                                text: 'Recuerda: SOLO JSON válido.'
                            }
                        ]
                    }
                ],
                max_tokens: maxOutputTokens,
                temperature: 0.1 // Bajo para consistencia
            });

            const rawContent = response.choices[0]?.message?.content?.trim() || '{}';
            
            logInfo('PERCEPTION_RAW', 'Respuesta cruda de percepción', {
                userId,
                rawLength: rawContent.length,
                fullResponse: rawContent, // Ver contenido completo
                processingTime: Date.now() - startTime
            }, 'perception.service.ts');

            try {
                const result = JSON.parse(rawContent) as CaptionResult;
                
                // Validar estructura mínima
                if (!result.classification || !result.thread_text) {
                    throw new Error('JSON inválido: faltan campos requeridos');
                }

                logInfo('PERCEPTION_SUCCESS', 'Análisis de percepción exitoso', {
                    userId,
                    classification: result.classification,
                    confidence: result.confidence || 0,
                    hasExtracted: !!result.extracted,
                    processingTime: Date.now() - startTime
                }, 'perception.service.ts');

                return result;

            } catch (parseError) {
                logWarning('PERCEPTION_PARSE_ERROR', 'Error parseando JSON de percepción', {
                    userId,
                    error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
                    rawContent: rawContent.substring(0, 200) + '...'
                }, 'perception.service.ts');

                // Fallback: rechazar imagen
                return this.createRejectionFallback();
            }

        } catch (error) {
            logError('PERCEPTION_ERROR', 'Error en análisis de percepción', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime: Date.now() - startTime
            }, 'perception.service.ts');

            // Fallback: rechazar imagen
            return this.createRejectionFallback();
        }
    }

    private createRejectionFallback(): CaptionResult {
        return {
            classification: "rejected",
            thread_text: [
                "Descripción de imagen enviada por el cliente",
                "Cliente envía imagen que no es aceptada o no es comprobante de pago.",
                "Escríbele al cliente que no podemos analizar ese tipo de imágenes y que solo aceptamos soportes o documentos relacionados con pagos."
            ].join("\n"),
            summary: "Imagen rechazada por análisis de percepción",
            confidence: 0.0
        };
    }

    formatThreadText(result: CaptionResult): string {
        if (result.classification === 'rejected') {
            return result.thread_text;
        }

        // Formato para comprobantes aceptados
        const extracted = result.extracted;
        const lines = [
            "Descripción de imagen enviada por el cliente",
            result.classification === 'payment_proof' ? "Comprobante de pago" : "Documento de soporte",
            ""
        ];

        if (extracted?.date_iso) {
            const dateTime = extracted.time_24h ? 
                `${extracted.date_iso} ${extracted.time_24h}` : 
                extracted.date_iso;
            lines.push(`• Fecha: ${dateTime}`);
        }

        if (extracted?.currency || extracted?.amount_total) {
            const currency = extracted.currency || 'UNK';
            const amount = extracted.amount_total || 0;
            lines.push(`• Moneda: ${currency}  |  Total: ${amount}`);
        }

        if (extracted?.reference || extracted?.authorization_code) {
            const ref = extracted.reference || extracted.authorization_code || '';
            lines.push(`• Referencia/Autorización: ${ref}`);
        }

        if (extracted?.bank_name || extracted?.payee_name) {
            const entity = extracted.bank_name || extracted.payee_name || '';
            lines.push(`• Banco/Comercio: ${entity}`);
        }

        if (result.summary) {
            lines.push(`• Resumen: ${result.summary}`);
        }

        if (result.ocr_text) {
            lines.push("");
            lines.push("(Extracto OCR)");
            lines.push(result.ocr_text.substring(0, 150) + (result.ocr_text.length > 150 ? '...' : ''));
        }

        return lines.join("\n");
    }
}