/**
 * Script de Limpieza del Proyecto
 * Elimina archivos duplicados y reorganiza la estructura
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Iniciando limpieza del proyecto...\n');

// Archivos a mover a backup
const filesToBackup = [
    'src/app-original.ts',
    'src/app-emergency.ts',
    'src/app-nuclear.ts',
    'src/app-emergency-backup.ts',
    'src/app.ts.backup.1751833834188'
];

// Archivos de deploy duplicados a organizar
const deployFilesToMove = [
    'deploy-cloud-run.sh',
    'deploy-cloud-run.ps1',
    'deploy-cloud-run-v2.ps1',
    'deploy-cloud-run-fixed.sh',
    'deploy-cloud-run-fixed.ps1',
    'diagnose-cloud-run.sh'
];

// Crear carpeta de backup si no existe
const backupDir = 'backup-files';
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
    console.log(`📁 Creada carpeta: ${backupDir}`);
}

// Crear subcarpeta para scripts de deploy
const deployBackupDir = path.join(backupDir, 'deploy-scripts');
if (!fs.existsSync(deployBackupDir)) {
    fs.mkdirSync(deployBackupDir);
    console.log(`📁 Creada carpeta: ${deployBackupDir}`);
}

// Función para mover archivo
function moveFile(source, destination) {
    try {
        if (fs.existsSync(source)) {
            fs.renameSync(source, destination);
            console.log(`✅ Movido: ${source} → ${destination}`);
            return true;
        } else {
            console.log(`⚠️  No encontrado: ${source}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error moviendo ${source}:`, error.message);
        return false;
    }
}

// Mover archivos app.ts duplicados
console.log('🔄 Moviendo archivos app.ts duplicados...');
filesToBackup.forEach(file => {
    const filename = path.basename(file);
    const destination = path.join(backupDir, filename);
    moveFile(file, destination);
});

// Mover scripts de deploy
console.log('\n🔄 Moviendo scripts de deploy...');
deployFilesToMove.forEach(file => {
    const destination = path.join(deployBackupDir, file);
    moveFile(file, destination);
});

// Renombrar app-unified.ts a app.ts
console.log('\n🔄 Activando app-unified.ts como app.ts principal...');
if (fs.existsSync('src/app.ts')) {
    moveFile('src/app.ts', path.join(backupDir, 'app-original-final.ts'));
}

if (fs.existsSync('src/app-unified.ts')) {
    moveFile('src/app-unified.ts', 'src/app.ts');
    console.log('✅ app-unified.ts ahora es el app.ts principal');
} else {
    console.log('❌ No se encontró src/app-unified.ts');
}

// Actualizar package.json para usar app.ts
console.log('\n🔄 Actualizando package.json...');
try {
    const packageJsonPath = 'package.json';
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Actualizar main
    packageJson.main = 'src/app.ts';
    
    // Actualizar scripts
    packageJson.scripts.dev = 'tsx --watch src/app.ts';
    packageJson.scripts['dev:old'] = 'echo "Archivo app-original movido a backup"';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ package.json actualizado');
} catch (error) {
    console.error('❌ Error actualizando package.json:', error.message);
}

// Crear archivo de resumen
const summaryContent = `# Limpieza del Proyecto - Resumen

## Archivos Movidos a Backup

### Archivos app.ts duplicados:
${filesToBackup.map(f => `- ${f}`).join('\n')}

### Scripts de deploy:
${deployFilesToMove.map(f => `- ${f}`).join('\n')}

## Cambios Realizados

1. **app-unified.ts** → **app.ts** (archivo principal)
2. **package.json** actualizado para usar el nuevo app.ts
3. Archivos duplicados movidos a carpeta backup-files/
4. Scripts de deploy organizados en backup-files/deploy-scripts/

## Estructura Final

\`\`\`
src/
├── app.ts                    # Aplicación principal unificada
├── config/
│   └── environment.ts        # Sistema de configuración automática
└── ...

docs/
├── deployment/               # Documentación de deployment
├── development/              # Guías de desarrollo
└── ...

backup-files/
├── deploy-scripts/           # Scripts de deploy antiguos
└── app-*.ts                  # Archivos app.ts duplicados
\`\`\`

## Próximos Pasos

1. Probar el funcionamiento: \`npm run dev:local\`
2. Verificar configuración: \`npm run config\`
3. Deploy a Cloud Run: \`npm run deploy\`

Fecha: ${new Date().toISOString()}
`;

fs.writeFileSync(path.join(backupDir, 'CLEANUP_SUMMARY.md'), summaryContent);
console.log('✅ Resumen guardado en backup-files/CLEANUP_SUMMARY.md');

console.log('\n🎉 Limpieza completada!');
console.log('\n📋 Próximos pasos:');
console.log('1. npm run dev:local  # Probar funcionamiento local');
console.log('2. npm run config     # Verificar configuración');
console.log('3. npm run deploy     # Deploy a Cloud Run');
console.log('\n📁 Archivos de backup en: backup-files/'); 