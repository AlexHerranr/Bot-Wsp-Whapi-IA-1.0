// src/plugins/hotel/hotel.plugin.ts
import { IFunctionRegistry } from '../../shared/interfaces';
import { checkAvailability } from './functions/check-availability';
import { checkBookingDetailsFunction } from '../../functions/booking/check-booking-details';
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
        console.log('🔌 hotel-plugin ✓ 2 functions');
        
        registry.register('check_availability', (args, context) => 
            checkAvailability(args as { startDate: string; endDate: string; numAdults: number }),
            source
        );

        registry.register('check_booking_details', (args, context) =>
            checkBookingDetailsFunction.handler(args as { firstName: string; lastName: string; checkInDate: string }),
            source
        );

        // Log técnico consolidado
        const { logSuccess } = require('../../utils/logging');
        logSuccess('PLUGIN_REGISTERED', 'hotel-plugin ✓ 2 functions', {
            plugin: 'hotel-plugin',
            functions: ['check_availability', 'check_booking_details'],
            source: source || 'hotel-plugin'
        }, 'index.ts');
    }
}