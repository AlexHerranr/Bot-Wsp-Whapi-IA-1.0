// src/plugins/hotel/logic/labels.ts

export class HotelLabels {
    private readonly HOTEL_LABELS = [
        'Potencial',
        'Consulta',
        'Reservado',
        'VIP',
        'Check-in',
        'Check-out',
        'Cancelado',
        'Repetidor'
    ];

    public getAvailableLabels(): string[] {
        return [...this.HOTEL_LABELS];
    }

    public isHotelLabel(label: string): boolean {
        return this.HOTEL_LABELS.includes(label);
    }
}