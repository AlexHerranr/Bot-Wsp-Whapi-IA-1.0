// src/plugins/hotel/functions/generate-invoice-pdf/__tests__/pdf-generation.test.ts
import { generateInvoicePDF } from '../generate-invoice-pdf';
import { PDFGeneratorService } from '../../services/pdf-generator.service';

// Mock del servicio PDF
jest.mock('../../services/pdf-generator.service');

describe('PDF Generation System', () => {
  const mockPDFService = PDFGeneratorService as jest.MockedClass<typeof PDFGeneratorService>;
  
  const validParams = {
    bookingId: 'RES-001',
    guestName: 'Juan Pérez',
    email: 'juan@example.com',
    checkInDate: '2024-01-15',
    checkOutDate: '2024-01-17',
    roomName: 'Apartamento Premium',
    nights: 2,
    totalCharges: '$400,000 COP',
    invoiceItems: [
      {
        description: 'Hospedaje 2 noches',
        quantity: '2',
        unitPrice: '$200,000',
        totalAmount: '$400,000'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validación de parámetros', () => {
    it('should reject missing bookingId', async () => {
      const result = await generateInvoicePDF({
        ...validParams,
        bookingId: ''
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('bookingId es requerido');
    });

    it('should reject missing required fields', async () => {
      const result = await generateInvoicePDF({
        bookingId: 'RES-001',
        guestName: '',
        email: '',
        checkInDate: '',
        checkOutDate: '',
        roomName: '',
        nights: 0,
        totalCharges: '',
        invoiceItems: []
      });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.context.errors).toHaveLength(7);
    });

    it('should accept valid parameters', async () => {
      const mockGenerateInvoicePDF = jest.fn().mockResolvedValue({
        success: true,
        pdfBuffer: Buffer.from('fake-pdf'),
        size: 1024
      });
      
      mockPDFService.prototype.generateInvoicePDF = mockGenerateInvoicePDF;

      const result = await generateInvoicePDF(validParams);
      
      expect(result.success).toBe(true);
      expect(mockGenerateInvoicePDF).toHaveBeenCalledTimes(1);
    });
  });

  describe('Generación exitosa', () => {
    beforeEach(() => {
      mockPDFService.prototype.generateInvoicePDF = jest.fn().mockResolvedValue({
        success: true,
        pdfBuffer: Buffer.from('fake-pdf-content'),
        size: 2048,
        pdfPath: '/tmp/invoice-RES-001-123456.pdf'
      });
    });

    it('should generate PDF successfully', async () => {
      const result = await generateInvoicePDF(validParams);
      
      expect(result.success).toBe(true);
      expect(result.data?.bookingId).toBe('RES-001');
      expect(result.data?.size).toBe('2.0 KB');
      expect(result.data?.efficiency).toMatch(/🚀|⚡|🐌/);
      expect(result.message).toContain('✅ PDF generado exitosamente');
    });

    it('should include PDF path when saveToFile is true', async () => {
      const result = await generateInvoicePDF({
        ...validParams,
        saveToFile: true
      });
      
      expect(result.success).toBe(true);
      expect(result.pdfPath).toBe('/tmp/invoice-RES-001-123456.pdf');
      expect(result.message).toContain('📁 Archivo:');
    });

    it('should include PDF buffer when returnBuffer is true', async () => {
      const result = await generateInvoicePDF({
        ...validParams,
        returnBuffer: true
      });
      
      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should determine correct document type', async () => {
      const testCases = [
        { triggerFunction: 'create_new_booking', expected: 'CONFIRMACIÓN DE RESERVA' },
        { triggerFunction: 'add_payment_booking', expected: 'COMPROBANTE DE PAGO' },
        { triggerFunction: 'confirm_booking', expected: 'RESERVA CONFIRMADA' },
        { triggerFunction: undefined, expected: 'FACTURA' }
      ];

      for (const testCase of testCases) {
        const result = await generateInvoicePDF({
          ...validParams,
          triggerFunction: testCase.triggerFunction as any
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.documentType).toBe(testCase.expected);
      }
    });
  });

  describe('Manejo de errores', () => {
    it('should handle PDF service errors gracefully', async () => {
      mockPDFService.prototype.generateInvoicePDF = jest.fn().mockResolvedValue({
        success: false,
        error: 'Template not found'
      });

      const result = await generateInvoicePDF(validParams);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PDF_GENERATION_ERROR');
      expect(result.error?.message).toContain('Template not found');
    });

    it('should handle unexpected errors', async () => {
      mockPDFService.prototype.generateInvoicePDF = jest.fn().mockRejectedValue(
        new Error('Puppeteer launch failed')
      );

      const result = await generateInvoicePDF(validParams);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNEXPECTED_ERROR');
      expect(result.error?.context.errorType).toBe('Error');
      expect(result.error?.message).toContain('Puppeteer launch failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockPDFService.prototype.generateInvoicePDF = jest.fn().mockRejectedValue(
        'String error'
      );

      const result = await generateInvoicePDF(validParams);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNEXPECTED_ERROR');
      expect(result.error?.context.errorType).toBe('UnknownError');
    });
  });

  describe('Métricas de rendimiento', () => {
    it('should classify performance correctly', async () => {
      // Mock para simular tiempo lento
      const slowMock = jest.fn().mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            pdfBuffer: Buffer.from('pdf'),
            size: 1024
          }), 100); // 100ms delay
        })
      );
      
      mockPDFService.prototype.generateInvoicePDF = slowMock;

      const result = await generateInvoicePDF(validParams);
      
      expect(result.success).toBe(true);
      expect(result.data?.efficiency).toBeTruthy();
      expect(['🚀 Rápido', '⚡ Normal', '🐌 Lento']).toContain(result.data?.efficiency);
    });
  });
});

describe('PDFGeneratorService Integration', () => {
  let service: PDFGeneratorService;

  beforeEach(() => {
    service = new PDFGeneratorService();
  });

  describe('Template loading and caching', () => {
    it('should load template successfully', async () => {
      const template = await service.loadTemplate();
      
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
      expect(template).toContain('<!doctype html>');
    });

    it('should cache template after first load', async () => {
      const template1 = await service.loadTemplate();
      const template2 = await service.loadTemplate();
      
      expect(template1).toBe(template2);
    });
  });

  describe('Data validation', () => {
    it('should validate required fields', () => {
      const errors = service.validateInvoiceData({});
      
      expect(errors).toHaveLength(7);
      expect(errors).toContain('bookingId es requerido');
      expect(errors).toContain('guestName es requerido');
      expect(errors).toContain('email es requerido');
    });

    it('should pass validation with complete data', () => {
      const errors = service.validateInvoiceData({
        bookingId: 'RES-001',
        guestName: 'Juan Pérez',
        email: 'juan@example.com',
        checkInDate: '2024-01-15',
        checkOutDate: '2024-01-17',
        roomName: 'Apartamento Premium',
        totalCharges: '$400,000',
        invoiceItems: [{ description: 'Test', totalAmount: '$100,000' }]
      });
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('Cache management', () => {
    it('should clear cache properly', async () => {
      // Load template to populate cache
      await service.loadTemplate();
      
      // Clear cache
      service.clearCache();
      
      // Should load fresh template
      const template = await service.loadTemplate();
      expect(typeof template).toBe('string');
    });
  });
});