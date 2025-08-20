/**
 * informar-movimiento-manana: Función para informar al equipo hotelero
 * 
 * PROPÓSITO:
 * - Informar movimientos del día siguiente: entradas, salidas, ocupados
 * - Para coordinación de personal interno del hotel
 * - Formato específico para WhatsApp/equipos operativos
 * 
 * ARQUITECTURA:
 * Personal → OpenAI Operaciones → informar_movimiento_manana() → GET /bookings → Reporte WhatsApp
 */

import axios from 'axios';
import type { FunctionDefinition } from '../../../functions/types/function-types.js';
import { logInfo, logError, logSuccess } from '../../../utils/logging';

// ============================================================================
// INTERFACES TYPESCRIPT PARA TYPE SAFETY
// ============================================================================

interface MovimientoMananaParams {
  fecha: string; // YYYY-MM-DD
  incluirSaldos?: boolean;
}

interface MovimientoMananaResult {
  success: boolean;
  reporte?: string;
  resumen?: {
    totalSalidas: number;
    totalEntradas: number;
    totalOcupados: number;
    saldoPendienteTotal: number;
  };
  message: string;
  error?: any;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export async function informarMovimientoManana(params: MovimientoMananaParams): Promise<MovimientoMananaResult> {
  const { fecha, incluirSaldos = true } = params;
  
  logInfo('MOVIMIENTO_MANANA', 'Generando reporte para equipo hotelero', { 
    fecha, incluirSaldos 
  }, 'informar-movimiento-manana.ts');

  try {
    // 1. Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fecha)) {
      return {
        success: false,
        message: "Formato de fecha inválido. Use YYYY-MM-DD",
        error: "invalid_date_format"
      };
    }

    // NOTA: No validamos fechas pasadas para evitar conflictos de zona horaria
    // Beds24 maneja esto internamente usando GMT

    // 2. Auth con token de lectura
    const token = process.env.BEDS24_TOKEN;
    const apiUrl = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';

    if (!token) {
      return {
        success: false,
        message: "Token de Beds24 no configurado",
        error: "missing_token"
      };
    }

    // 3. Consultar movimientos del día - ENTRADAS (checking in)
    logInfo('MOVIMIENTO_MANANA', 'Consultando ENTRADAS en Beds24', {
      fecha,
      endpoint: '/bookings'
    }, 'informar-movimiento-manana.ts');

    const entradas = await axios.get(`${apiUrl}/bookings`, {
      params: {
        arrivalFrom: fecha,
        arrivalTo: fecha,
        includeInvoiceItems: true,
        includeInfoItems: true
      },
      headers: {
        'Content-Type': 'application/json',
        'token': token
      },
      timeout: 15000
    });

    // 4. Consultar SALIDAS (checking out)
    logInfo('MOVIMIENTO_MANANA', 'Consultando SALIDAS en Beds24', {
      fecha,
      endpoint: '/bookings'
    }, 'informar-movimiento-manana.ts');

    const salidas = await axios.get(`${apiUrl}/bookings`, {
      params: {
        departureFrom: fecha,
        departureTo: fecha,
        includeInvoiceItems: true,
        includeInfoItems: true
      },
      headers: {
        'Content-Type': 'application/json',
        'token': token
      },
      timeout: 15000
    });

    // 5. Consultar TODAS las reservas activas para determinar ocupación real
    logInfo('MOVIMIENTO_MANANA', 'Consultando reservas activas en Beds24', {
      fecha,
      endpoint: '/bookings'
    }, 'informar-movimiento-manana.ts');

    const reservasActivas = await axios.get(`${apiUrl}/bookings`, {
      params: {
        arrivalTo: fecha,
        departureFrom: fecha,
        includeInvoiceItems: true,
        includeInfoItems: true
      },
      headers: {
        'Content-Type': 'application/json',
        'token': token
      },
      timeout: 15000
    });

    // 6. Consultar PRÓXIMAS RESERVAS para calcular disponibilidad
    logInfo('MOVIMIENTO_MANANA', 'Consultando próximas reservas en Beds24', {
      fecha,
      endpoint: '/bookings'
    }, 'informar-movimiento-manana.ts');

    // Calcular fecha límite (30 días después para ver disponibilidad)
    const fechaLimite = new Date(fecha);
    fechaLimite.setDate(fechaLimite.getDate() + 30);
    const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];

    const proximasReservas = await axios.get(`${apiUrl}/bookings`, {
      params: {
        arrivalFrom: fecha,
        arrivalTo: fechaLimiteStr,
        includeInvoice: 'false',
        includeComments: 'false',
        includeInfoItems: 'false'
      },
      headers: {
        'Content-Type': 'application/json',
        'token': token
      },
      timeout: 15000
    });

    // Consolidar respuestas
    const entradasData = entradas.data?.data || [];
    const salidasData = salidas.data?.data || [];
    const reservasActivasData = reservasActivas.data?.data || [];
    const proximasReservasData = proximasReservas.data?.data || [];

    logSuccess('MOVIMIENTO_MANANA', `Movimientos encontrados: ${entradasData.length} entradas, ${salidasData.length} salidas, ${reservasActivasData.length} activas, ${proximasReservasData.length} próximas`, {
      entradas: entradasData.length,
      salidas: salidasData.length,
      reservasActivas: reservasActivasData.length,
      proximasReservas: proximasReservasData.length,
      fecha,
      fechaConsultada: fecha
    }, 'informar-movimiento-manana.ts');

    // DEBUG: Verificar fechas de reservas activas
    logInfo('MOVIMIENTO_MANANA', 'DEBUG: Verificando fechas de reservas activas', {
      reservasActivas: reservasActivasData.map(r => ({
        roomId: r.roomId,
        roomName: getRoomName(r.roomId),
        arrival: r.arrival,
        departure: r.departure,
        fechaConsultada: fecha
      }))
    }, 'informar-movimiento-manana.ts');

    // 6. Procesar ENTRADAS
    const entradasProcesadas = [];
    let saldoPendienteTotal = 0;

    for (const booking of entradasData) {
      // Calcular saldo pendiente
      let paidAmount = 0;
      let pendingBalance = 0;
      
      // Calcular saldo pendiente usando price + invoice data cuando disponible
      
      // Extraer información operativa primero
      const guestName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim();
      const phone = booking.phone || booking.mobile || 'Sin teléfono';
      const roomInfo = getRoomName(booking.roomId) || `Room ID ${booking.roomId}`;
      const channel = booking.referer || booking.channel || 'Direct';

      if (incluirSaldos) {
        // Regla especial: Expedia y Airbnb siempre saldo = 0 (pagan por adelantado)
        if (channel.toLowerCase().includes('expedia') || channel.toLowerCase().includes('airbnb')) {
          pendingBalance = 0;
        } else if (booking.invoiceItems && booking.invoiceItems.length > 0) {
          // Método preferido: calcular saldo usando invoiceItems
          const charges = booking.invoiceItems.filter((item: any) => item.type === 'charge');
          const payments = booking.invoiceItems.filter((item: any) => item.type === 'payment');
          
          const totalCharges = charges.reduce((sum: number, charge: any) => sum + (charge.amount * charge.qty || 0), 0);
          const totalPayments = payments.reduce((sum: number, payment: any) => sum + Math.abs(payment.amount || 0), 0);
          
          pendingBalance = totalCharges - totalPayments;
        } else {
          // Método fallback: usar price completo como saldo pendiente
          pendingBalance = booking.price || 0;
        }
        
        saldoPendienteTotal += pendingBalance;
      }
      
      // Extraer horas y notas usando ambos campos
      const allNotes = [booking.notes || '', booking.comments || ''].filter(Boolean).join(' | ');
      const horaEntrada = extractTimeFromNotes(allNotes, 'entrada') || 'No reportada';

      entradasProcesadas.push({
        guestName,
        phone,
        roomInfo,
        horaEntrada,
        pendingBalance,
        channel,
        adults: booking.adults || 0,
        children: booking.children || 0
      });
    }

    // 7. Procesar SALIDAS
    const salidasProcesadas = [];

    for (const booking of salidasData) {
      const guestName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim();
      const phone = booking.phone || booking.mobile || 'Sin teléfono';
      const roomInfo = getRoomName(booking.roomId) || `Room ID ${booking.roomId}`;
      const channel = booking.referer || 'Direct';
      
      const allNotes = [booking.notes || '', booking.comments || ''].filter(Boolean).join(' | ');
      const horaSalida = extractTimeFromNotes(allNotes, 'salida') || 'No reportada';

      salidasProcesadas.push({
        guestName,
        phone,
        roomInfo,
        horaSalida,
        channel,
        adults: booking.adults || 0,
        children: booking.children || 0
      });
    }

    // 8. Procesar OCUPADOS REALES (no salen mañana, no entran mañana)
    const ocupadosProcesados = [];
    const apartamentosSalen = salidasProcesadas.map(s => s.roomInfo);
    const apartamentosEntran = entradasProcesadas.map(e => e.roomInfo);

    for (const booking of reservasActivasData) {
      const roomInfo = getRoomName(booking.roomId) || `Room ID ${booking.roomId}`;
      
      // SOLO considerar ocupado si:
      // 1. Está hospedado antes de la fecha (arrival < fecha)
      // 2. Sale DESPUÉS de la fecha consultada (departure > fecha)  
      // 3. NO sale mañana (no está en lista de salidas)
      // IMPORTANTE: Si departure === fecha, va en SALIDAS, no en OCUPADOS
      if (booking.arrival < fecha && booking.departure > fecha && !apartamentosSalen.includes(roomInfo)) {
        
        // Calcular saldo pendiente
        let paidAmount = 0;
        let pendingBalance = 0;
        
        const guestName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim();
        const channel = booking.referer || booking.channel || 'Direct';

        if (incluirSaldos) {
          // Regla especial: Expedia y Airbnb siempre saldo = 0 para ocupados también
          if (channel.toLowerCase().includes('expedia') || channel.toLowerCase().includes('airbnb')) {
            pendingBalance = 0;
          } else if (booking.invoiceItems && booking.invoiceItems.length > 0) {
            const charges = booking.invoiceItems.filter((item: any) => item.type === 'charge');
            const payments = booking.invoiceItems.filter((item: any) => item.type === 'payment');
            
            const totalCharges = charges.reduce((sum: number, charge: any) => sum + (charge.amount * charge.qty || 0), 0);
            const totalPayments = payments.reduce((sum: number, payment: any) => sum + Math.abs(payment.amount || 0), 0);
            
            pendingBalance = totalCharges - totalPayments;
          }
          saldoPendienteTotal += pendingBalance;
        }

        ocupadosProcesados.push({
          guestName,
          roomInfo,
          departureDate: booking.departure
        });
      }
    }

    // 9. Generar reporte simplificado en texto plano para OpenAI
    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaManana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let diaTitulo;
    if (fecha === fechaHoy) {
        diaTitulo = "Hoy";
    } else if (fecha === fechaManana) {
        diaTitulo = "Mañana " + new Date(fecha).getDate();
    } else {
        const fechaObj = new Date(fecha);
        diaTitulo = `El día ${fechaObj.getDate()}`;
    }
    
    let reporte = `${diaTitulo} Sale y Entra:\n\n`;

    // SALIDAS - Formato simplificado con total de personas
    reporte += `SALE:\n`;
    if (salidasProcesadas.length > 0) {
      salidasProcesadas.forEach(s => {
        const phone = (s.phone && s.phone !== 'Sin teléfono') ? s.phone : 'N/A';
        const hora = (s.horaSalida && s.horaSalida !== 'No reportada') ? s.horaSalida : 'N/A';
        
        // Cambiar pacartagena2 a Directo
        let canal = s.channel || 'Direct';
        if (canal.toLowerCase().includes('pacartagena')) {
            canal = 'Directo';
        }
        
        // Calcular total de personas (adultos + niños)
        const totalPersonas = (s.adults || 0) + (s.children || 0);
        const personasTexto = totalPersonas > 0 ? `${totalPersonas} Personas` : 'N/A Personas';
        
        reporte += `- ${s.roomInfo} - ${s.guestName} - ${personasTexto} - Tel: ${phone} - Hora: ${hora} - Canal: ${canal}\n`;
      });
    } else {
      reporte += `- No hay salidas programadas\n`;
    }
    reporte += '\n';

    // ENTRADAS - Formato simplificado con total de personas
    reporte += `ENTRA:\n`;
    if (entradasProcesadas.length > 0) {
      entradasProcesadas.forEach(e => {
        const phone = (e.phone && e.phone !== 'Sin teléfono') ? e.phone : 'N/A';
        const hora = (e.horaEntrada && e.horaEntrada !== 'No reportada') ? e.horaEntrada : 'N/A';
        const saldo = e.pendingBalance > 0 ? `$${e.pendingBalance.toLocaleString()}` : '$0';
        
        // Cambiar pacartagena2 a Directo
        let canal = e.channel || 'Direct';
        if (canal.toLowerCase().includes('pacartagena')) {
            canal = 'Directo';
        }
        
        // Calcular total de personas (adultos + niños)
        const totalPersonas = (e.adults || 0) + (e.children || 0);
        const personasTexto = totalPersonas > 0 ? `${totalPersonas} Personas` : 'N/A Personas';
        
        reporte += `- ${e.roomInfo} - ${e.guestName} - ${personasTexto} - Tel: ${phone} - Hora: ${hora} - Saldo: ${saldo} - Canal: ${canal}\n`;
      });
    } else {
      reporte += `- No hay entradas programadas\n`;
    }
    reporte += '\n';

    // OCUPADOS - Formato simplificado
    reporte += `OCUPADOS:\n`;
    if (ocupadosProcesados.length > 0) {
      ocupadosProcesados.forEach(o => {
        const fechaSalida = formatDepartureDate(o.departureDate);
        reporte += `- ${o.roomInfo} - ${o.guestName} - Sale: ${fechaSalida}\n`;
      });
    } else {
      reporte += `- Todos los apartamentos disponibles\n`;
    }
    reporte += '\n';

    // DESOCUPADOS - Formato simplificado
    const apartamentosLibres = calcularDesocupados(salidasProcesadas, entradasProcesadas, ocupadosProcesados, proximasReservasData, fecha);
    reporte += `DESOCUPADOS:\n`;
    if (apartamentosLibres.length > 0) {
      apartamentosLibres.forEach(libre => {
        reporte += `- ${libre.roomInfo} - ${libre.disponibilidad}\n`;
      });
    } else {
      reporte += `- No hay apartamentos disponibles\n`;
    }

    const resumen = {
      totalSalidas: salidasProcesadas.length,
      totalEntradas: entradasProcesadas.length,
      totalOcupados: ocupadosProcesados.length,
      saldoPendienteTotal: saldoPendienteTotal
    };

    // 10. NOTA: No enviar directo a WhatsApp - el assistant maneja el envío
    // El reporte se retorna al assistant quien formatea y envía la respuesta

    return {
      success: true,
      reporte: reporte,
      resumen: resumen,
      message: reporte
    };

  } catch (error) {
    logError('MOVIMIENTO_MANANA', `Error generando reporte: ${error.message}`, {
      error: error.response?.data || error.message,
      fecha
    }, 'informar-movimiento-manana.ts');

    return {
      success: false,
      message: "❌ Error generando reporte de movimientos. Contacte soporte técnico.",
      error: error.response?.data || error.message
    };
  }
}

// Helper para formatear fecha para el equipo con día en diminutivo
function formatDateForTeam(dateStr: string): string {
  try {
    // Crear fecha correctamente desde string YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month es 0-indexed
    
    // Mapeo de días en diminutivo
    const diasDiminutivo = {
      'domingo': 'dom',
      'lunes': 'lun',
      'martes': 'mar',
      'miércoles': 'mie',
      'jueves': 'jue',
      'viernes': 'vie',
      'sábado': 'sab'
    };
    
    // Obtener día completo y convertir a diminutivo
    const diaCompleto = date.toLocaleDateString('es-CO', { weekday: 'long' });
    const diaDiminutivo = diasDiminutivo[diaCompleto] || diaCompleto.slice(0, 3);
    
    // Formatear fecha completa con día en diminutivo
    const fechaCompleta = date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    
    return `${diaDiminutivo}, ${fechaCompleta}`;
  } catch {
    return dateStr;
  }
}

// Helper para obtener nombre real del apartamento (por implementar con DB)
function getRoomName(roomId: number): string | null {
  const roomNames: Record<number, string> = {
    378110: '2005A',
    378316: '1820', 
    378320: '2005B',
    378321: '1722A',
    378318: '1722B',
    506591: '715',
    378317: '1317'
  };
  
  return roomNames[roomId] || null;
}

// Helper para extraer horas de entrada/salida de notas
function extractTimeFromNotes(notes: string, type: 'entrada' | 'salida'): string | null {
  if (!notes) return null;
  
  const patterns = {
    entrada: [
      /hora.*entrada:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i,
      /llegada:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i,
      /check.*in:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i,
      /entrada:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i
    ],
    salida: [
      /hora.*salida:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i,
      /check.*out:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i,
      /salida:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i,
      /departure:?\s*([0-9]{1,2}:[0-9]{2}(\s*[AP]M)?)/i
    ]
  };

  for (const pattern of patterns[type]) {
    const match = notes.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Helper para extraer notas internas (excluyendo horas)
function extractInternalNotes(notes: string): string | null {
  if (!notes) return null;
  
  // Remover patrones de horas para quedarse solo con notas internas
  let internalNotes = notes
    .replace(/hora.*entrada:?\s*[0-9]{1,2}:[0-9]{2}(\s*[AP]M)?/gi, '')
    .replace(/hora.*salida:?\s*[0-9]{1,2}:[0-9]{2}(\s*[AP]M)?/gi, '')
    .replace(/llegada:?\s*[0-9]{1,2}:[0-9]{2}(\s*[AP]M)?/gi, '')
    .replace(/check.*(in|out):?\s*[0-9]{1,2}:[0-9]{2}(\s*[AP]M)?/gi, '')
    .replace(/\s*\|\s*/g, ' ')
    .trim();

  return internalNotes || null;
}

// Helper eliminado: enviarReporteWhatsApp 
// El assistant de operaciones maneja automáticamente el envío de respuestas

// Helper para calcular apartamentos desocupados con lógica simple
function calcularDesocupados(salidas: any[], entradas: any[], ocupados: any[], proximasReservas: any[], fechaConsulta: string): any[] {
  const todosLosApartamentos = ['715', '1317', '1722A', '1722B', '1820', '2005A', '2005B'];
  const apartamentosDesocupados = [];
  
  const apartamentosConSalida = salidas.map(s => s.roomInfo);
  const apartamentosConEntrada = entradas.map(e => e.roomInfo);
  const apartamentosOcupados = ocupados.map(o => o.roomInfo);
  
  for (const roomInfo of todosLosApartamentos) {
    let tipoDesocupado = null;
    
    // CASO 1: Se desocupa mañana por salida (y no tiene entrada el mismo día)
    if (apartamentosConSalida.includes(roomInfo) && !apartamentosConEntrada.includes(roomInfo)) {
      tipoDesocupado = 'se_desocupa';
    }
    // CASO 2: Sigue desocupado (no está en salidas, entradas, ni ocupados)
    else if (!apartamentosConSalida.includes(roomInfo) && 
             !apartamentosConEntrada.includes(roomInfo) && 
             !apartamentosOcupados.includes(roomInfo)) {
      tipoDesocupado = 'sigue_desocupado';
    }
    
    if (tipoDesocupado) {
      // Buscar próxima reserva para calcular noches disponibles
      const proximaReserva = proximasReservas
        .filter(reserva => {
          const roomName = getRoomName(reserva.roomId);
          return roomName === roomInfo && reserva.arrival > fechaConsulta;
        })
        .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
      
      let noches;
      if (proximaReserva) {
        const fechaInicio = new Date(fechaConsulta);
        const fechaProximaReserva = new Date(proximaReserva.arrival);
        const diffTime = fechaProximaReserva.getTime() - fechaInicio.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        noches = diffDays;
      } else {
        noches = "30+";
      }
      
      // Textos simples y claros
      let descripcion;
      if (tipoDesocupado === 'se_desocupa') {
        descripcion = `Se desocupa mañana | ${noches} noches disponibles`;
      } else {
        descripcion = `Sigue desocupado | ${noches} noches más`;
      }
      
      apartamentosDesocupados.push({
        roomInfo,
        disponibilidad: descripcion
      });
    }
  }
  
  return apartamentosDesocupados;
}

// Helper para formatear fecha de salida con día en diminutivo
function formatDepartureDate(dateStr: string): string {
  try {
    // Crear fecha correctamente desde string YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month es 0-indexed
    
    // Mapeo de días en diminutivo
    const diasDiminutivo = {
      'domingo': 'dom',
      'lunes': 'lun',
      'martes': 'mar',
      'miércoles': 'mie',
      'jueves': 'jue',
      'viernes': 'vie',
      'sábado': 'sab'
    };
    
    // Obtener día completo y convertir a diminutivo
    const diaCompleto = date.toLocaleDateString('es-CO', { weekday: 'long' });
    const diaDiminutivo = diasDiminutivo[diaCompleto] || diaCompleto.slice(0, 3);
    
    // Formatear fecha con día y mes
    const fechaCorta = date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short'
    });
    
    return `${diaDiminutivo} ${fechaCorta}`;
  } catch {
    return dateStr;
  }
}

// ============================================================================
// DEFINICIÓN PARA OPENAI ASSISTANT
// ============================================================================

export const informarMovimientoMananaFunction: FunctionDefinition = {
  name: 'informar_movimiento_manana',
  description: 'Genera reporte diario de movimientos del hotel: entradas, salidas, ocupados y desocupados',
  category: 'hotel_operations',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      fecha: {
        type: 'string',
        description: 'Fecha del reporte en formato YYYY-MM-DD. Ejemplo: 2025-08-20 para el reporte de mañana 20 de agosto',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      incluirSaldos: {
        type: 'boolean',
        description: 'Si incluir información de saldos pendientes en el reporte. Recomendado: true para reportes completos',
        default: true
      },
    },
    required: ['fecha', 'incluirSaldos'],
    additionalProperties: false
  },
  handler: informarMovimientoManana
};
