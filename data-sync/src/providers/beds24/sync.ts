import { prisma } from '../../infra/db/prisma.client';
import { logger } from '../../utils/logger';
import { fetchBookingsPaged, getAllProperties, type Beds24Booking } from './client';
import { 
  formatDateSimple, 
  sumMoney, 
  sanitizeAmount, 
  extractChargesAndPayments, 
  extractInfoItems 
} from './utils';

export async function syncSingleBooking(externalId: string): Promise<void> {
  try {
    // Get single booking data from Beds24
    const bookings = await fetchBookingsPaged();
    const booking = bookings.find(b => String(b.id) === String(externalId));
    
    if (!booking) {
      logger.warn({ externalId }, 'Booking not found in Beds24');
      return;
    }

    const reservationData = buildReservationData(booking, new Map());
    
    // Determine target table based on status
    if (booking.status === 'cancelled' || booking.status === 'black') {
      await prisma.reservationsCancelled.upsert({
        where: { bookingId: String(booking.id) },
        update: reservationData,
        create: reservationData
      });
    } else {
      // For now, put other statuses in confirmed future
      await prisma.reservationsConfirmedFuture.upsert({
        where: { bookingId: String(booking.id) },
        update: reservationData,
        create: reservationData
      });
    }
    logger.info({ externalId, status: booking.status }, 'Single booking synced');
  } catch (error: any) {
    logger.error({ externalId, error: error.message }, 'Failed to sync single booking');
    throw error;
  }
}

export async function syncCancelledReservations(dateFrom?: string, dateTo?: string): Promise<{ processed: number; upserted: number }> {
  const startTime = Date.now();
  logger.info({ dateFrom, dateTo }, 'Starting cancelled reservations sync');
  
  const cancelledStatuses = ['cancelled', 'black'];
  const bookings = await fetchBookingsPaged(
    dateFrom || '2023-01-01', 
    dateTo || '2025-12-31', 
    true, // useModified for cancelled
    cancelledStatuses
  );

  const properties = await getAllProperties();
  const propertyMap = new Map(properties.map(p => [p.id, p]));

  let processed = 0;
  let upserted = 0;

  for (const booking of bookings) {
    // Phone filter (minimum 4 digits)
    const phone = (booking.phone || booking.mobile || booking.guestPhone || '').toString().trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 4) continue;

    // Name filter (at least one name field)
    const hasName = (booking.firstName && booking.firstName.trim()) || 
                   (booking.lastName && booking.lastName.trim()) || 
                   (booking.title && booking.title.trim());
    if (!hasName) continue;

    const reservationData = buildReservationData(booking, propertyMap);
    
    await prisma.reservationsCancelled.upsert({
      where: { bookingId: String(booking.id) },
      update: reservationData,
      create: reservationData
    });

    processed++;
    upserted++;
  }

  const duration = Date.now() - startTime;
  logger.info({ processed, upserted, duration, rate: Math.round(processed / (duration / 1000)) }, 'Cancelled reservations sync completed');
  return { processed, upserted };
}

export async function syncLeadsAndConfirmed(dateFrom?: string, dateTo?: string): Promise<{ confirmed: number; leads: number; skipped: number }> {
  const startTime = Date.now();
  logger.info({ dateFrom, dateTo }, 'Starting leads and confirmed sync');

  const today = new Date();
  const defaultFrom = today.toISOString().split('T')[0];
  const sixMonthsLater = new Date(today.getTime() + (180 * 24 * 60 * 60 * 1000));
  const defaultTo = sixMonthsLater.toISOString().split('T')[0];

  const bookings = await fetchBookingsPaged(
    dateFrom || defaultFrom,
    dateTo || defaultTo,
    false, // use arrival dates
    ['confirmed', 'new']
  );

  let confirmedCount = 0;
  let leadsCount = 0;
  let skippedCount = 0;

  for (const booking of bookings) {
    // Filter future bookings only
    const departure = formatDateSimple(booking.departure);
    if (!departure || departure <= today.toISOString().split('T')[0]) {
      skippedCount++;
      continue;
    }

    // Phone filter
    const phone = (booking.phone || booking.mobile || booking.guestPhone || '').toString().trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 4) {
      skippedCount++;
      continue;
    }

    // Name filter
    const hasName = (booking.firstName && booking.firstName.trim()) || 
                   (booking.lastName && booking.lastName.trim()) || 
                   (booking.title && booking.title.trim());
    if (!hasName) {
      skippedCount++;
      continue;
    }

    const commonData = buildReservationData(booking, new Map());
    const totalCharges = sumMoney(booking.invoiceItems, 'charge');
    const totalPayments = sumMoney(booking.invoiceItems, 'payment');
    
    const channel = booking.apiSource || booking.channel || 
                   (booking.referer && String(booking.referer).toLowerCase() !== 'direct' ? booking.referer : 'Directa');
    
    const isAirbnbOrExpedia = 
      channel?.toLowerCase().includes('airbnb') ||
      channel?.toLowerCase().includes('expedia');
    
    const hasPayments = totalPayments > 0;

    if (hasPayments || isAirbnbOrExpedia) {
      // Confirmed reservation
      await prisma.reservationsConfirmedFuture.upsert({
        where: { bookingId: String(booking.id) },
        update: commonData,
        create: commonData
      });
      confirmedCount++;
    } else if (booking.status === 'confirmed' || booking.status === 'new') {
      // Lead (no payments, not Airbnb/Expedia)
      const arrivalDateObj = new Date(formatDateSimple(booking.arrival) || '2025-12-31');
      const daysUntilArrival = Math.ceil((arrivalDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let priority = 'medium';
      if (daysUntilArrival <= 7) priority = 'high';
      else if (totalCharges > 200000) priority = 'high';
      else if (daysUntilArrival > 30) priority = 'low';

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
        where: { bookingId: String(booking.id) },
        update: leadData,
        create: leadData
      });
      leadsCount++;
    } else {
      skippedCount++;
    }
  }

  const duration = Date.now() - startTime;
  const totalProcessed = confirmedCount + leadsCount;
  logger.info({ 
    confirmed: confirmedCount, 
    leads: leadsCount, 
    skipped: skippedCount, 
    duration, 
    rate: Math.round(totalProcessed / (duration / 1000))
  }, 'Leads and confirmed sync completed');
  return { confirmed: confirmedCount, leads: leadsCount, skipped: skippedCount };
}

function buildReservationData(booking: Beds24Booking, propertyMap: Map<number, any>) {
  const phone = (booking.phone || booking.mobile || booking.guestPhone || '').toString().trim();
  const guestName = [booking.title, booking.firstName, booking.lastName].filter(Boolean).join(' ').trim() || null;
  const property = propertyMap.get(booking.propertyId || 0);
  const propertyName = property?.name || null;
  
  const arrivalDate = formatDateSimple(booking.arrival);
  const departureDate = formatDateSimple(booking.departure);
  const numNights = booking.numNights || null;
  const totalPersons = (Number(booking.numAdult||0) + Number(booking.numChild||0)) || null;
  
  const bookingDate = formatDateSimple(booking.bookingTime);
  const modifiedDate = formatDateSimple(booking.modifiedTime);
  
  const channel = booking.apiSource || booking.channel || 
                 (booking.referer && String(booking.referer).toLowerCase() !== 'direct' ? booking.referer : 'Directa');
  
  const totalCharges = sumMoney(booking.invoiceItems, 'charge');
  const totalPayments = sumMoney(booking.invoiceItems, 'payment');
  const balance = totalCharges - totalPayments;
  const basePrice = booking.price ? parseFloat(String(booking.price)) : 0;
  
  const { charges, payments } = extractChargesAndPayments(booking.invoiceItems);
  const infoItems = extractInfoItems(booking.infoItems);

  return {
    bookingId: String(booking.id),
    phone,
    guestName,
    status: booking.status || null,
    internalNotes: booking.message || null,
    propertyName,
    arrivalDate,
    departureDate,
    numNights,
    totalPersons,
    totalCharges: totalCharges ? sanitizeAmount(Math.round(totalCharges)) : null,
    totalPayments: totalPayments ? sanitizeAmount(Math.round(totalPayments)) : null,
    balance: balance ? sanitizeAmount(Math.round(balance)) : null,
    basePrice: basePrice ? sanitizeAmount(Math.round(basePrice)) : null,
    channel,
    email: booking.email || null,
    country: booking.country || null,
    guestLang: booking.lang || null,
    apiReference: booking.apiReference || null,
    charges: charges,
    payments: payments,
    messages: [], // Messages disabled temporarily
    infoItems: infoItems,
    notes: booking.notes || null,
    bookingDate,
    modifiedDate,
    raw: booking as any
  };
}

