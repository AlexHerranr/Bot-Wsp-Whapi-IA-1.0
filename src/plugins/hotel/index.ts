// src/plugins/hotel/hotel.plugin.ts
import { IFunctionRegistry } from '../../shared/interfaces';
import { checkAvailability } from './functions/check-availability/check-availability';
import { checkBookingDetailsFunction } from './functions/check-booking-details/check-booking-details';
import { createNewBookingFunction } from './functions/create-new-booking/create-new-booking';
import { editBookingFunction } from './functions/edit-booking/edit-booking';
import { cancelBooking } from './functions/cancel-booking/cancel-booking';
import { informarMovimientoMananaFunction } from './functions/informar-movimiento-manana/informar-movimiento-manana';
import { generateBookingConfirmationPDFFunction } from './functions/generate-booking-confirmation-pdf/generate-booking-confirmation-pdf';
import { generatePaymentReceiptPDFFunction } from './functions/generate-payment-receipt-pdf/generate-payment-receipt-pdf';
import { HotelContext } from './logic/context';
import { HotelValidation } from './logic/validation';
import { HotelLabels } from './logic/labels';

export class HotelPlugin {
    public readonly context: HotelContext;
    public readonly validation: HotelValidation;
    public readonly labels: HotelLabels;

    constructor() {
        this.context = new HotelContext();
        this.validation = new HotelValidation();
        this.labels = new HotelLabels();
    }

    public register(registry: IFunctionRegistry, source?: string): void {
        console.log('🔌 hotel-plugin registering 8 functions...');
        
        try {
            registry.register('check_availability', (args, context) => 
                checkAvailability(args as { startDate: string; endDate: string; numAdults: number }),
                source
            );

            registry.register('check_booking_details', (args, context) =>
                checkBookingDetailsFunction.handler(args as { firstName: string; lastName: string; checkInDate: string }),
                source
            );

            registry.register('create_new_booking', async (args, context) => {
                // Importar directamente la función que acepta context
                const { createNewBooking } = require('./functions/create-new-booking/create-new-booking');
                const result = await createNewBooking(args as any, context);
                return JSON.stringify(result);
            }, source);

            registry.register('edit_booking', async (args, context) => {
                const result = await editBookingFunction.handler(args as any);
                return JSON.stringify(result);
            }, source);

            registry.register('cancel_booking', async (args, context) => {
                const result = await cancelBooking(args as any);
                return JSON.stringify(result);
            }, source);

            registry.register('informar_movimiento_manana', (args, context) =>
                informarMovimientoMananaFunction.handler(args as any), source);

            registry.register('generate_booking_confirmation_pdf', async (args, context) => {
                // Importar directamente la función que acepta context
                const { generateBookingConfirmationPDF } = require('./functions/generate-booking-confirmation-pdf/generate-booking-confirmation-pdf');
                const result = await generateBookingConfirmationPDF(args as any, context);
                // IMPORTANTE: Retornar el objeto completo, NO hacer stringify aquí
                // OpenAI service se encargará de manejar el attachment y hacer el stringify correcto
                return result;
            }, source);

            registry.register('generate_payment_receipt_pdf', async (args, context) => {
                // Importar directamente la función que acepta context
                const { generatePaymentReceiptPDF } = require('./functions/generate-payment-receipt-pdf/generate-payment-receipt-pdf');
                const result = await generatePaymentReceiptPDF(args as any, context);
                // IMPORTANTE: Retornar el objeto completo, NO hacer stringify aquí
                // OpenAI service se encargará de manejar el attachment y hacer el stringify correcto
                return result;
            }, source);

            console.log('🔌 hotel-plugin ✓ 8 functions registered successfully');
        } catch (error) {
            console.error('❌ Error registering hotel-plugin functions:', error);
            console.log('🔌 hotel-plugin ✓ 2 functions (partial due to errors)');
        }

        // Log técnico consolidado
        const { logSuccess } = require('../../utils/logging');
        logSuccess('PLUGIN_REGISTERED', 'hotel-plugin ✓ 8 functions', {
            plugin: 'hotel-plugin',
            functions: ['check_availability', 'check_booking_details', 'create_new_booking', 'edit_booking', 'cancel_booking', 'informar_movimiento_manana', 'generate_booking_confirmation_pdf', 'generate_payment_receipt_pdf'],
            source: source || 'hotel-plugin'
        }, 'index.ts');
    }
}