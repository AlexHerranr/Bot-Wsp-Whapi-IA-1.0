// 🧪 Tests Unitarios - Sistema de Logging
// Tests para las funciones de logging del bot

import { 
  logInfo, 
  logError, 
  logSuccess, 
  logWarning,
  logDebug 
} from '../../src/utils/logging/index';

// Mock del dashboard para capturar logs
jest.mock('../../src/utils/monitoring/dashboard', () => ({
  botDashboard: {
    addLog: jest.fn(),
    logActivity: jest.fn()
  }
}));

// Importar después del mock
import { botDashboard } from '../../src/utils/monitoring/dashboard';
const mockAddLog = botDashboard.addLog as jest.MockedFunction<typeof botDashboard.addLog>;

// Mock de console.log para evitar spam en tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('🧪 Sistema de Logging', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada test
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockAddLog.mockClear();
    // Habilitar logs en consola para tests
    process.env.LOG_TO_CONSOLE = 'true';
  });

  afterEach(() => {
    // Limpiar variable de entorno después de cada test
    delete process.env.LOG_TO_CONSOLE;
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

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*💬 INFO \[TEST\] Mensaje de prueba/)
      );
    });

    it('debería manejar mensajes sin detalles', () => {
      const category = 'TEST';
      const message = 'Mensaje simple';

      logInfo(category, message);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*💬 INFO \[TEST\] Mensaje simple/)
      );
    });
  });

  describe('logError', () => {
    it('debería registrar errores correctamente', () => {
      const category = 'ERROR_TEST';
      const message = 'Error de prueba';
      const error = new Error('Error simulado');

      logError(category, message, error);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*❌ ERROR \[ERROR_TEST\] Error de prueba/)
      );
    });

    it('debería manejar errores sin objeto Error', () => {
      const category = 'ERROR_TEST';
      const message = 'Error simple';
      const details = { code: 500 };

      logError(category, message, details);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*❌ ERROR \[ERROR_TEST\] Error simple/)
      );
    });
  });

  describe('logSuccess', () => {
    it('debería registrar éxitos correctamente', () => {
      const category = 'SUCCESS_TEST';
      const message = 'Operación exitosa';

      logSuccess(category, message);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*✅ SUCCESS \[SUCCESS_TEST\] Operación exitosa/)
      );
    });
  });

  describe('logWarning', () => {
    it('debería registrar advertencias correctamente', () => {
      const category = 'WARNING_TEST';
      const message = 'Advertencia de prueba';

      logWarning(category, message);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*⚠️ WARNING \[WARNING_TEST\] Advertencia de prueba/)
      );
    });
  });

  describe('logDebug', () => {
    it('debería registrar debug correctamente', () => {
      const category = 'DEBUG_TEST';
      const message = 'Información de debug';
      const details = { debug: true, level: 'verbose' };

      logDebug(category, message, details);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*💬 INFO \[DEBUG_TEST\] \[DEBUG\] Información de debug/)
      );
    });
  });

  describe('Formato de logs', () => {
    it('debería incluir timestamp en todos los logs', () => {
      const category = 'TIMESTAMP_TEST';
      const message = 'Test de timestamp';

      logInfo(category, message);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*💬 INFO \[TIMESTAMP_TEST\] Test de timestamp/)
      );
    });

    it('debería incluir categoría en todos los logs', () => {
      const category = 'CATEGORY_TEST';
      const message = 'Test de categoría';

      logInfo(category, message);

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*💬 INFO \[CATEGORY_TEST\] Test de categoría/)
      );
    });
  });
}); 