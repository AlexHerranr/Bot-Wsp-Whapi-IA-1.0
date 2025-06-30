import fs from 'fs/promises';
import path from 'path';

interface GuestProfile {
  phoneNumber: string;
  name?: string;
  lastInteraction: Date;
  conversationSummary: string;
  // Añadir más campos según necesidad
}

export class GuestMemoryService {
  private dataDir = path.join(process.cwd(), 'data');
  private dataPath = path.join(this.dataDir, 'guests.json');
  private profiles: Map<string, GuestProfile> = new Map();

  constructor() {
    this.ensureDataDirExists();
  }

  private async ensureDataDirExists() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log(`Directorio de datos creado en: ${this.dataDir}`);
    }
  }

  async loadProfiles(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      const profiles = JSON.parse(data, (key, value) => {
        if (key === 'lastInteraction') return new Date(value);
        return value;
      });
      this.profiles = new Map(Object.entries(profiles));
      console.log('Perfiles de invitados cargados.');
    } catch {
      console.log('No se encontró archivo de perfiles, se creará uno nuevo.');
      await this.saveProfiles();
    }
  }

  async getOrCreateProfile(phoneNumber: string): Promise<GuestProfile> {
    if (!this.profiles.has(phoneNumber)) {
      this.profiles.set(phoneNumber, {
        phoneNumber,
        lastInteraction: new Date(),
        conversationSummary: '',
      });
    }
    return this.profiles.get(phoneNumber)!;
  }

  async updateProfile(phoneNumber: string, updates: Partial<GuestProfile>): Promise<void> {
    const profile = await this.getOrCreateProfile(phoneNumber);
    Object.assign(profile, updates);
    await this.saveProfiles();
  }

  private async saveProfiles(): Promise<void> {
    const data = Object.fromEntries(this.profiles);
    await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
  }
}
