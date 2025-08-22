/**
 * Ejemplo de script provisional para Beds24.
 * No se carga en el runtime del bot.
 */
// import { getBeds24Config } from '../../../../config/integrations/beds24.config'; // CONFIG NO DISPONIBLE
import { Beds24Client } from '../../services/beds24-client'; // USAR CLIENT UNIFICADO

export async function fetchExampleCalendar(): Promise<void> {
  // Usar el client unificado del hotel plugin
  const client = new Beds24Client();

  // Ejemplo de uso del client unificado
  // const result = await client.searchAvailability({ arrival: '2025-08-20', departure: '2025-08-25', numAdults: 2 });
  console.log('Beds24 example: client unificado listo para usar');
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


