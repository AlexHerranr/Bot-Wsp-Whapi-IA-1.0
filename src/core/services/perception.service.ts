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
    "Eres una capa especializada de percepción para un bot de reservas hoteleras.",
    "ESPECIALIZACIÓN: Solo procesas comprobantes de pago, facturas, vouchers, transferencias bancarias y documentos financieros.",
    "LIMITACIONES CONOCIDAS: Si la imagen está rotada, borrosa o con texto muy pequeño, menciona estas limitaciones en tu respuesta.",
    "PRECISIÓN: Para datos numéricos (montos, fechas, referencias) sé extremadamente preciso o indica si no se puede leer claramente.",
    "Si la imagen NO es un documento financiero → responde exactamente: 'IMAGEN_RECHAZADA'"
].join(" ");

const CAPTIONER_USER_PREFIX = [
    "Analiza cuidadosamente esta imagen para determinar si es un comprobante de pago o documento financiero.",
    "INSTRUCCIONES ESPECÍFICAS:",
    "• Si NO es comprobante de pago, factura, transferencia, voucher o documento financiero → responde exactamente: 'IMAGEN_RECHAZADA'",
    "• Si SÍ es un comprobante financiero → extrae y describe en español:",
    "- Tipo de documento (recibo, transferencia, voucher, etc.)",
    "- Fecha y hora (formato DD/MM/YYYY HH:MM si visible)",
    "- Monto total y moneda",
    "- Número de referencia o código de autorización",
    "- Nombre del banco, comercio o entidad",
    "- Detalles adicionales relevantes del pago",
    "Responde en texto natural y claro, enfócate en la precisión de los datos numéricos."
].join(" ");

export class PerceptionService {
    private openai: OpenAI;
    private static activePerceptionCalls: number = 0;
    private static readonly MAX_CONCURRENT_PERCEPTION = 10; // Crítico: Limitar para evitar rate-limits

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
        
        // CRÍTICO: Control de concurrencia para rate-limits
        if (PerceptionService.activePerceptionCalls >= PerceptionService.MAX_CONCURRENT_PERCEPTION) {
            logWarning('PERCEPTION_RATE_LIMIT', 'Rate limit percepción alcanzado', {
                userId,
                activeCallsPrecheck: PerceptionService.activePerceptionCalls,
                maxAllowed: PerceptionService.MAX_CONCURRENT_PERCEPTION
            }, 'perception.service.ts');

            return {
                classification: 'rejected',
                thread_text: 'Descripción de imagen enviada por el cliente\nSistema temporalmente ocupado. Intenta enviar la imagen nuevamente en unos segundos.'
            };
        }

        PerceptionService.activePerceptionCalls++;

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
                max_tokens: Math.min(maxOutputTokens, 300), // Crítico: Reducir latencia para comprobantes
                temperature: 0 // Óptimo para extracción factual según docs OpenAI
            });

            const rawContent = response.choices[0]?.message?.content?.trim() || '{}';
            
            logInfo('PERCEPTION_RAW', 'Respuesta cruda de percepción', {
                userId,
                rawLength: rawContent.length,
                // Ver contenido completo para debug temporal
                fullResponse: rawContent,
                processingTime: Date.now() - startTime
            }, 'perception.service.ts');

            // Procesar respuesta como texto plano
            if (rawContent === 'IMAGEN_RECHAZADA') {
                logInfo('PERCEPTION_REJECTED', 'Imagen rechazada por percepción', {
                    userId,
                    processingTime: Date.now() - startTime
                }, 'perception.service.ts');
                
                return {
                    classification: 'rejected',
                    thread_text: 'Descripción de imagen enviada por el cliente\nCliente envía imagen que no es aceptada o no es comprobante de pago.\nEscríbele al cliente que no podemos analizar ese tipo de imágenes y que solo aceptamos soportes o documentos relacionados con pagos.'
                };
            }

            // Es un comprobante - formatear descripción
            const formattedDescription = [
                'Descripción de imagen enviada por el cliente',
                'Comprobante de pago detectado',
                '',
                rawContent // Descripción natural de gpt-4o-mini
            ].join('\n');

            logInfo('PERCEPTION_SUCCESS', 'Comprobante procesado exitosamente', {
                userId,
                descriptionLength: rawContent.length,
                processingTime: Date.now() - startTime
            }, 'perception.service.ts');

            return {
                classification: 'payment_proof',
                thread_text: formattedDescription
            };

        } catch (error) {
            logError('PERCEPTION_ERROR', 'Error en análisis de percepción', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime: Date.now() - startTime
            }, 'perception.service.ts');

            // Fallback: rechazar imagen
            return this.createRejectionFallback();
        } finally {
            // CRÍTICO: Decrementar contador en todos los casos
            PerceptionService.activePerceptionCalls = Math.max(0, PerceptionService.activePerceptionCalls - 1);
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