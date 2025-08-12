import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BEDS24_API_URL = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';
const BEDS24_TOKEN = process.env.BEDS24_TOKEN || '';

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
  arrival?: string;
  departure?: string;
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

async function fetchBookingsPaged(dateFrom?: string, dateTo?: string): Promise<Beds24Booking[]> {
  if (!BEDS24_TOKEN) throw new Error('Falta BEDS24_TOKEN');

  const base = `${BEDS24_API_URL}/bookings`;
  const qp = [
    `includeInfoItems=true`,
    `includeInvoiceItems=true`,
    `includeGuests=true`,
  ];

  // Solo estados que pueden ser leads o confirmadas
  const BOOKING_STATUSES = ['confirmed', 'new'];
  BOOKING_STATUSES.forEach(status => {
    qp.push(`status=${encodeURIComponent(status)}`);
  });

  // Usar fechas de llegada (arrival) para reservas futuras
  if (dateFrom && dateTo) {
    qp.push(`arrivalFrom=${encodeURIComponent(dateFrom)}`);
    qp.push(`arrivalTo=${encodeURIComponent(dateTo)}`);
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

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const isoLike = /^\\d{4}-\\d{2}-\\d{2}/.test(d) ? d : new Date(d).toISOString();
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

function sumMoney(items: Beds24Booking['invoiceItems'], type: 'charge'|'payment'): number {
  if (!items || !Array.isArray(items)) return 0;
  return items
    .filter(i => i?.type === type)
    .reduce((acc, i) => acc + (typeof i?.amount === 'string' ? parseFloat(i!.amount) : (i?.amount || 0)), 0);
}

function sanitizeAmount(amount: any): string {
  if (!amount) return '0';
  const cleaned = String(amount).replace(/[^\\d.-]/g, '');
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

async function main() {
  console.log('🎯 SINCRONIZACIÓN AUTOMÁTICA DE LEADS Y RESERVAS CONFIRMADAS');
  
  // Fechas desde hoy hasta 6 meses adelante
  const today = new Date();
  const dateFrom = today.toISOString().split('T')[0];
  const sixMonthsLater = new Date(today.getTime() + (180 * 24 * 60 * 60 * 1000));
  const dateTo = sixMonthsLater.toISOString().split('T')[0];

  console.log(`📅 Sincronizando reservas futuras desde ${dateFrom} hasta ${dateTo}...`);

  const bookings = await fetchBookingsPaged(dateFrom, dateTo);
  console.log(`📊 Total reservas encontradas: ${bookings.length}`);

  // Filtrar solo reservas futuras válidas
  const futureBookings = bookings.filter(b => {
    const departure = formatDateSimple(b.departure);
    return departure && departure > '2025-08-11'; // Solo futuras
  });

  console.log(`🔮 Reservas futuras válidas: ${futureBookings.length}`);

  let confirmedCount = 0;
  let leadsCount = 0;
  let skippedCount = 0;

  for (const b of futureBookings) {
    // 📱 FILTRO TELÉFONO OBLIGATORIO
    const phone = (b.phone || b.mobile || b.guestPhone || '').toString().trim();
    const phoneDigits = phone.replace(/\\D/g, '');
    if (phoneDigits.length < 4) {
      skippedCount++;
      continue;
    }

    // 👤 FILTRO NOMBRE OBLIGATORIO
    const hasName = (b.firstName && b.firstName.trim()) || 
                   (b.lastName && b.lastName.trim()) || 
                   (b.title && b.title.trim());
    if (!hasName) {
      skippedCount++;
      continue;
    }

    // Preparar datos comunes
    const guestName = [b.title, b.firstName, b.lastName].filter(Boolean).join(' ').trim() || null;
    const arrivalDate = formatDateSimple(b.arrival);
    const departureDate = formatDateSimple(b.departure);
    const numNights = b.numNights || null;
    const totalPersons = (Number(b.numAdult||0) + Number(b.numChild||0)) || null;
    const bookingDate = formatDateSimple(b.bookingTime);
    const modifiedDate = formatDateSimple(b.modifiedTime);
    const channel = b.apiSource || b.channel || (b.referer && String(b.referer).toLowerCase() !== 'direct' ? b.referer : 'Directa');
    
    const totalCharges = sumMoney(b.invoiceItems, 'charge');
    const totalPayments = sumMoney(b.invoiceItems, 'payment');
    const balance = totalCharges - totalPayments;
    const basePrice = b.price ? parseFloat(String(b.price)) : 0;
    
    const { charges, payments } = extractChargesAndPayments(b.invoiceItems);

    // 🎯 LÓGICA DE CLASIFICACIÓN
    const isAirbnbOrExpedia = 
      channel?.toLowerCase().includes('airbnb') ||
      channel?.toLowerCase().includes('expedia');
    
    const hasPayments = totalPayments > 0;
    const isValidLeadStatus = b.status === 'confirmed' || b.status === 'new';

    const commonData = {
      bookingId: String(b.id),
      phone,
      guestName,
      status: b.status || null,
      internalNotes: b.message || null,
      propertyName: null, // Se puede llenar después con un mapa de propiedades
      arrivalDate,
      departureDate,
      numNights,
      totalPersons,
      totalCharges: totalCharges ? sanitizeAmount(Math.round(totalCharges)) : null,
      totalPayments: totalPayments ? sanitizeAmount(Math.round(totalPayments)) : null,
      balance: balance ? sanitizeAmount(Math.round(balance)) : null,
      basePrice: basePrice ? sanitizeAmount(Math.round(basePrice)) : null,
      channel,
      email: b.email || null,
      country: b.country || null,
      guestLang: b.lang || null,
      apiReference: b.apiReference || null,
      charges: charges,
      payments: payments,
      messages: [], // Mensajes deshabilitados temporalmente
      infoItems: [], // Info items simplificados
      notes: b.notes || null,
      bookingDate,
      modifiedDate,
      raw: b as any
    };

    try {
      if (hasPayments || isAirbnbOrExpedia) {
        // ✅ ES UNA RESERVA CONFIRMADA
        await prisma.reservationsConfirmedFuture.upsert({
          where: { bookingId: String(b.id) },
          update: commonData,
          create: commonData
        });
        confirmedCount++;
      } else if (isValidLeadStatus && !hasPayments && !isAirbnbOrExpedia) {
        // 🎯 ES UN LEAD (RESERVA PENDIENTE)
        const arrivalDateObj = new Date(arrivalDate || '2025-12-31');
        const today = new Date();
        const daysUntilArrival = Math.ceil((arrivalDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Prioridad basada en fecha de llegada y valor
        let priority = 'medium';
        if (daysUntilArrival <= 7) priority = 'high';        // Llega pronto
        else if (totalCharges > 200000) priority = 'high';   // Alto valor
        else if (daysUntilArrival > 30) priority = 'low';    // Llega tarde

        const leadData = {
          ...commonData,
          leadStatus: 'active',
          leadPriority: priority,
          leadSource: 'no_payment',
          createdAt: new Date(),
          lastContactAt: null,
          followUpDate: null,
          crmNotes: null,
          contactAttempts: 0
        };

        await prisma.reservationsPendingFuture.upsert({
          where: { bookingId: String(b.id) },
          update: leadData,
          create: leadData
        });
        leadsCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error procesando ${b.id}:`, error.message);
      skippedCount++;
    }

    if ((confirmedCount + leadsCount) % 10 === 0) {
      console.log(`Procesadas: ${confirmedCount + leadsCount} reservas...`);
    }
  }

  console.log(`\\n✅ SINCRONIZACIÓN COMPLETADA:`);
  console.log(`✅ Reservas Confirmadas: ${confirmedCount}`);
  console.log(`🎯 Leads Generados: ${leadsCount}`);
  console.log(`⏭️  Omitidas: ${skippedCount}`);
  console.log(`📊 Total procesadas: ${confirmedCount + leadsCount + skippedCount}`);

  // Estadísticas rápidas
  const totalConfirmed = await prisma.reservationsConfirmedFuture.count();
  const totalLeads = await prisma.reservationsPendingFuture.count();
  const activeLeads = await prisma.reservationsPendingFuture.count({
    where: { leadStatus: 'active' }
  });

  console.log(`\\n📊 ESTADO ACTUAL:`);
  console.log(`✅ Total Confirmadas Futuras: ${totalConfirmed}`);
  console.log(`🎯 Total Leads: ${totalLeads} (${activeLeads} activos)`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});