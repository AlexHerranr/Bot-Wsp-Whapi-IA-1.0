/**
 * Configuración de Puppeteer para diferentes entornos
 * Maneja las rutas de Chromium para local, Railway y otros entornos cloud
 */

export interface PuppeteerConfig {
  executablePath?: string;
  headless: boolean | 'shell';
  args: string[];
  ignoreDefaultArgs?: string[];
  handleSIGINT: boolean;
  handleSIGTERM: boolean;
  handleSIGHUP: boolean;
  dumpio: boolean;
  timeout: number;
}

/**
 * Detecta el entorno de ejecución
 */
function detectEnvironment(): 'railway' | 'local' | 'docker' | 'unknown' {
  // Railway setea esta variable
  if (process.env.RAILWAY_ENVIRONMENT) {
    return 'railway';
  }
  
  // Detectar si estamos en Docker
  if (process.env.DOCKER_CONTAINER || process.env.NODE_ENV === 'production') {
    return 'docker';
  }
  
  // Por defecto asumimos local
  return process.env.NODE_ENV === 'development' ? 'local' : 'unknown';
}

/**
 * Obtiene la ruta del ejecutable de Chromium según el entorno
 */
function getChromiumPath(): string | undefined {
  const environment = detectEnvironment();
  
  switch (environment) {
    case 'railway':
      // En Railway con nixpacks
      return process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/*/bin/chromium';
      
    case 'docker':
      // En Docker Alpine
      return '/usr/bin/chromium-browser';
      
    case 'local':
      // En desarrollo local, dejar que Puppeteer use su Chromium descargado
      return undefined;
      
    default:
      // Intentar detectar automáticamente
      const possiblePaths = [
        '/usr/bin/chromium-browser', // Alpine
        '/usr/bin/chromium',          // Debian/Ubuntu
        '/usr/bin/google-chrome',     // Google Chrome
      ];
      
      // Buscar el primer path que exista
      const fs = require('fs');
      for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
          return path;
        }
      }
      
      return undefined;
  }
}

/**
 * Configuración de Puppeteer optimizada para el entorno actual
 */
export function getPuppeteerConfig(): PuppeteerConfig {
  const environment = detectEnvironment();
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`🔧 Puppeteer configurado para entorno: ${environment}`);
  
  const baseConfig: PuppeteerConfig = {
    headless: isProduction ? true : 'shell',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Importante para contenedores
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    dumpio: !isProduction, // Solo logs en desarrollo
    timeout: 60000,
  };
  
  // Agregar ruta del ejecutable si está disponible
  const chromiumPath = getChromiumPath();
  if (chromiumPath) {
    baseConfig.executablePath = chromiumPath;
    console.log(`📍 Usando Chromium en: ${chromiumPath}`);
  } else {
    console.log('📦 Usando Chromium empaquetado con Puppeteer');
  }
  
  // Configuraciones específicas por entorno
  if (environment === 'railway') {
    // Railway tiene limitaciones de memoria
    baseConfig.args.push('--max-old-space-size=512');
    baseConfig.args.push('--memory-pressure-off');
  }
  
  return baseConfig;
}

/**
 * Configuración para lanzar Puppeteer con reintentos
 */
export async function launchPuppeteerWithRetry(
  puppeteer: any,
  maxRetries: number = 3
): Promise<any> {
  const config = getPuppeteerConfig();
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🚀 Intento ${attempt} de lanzar Puppeteer...`);
      const browser = await puppeteer.launch(config);
      console.log('✅ Puppeteer lanzado exitosamente');
      return browser;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Intento ${attempt} falló:`, error.message);
      
      if (attempt < maxRetries) {
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        
        // En el segundo intento, probar sin ruta específica
        if (attempt === 2 && config.executablePath) {
          delete config.executablePath;
          console.log('🔄 Intentando con Chromium empaquetado...');
        }
      }
    }
  }
  
  throw new Error(`No se pudo lanzar Puppeteer después de ${maxRetries} intentos: ${lastError?.message}`);
}

// Exportar configuración por defecto
export default {
  getPuppeteerConfig,
  launchPuppeteerWithRetry,
  detectEnvironment,
};