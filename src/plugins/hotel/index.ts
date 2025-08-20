// src/plugins/hotel/hotel.plugin.ts
import { IFunctionRegistry } from '../../shared/interfaces';
import { checkAvailability } from './functions/check-availability';
import { checkBookingDetailsFunction } from './functions/check-booking-details';
import { createNewBookingFunction } from './functions/create-new-booking';
import { editBookingFunction } from './functions/edit-booking';
import { informarMovimientoMananaFunction } from './functions/informar-movimiento-manana';
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
        console.log('🔌 hotel-plugin registering 5 functions...');
        
        try {
            registry.register('check_availability', (args, context) => 
                checkAvailability(args as { startDate: string; endDate: string; numAdults: number }),
                source
            );

            registry.register('check_booking_details', (args, context) =>
                checkBookingDetailsFunction.handler(args as { firstName: string; lastName: string; checkInDate: string }),
                source
            );

            registry.register('create_new_booking', (args, context) =>
                createNewBookingFunction.handler(args as any),
                source
            );

            registry.register('edit_booking', (args, context) =>
                editBookingFunction.handler(args as any),
                source
            );

            registry.register('informar_movimiento_manana', (args, context) =>
                informarMovimientoMananaFunction.handler(args as any),
                source
            );

            console.log('🔌 hotel-plugin ✓ 5 functions registered successfully');
        } catch (error) {
            console.error('❌ Error registering hotel-plugin functions:', error);
            console.log('🔌 hotel-plugin ✓ 2 functions (partial due to errors)');
        }

        // Log técnico consolidado
        const { logSuccess } = require('../../utils/logging');
        logSuccess('PLUGIN_REGISTERED', 'hotel-plugin ✓ 5 functions', {
            plugin: 'hotel-plugin',
            functions: ['check_availability', 'check_booking_details', 'create_new_booking', 'edit_booking', 'informar_movimiento_manana'],
            source: source || 'hotel-plugin'
        }, 'index.ts');
    }
}