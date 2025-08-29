/**
 * Configuración de Puppeteer para diferentes entornos
 * Maneja las rutas de Chromium para local, Railway y otros entornos cloud
 */

import * as fs from 'fs';

export interface PuppeteerConfig {
  executablePath?: string;
  headless: boolean | 'shell' | 'new';
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
    headless: true, // Railway necesita headless classic, no 'new'
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-default-apps',
      '--no-default-browser-check',
      '--disable-site-isolation-trials',
      '--disable-audio-output'
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
    // Railway necesita configuración especial
    baseConfig.args = [
      ...baseConfig.args,
      '--disable-dev-shm-usage', // Crítico para Railway
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ];
    
    // Usar timeout más largo para Railway
    baseConfig.timeout = 120000; // 2 minutos
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
  let lastError: Error | null = null;
  
  // Intentar diferentes configuraciones
  const configs = [
    // Intento 1: Configuración normal
    getPuppeteerConfig(),
    
    // Intento 2: Sin executable path (usar Chromium empaquetado)
    (() => {
      const config = getPuppeteerConfig();
      delete config.executablePath;
      return config;
    })(),
    
    // Intento 3: Configuración mínima para Railway
    {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote'
      ],
      timeout: 0 // Sin timeout
    }
  ];
  
  for (let attempt = 0; attempt < configs.length && attempt < maxRetries; attempt++) {
    try {
      console.log(`🚀 Intento ${attempt + 1} de lanzar Puppeteer...`);
      if (attempt === 1) {
        console.log('🔄 Intentando con Chromium empaquetado...');
      } else if (attempt === 2) {
        console.log('🔧 Intentando con configuración mínima...');
      }
      
      const browser = await puppeteer.launch(configs[attempt]);
      console.log('✅ Puppeteer lanzado exitosamente');
      return browser;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Intento ${attempt + 1} falló:`, error.message);
      
      if (attempt < maxRetries - 1) {
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 2000));
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