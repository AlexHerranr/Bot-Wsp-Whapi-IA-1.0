#!/usr/bin/env node
/**
 * Script de Testing Pre-Deploy Automatizado
 * Ejecuta validaciones básicas antes del deploy
 */

const fs = require('fs');
const path = require('path');

// Colores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

class PreDeployTester {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.warnings = 0;
        this.issues = [];
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    test(name, condition, severity = 'error') {
        const status = condition ? 'PASS' : 'FAIL';
        const icon = condition ? '✅' : '❌';
        const color = condition ? 'green' : 'red';
        
        this.log(`${icon} ${name}: ${status}`, color);
        
        if (condition) {
            this.passed++;
        } else {
            if (severity === 'warning') {
                this.warnings++;
            } else {
                this.failed++;
            }
            this.issues.push({ name, severity });
        }
        
        return condition;
    }

    async validateEnvironment() {
        this.log('\n🔧 Validando Variables de Entorno...', 'blue');
        
        const envFile = '.env';
        const envExists = fs.existsSync(envFile);
        this.test('Archivo .env existe', envExists);
        
        if (envExists) {
            const envContent = fs.readFileSync(envFile, 'utf-8');
            
            // Variables críticas
            const criticalVars = [
                'OPENAI_API_KEY',
                'ASSISTANT_ID', 
                'WHAPI_TOKEN',
                'WHAPI_API_URL',
                'BEDS24_TOKEN',
                'BEDS24_API_URL'
            ];
            
            criticalVars.forEach(varName => {
                const exists = envContent.includes(`${varName}=`) && 
                             !envContent.includes(`${varName}=\n`);
                this.test(`${varName} configurado`, exists);
            });
            
            // Variables de funcionalidades
            const featureVars = [
                'ENABLE_VOICE_RESPONSES=true',
                'ENABLE_VOICE_TRANSCRIPTION=true', 
                'ENABLE_IMAGE_PROCESSING=true'
            ];
            
            featureVars.forEach(varCheck => {
                const exists = envContent.includes(varCheck);
                this.test(`${varCheck}`, exists);
            });
        }
    }

    async validateCodeStructure() {
        this.log('\n📁 Validando Estructura de Código...', 'blue');
        
        const criticalFiles = [
            'src/app-unified.ts',
            'package.json',
            'tsconfig.json'
        ];
        
        criticalFiles.forEach(file => {
            const exists = fs.existsSync(file);
            this.test(`${file} existe`, exists);
        });
        
        // Validar app-unified.ts contiene funciones críticas
        if (fs.existsSync('src/app-unified.ts')) {
            const content = fs.readFileSync('src/app-unified.ts', 'utf-8');
            
            const criticalFunctions = [
                'sendWhatsAppMessage',
                'processWithOpenAI',
                'transcribeAudio',
                'sendTypingIndicator',
                'sendRecordingIndicator'
            ];
            
            criticalFunctions.forEach(func => {
                const exists = content.includes(`function ${func}`) || 
                             content.includes(`const ${func}`) ||
                             content.includes(`async function ${func}`);
                this.test(`Función ${func} presente`, exists);
            });
            
            // Validar no hay syntax errors obvios
            const noSyntaxErrors = !content.includes('undefined)') && 
                                  !content.includes('null)') &&
                                  content.includes('export') || content.includes('module.exports');
            this.test('Sin errores de sintaxis obvios', noSyntaxErrors);
        }
    }

    async validateVoiceLogic() {
        this.log('\n🎤 Validando Lógica de Voz...', 'blue');
        
        if (fs.existsSync('src/app-unified.ts')) {
            const content = fs.readFileSync('src/app-unified.ts', 'utf-8');
            
            // Verificar lógica de voz presente
            const hasVoiceLogic = content.includes('shouldUseVoice') &&
                                content.includes('lastInputVoice') &&
                                content.includes('ENABLE_VOICE_RESPONSES');
            this.test('Lógica de respuesta de voz presente', hasVoiceLogic);
            
            // Verificar TTS integration
            const hasTTS = content.includes('audio.speech.create') ||
                          content.includes('tts-1');
            this.test('Integración TTS OpenAI presente', hasTTS);
            
            // Verificar indicadores apropiados  
            const hasIndicators = content.includes('sendRecordingIndicator') &&
                                 content.includes('willRespondWithVoice');
            this.test('Indicadores de recording/typing presente', hasIndicators);
            
            // Verificar fallback a texto
            const hasFallback = content.includes('fallback') ||
                              content.includes('catch') && content.includes('texto');
            this.test('Fallback a texto en errores', hasFallback, 'warning');
        }
    }

    async validateBeds24Integration() {
        this.log('\n🏨 Validando Integración Beds24...', 'blue');
        
        if (fs.existsSync('src/app-unified.ts')) {
            const content = fs.readFileSync('src/app-unified.ts', 'utf-8');
            
            // Function calling
            const hasFunctionCalling = content.includes('check_availability') &&
                                     (content.includes('function_name') || content.includes('toolCalls'));
            this.test('Function calling check_availability', hasFunctionCalling);
            
            // Beds24 API integration
            const hasBeds24API = content.includes('BEDS24_API_URL') ||
                               content.includes('beds24') ||
                               content.includes('BEDS24');
            this.test('Integración API Beds24', hasBeds24API);
            
            // Manejo de fechas
            const hasDateHandling = content.includes('startDate') &&
                                  content.includes('endDate') &&
                                  content.includes('getTime()');
            this.test('Manejo correcto de fechas', hasDateHandling);
        }
    }

    async validatePackageIntegrity() {
        this.log('\n📦 Validando Integridad de Packages...', 'blue');
        
        const packageExists = fs.existsSync('package.json');
        this.test('package.json existe', packageExists);
        
        if (packageExists) {
            try {
                const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
                
                const criticalDeps = [
                    'openai',
                    'typescript',
                    '@types/node'
                ];
                
                criticalDeps.forEach(dep => {
                    const exists = pkg.dependencies?.[dep] || pkg.devDependencies?.[dep];
                    this.test(`Dependencia ${dep}`, !!exists);
                });
                
                // Build script
                const hasBuildScript = pkg.scripts?.build;
                this.test('Script de build configurado', !!hasBuildScript);
                
            } catch (error) {
                this.test('package.json válido JSON', false);
            }
        }
        
        // Node modules
        const nodeModulesExists = fs.existsSync('node_modules');
        this.test('node_modules presente', nodeModulesExists, 'warning');
    }

    generateReport() {
        this.log('\n' + '='.repeat(50), 'bold');
        this.log('📊 REPORTE DE PRE-DEPLOY', 'bold');
        this.log('='.repeat(50), 'bold');
        
        const total = this.passed + this.failed + this.warnings;
        this.log(`\n✅ Passed: ${this.passed}/${total}`, 'green');
        this.log(`❌ Failed: ${this.failed}/${total}`, 'red');
        this.log(`⚠️  Warnings: ${this.warnings}/${total}`, 'yellow');
        
        if (this.issues.length > 0) {
            this.log('\n🚨 Issues Encontrados:', 'red');
            this.issues.forEach(issue => {
                const icon = issue.severity === 'warning' ? '⚠️' : '❌';
                this.log(`${icon} ${issue.name} (${issue.severity})`, 'yellow');
            });
        }
        
        // Decisión de deploy
        this.log('\n🚀 Decisión de Deploy:', 'bold');
        if (this.failed === 0) {
            this.log('✅ DEPLOY APROBADO', 'green');
            this.log('Todos los tests críticos pasaron.', 'green');
            if (this.warnings > 0) {
                this.log(`⚠️  Hay ${this.warnings} warnings - revisar antes de producción.`, 'yellow');
            }
        } else {
            this.log('❌ DEPLOY BLOQUEADO', 'red');
            this.log(`${this.failed} tests críticos fallaron.`, 'red');
            this.log('Corregir issues antes de deploy.', 'red');
        }
        
        return this.failed === 0;
    }

    async run() {
        this.log('🚀 Iniciando Pre-Deploy Testing...', 'blue');
        this.log(`📅 ${new Date().toISOString()}`, 'blue');
        
        await this.validateEnvironment();
        await this.validateCodeStructure();  
        await this.validateVoiceLogic();
        await this.validateBeds24Integration();
        await this.validatePackageIntegrity();
        
        const success = this.generateReport();
        
        // Exit code para CI/CD
        process.exit(success ? 0 : 1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const tester = new PreDeployTester();
    tester.run().catch(console.error);
}

module.exports = PreDeployTester;