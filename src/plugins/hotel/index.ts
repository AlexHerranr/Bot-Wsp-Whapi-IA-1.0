// src/plugins/hotel/hotel.plugin.ts
import { IFunctionRegistry } from '../../shared/interfaces';
import { checkAvailability } from './functions/check-availability/check-availability';
import { checkBookingDetailsFunction } from './functions/check-booking-details/check-booking-details';
import { createNewBookingFunction } from './functions/create-new-booking/create-new-booking';
import { editBookingFunction } from './functions/edit-booking/edit-booking';
import { cancelBooking } from './functions/cancel-booking/cancel-booking';
import { informarMovimientoMananaFunction } from './functions/informar-movimiento-manana/informar-movimiento-manana';
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
        console.log('🔌 hotel-plugin registering 6 functions...');
        
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
                const result = await createNewBookingFunction.handler(args as any);
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
                informarMovimientoMananaFunction.handler(args as any),
                source
            );

            console.log('🔌 hotel-plugin ✓ 6 functions registered successfully');
        } catch (error) {
            console.error('❌ Error registering hotel-plugin functions:', error);
            console.log('🔌 hotel-plugin ✓ 2 functions (partial due to errors)');
        }

        // Log técnico consolidado
        const { logSuccess } = require('../../utils/logging');
        logSuccess('PLUGIN_REGISTERED', 'hotel-plugin ✓ 6 functions', {
            plugin: 'hotel-plugin',
            functions: ['check_availability', 'check_booking_details', 'create_new_booking', 'edit_booking', 'cancel_booking', 'informar_movimiento_manana'],
            source: source || 'hotel-plugin'
        }, 'index.ts');
    }
}