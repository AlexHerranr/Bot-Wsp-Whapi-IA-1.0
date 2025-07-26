/**
 * Validador de respuestas post-generación
 * Corrige discrepancias entre datos de BEDS24 y respuestas de OpenAI
 */

interface ApartmentReference {
  original: string;
  corrected?: string;
}

/**
 * Extrae nombres de apartamentos de un texto
 */
function extractApartmentNames(text: string): string[] {
  // Regex para detectar patrones como "Apartamento 1722-A", "Apartaestudio 1722-B", etc.
  const apartmentRegex = /(?:Apartamento|Apartaestudio|Apto\.?)\s+(\d{3,4}-[A-Z])/gi;
  const matches = text.matchAll(apartmentRegex);
  return Array.from(matches, match => match[1]); // Solo el código (ej: "1722-A")
}

/**
 * Corrige nombres de apartamentos en la respuesta de OpenAI basándose en datos originales
 */
export function validateAndCorrectResponse(
  openaiResponse: string, 
  originalToolOutputs: string[]
): { 
  correctedResponse: string; 
  corrections: ApartmentReference[]; 
  hadErrors: boolean 
} {
  
  // Extraer apartamentos de los outputs originales de BEDS24
  const originalApartments = new Set<string>();
  originalToolOutputs.forEach(output => {
    const apartments = extractApartmentNames(output);
    apartments.forEach(apt => originalApartments.add(apt));
  });

  // Si no hay apartamentos en los datos originales, no hay nada que validar
  if (originalApartments.size === 0) {
    return {
      correctedResponse: openaiResponse,
      corrections: [],
      hadErrors: false
    };
  }

  // Extraer apartamentos de la respuesta de OpenAI
  const responseApartments = extractApartmentNames(openaiResponse);
  
  // Buscar discrepancias
  const corrections: ApartmentReference[] = [];
  let correctedResponse = openaiResponse;
  let hadErrors = false;

  responseApartments.forEach(responseApt => {
    // Buscar si existe exactamente en los originales
    if (!originalApartments.has(responseApt)) {
      // Buscar el apartamento correcto más similar (mismo número, diferente letra)
      const apartmentNumber = responseApt.split('-')[0];
      const correctApartment = Array.from(originalApartments).find(orig => 
        orig.startsWith(apartmentNumber + '-')
      );

      if (correctApartment) {
        // Reemplazar todas las ocurrencias del apartamento incorrecto
        const wrongPattern = new RegExp(
          `((?:Apartamento|Apartaestudio|Apto\\.?)\\s+)${responseApt.replace(/[-]/g, '\\-')}`, 
          'gi'
        );
        
        correctedResponse = correctedResponse.replace(wrongPattern, `$1${correctApartment}`);
        
        corrections.push({
          original: responseApt,
          corrected: correctApartment
        });
        
        hadErrors = true;
      }
    }
  });

  return {
    correctedResponse,
    corrections,
    hadErrors
  };
}