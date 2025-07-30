/**
 * Validador de respuestas post-generación expandido
 * Detecta discrepancias amplias entre datos de BEDS24 y respuestas de OpenAI
 */

interface ValidationDiscrepancy {
  type: 'apartment_name' | 'price';
  original: string;
  incorrect: string;
  description: string;
}

interface ValidationResult {
  correctedResponse: string; 
  discrepancies: ValidationDiscrepancy[]; 
  hadErrors: boolean;
  needsRetry: boolean; // Para casos complejos que requieren retry
}

/**
 * Extrae nombres de apartamentos de un texto
 */
function extractApartmentNames(text: string): string[] {
  const apartmentRegex = /(?:Apartamento|Apartaestudio|Apto\.?)\s+(\d{3,4}-[A-Z])/gi;
  const matches = text.matchAll(apartmentRegex);
  return Array.from(matches, match => match[1]);
}

/**
 * Extrae precios de un texto (formato colombiano)
 */
function extractPrices(text: string): string[] {
  const priceRegex = /\$[\d,]+(?:,000)?(?:\s*COP)?/gi;
  return text.match(priceRegex) || [];
}

// Funciones de extracción adicionales removidas por simplicidad
// Solo validamos apartamentos y precios por ahora

/**
 * Validación simplificada de respuestas post-generación
 * Detecta discrepancias solo en apartamentos y precios
 */
export function validateAndCorrectResponse(
  openaiResponse: string, 
  originalToolOutputs: string[]
): ValidationResult {
  
  if (originalToolOutputs.length === 0) {
    return {
      correctedResponse: openaiResponse,
      discrepancies: [],
      hadErrors: false,
      needsRetry: false
    };
  }

  const discrepancies: ValidationDiscrepancy[] = [];
  let correctedResponse = openaiResponse;
  let hasComplexErrors = false;

  // Combinar todos los outputs originales
  const originalText = originalToolOutputs.join('\n');
  
  // 1. Validar nombres de apartamentos
  const originalApartments = new Set<string>();
  originalToolOutputs.forEach(output => {
    extractApartmentNames(output).forEach(apt => originalApartments.add(apt));
  });

  const responseApartments = extractApartmentNames(openaiResponse);
  responseApartments.forEach(responseApt => {
    if (!originalApartments.has(responseApt)) {
      const apartmentNumber = responseApt.split('-')[0];
      const correctApartment = Array.from(originalApartments).find(orig => 
        orig.startsWith(apartmentNumber + '-')
      );

      if (correctApartment) {
        // Corrección automática para nombres
        const wrongPattern = new RegExp(
          `((?:Apartamento|Apartaestudio|Apto\\.?)\\s+)${responseApt.replace(/[-]/g, '\\-')}`, 
          'gi'
        );
        correctedResponse = correctedResponse.replace(wrongPattern, `$1${correctApartment}`);
        
        discrepancies.push({
          type: 'apartment_name',
          original: correctApartment,
          incorrect: responseApt,
          description: `Nombre de apartamento corregido: ${responseApt} → ${correctApartment}`
        });
      }
    }
  });

  // 2. Validar precios
  const originalPrices = new Set(extractPrices(originalText));
  const responsePrices = extractPrices(openaiResponse);
  
  responsePrices.forEach(responsePrice => {
    // Buscar precio similar o exacto en originales
    const matchingPrice = Array.from(originalPrices).find(origPrice => 
      origPrice.replace(/[,\s]/g, '') === responsePrice.replace(/[,\s]/g, '') ||
      origPrice.includes(responsePrice.replace(/[,\s$]/g, ''))
    );

    if (!matchingPrice) {
      discrepancies.push({
        type: 'price',
        original: Array.from(originalPrices).join(', ') || 'N/A',
        incorrect: responsePrice,
        description: `Precio no encontrado en datos originales: ${responsePrice}`
      });
      hasComplexErrors = true; // Precios requieren retry
    }
  });

  // Solo validamos apartamentos y precios por ahora
  // Fechas y descripciones se validarán en futuras versiones

  return {
    correctedResponse,
    discrepancies,
    hadErrors: discrepancies.length > 0,
    needsRetry: hasComplexErrors // Solo retry para errores de precios (complejos)
  };
}