// 🧪 Tests Unitarios - Sistema de Logging
// Tests para las funciones de logging del bot

import { 
  logInfo, 
  logError, 
  logSuccess, 
  logWarning,
  logDebug 
} from '../../src/utils/logging/index';

// Mock de console.log para capturar logs
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('🧪 Sistema de Logging', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada test
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    // Restaurar console original
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('logInfo', () => {
    it('debería registrar información correctamente', () => {
      const category = 'TEST';
      const message = 'Mensaje de prueba';
      const details = { userId: '123', action: 'test' };

      logInfo(category, message, details);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💬 INFO')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(category)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('debería manejar mensajes sin detalles', () => {
      const category = 'TEST';
      const message = 'Mensaje simple';

      logInfo(category, message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💬 INFO')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('logError', () => {
    it('debería registrar errores correctamente', () => {
      const category = 'ERROR_TEST';
      const message = 'Error de prueba';
      const error = new Error('Error simulado');

      logError(category, message, error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('☠️ ERROR')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(category)
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    it('debería manejar errores sin objeto Error', () => {
      const category = 'ERROR_TEST';
      const message = 'Error simple';
      const details = { code: 500 };

      logError(category, message, details);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('☠️ ERROR')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('logSuccess', () => {
    it('debería registrar éxitos correctamente', () => {
      const category = 'SUCCESS_TEST';
      const message = 'Operación exitosa';

      logSuccess(category, message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ SUCCESS')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(category)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('logWarning', () => {
    it('debería registrar advertencias correctamente', () => {
      const category = 'WARNING_TEST';
      const message = 'Advertencia de prueba';

      logWarning(category, message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ WARNING')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(category)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('logDebug', () => {
    it('debería registrar debug correctamente', () => {
      const category = 'DEBUG_TEST';
      const message = 'Información de debug';
      const details = { debug: true, level: 'verbose' };

      logDebug(category, message, details);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🔍 DEBUG')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(category)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('Formato de logs', () => {
    it('debería incluir timestamp en todos los logs', () => {
      const category = 'TIMESTAMP_TEST';
      const message = 'Test de timestamp';

      logInfo(category, message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });

    it('debería incluir categoría en todos los logs', () => {
      const category = 'CATEGORY_TEST';
      const message = 'Test de categoría';

      logInfo(category, message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(category)
      );
    });
  });
}); 