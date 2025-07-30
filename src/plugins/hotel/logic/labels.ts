// src/plugins/hotel/logic/labels.ts
import { ILabelManager } from '../../../shared/interfaces';

export class HotelLabels implements ILabelManager {
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

    // SQL-integrated label management methods
    public async getLabels(userId: string): Promise<string[]> {
        try {
            // TODO: Integrate with DatabaseService to fetch labels from SQL
            // For now, return default hotel labels as fallback
            console.log(`Fetching hotel labels for user ${userId} from SQL...`);
            return [...this.HOTEL_LABELS];
        } catch (error) {
            console.error('Error fetching hotel labels from SQL, using memory fallback:', error);
            return [...this.HOTEL_LABELS];
        }
    }

    public async setLabels(userId: string, labels: string[]): Promise<void> {
        try {
            // Validate that labels are hotel-specific
            const validLabels = labels.filter(label => this.isHotelLabel(label));
            
            if (validLabels.length !== labels.length) {
                console.warn(`Some labels for user ${userId} are not hotel-specific and were filtered out`);
            }

            // TODO: Integrate with DatabaseService to persist labels to SQL
            console.log(`Saving hotel labels for user ${userId} to SQL:`, validLabels);
            
            // SQL persistence would go here
            // await this.databaseService.saveUserLabels(userId, validLabels);
            
        } catch (error) {
            console.error('Error saving hotel labels to SQL:', error);
            throw error;
        }
    }

    public async addLabel(userId: string, label: string): Promise<void> {
        if (!this.isHotelLabel(label)) {
            throw new Error(`Label '${label}' is not a valid hotel label`);
        }

        const currentLabels = await this.getLabels(userId);
        if (!currentLabels.includes(label)) {
            await this.setLabels(userId, [...currentLabels, label]);
        }
    }

    public async removeLabel(userId: string, label: string): Promise<void> {
        const currentLabels = await this.getLabels(userId);
        const updatedLabels = currentLabels.filter(l => l !== label);
        await this.setLabels(userId, updatedLabels);
    }
}