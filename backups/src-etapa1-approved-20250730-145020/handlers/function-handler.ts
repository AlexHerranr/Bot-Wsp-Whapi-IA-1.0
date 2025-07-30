import { enhancedLog } from '../utils/core/index.js';
import { executeFunction } from '../functions/registry/function-registry.js';

export class FunctionHandler {

  async handleFunction(name: string, args: any): Promise<any> {
    enhancedLog('info', 'FUNCTION_HANDLER', `Ejecutando función: ${name}`);
    enhancedLog('info', 'FUNCTION_HANDLER', `Argumentos: ${JSON.stringify(args)}`);

    try {
      // Usar el registro central para ejecutar funciones
      const result = await executeFunction(name, args);
      
      enhancedLog('success', 'FUNCTION_HANDLER', `Función ${name} ejecutada exitosamente`);
      
      // Log detallado del contenido exacto enviado a OpenAI
      enhancedLog('info', 'OPENAI_FUNCTION_OUTPUT', `Contenido exacto enviado a OpenAI después de ${name}`, {
        functionName: name,
        args: args,
        resultType: typeof result,
        resultLength: Array.isArray(result) ? result.length : 'N/A',
        fullContent: result, // Contenido completo que recibe OpenAI
        timestamp: new Date().toISOString()
      });
      
      return result;
      
    } catch (error) {
      enhancedLog('error', 'FUNCTION_HANDLER', `Error ejecutando función ${name}: ${error.message}`);
      return { 
        success: false,
        error: `Error ejecutando función: ${error.message}` 
      };
    }
  }

  // Métodos antiguos eliminados - ahora se usa el registro central de funciones
  // Los handlers específicos están en src/functions/*/
  
  // Funciones DISABLED movidas a src/features/future/labels/
  // - handleUpdateClientLabels_DISABLED → update-client-labels.ts
  // - handleGetAvailableLabels_DISABLED → get-available-labels.ts
}
