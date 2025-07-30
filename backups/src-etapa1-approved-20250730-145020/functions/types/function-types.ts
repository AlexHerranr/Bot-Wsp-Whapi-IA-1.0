/**
 * Tipos compartidos para todas las funciones de OpenAI
 */

export interface FunctionDefinition {
  name: string;
  description: string;
  handler: (args: any) => Promise<any>;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  enabled: boolean;
  category: string;
  version: string;
}

export interface FunctionResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface BookingData {
  bookingId?: string;
  propertyId: number;
  roomId: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalPrice: number;
  status?: 'pending' | 'confirmed' | 'cancelled';
}

export interface AvailabilityData {
  propertyId: number;
  propertyName: string;
  roomId: number;
  roomName: string;
  startDate: string;
  endDate: string;
  available: boolean;
  price?: number;
}

export interface EscalationData {
  reason: string;
  context: {
    summary: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    customerInfo?: any;
  };
}

export type FunctionCategory = 
  | 'availability' 
  | 'booking' 
  | 'escalation' 
  | 'communication' 
  | 'validation' 
  | 'pricing' 
  | 'external'; 