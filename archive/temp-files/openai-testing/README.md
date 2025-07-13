# OpenAI Testing & Monitoring

Sistema de testing y monitoring para OpenAI Rate Limits del Bot WhatsApp.

## 🚀 Configuración Inicial

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar API Key:**
   - Edita el archivo `.env`
   - Agrega tu API key de OpenAI

3. **Verificar configuración:**
   ```bash
   npm run test-config
   ```

## 📊 Comandos Disponibles

### Verificaciones Básicas
- `npm run check-limits` - Verificar rate limits actuales
- `npm run analyze-threads` - Analizar threads existentes
- `npm run full-report` - Reporte completo

### Monitoring
- `npm run monitor` - Monitor en tiempo real (Ctrl+C para detener)

### Utilidades
- `npm run test-config` - Verificar configuración
- `npm run clean` - Limpiar resultados

## 📁 Estructura

```
openai-testing/
├── rate-limits/          # Scripts de análisis
│   ├── check-limits.js   # Verificar límites actuales
│   ├── thread-analyzer.js # Analizar threads
│   └── monitor-usage.js  # Monitor en tiempo real
├── utils/                # Utilidades
│   └── openai-client.js  # Cliente OpenAI con tracking
├── results/              # Resultados de análisis
└── .env                  # Configuración
```

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

- `current-limits.json` - Estado actual de rate limits
- `thread-analysis.json` - Análisis detallado de threads
- `monitor-history.json` - Historial del monitor
- `client-stats.json` - Estadísticas del cliente

## 🛠️ Troubleshooting

### Error: API Key inválida
- Verifica que la API key esté correctamente configurada en `.env`
- Asegúrate de que empiece con `sk-`

### Error: No se encuentran threads
- Verifica que el path al archivo `threads.json` sea correcto
- Asegúrate de que el bot haya guardado threads previamente

### Rate Limit Errors
- Usa el monitor para ver el estado en tiempo real
- Considera pausar el bot temporalmente si es crítico
