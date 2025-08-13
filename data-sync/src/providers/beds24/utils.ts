import { logger } from '../../utils/logger';

export function parseDate(d?: string): Date | null {
  if (!d) return null;
  const isoLike = /^\d{4}-\d{2}-\d{2}/.test(d) ? d : new Date(d).toISOString();
  const date = new Date(isoLike);
  return isNaN(date.getTime()) ? null : date;
}

export function formatDateSimple(d?: string): string | null {
  if (!d) return null;
  const date = parseDate(d);
  if (!date) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export function sumMoney(items: any[], type: 'charge'|'payment'): number {
  if (!items || !Array.isArray(items)) return 0;
  return items
    .filter(i => i?.type === type)
    .reduce((acc, i) => acc + (typeof i?.amount === 'string' ? parseFloat(i!.amount) : (i?.amount || 0)), 0);
}

export function sanitizeAmount(amount: any): string {
  if (!amount) return '0';
  const cleaned = String(amount).replace(/[^\d.-]/g, '');
  return cleaned || '0';
}

export function extractChargesAndPayments(invoiceItems: any[]) {
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

export function extractInfoItems(infoItems: any[]): any[] {
  if (!infoItems || !Array.isArray(infoItems)) return [];
  
  return infoItems.map(item => ({
    code: item.code || '',
    text: item.text || '',
    time: item.createTime || null
  })).filter(item => item.code || item.text);
}

export function mapSourceToDirection(source: string): string {
  switch (source) {
    case 'guest': return 'in';
    case 'host': return 'out';
    case 'internalNote':
    case 'system': 
    default: return 'system';
  }
}