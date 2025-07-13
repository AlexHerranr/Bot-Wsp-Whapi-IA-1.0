import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Configurando OpenAI Testing Environment...\n');

// Verificar estructura de directorios
const requiredDirs = ['rate-limits', 'utils', 'results'];
console.log('📁 Verificando estructura de directorios...');

for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✅ Creado: ${dir}/`);
    } else {
        console.log(`   ✅ Existe: ${dir}/`);
    }
}

// Crear archivo .env si no existe
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('\n🔧 Creando archivo .env...');
    
    const envContent = `# OpenAI Testing Environment Configuration
# Copia tu API key de OpenAI aquí
OPENAI_API_KEY=tu_api_key_aqui

# Opcional: ID de organización
OPENAI_ORG_ID=org-SLzuAJSiM1gqPZbyX7gWQe8D

# Opcional: Modelo a usar
OPENAI_MODEL=o3-mini

# Configuración de testing
NODE_ENV=development
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('   ✅ Archivo .env creado');
    console.log('   ⚠️  IMPORTANTE: Edita .env con tu API key real');
} else {
    console.log('\n✅ Archivo .env ya existe');
}

// Crear archivo README específico
const readmePath = path.join(__dirname, 'README.md');
if (!fs.existsSync(readmePath)) {
    console.log('\n📝 Creando README.md...');
    
    const readmeContent = `# OpenAI Testing & Monitoring

Sistema de testing y monitoring para OpenAI Rate Limits del Bot WhatsApp.

## 🚀 Configuración Inicial

1. **Instalar dependencias:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Configurar API Key:**
   - Edita el archivo \`.env\`
   - Agrega tu API key de OpenAI

3. **Verificar configuración:**
   \`\`\`bash
   npm run test-config
   \`\`\`

## 📊 Comandos Disponibles

### Verificaciones Básicas
- \`npm run check-limits\` - Verificar rate limits actuales
- \`npm run analyze-threads\` - Analizar threads existentes
- \`npm run full-report\` - Reporte completo

### Monitoring
- \`npm run monitor\` - Monitor en tiempo real (Ctrl+C para detener)

### Utilidades
- \`npm run test-config\` - Verificar configuración
- \`npm run clean\` - Limpiar resultados

## 📁 Estructura

\`\`\`
openai-testing/
├── rate-limits/          # Scripts de análisis
│   ├── check-limits.js   # Verificar límites actuales
│   ├── thread-analyzer.js # Analizar threads
│   └── monitor-usage.js  # Monitor en tiempo real
├── utils/                # Utilidades
│   └── openai-client.js  # Cliente OpenAI con tracking
├── results/              # Resultados de análisis
└── .env                  # Configuración
\`\`\`

## 🔍 Interpretación de Resultados

### Rate Limits
- **OK**: Uso normal (<60%)
- **INFO**: Uso moderado (60-80%)
- **WARNING**: Uso elevado (80-95%)
- **CRITICAL**: Uso muy alto (>95%)

### Threads
- **ACTIVE**: Actividad reciente (<3 días)
- **LOW_ACTIVITY**: Poca actividad (3-7 días)
- **INACTIVE**: Sin actividad (>7 días)

## 🚨 Alertas

El monitor mostrará alertas automáticas cuando:
- Rate limits superen umbrales configurados
- Ocurran errores consecutivos
- Se detecten patrones anómalos

## 📊 Archivos de Resultados

- \`current-limits.json\` - Estado actual de rate limits
- \`thread-analysis.json\` - Análisis detallado de threads
- \`monitor-history.json\` - Historial del monitor
- \`client-stats.json\` - Estadísticas del cliente

## 🛠️ Troubleshooting

### Error: API Key inválida
- Verifica que la API key esté correctamente configurada en \`.env\`
- Asegúrate de que empiece con \`sk-\`

### Error: No se encuentran threads
- Verifica que el path al archivo \`threads.json\` sea correcto
- Asegúrate de que el bot haya guardado threads previamente

### Rate Limit Errors
- Usa el monitor para ver el estado en tiempo real
- Considera pausar el bot temporalmente si es crítico
`;
    
    fs.writeFileSync(readmePath, readmeContent);
    console.log('   ✅ README.md creado');
} else {
    console.log('\n✅ README.md ya existe');
}

// Verificar dependencias
console.log('\n📦 Verificando dependencias...');
const packageJsonPath = path.join(__dirname, 'package.json');

if (fs.existsSync(packageJsonPath)) {
    console.log('   ✅ package.json encontrado');
    
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('   ⚠️  node_modules no encontrado');
        console.log('   💡 Ejecuta: npm install');
    } else {
        console.log('   ✅ node_modules existe');
    }
} else {
    console.log('   ❌ package.json no encontrado');
}

// Verificar configuración de API
console.log('\n🔑 Verificando configuración de API...');
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.log('   ⚠️  OPENAI_API_KEY no configurada');
    console.log('   💡 Edita .env con tu API key');
} else if (apiKey === 'tu_api_key_aqui') {
    console.log('   ⚠️  OPENAI_API_KEY usa valor por defecto');
    console.log('   💡 Edita .env con tu API key real');
} else if (!apiKey.startsWith('sk-')) {
    console.log('   ⚠️  API Key no parece válida');
    console.log('   💡 Debe empezar con "sk-"');
} else {
    console.log('   ✅ API Key configurada correctamente');
}

// Crear archivo de ejemplo de configuración
const exampleConfigPath = path.join(__dirname, 'config.example.json');
if (!fs.existsSync(exampleConfigPath)) {
    console.log('\n⚙️  Creando configuración de ejemplo...');
    
    const exampleConfig = {
        "monitor": {
            "intervalMs": 30000,
            "alertThresholds": {
                "critical": 95,
                "warning": 80,
                "info": 60
            },
            "maxHistorySize": 200
        },
        "analysis": {
            "maxThreadsToAnalyze": 50,
            "tokenEstimationRatio": 4,
            "inactiveThresholdDays": 7
        },
        "client": {
            "maxHistorySize": 100,
            "requestTimeout": 30000
        }
    };
    
    fs.writeFileSync(exampleConfigPath, JSON.stringify(exampleConfig, null, 2));
    console.log('   ✅ config.example.json creado');
}

console.log('\n🎯 SIGUIENTE PASOS:');
console.log('================');
console.log('1. 🔧 Edita .env con tu API key de OpenAI');
console.log('2. 📦 Ejecuta: npm install');
console.log('3. ✅ Verifica: npm run test-config');
console.log('4. 🚀 Ejecuta: npm run check-limits');
console.log('5. 📊 Monitorea: npm run monitor');

console.log('\n✅ Setup completado!');
console.log(`📁 Carpeta: ${__dirname}`);
console.log('🔧 Edita .env antes de usar los scripts'); 