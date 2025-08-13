import axios, { AxiosResponse } from 'axios';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface Beds24Property {
  id: number;
  name: string;
  rooms?: Array<{ id: number; name: string; [key: string]: any }>;
  [key: string]: any;
}

export interface Beds24Booking {
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
  infoItems?: any[];
  [key: string]: any;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryRequest<T>(
  requestFn: () => Promise<T>, 
  retries: number = 3, 
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      if (attempt === retries) throw error;
      
      const delayMs = baseDelay * Math.pow(2, attempt - 1);
      logger.warn({ attempt, error: error.message, delayMs }, 'Retrying Beds24 request');
      await delay(delayMs);
    }
  }
  throw new Error('Max retries exceeded'); // Should never reach here
}

export async function getAllProperties(): Promise<Beds24Property[]> {
  if (!env.BEDS24_TOKEN) throw new Error('BEDS24_TOKEN is required');
  
  return retryRequest(async () => {
    const res: AxiosResponse = await axios.get(`${env.BEDS24_API_URL}/properties`, {
      headers: { accept: 'application/json', token: env.BEDS24_TOKEN },
      timeout: env.BEDS24_TIMEOUT
    });
    
    return Array.isArray(res.data?.data) ? res.data.data : [];
  });
}

export async function getMessagesForBooking(bookingId: string): Promise<any[]> {
  if (!env.BEDS24_TOKEN) return [];
  
  return retryRequest(async () => {
    const res: AxiosResponse = await axios.get(`${env.BEDS24_API_URL}/bookings/messages`, {
      headers: { accept: 'application/json', token: env.BEDS24_TOKEN },
      params: { bookingId: [bookingId], maxAge: 30 },
      timeout: 15000
    });
    
    const messages = Array.isArray(res.data?.data) ? res.data.data : [];
    
    // Filter manually due to Beds24 API bug
    const filteredMessages = messages.filter(msg => 
      String(msg.bookingId) === String(bookingId)
    );
    
    logger.debug({ 
      total: messages.length, 
      filtered: filteredMessages.length, 
      bookingId 
    }, 'Messages fetched from Beds24');
    
    return filteredMessages
      .map(msg => ({
        id: msg.id || 0,
        time: msg.time || null,
        source: msg.source || 'unknown',
        direction: msg.source === 'guest' ? 'in' : msg.source === 'host' ? 'out' : 'system',
        text: msg.message || ''
      }))
      .sort((a, b) => new Date(a.time || 0).getTime() - new Date(b.time || 0).getTime())
      .filter(msg => msg.text.trim().length > 0);
  }, 2, 500); // Shorter retry for messages
}

export async function fetchBookingsPaged(
  dateFrom?: string, 
  dateTo?: string, 
  useModified: boolean = false,
  statuses: string[] = ['confirmed', 'request', 'new', 'cancelled', 'black', 'inquiry']
): Promise<Beds24Booking[]> {
  if (!env.BEDS24_TOKEN) throw new Error('BEDS24_TOKEN is required');

  const qp = [
    'includeInfoItems=true',
    'includeInvoiceItems=true',
    'includeGuests=true',
  ];

  // Add status filters
  statuses.forEach(status => {
    qp.push(`status=${encodeURIComponent(status)}`);
  });

  // Add date filters
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
    const url = `${env.BEDS24_API_URL}/bookings?${queryString}&page=${page}`;
    
    const pageData = await retryRequest(async () => {
      const res: AxiosResponse = await axios.get(url, {
        headers: { accept: 'application/json', token: env.BEDS24_TOKEN },
        timeout: env.BEDS24_TIMEOUT
      });
      return res.data || {};
    });

    const data: Beds24Booking[] = Array.isArray(pageData.data) ? pageData.data : [];
    out.push(...data);

    const hasNext = !!(pageData.pages && pageData.pages.nextPageExists === true);
    if (!hasNext) break;
    
    page += 1;
    // Rate limiting: longer delay every 10 pages
    await delay(page % 10 === 0 ? 2000 : 400);
  }

  logger.info({ 
    total: out.length, 
    pages: page - 1, 
    dateFrom, 
    dateTo, 
    useModified, 
    statuses 
  }, 'Beds24 bookings fetched');

  return out;
}