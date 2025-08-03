// Tipos base de la API
export interface Beds24ApiResponse<T> {
    success: boolean;
    type?: string;
    count?: number;
    pages?: {
        nextPageExists: boolean;
        nextPageLink: string;
    };
    data?: T[];
    code?: number;
    error?: string;
}

// Tipos para disponibilidad
export interface RoomAvailability {
    roomId: number;
    propertyId: number;
    name: string;
    availability: {
        [date: string]: boolean; // "2021-01-01": true
    };
}

export interface AvailabilityQuery {
    roomId?: number[];
    propertyId?: number[];
    startDate: string; // formato: YYYY-MM-DD
    endDate: string;   // formato: YYYY-MM-DD
}

// Tipos para habitaciones
export interface Room {
    id: number;
    propertyId: number;
    name: string;
    roomType: string;
    qty: number;
    minPrice: number;
    maxPeople: number;
    maxAdult: number;
    maxChildren: number;
    minStay: number;
    maxStay: number;
    rackRate?: number;
    cleaningFee?: number;
    securityDeposit?: number;
    roomSize?: number;
    texts?: RoomText[];
    units?: RoomUnit[];
    priceRules?: PriceRule[];
}

export interface RoomText {
    language: string;
    displayName: string;
    roomDescription?: string;
    accommodationType?: string;
}

export interface RoomUnit {
    id: number;
    name: string;
    statusColor?: string;
    statusText?: string;
    note?: string;
}

export interface PriceRule {
    id: number;
    name: string;
    minimumStay?: number;
    maximumStay?: number;
    extraPerson?: number;
    extraChild?: number;
}

// Tipos para propiedades
export interface Property {
    id: number;
    name: string;
    rooms?: Room[];
}

// Tipos transformados para el bot
export interface AvailabilityInfo {
    propertyName: string;
    roomName: string;
    available: boolean;
    dateRange: {
        from: string;
        to: string;
    };
    availableDates: string[];
    unavailableDates: string[];
    totalDays: number;
    availableDays: number;
    priceInfo?: {
        minPrice?: number;
        cleaningFee?: number;
        securityDeposit?: number;
    };
}

// Configuración del servicio
export interface Beds24Config {
    apiUrl: string;
    apiToken: string;
}

// Tipos para errores
export class Beds24Error extends Error {
    constructor(
        message: string,
        public code?: number,
        public details?: any
    ) {
        super(message);
        this.name = 'Beds24Error';
    }
} 