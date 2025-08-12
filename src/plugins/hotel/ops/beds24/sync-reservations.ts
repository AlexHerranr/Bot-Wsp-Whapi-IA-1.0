import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BEDS24_API_URL = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';
const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';

interface Beds24Property {
  id: number;
  name: string;
  rooms?: Array<{ id: number; name: string; [key: string]: any }>;
  [key: string]: any;
}

interface Beds24Booking {
  id: string;
  propertyId?: number;
  roomId?: number;
  title?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  guestPhone?: string;
  email?: string;
  arrival?: string;    // 'YYYY-MM-DD' o ISO
  departure?: string;  // 'YYYY-MM-DD' o ISO
  numNights?: number;
  status?: string;
  apiSource?: string;
  channel?: string;
  referer?: string;
  apiReference?: string;
  reference?: string;
  numAdult?: number;
  numChild?: number;
  price?: string | number;
  notes?: string;
  message?: string;
  bookingTime?: string;
  modifiedTime?: string;
  invoiceItems?: Array<{ 
    type?: 'charge' | 'payment'; 
    amount?: string | number; 
    subType?: string; 
    paymentType?: string; 
    description?: string; 
    createTime?: string 
  }>;
  [key: string]: any;
}

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const isoLike = /^\d{4}-\d{2}-\d{2}/.test(d) ? d : new Date(d).toISOString();
  const date = new Date(isoLike);
  return isNaN(date.getTime()) ? null : date;
}

function formatDateSimple(d?: string): string | null {
  if (!d) return null;
  const date = parseDate(d);
  if (!date) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

async function getAllProperties(): Promise<Beds24Property[]> {
  if (!BEDS24_TOKEN) throw new Error('Falta BEDS24_TOKEN');
  
  try {
    const res = await axios.get(`${BEDS24_API_URL}/properties`, {
      headers: { accept: 'application/json', token: BEDS24_TOKEN },
      timeout: 30000
    });
    
    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch (error) {
    console.error('Error obteniendo propiedades:', error);
    return [];
  }
}

async function getMessagesForBooking(bookingId: string): Promise<any[]> {
  if (!BEDS24_TOKEN) return [];
  
  try {
    const res = await axios.get(`${BEDS24_API_URL}/bookings/messages`, {
      headers: { accept: 'application/json', token: BEDS24_TOKEN },
      params: { bookingId: [bookingId], maxAge: 30 }, // Solo últimos 30 días
      timeout: 15000
    });
    
    const messages = Array.isArray(res.data?.data) ? res.data.data : [];
    
    // 🚨 FILTRO CRÍTICO: La API de Beds24 NO filtra correctamente por bookingId
    // Debemos filtrar manualmente para evitar contaminación de datos
    const filteredMessages = messages.filter(msg => 
      String(msg.bookingId) === String(bookingId)
    );
    
    console.log(`🔍 Mensajes API: ${messages.length} total, ${filteredMessages.length} filtrados para booking ${bookingId}`);
    
    // Formato optimizado para CRM con direction
    return filteredMessages.map(msg => ({
      id: msg.id || 0,
      time: msg.time || null,
      source: msg.source || 'unknown',
      direction: mapSourceToDirection(msg.source),
      text: msg.message || ''
    }))
    .sort((a, b) => new Date(a.time || 0).getTime() - new Date(b.time || 0).getTime())
    .filter(msg => msg.text.trim().length > 0); // Solo mensajes con contenido
    
  } catch (error) {
    console.error(`Error obteniendo mensajes para booking ${bookingId}:`, error.message);
    return [];
  }
}

function mapSourceToDirection(source: string): string {
  switch (source) {
    case 'guest': return 'in';
    case 'host': return 'out';
    case 'internalNote':
    case 'system': 
    default: return 'system';
  }
}

function extractInfoItems(infoItems: any[]): any[] {
  if (!infoItems || !Array.isArray(infoItems)) return [];
  
  return infoItems.map(item => ({
    code: item.code || '',
    text: item.text || '',
    time: item.createTime || null
  })).filter(item => item.code || item.text); // Solo items con contenido
}

function sumMoney(items: Beds24Booking['invoiceItems'], type: 'charge'|'payment'): number {
  if (!items || !Array.isArray(items)) return 0;
  return items
    .filter(i => i?.type === type)
    .reduce((acc, i) => acc + (typeof i?.amount === 'string' ? parseFloat(i!.amount) : (i?.amount || 0)), 0);
}

function sanitizeAmount(amount: any): string {
  if (!amount) return '0';
  // Limpiar caracteres no numéricos excepto punto decimal
  const cleaned = String(amount).replace(/[^\d.-]/g, '');
  return cleaned || '0';
}

function extractChargesAndPayments(invoiceItems: Beds24Booking['invoiceItems']) {
  if (!invoiceItems || !Array.isArray(invoiceItems)) {
    return { charges: [], payments: [] };
  }

  const charges: any[] = [];
  const payments: any[] = [];

  invoiceItems.forEach(item => {
    if (!item) return;

    if (item.type === 'charge') {
      charges.push({
        description: item.description || 'Cargo adicional',
        amount: sanitizeAmount(item.amount)
      });
    } else if (item.type === 'payment') {
      payments.push({
        description: item.description || 'Pago recibido',
        amount: sanitizeAmount(item.amount)
      });
    }
  });

  return { charges, payments };
}

async function fetchBookingsPaged(dateFrom?: string, dateTo?: string, useModified: boolean = false): Promise<Beds24Booking[]> {
  if (!BEDS24_TOKEN) throw new Error('Falta BEDS24_TOKEN');

  const base = `${BEDS24_API_URL}/bookings`;
  const qp = [
    `includeInfoItems=true`,       // Para códigos de puerta, avisos, etc.
    `includeInvoiceItems=true`,    // Para cargos y pagos
    `includeGuests=true`,          // Para datos de huéspedes
  ];

  // 🎯 CRÍTICO: Agregar TODOS los estados como en Google Apps Script
  const ALL_BOOKING_STATUSES = ['confirmed', 'request', 'new', 'cancelled', 'black', 'inquiry'];
  ALL_BOOKING_STATUSES.forEach(status => {
    qp.push(`status=${encodeURIComponent(status)}`);
  });

  // 🎯 CAMBIO CRÍTICO: Para canceladas usar modifiedFrom/modifiedTo como en Google Apps Script
  if (dateFrom && dateTo) {
    if (useModified) {
      qp.push(`modifiedFrom=${encodeURIComponent(dateFrom)}`);
      qp.push(`modifiedTo=${encodeURIComponent(dateTo)}`);
    } else {
      qp.push(`arrivalFrom=${encodeURIComponent(dateFrom)}`);
      qp.push(`arrivalTo=${encodeURIComponent(dateTo)}`);
    }
  }

  const queryString = qp.join('&');

  let page = 1;
  const out: Beds24Booking[] = [];

  while (true) {
    const url = `${base}?${queryString}&page=${page}`;
    const res = await axios.get(url, {
      headers: { accept: 'application/json', token: BEDS24_TOKEN },
      timeout: 45000
    });
    const body = res.data || {};
    const data: Beds24Booking[] = Array.isArray(body.data) ? body.data : [];

    out.push(...data);

    const hasNext = !!(body.pages && body.pages.nextPageExists === true);
    if (!hasNext) break;
    page += 1;
    await new Promise(r => setTimeout(r, page % 10 === 0 ? 2000 : 400));
  }

  return out;
}

async function main() {
  // 🎯 MODO CANCELADAS: Usar fechas amplias desde 2023 como en Google Apps Script
  // Para canceladas usamos modifiedFrom/modifiedTo en lugar de arrival
  const dateFrom = process.argv[2] || '2023-01-01';
  const dateTo = process.argv[3] || '2025-12-31';
  const useModified = true; // Para canceladas usar fechas de modificación

  console.log(`Obteniendo propiedades...`);
  const properties = await getAllProperties();
  console.log(`Propiedades obtenidas: ${properties.length}`);

  // Crear mapa para lookup rápido de propiedades
  const propertyMap = new Map<number, Beds24Property>();
  
  properties.forEach(prop => {
    propertyMap.set(prop.id, prop);
  });

  console.log(`🔍 Fetching bookings desde ${dateFrom} hasta ${dateTo} (usando ${useModified ? 'modifiedFrom/To' : 'arrivalFrom/To'})...`);
  const bookings = await fetchBookingsPaged(dateFrom, dateTo, useModified);
  console.log(`📊 Total fetched: ${bookings.length}`);

  // 🎯 TODOS LOS ESTADOS IMPORTANTES - No filtrar por status
  const ALL_BOOKING_STATUSES = ['confirmed', 'request', 'new', 'cancelled', 'black', 'inquiry'];
  console.log(`📊 Sincronizando TODOS los estados: ${ALL_BOOKING_STATUSES.join(', ')}`);

  let kept = 0, upserts = 0, skippedNoPhone = 0, skippedNoName = 0, skippedByStatus = 0;
  for (const b of bookings) {
    // Log del status para debug
    if (kept < 10) {
      console.log(`🔍 Reserva ${b.id}: status="${b.status}", phone="${(b.phone || b.mobile || '')?.slice(0,5)}..."`);
    }

    // 🚫 FILTRO SOLO CANCELADAS - buscar cancelled y black
    const isCancelled = b.status === 'cancelled' || b.status === 'black';
    if (!isCancelled) { skippedByStatus += 1; continue; }
    
    // 📱 FILTRO TELÉFONO RELAJADO - mínimo 4 dígitos
    const phone = (b.phone || b.mobile || b.guestPhone || '').toString().trim();
    const phoneDigits = phone.replace(/\D/g, ''); // Solo números
    if (phoneDigits.length < 4) { skippedNoPhone += 1; continue; }
    
    console.log(`🚫 CANCELADA ENCONTRADA: ${b.id} - status="${b.status}", phone="${phone.slice(0,10)}..."`);
    
    // 👤 FILTRO NOMBRE OBLIGATORIO - al menos un nombre
    const hasName = (b.firstName && b.firstName.trim()) || 
                   (b.lastName && b.lastName.trim()) || 
                   (b.title && b.title.trim());
    if (!hasName) { 
      skippedNoName += 1; 
      continue; // ⚠️ SKIP si no tiene nombre
    }

    // Nombre de propiedad (roomName va en raw)
    const property = propertyMap.get(b.propertyId || 0);
    const propertyName = property?.name || null;

    // Nombre del huésped (simple)
    const guestName = [b.title, b.firstName, b.lastName].filter(Boolean).join(' ').trim() || null;

    // Fechas formato simple YYYY-MM-DD
    const arrivalDate = formatDateSimple(b.arrival);
    const departureDate = formatDateSimple(b.departure);
    
    // Usar numNights directo de Beds24 - no calcular
    const numNights = b.numNights || null;
    
    // Total de personas
    const totalPersons = (Number(b.numAdult||0) + Number(b.numChild||0)) || null;

    // Fechas importantes de Beds24 (formato simple)
    const bookingDate = formatDateSimple(b.bookingTime);
    const modifiedDate = formatDateSimple(b.modifiedTime);

    // Canal de reserva
    const channel = b.apiSource || b.channel || (b.referer && String(b.referer).toLowerCase() !== 'direct' ? b.referer : 'Directa');

    // (totalPersons ya calculado arriba)

    // Financieros (como strings sin decimales)
    const totalCharges = sumMoney(b.invoiceItems, 'charge');
    const totalPayments = sumMoney(b.invoiceItems, 'payment');
    const balance = totalCharges - totalPayments;
    const basePrice = b.price ? parseFloat(String(b.price)) : 0;

    // Extraer cargos y pagos detallados
    const { charges, payments } = extractChargesAndPayments(b.invoiceItems);

    // Extraer info items (códigos de puerta, avisos del sistema, etc.)
    const infoItems = extractInfoItems(b.infoItems);

    // 💬 MENSAJES DESHABILITADOS TEMPORALMENTE
    // La API de Beds24 /bookings/messages tiene bugs de filtrado
    // y no devuelve mensajes viejos confiablemente
    let messages: any[] = [];

    kept += 1;

    const reservationData = {
      // 🎯 INFORMACIÓN CRÍTICA (Prioridad 1)
      bookingId: String(b.id),
      phone,
      guestName,
      status: b.status || null,
      internalNotes: b.message || null,
      
      // 🏨 UBICACIÓN (Prioridad 2)
      propertyName,
      
      // 📅 FECHAS DE ESTADÍA (Prioridad 3)
      arrivalDate,
      departureDate,
      numNights,
      
      // 👥 OCUPACIÓN (Prioridad 4)
      totalPersons: totalPersons || null,
      
      // 💰 FINANCIEROS (Prioridad 5) - Sanitizados
      totalCharges: totalCharges ? sanitizeAmount(Math.round(totalCharges)) : null,
      totalPayments: totalPayments ? sanitizeAmount(Math.round(totalPayments)) : null,
      balance: balance ? sanitizeAmount(Math.round(balance)) : null,
      basePrice: basePrice ? sanitizeAmount(Math.round(basePrice)) : null,
      
      // 📊 ORIGEN Y CONTACTO (Prioridad 6)
      channel,
      email: b.email || null,
      country: b.country || null,
      guestLang: b.lang || null,
      apiReference: b.apiReference || null,
      
      // 💳 TRANSACCIONES DETALLADAS (Prioridad 7) - Siempre arrays
      charges: charges,
      payments: payments,
      
      // 💬 CONVERSACIÓN Y EVENTOS (Prioridad 7.5)
      messages: messages,
      infoItems: infoItems,
      
      // 📝 NOTAS Y FECHAS DE SISTEMA (Prioridad 8)
      notes: b.notes || null,
      bookingDate,
      modifiedDate,
      
      // 🗂️ BACKUP COMPLETO (Prioridad 9)
      raw: b as any
    };

    // 🚫 SOLO CANCELADAS - Todas van a ReservationsCancelled
    await prisma.reservationsCancelled.upsert({
      where: { bookingId: String(b.id) },
      update: reservationData,
      create: reservationData
    });

    upserts += 1;
    
    if (upserts % 50 === 0) {
      console.log(`Procesadas: ${upserts}/${kept} reservas...`);
    }
  }

  console.log(`\n✅ Sincronización CANCELADAS completada:`);
  console.log(`📊 Total reservas API: ${bookings.length}`);
  console.log(`🚫 Canceladas con teléfono: ${kept}`);
  console.log(`💾 Guardadas en BD: ${upserts}`);
  console.log(`⏭️ Sin teléfono (omitidas): ${skippedNoPhone}`);
  console.log(`📊 No canceladas (omitidas): ${skippedByStatus}`);
  console.log(`👤 Sin nombre (solo info): ${skippedNoName}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});