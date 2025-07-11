
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logError } from '../utils/logger';

// TODO: Reemplazar con el ID de tu proyecto de Google Cloud
const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID || 'gen-lang-client-0318357688';

export interface AppSecrets {
    OPENAI_API_KEY: string;
    ASSISTANT_ID: string;
    WHAPI_TOKEN: string;
    WHAPI_API_URL: string;
    BEDS24_TOKEN: string;
    BEDS24_API_URL: string;
}

// Variable para cachear los secretos una vez obtenidos
let cachedSecrets: AppSecrets | null = null;

/**
 * Accede a la última versión de un secreto en Google Secret Manager.
 * @param client El cliente de Secret Manager.
 * @param name El nombre del secreto.
 * @returns El payload del secreto como string.
 */
const accessSecretVersion = async (client: SecretManagerServiceClient, name: string): Promise<string> => {
    try {
        const [version] = await client.accessSecretVersion({
            name: `projects/${GCLOUD_PROJECT_ID}/secrets/${name}/versions/latest`,
        });
        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error(`El secreto ${name} está vacío.`);
        }
        return payload;
    } catch (error) {
        logError('SECRET_MANAGER', `Error al acceder al secreto ${name}`, { error });
        throw error;
    }
};

/**
 * Obtiene los secretos de la aplicación, ya sea desde la caché o desde Google Secret Manager.
 * En un entorno local, los obtiene desde las variables de entorno para facilitar el desarrollo.
 * 
 * @IMPORTANT: ¡NUNCA expongas las claves directamente en el código!
 * Esta función es el ÚNICO lugar donde se deben manejar los secretos.
 * @returns Un objeto con todos los secretos de la aplicación.
 */
export const getSecrets = async (): Promise<AppSecrets> => {
    // Si ya tenemos los secretos en caché, los devolvemos.
    if (cachedSecrets) {
        return cachedSecrets;
    }

    // En entorno local, usar variables de entorno para facilitar el desarrollo.
    // En producción, SIEMPRE usar un gestor de secretos.
    if (process.env.NODE_ENV !== 'production' && process.env.K_SERVICE === undefined) {
        console.warn('Cargando secretos desde variables de entorno (solo para desarrollo local)');
        cachedSecrets = {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
            ASSISTANT_ID: process.env.ASSISTANT_ID!,
            WHAPI_TOKEN: process.env.WHAPI_TOKEN!,
            WHAPI_API_URL: process.env.WHAPI_API_URL!,
            BEDS24_TOKEN: process.env.BEDS24_TOKEN!,
            BEDS24_API_URL: process.env.BEDS24_API_URL!,
        };
        
        // Validar que todas las variables necesarias estén presentes
        for (const [key, value] of Object.entries(cachedSecrets)) {
            if (!value) {
                throw new Error(`Falta la variable de entorno para desarrollo: ${key}`);
            }
        }
        
        return cachedSecrets;
    }
    
    // En producción (Cloud Run), obtener los secretos desde Google Secret Manager.
    console.log('Cargando secretos desde Google Secret Manager...');
    const client = new SecretManagerServiceClient();

    try {
        const [
            openaiApiKey,
            assistantId,
            whapiToken,
            whapiUrl,
            beds24Token,
            beds24ApiUrl,
        ] = await Promise.all([
            accessSecretVersion(client, 'OPENAI_API_KEY'),
            accessSecretVersion(client, 'ASSISTANT_ID'),
            accessSecretVersion(client, 'WHAPI_TOKEN'),
            accessSecretVersion(client, 'WHAPI_API_URL'),
            accessSecretVersion(client, 'BEDS24_TOKEN'),
            accessSecretVersion(client, 'BEDS24_API_URL'),
        ]);

        cachedSecrets = {
            OPENAI_API_KEY: openaiApiKey,
            ASSISTANT_ID: assistantId,
            WHAPI_TOKEN: whapiToken,
            WHAPI_API_URL: whapiUrl,
            BEDS24_TOKEN: beds24Token,
            BEDS24_API_URL: beds24ApiUrl,
        };
        
        console.log('Secretos cargados y cacheados exitosamente desde Secret Manager.');
        return cachedSecrets;
    } catch (error) {
        logError('SECRET_MANAGER', 'Fallo catastrófico al cargar secretos desde Secret Manager. El sistema no puede iniciar.', { error });
        // En caso de fallo, detener la aplicación es la opción más segura.
        process.exit(1);
    }
};

/**
 * Valida que los secretos se hayan cargado correctamente.
 * Es una función ligera que solo comprueba si la caché existe.
 * @returns {boolean} True si los secretos están listos, false en caso contrario.
 */
export const areSecretsLoaded = (): boolean => {
    return cachedSecrets !== null;
}; 