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

    public register(registry: IFunctionRegistry): void {
        console.log('🔌 Registrando funciones del plugin hotelero...');

        registry.register('check_availability', (args, context) => 
            checkAvailability(args as { startDate: string; endDate: string; guests?: number })
        );

        console.log('✅ Funciones hoteleras registradas.');
    }
}