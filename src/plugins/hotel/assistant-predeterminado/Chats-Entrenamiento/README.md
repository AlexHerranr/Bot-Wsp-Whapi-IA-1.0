# 🏖️ Pa'Cartagena - Dataset de Entrenamiento

Dataset completo para fine-tuning del asistente virtual de Pa'Cartagena basado en conversaciones reales de WhatsApp.

## 📁 Archivos Principales

### 📊 **Datos Fuente**
- `Chats de WhatsApp_1.xls` - Archivo Excel original (6.8MB)  
- `Chats de WhatsApp_1.xlsx` - Archivo Excel original (4.2MB)
- **Total**: 102,507 mensajes reales (Jul 2023 - Ago 2024)

### 🎯 **Dataset Final**
- `preguntasyreptuestastipicas_completo.json` - **ARCHIVO PRINCIPAL**
  - 17 categorías completas (principales + situaciones raras)
  - 66 ejemplos auténticos documentados
  - Cobertura 100% de situaciones del negocio

### 🤖 **Fine-tuning OpenAI**
- `convert-to-openai-format.js` - Conversor a formato JSONL
- `openai-training-data/` - Archivos listos para OpenAI
  - `train.jsonl` - Dataset de entrenamiento
  - `validation.jsonl` - Dataset de validación  
  - `test.jsonl` - Dataset de pruebas

### 📋 **Documentación**
- `PLAN_TECNICO_DETALLADO.md` - Plan técnico completo con mejoras OpenAI

## 🏨 Categorías Documentadas

### Principales (7)
- Consulta disponibilidad
- Consulta precios
- Proceso reserva
- Inventario específico
- Ubicación servicios
- Cancelaciones
- Conversación general

### Situaciones Especiales (10)
- Mascotas/animales
- Problemas técnicos
- Quejas limpieza/ruido
- Emergencias salud
- Transporte/direcciones
- Ocasiones especiales
- Familias/bebés
- Grupos grandes
- Facturas empresariales
- Problemas acceso

## 🚀 Uso Rápido

```bash
# Convertir a formato OpenAI
node convert-to-openai-format.js

# Subir para fine-tuning
cd openai-training-data
./upload-to-openai.sh
```

## 📈 Estadísticas
- **102,507 mensajes** analizados
- **13 meses** de datos reales
- **7 apartamentos** documentados
- **4 canales** de reserva
- **100% cobertura** situacional

---
**Negocio**: Pa'Cartagena (TE ALQUILAMOS S.A.S)  
**Ubicación**: Edificio Nuevo Conquistador, Laguito, Cartagena  
**Staff**: Alexander Herran, Daniel Moreno