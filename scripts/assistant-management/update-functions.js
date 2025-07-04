#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Actualizando Funciones del Assistant...\n');

async function updateFunctions() {
    try {
        const dotenv = await import('dotenv');
        dotenv.config();
        
        const OpenAI = await import('openai');
        const openai = new OpenAI.default({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        const assistantId = process.env.OPENAI_ASSISTANT_ID;
        if (!assistantId) {
            console.error('❌ OPENAI_ASSISTANT_ID no encontrado en .env');
            return;
        }
        
        console.log(`✅ Assistant ID: ${assistantId}`);
        
        // Definir funciones actualizadas
        const updatedFunctions = [
            {
                type: "function",
                function: {
                    name: "check_availability",
                    description: "Consulta disponibilidad de apartamentos en fechas específicas usando integración con Beds24",
                    parameters: {
                        type: "object",
                        properties: {
                            startDate: { 
                                type: "string", 
                                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                                description: "Fecha de inicio en formato YYYY-MM-DD" 
                            },
                            endDate: { 
                                type: "string", 
                                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                                description: "Fecha de salida en formato YYYY-MM-DD" 
                            }
                        },
                        required: ["startDate", "endDate"],
                        additionalProperties: false
                    }
                }
            },
            {
                type: "function", 
                function: {
                    name: "escalate_to_human",
                    description: "Transfiere conversación a agente humano cuando se requiere intervención manual",
                    parameters: {
                        type: "object",
                        properties: {
                            reason: { 
                                type: "string", 
                                enum: [
                                    "payment_confirmation", "customer_complaint", "damage_report", 
                                    "arrival_notification", "departure_notification"
                                ],
                                description: "Razón específica para la escalación" 
                            },
                            context: { 
                                type: "object",
                                properties: {
                                    summary: { type: "string", description: "Resumen de la consulta" },
                                    urgency: { type: "string", enum: ["low", "medium", "high", "critical"] },
                                    customerInfo: { type: "object", description: "Información del cliente" }
                                },
                                required: ["summary"],
                                description: "Contexto adicional" 
                            }
                        },
                        required: ["reason", "context"],
                        additionalProperties: false
                    }
                }
            }
        ];
        
        // Actualizar assistant con nuevas funciones
        console.log('🔄 Actualizando funciones...');
        await openai.beta.assistants.update(assistantId, {
            tools: [
                { type: "file_search" },
                ...updatedFunctions
            ]
        });
        
        console.log('✅ Funciones actualizadas exitosamente!');
        console.log('📋 Funciones esenciales activas:');
        console.log('   - check_availability(startDate, endDate)');
        console.log('   - escalate_to_human(reason, context) - 5 razones: payment_confirmation, customer_complaint, damage_report, arrival_notification, departure_notification');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

updateFunctions(); 