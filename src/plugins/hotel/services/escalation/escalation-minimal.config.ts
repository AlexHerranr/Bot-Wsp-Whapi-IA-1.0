/**
 * Configuración Mínima del Sistema de Escalamiento
 * Solo razones que REALMENTE requieren intervención humana
 */

export interface EscalationDestination {
  type: 'contact' | 'group';
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface EscalationRule {
  reason: string;
  destination: EscalationDestination;
  requiresImmediate: boolean;
  includeContext: boolean;
  template: string;
}

// Configuración de Contactos
export const ESCALATION_DESTINATIONS: Record<string, EscalationDestination> = {
  // Contacto principal (Alexander)
  PRINCIPAL: {
    type: 'contact',
    id: '573003913251@s.whatsapp.net',
    name: 'Alexander',
    description: 'Contacto principal',
    priority: 'high'
  }
};

// Mapeo Mínimo de Razones (Solo las que requieren humano)
export const ESCALATION_RULES: Record<string, EscalationRule> = {
  // === 1. CONFIRMACIÓN PAGO (Verificación manual requerida) ===
  'payment_confirmation': {
    reason: 'payment_confirmation',
    destination: ESCALATION_DESTINATIONS.PRINCIPAL,
    requiresImmediate: true,
    includeContext: true,
    template: 'PAYMENT_CONFIRMATION'
  },

  // === 2. PROBLEMAS/QUEJAS CLIENTE (Atención personal requerida) ===
  'customer_complaint': {
    reason: 'customer_complaint',
    destination: ESCALATION_DESTINATIONS.PRINCIPAL,
    requiresImmediate: true,
    includeContext: true,
    template: 'CUSTOMER_COMPLAINT'
  },

  // === 3. REPORTE DAÑOS (Inspección/acción requerida) ===
  'damage_report': {
    reason: 'damage_report',
    destination: ESCALATION_DESTINATIONS.PRINCIPAL,
    requiresImmediate: true,
    includeContext: true,
    template: 'DAMAGE_REPORT'
  },

  // === 4. NOTIFICACIÓN LLEGADA (Coordinación con equipo) ===
  'arrival_notification': {
    reason: 'arrival_notification',
    destination: ESCALATION_DESTINATIONS.PRINCIPAL,
    requiresImmediate: false,
    includeContext: true,
    template: 'ARRIVAL_NOTIFICATION'
  },

  // === 5. NOTIFICACIÓN SALIDA (Coordinación checkout) ===
  'departure_notification': {
    reason: 'departure_notification',
    destination: ESCALATION_DESTINATIONS.PRINCIPAL,
    requiresImmediate: false,
    includeContext: true,
    template: 'DEPARTURE_NOTIFICATION'
  }
};

// Configuración de Fallback
export const FALLBACK_DESTINATION = ESCALATION_DESTINATIONS.PRINCIPAL; 