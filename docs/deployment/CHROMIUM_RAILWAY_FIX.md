# Solución para Chromium/Puppeteer en Railway

## Problema Identificado

El bot falla al generar PDFs en Railway con el siguiente error:
```
Error: Tried to find the browser at the configured path (/usr/bin/chromium), but no executable was found.
```

## Causa del Problema

1. **Imagen Docker Alpine**: La imagen `node:18-alpine` no incluye Chromium
2. **Puppeteer requiere Chromium**: Para generar PDFs, Puppeteer necesita un navegador instalado
3. **Railway/Nixpacks**: Railway usa Nixpacks que requiere configuración especial

## Solución Implementada

### 1. Dockerfile Actualizado
Se modificó el Dockerfile para instalar Chromium y sus dependencias:

```dockerfile
# Instalar Chromium y dependencias
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont
```

### 2. Configuración de Nixpacks
Se creó `nixpacks.toml` para Railway:
- Instala Chromium y todas las librerías necesarias
- Configura variables de entorno para Puppeteer
- Define el path correcto de Chromium

### 3. Configuración de Puppeteer
Se creó `src/config/puppeteer.config.ts`:
- Detecta automáticamente el entorno (Railway, Docker, local)
- Configura el path correcto de Chromium según el entorno
- Incluye reintentos y fallbacks

### 4. Dependencias Agregadas
Se agregaron a `package.json`:
- `puppeteer`: Para desarrollo local
- `puppeteer-core`: Para producción (usa Chromium del sistema)

## Pasos para Desplegar

1. **Instalar dependencias localmente**:
   ```bash
   npm install
   ```

2. **Construir el proyecto**:
   ```bash
   npm run build
   ```

3. **Desplegar a Railway**:
   ```bash
   git add .
   git commit -m "fix: agregar soporte para Chromium en Railway para generación de PDFs"
   git push origin main
   ```

## Configuración en Railway

Railway debería detectar automáticamente el archivo `nixpacks.toml` y:
1. Instalar Chromium del sistema
2. Configurar las variables de entorno necesarias
3. Usar la configuración correcta de Puppeteer

## Variables de Entorno

Asegúrate de que estas variables estén configuradas en Railway:

```env
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/nix/store/*/bin/chromium
NODE_OPTIONS=--max-old-space-size=768
```

## Verificación

Para verificar que funciona:

1. **Logs de inicio**: Deberías ver:
   ```
   🔧 Puppeteer configurado para entorno: railway
   📍 Usando Chromium en: /nix/store/*/bin/chromium
   ```

2. **Generación de PDF**: La función `generate_booking_confirmation_pdf` debería completarse sin errores

## Troubleshooting

Si continúa fallando:

1. **Verificar logs de Railway**:
   ```bash
   npm run logs:railway:live
   ```

2. **Probar configuración alternativa**: 
   Si nixpacks falla, puedes usar solo el Dockerfile con:
   ```
   railway up --build
   ```

3. **Verificar memoria**: 
   Railway tiene límites de memoria. Si el bot se queda sin memoria al lanzar Chromium, considera:
   - Aumentar el plan de Railway
   - Optimizar el uso de memoria con `--single-process` en los args de Puppeteer

## Notas Importantes

- **Desarrollo local**: En local, Puppeteer descarga su propio Chromium
- **Railway**: Usa el Chromium del sistema instalado por nixpacks
- **Docker**: Usa chromium-browser de Alpine
- **Memoria**: La generación de PDFs consume ~100-200MB adicionales de RAM

## Referencias

- [Puppeteer Troubleshooting](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md)
- [Railway Nixpacks Documentation](https://nixpacks.com/docs)
- [Alpine Chromium Package](https://pkgs.alpinelinux.org/package/edge/community/x86/chromium)