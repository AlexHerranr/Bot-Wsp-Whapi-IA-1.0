import fs from 'fs';
import path from 'path';

// Interfaz para datos que vienen de OpenAI - ACTUALIZADA para match con generate-booking-confirmation-pdf.ts
interface OpenAIInvoiceData {
  bookingId: string;
  guestName: string;
  guestCount: string;  // Ahora obligatorio
  phone: string;       // Ahora obligatorio
  email: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  roomName: string;
  distribucion?: string; // Campo agregado
  nights: number;
  totalCharges: string;  // Reemplaza basePrice
  totalPaid: string;     // Ahora obligatorio
  paymentDescription: string; // Reemplaza paymentNote y ahora obligatorio
  balance?: string;
  bookingStatus?: string;
  invoiceItems: Array<{  // Campo agregado - obligatorio
    description: string;
    quantity?: string;
    unitPrice?: string;
    totalAmount: string;
  }>;
}

// Interfaz para la configuración completa
interface TemplateConfig {
  company: {
    name: string;
    nit: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logo: string;
  };
  policies: {
    checkIn: { time: string; note: string; };
    checkOut: { time: string; note: string; };
    cancellation: string;
    services: string;
  };
  location: {
    googleMapsUrl: string;
    address: string;
    calendarLocation: string;
  };
  fixedItems: {
    cleaning: { description: string; unitPrice: number; quantity: number; };
    insurance: { description: string; unitPrice: number; quantity: number; };
  };
  template: {
    title: string;
    status: string;
  };
}

// Interfaz para el contexto final del template
interface TemplateContext {
  // Datos de la empresa (fijos)
  companyName: string;
  companyNit: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyLogo: string;
  
  // Datos de reserva (variables de OpenAI)
  bookingId: string;
  guestName: string;
  guestCount: string;
  phone?: string;
  email: string;
  
  // Fechas procesadas
  checkInDateFormatted: string;
  checkOutDateFormatted: string;
  checkInDateISO: string;
  checkOutDateISO: string;
  nights: number;
  multipleNights: boolean;
  
  // Apartamento
  roomName: string;
  aptDescription?: string;
  distribucion?: string;
  
  // Financiero
  totalCharges: string;
  totalPaid?: string;
  balance?: string;
  paymentNote?: string;
  
  // Enlaces dinámicos
  googleMapsUrl: string;
  calendarUrl: string;
  locationAddress: string;
  
  // Políticas (fijas)
  checkInTime: string;
  checkInNote: string;
  checkOutTime: string;
  checkOutNote: string;
  cancellationPolicy: string;
  servicesNote: string;
  
  // Template
  templateTitle: string;
  templateStatus: string;
}

export class TemplateProcessor {
  private config: TemplateConfig;
  
  constructor() {
    this.loadConfig();
  }
  
  private loadConfig(): void {
    const configPath = path.join(__dirname, '../config/template-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(configData);
  }
  
  /**
   * Procesa datos de OpenAI combinándolos con configuración fija
   */
  public processTemplateData(openAIData: OpenAIInvoiceData): TemplateContext {
    // Calcular noches automáticamente
    const checkIn = new Date(openAIData.checkInDate);
    const checkOut = new Date(openAIData.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 3600 * 24));
    
    // Formatear fechas para display
    const checkInFormatted = this.formatDateForDisplay(checkIn);
    const checkOutFormatted = this.formatDateForDisplay(checkOut);
    
    // Formatear fechas para ISO (calendar)
    const checkInISO = this.formatDateForISO(checkIn);
    const checkOutISO = this.formatDateForISO(checkOut);
    
    // Parsear totales desde strings
    const totalChargesAmount = parseInt(openAIData.totalCharges.replace(/[^\d]/g, '')) || 0;
    const totalPaidAmount = parseInt(openAIData.totalPaid.replace(/[^\d]/g, '')) || 0;
    
    // Calcular balance
    const balance = totalChargesAmount - totalPaidAmount;
    
    // Generar URL de calendario
    const calendarUrl = this.generateCalendarUrl(openAIData, checkInISO, checkOutISO);
    
    return {
      // Empresa (fijos)
      companyName: this.config.company.name,
      companyNit: this.config.company.nit,
      companyAddress: this.config.company.address,
      companyPhone: this.config.company.phone,
      companyEmail: this.config.company.email,
      companyWebsite: this.config.company.website,
      companyLogo: this.config.company.logo,
      
      // Reserva (variables)
      bookingId: openAIData.bookingId,
      guestName: openAIData.guestName,
      guestCount: openAIData.guestCount || '1 Adulto',
      phone: openAIData.phone,
      email: openAIData.email,
      
      // Fechas
      checkInDateFormatted: checkInFormatted,
      checkOutDateFormatted: checkOutFormatted,
      checkInDateISO: checkInISO,
      checkOutDateISO: checkOutISO,
      nights: nights,
      multipleNights: nights > 1,
      
      // Apartamento
      roomName: openAIData.roomName,
      aptDescription: openAIData.roomName, // Usar roomName como descripción
      distribucion: openAIData.distribucion,
      
      // Financiero
      totalCharges: openAIData.totalCharges,
      totalPaid: openAIData.totalPaid,
      balance: balance > 0 ? this.formatCurrency(balance) : undefined,
      paymentNote: openAIData.paymentDescription,
      
      // Enlaces
      googleMapsUrl: this.config.location.googleMapsUrl,
      calendarUrl: calendarUrl,
      locationAddress: this.config.location.address,
      
      // Políticas
      checkInTime: this.config.policies.checkIn.time,
      checkInNote: this.config.policies.checkIn.note,
      checkOutTime: this.config.policies.checkOut.time,
      checkOutNote: this.config.policies.checkOut.note,
      cancellationPolicy: this.config.policies.cancellation,
      servicesNote: this.config.policies.services,
      
      // Template
      templateTitle: this.config.template.title,
      templateStatus: this.config.template.status
    };
  }
  
  private formatDateForDisplay(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };
    return date.toLocaleDateString('es-ES', options);
  }
  
  private formatDateForISO(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  
  private formatCurrency(amount: number): string {
    return `$${new Intl.NumberFormat('es-CO').format(amount)}`;
  }
  
  private generateCalendarUrl(data: OpenAIInvoiceData, checkInISO: string, checkOutISO: string): string {
    const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
    const title = encodeURIComponent(`Reserva Pa'Cartagena: ${data.roomName}`);
    const dates = `${checkInISO}T200000Z/${checkOutISO}T164500Z`; // 3PM-11:45AM Colombia time
    const details = encodeURIComponent(`Reserva Confirmada #${data.bookingId} para ${data.guestName}`);
    const location = encodeURIComponent(this.config.location.calendarLocation);
    
    return `${baseUrl}&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  }
}

// Función de utilidad para uso directo
export function processInvoiceData(openAIData: OpenAIInvoiceData): TemplateContext {
  const processor = new TemplateProcessor();
  return processor.processTemplateData(openAIData);
}

export type { OpenAIInvoiceData, TemplateContext };