// src/plugins/hotel/hotel.plugin.ts
import { IFunctionRegistry } from '../../shared/interfaces';
import { checkAvailability } from './functions/check-availability';
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
        console.log('🔌 hotel-plugin ✓ 1 function');
        
        registry.register('check_availability', (args, context) => 
            checkAvailability(args as { startDate: string; endDate: string; numAdults: number }),
            source
        );

        // Log técnico consolidado
        const { logSuccess } = require('../../utils/logging');
        logSuccess('PLUGIN_REGISTERED', 'hotel-plugin ✓ 1 function', {
            plugin: 'hotel-plugin',
            functions: ['check_availability'],
            source: source || 'hotel-plugin'
        }, 'index.ts');
    }
}