/**
 * Ejemplo de script provisional para WHAPI.
 * No se carga en el runtime del bot.
 */
import fetch from 'node-fetch';

const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';

export async function probeProfile(phone: string): Promise<void> {
  if (!WHAPI_TOKEN) throw new Error('WHAPI_TOKEN no está configurado');
  const url = `${WHAPI_API_URL}/messages/profile?phone=${encodeURIComponent(phone)}`;
  const res = await fetch(url, {
    headers: { Authorization: WHAPI_TOKEN }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHAPI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  console.log('Perfil:', JSON.stringify(data, null, 2));
}

// Descomenta para ejecución directa temporal
// (async () => {
//   try {
//     await probeProfile('57300XXXXXXX');
//   } catch (err) {
//     console.error(err);
//     process.exit(1);
//   }
// })();


