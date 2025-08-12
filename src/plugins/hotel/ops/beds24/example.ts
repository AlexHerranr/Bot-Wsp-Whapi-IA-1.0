/**
 * Ejemplo de script provisional para Beds24.
 * No se carga en el runtime del bot.
 */
import { getBeds24Config } from '../../../../config/integrations/beds24.config';
import { Beds24Service } from '../../services/beds24/beds24.service';

export async function fetchExampleCalendar(): Promise<void> {
  const cfg = getBeds24Config();
  const service = new Beds24Service(cfg as any);

  // Reemplaza por el método concreto que exponga Beds24Service cuando lo necesites
  // Ejemplo hipotético: await service.getCalendar({ propertyId: 123, from: '2025-08-20', to: '2025-08-25' });
  console.log('Beds24 example: configuración cargada y cliente listo');
}

// Descomenta para ejecución directa temporal
// (async () => {
//   try {
//     await fetchExampleCalendar();
//   } catch (err) {
//     console.error(err);
//     process.exit(1);
//   }
// })();


