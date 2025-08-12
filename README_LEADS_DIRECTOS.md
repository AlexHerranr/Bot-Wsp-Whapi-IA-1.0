# 🎯 Sistema de Leads Directos - WhatsApp

**Gestión comercial de leads que llegan directamente por WhatsApp (no vienen de Beds24)**

> **Sistema independiente para convertir conversaciones de WhatsApp en oportunidades de negocio**

---

## 📊 ¿Qué son los Leads Directos?

Los **LeadsDirectos** son personas que escriben espontáneamente por WhatsApp preguntando por:
- ✅ Disponibilidad de apartamentos
- ✅ Precios y cotizaciones  
- ✅ Información sobre alojamiento
- ✅ Reservas directas (sin pasar por Booking/Airbnb)

**Diferencia clave**: 
- 🎯 **LeadsDirectos** = Conversaciones de WhatsApp → CRM comercial
- 📋 **ReservationsPendingFuture** = Reservas de Beds24 sin pago → Follow-up financiero

---

## 🗂️ Estructura de la Tabla

### **Campos Principales**
```sql
CREATE TABLE "LeadsDirectos" (
  -- 🎯 INFORMACIÓN BÁSICA
  "huesped"        VARCHAR  NOT NULL,     -- Nombre del huésped  
  "apto"           VARCHAR,               -- Apartamento de interés
  "llegada"        VARCHAR  NOT NULL,     -- Fecha llegada YYYY-MM-DD
  "pax"            INTEGER,               -- Número de personas
  "telefono"       VARCHAR  NOT NULL,     -- WhatsApp del contacto
  
  -- 🚨 GESTIÓN COMERCIAL  
  "estadoLead"     VARCHAR DEFAULT 'nuevo',        -- nuevo, contactado, seguimiento, convertido, perdido
  "prioridad"      VARCHAR DEFAULT 'media',        -- alta, media, baja
  "ultimaGestion"  TIMESTAMP,                      -- Última gestión comercial
  
  -- 📝 SEGUIMIENTO
  "proximaAccion"  TIMESTAMP,                      -- Próximo follow-up programado
  "intentosContacto" INTEGER DEFAULT 0,            -- Cuántas veces contactado
  "notas"          TEXT,                           -- Notas del equipo comercial
  "responsable"    VARCHAR,                        -- Quién gestiona el lead
  
  -- 💰 COMERCIAL
  "valorReserva"   VARCHAR,                        -- Valor estimado/final
  "canal"          VARCHAR DEFAULT 'WhatsApp Directo',
  
  -- 🗓️ FECHAS
  "fechaCreacion"  TIMESTAMP DEFAULT NOW(),
  "fechaConversion" TIMESTAMP                      -- Si se convirtió, cuándo
);
```

---

## 🎯 Estados del Lead

| Estado | Descripción | Acción Requerida |
|--------|-------------|------------------|
| `nuevo` | 🆕 Recién llegó por WhatsApp | **Contactar en 24h** |
| `contactado` | 📞 Ya se contactó una vez | **Seguimiento en 3 días** |
| `seguimiento` | 📅 En proceso de negociación | **Según agenda programada** |
| `convertido` | ✅ Se convirtió en reserva | **Archivado como éxito** |

## 🗑️ **NUEVO: Sistema de Descarte de Leads**

Cuando un lead no se puede concretar, se mueve a **LeadsDescartados** con información detallada del motivo.

### **Categorías de Descarte**
| Categoría | Descripción | ¿Reactivable? |
|-----------|-------------|---------------|
| `sin_interes` | 😴 Cliente perdió interés, no responde | ❌ No |
| `precio` | 💸 Muy caro, buscó alternativas más baratas | ✅ Sí |
| `fechas` | 📅 No coinciden fechas disponibles | ✅ Sí |
| `competencia` | 🏢 Eligió otra opción, competencia | ✅ Sí |
| `otro` | ❓ Otras razones específicas | 🔄 Depende |

---

## 🔥 Priorización Automática

### **Alta Prioridad** 🔥
- Sin fecha de llegada especificada (urgente)
- Valor estimado > $800,000
- Llegada en los próximos 7 días
- Leads nuevos sin contactar

### **Media Prioridad** 📅  
- Llegada entre 8-60 días
- Valor $300,000 - $800,000
- Ya contactados, en seguimiento

### **Baja Prioridad** ⏰
- Llegada > 60 días  
- Valor < $300,000
- Consultas muy generales

---

## 🚀 Funciones Disponibles

### **1. Crear Lead Automático**
```typescript
import { crearLeadDirecto } from './src/functions/hotel/leads-directos';

// Desde conversación de WhatsApp
const nuevoLead = await crearLeadDirecto({
  telefono: '+57 300 1234567',
  huesped: 'Carlos Mendoza', 
  llegada: '2025-10-15',
  pax: 2,
  apto: 'Apartamento Vista Mar',
  valorEstimado: '650000',
  notas: 'Interesado en descuentos para pareja'
});
```

### **2. Marcar como Contactado**
```typescript
await marcarLeadContactado(
  'WA1734567890_abc123', 
  'Envié cotización por WhatsApp. Interesado pero evaluando opciones.',
  'Juan Pérez'
);
```

### **3. Programar Seguimiento**
```typescript
await programarSeguimiento(
  'WA1734567890_abc123',
  new Date('2025-08-20'),
  'Seguimiento post-cotización. Decisión pendiente.'
);
```

### **4. Descartar Lead**
```typescript
await descartarLead(
  'WA1734567890_abc123',
  'Cliente encontró opción más barata en Booking.com',
  'competencia',
  'María Comercial',
  true, // Puede reactivarse
  new Date('2025-12-01') // Reactivar en temporada alta
);
```

### **5. Convertir Lead**
```typescript
await convertirLead(
  'WA1734567890_abc123',
  '750000', // Valor final
  'Apartamento Premium' // Apartamento final
);
```

### **6. Reactivar Lead Descartado**
```typescript
await reactivarLead(
  'WA1734567890_abc123', // ID original
  'Carlos Comercial',
  'Cliente volvió a preguntar por disponibilidad'
);
```

---

## 📋 Tabla de Gestión Comercial

### **Vista Principal**
```
┌─────────────────────┬─────────────────────┬────────────┬─────┬─────────────────┬─────────────┬───────────┬─────────────────┐
│ Huésped             │ Apto                │ Llegada    │ Pax │ Teléfono        │ Estado Lead │ Prioridad │ Ultima Gestión  │
├─────────────────────┼─────────────────────┼────────────┼─────┼─────────────────┼─────────────┼───────────┼─────────────────┤
│ María García        │ Apartamento Vista   │ 2025-09-15 │   4 │ +57 300 1234567 │ 🆕 Nuevo   │ 🔥 Alta   │ Nunca            │
│ Carlos Mendoza      │ Por definir         │ 2025-10-20 │   2 │ +57 301 9876543 │ 📞 Contact │ 📅 Media  │ Hace 2 días     │
│ Ana Rodríguez       │ Studio Centro       │ 2025-11-05 │   1 │ +57 302 5555555 │ 📅 Seguim  │ ⏰ Baja   │ 2025-08-10      │
└─────────────────────┴─────────────────────┴────────────┴─────┴─────────────────┴─────────────┴───────────┴─────────────────┘
```

### **Consultas Útiles**
```sql
-- Leads pendientes de contactar hoy
SELECT huesped, telefono, prioridad, valorReserva
FROM "LeadsDirectos" 
WHERE estadoLead = 'nuevo' OR 
      (ultimaGestion < NOW() - INTERVAL '3 days' AND estadoLead IN ('contactado', 'seguimiento'))
ORDER BY prioridad ASC, fechaCreacion ASC;

-- Dashboard de conversión  
SELECT 
  estadoLead,
  COUNT(*) as cantidad,
  ROUND(AVG(CAST(valorReserva AS NUMERIC)), 0) as valor_promedio
FROM "LeadsDirectos" 
GROUP BY estadoLead 
ORDER BY cantidad DESC;

-- Top leads por valor
SELECT huesped, telefono, valorReserva, estadoLead
FROM "LeadsDirectos"
WHERE estadoLead IN ('nuevo', 'contactado', 'seguimiento')
ORDER BY CAST(valorReserva AS NUMERIC) DESC
LIMIT 5;

-- 🗑️ CONSULTAS DE LEADS DESCARTADOS
-- Análisis de descartes por categoría
SELECT categoriaDescarte, COUNT(*) as cantidad,
       ROUND(AVG(CAST(valorEstimadoOriginal AS NUMERIC)), 0) as valor_promedio
FROM "LeadsDescartados"
GROUP BY categoriaDescarte
ORDER BY cantidad DESC;

-- Leads candidatos a reactivación
SELECT huesped, telefono, razonDescarte, fechaDescarte,
       valorEstimadoOriginal, fechaReactivacion
FROM "LeadsDescartados"
WHERE puedeReactivarse = true 
  AND (fechaReactivacion <= NOW() OR fechaReactivacion IS NULL)
ORDER BY valorEstimadoOriginal DESC;

-- Verificar si un teléfono fue descartado antes
SELECT huesped, razonDescarte, fechaDescarte, categoriaDescarte
FROM "LeadsDescartados"
WHERE telefono = '+57 300 1234567'
ORDER BY fechaDescarte DESC;

-- Valor perdido por descartes (este mes)
SELECT SUM(CAST(valorEstimadoOriginal AS NUMERIC)) as valor_perdido_mes
FROM "LeadsDescartados"
WHERE DATE_TRUNC('month', fechaDescarte) = DATE_TRUNC('month', NOW());
```

---

## 🤖 Integración con WhatsApp Bot

### **Detección Automática**
El sistema puede detectar automáticamente leads desde conversaciones:

```typescript
// Palabras clave que activan detección de lead
const palabrasClaveReserva = [
  'reservar', 'disponibilidad', 'precio', 'apartamento',
  'habitación', 'alojamiento', 'llegada', 'personas', 'cotización'
];

// Detección automática
await detectarLeadDesdeConversacion(
  "Hola, me interesa reservar un apartamento para el 15 de septiembre",
  "+57 300 1234567",
  "María García"
);
```

### **Workflow Automático**
1. 📱 **Cliente escribe** preguntando por reserva
2. 🤖 **Bot detecta** palabras clave de interés  
3. 🎯 **Sistema crea** lead automático
4. 📊 **Aparece en tabla** de gestión comercial
5. 👨‍💼 **Equipo gestiona** follow-up personalizado

---

## 📈 Métricas y KPIs

### **Dashboard Comercial Completo**
```sql
-- Embudo de conversión completo (incluyendo descartados)
SELECT 
  'Activos' as estado, COUNT(*) as cantidad,
  SUM(CAST(valorReserva AS NUMERIC)) as valor_total
FROM "LeadsDirectos"
WHERE estadoLead IN ('nuevo','contactado','seguimiento')
UNION ALL
SELECT 
  'Convertidos' as estado, COUNT(*) as cantidad,
  SUM(CAST(valorReserva AS NUMERIC)) as valor_total
FROM "LeadsDirectos" WHERE estadoLead = 'convertido'
UNION ALL
SELECT 
  'Descartados' as estado, COUNT(*) as cantidad,
  SUM(CAST(valorEstimadoOriginal AS NUMERIC)) as valor_total
FROM "LeadsDescartados";

-- Tasa de conversión vs descarte
SELECT 
  DATE_TRUNC('month', fechaCreacion) as mes,
  COUNT(*) as leads_creados,
  COUNT(*) FILTER (WHERE estadoLead = 'convertido') as convertidos,
  (SELECT COUNT(*) FROM "LeadsDescartados" 
   WHERE DATE_TRUNC('month', fechaCreacionOriginal) = DATE_TRUNC('month', ld.fechaCreacion)) as descartados,
  ROUND(COUNT(*) FILTER (WHERE estadoLead = 'convertido') * 100.0 / COUNT(*), 2) as tasa_conversion,
  ROUND((SELECT COUNT(*) FROM "LeadsDescartados" 
         WHERE DATE_TRUNC('month', fechaCreacionOriginal) = DATE_TRUNC('month', ld.fechaCreacion)) * 100.0 / COUNT(*), 2) as tasa_descarte
FROM "LeadsDirectos" ld
GROUP BY mes
ORDER BY mes DESC;

-- Performance por responsable (incluyendo descartes)
SELECT 
  COALESCE(ld.responsable, 'Sin asignar') as responsable,
  COUNT(*) FILTER (WHERE ld.estadoLead = 'convertido') as convertidos,
  COUNT(*) FILTER (WHERE ld.estadoLead IN ('nuevo','contactado','seguimiento')) as activos,
  (SELECT COUNT(*) FROM "LeadsDescartados" desc 
   WHERE desc.descartadoPor = ld.responsable) as descartados,
  ROUND(COUNT(*) FILTER (WHERE ld.estadoLead = 'convertido') * 100.0 / 
        NULLIF(COUNT(*) + COALESCE((SELECT COUNT(*) FROM "LeadsDescartados" desc 
                                   WHERE desc.descartadoPor = ld.responsable), 0), 0), 2) as efectividad
FROM "LeadsDirectos" ld
GROUP BY responsable
ORDER BY efectividad DESC;
```

### **Alertas Importantes**
- 🚨 **Leads de alta prioridad** sin gestionar > 24h
- ⏰ **Leads sin contacto** > 3 días  
- 📅 **Seguimientos vencidos** (proximaAccion pasada)
- 🔥 **Leads con llegada** < 7 días sin confirmar
- 🔄 **Leads reactivables** listos para contactar nuevamente
- ⚠️ **Clientes reincidentes** (mismo teléfono descartado múltiples veces)

---

## 🎯 Mejores Prácticas

### **Para el Equipo Comercial**
1. **Respuesta rápida**: Contactar leads nuevos en máximo 24h
2. **Seguimiento constante**: No dejar leads > 3 días sin contacto  
3. **Notas detalladas**: Registrar cada interacción y preferencias
4. **Priorización**: Atender primero alta prioridad y próximas llegadas

### **Para el Bot**
1. **Detección temprana**: Identificar interés desde primera interacción
2. **Captura de datos**: Obtener nombre, fecha, personas, preferencias
3. **Transferencia fluida**: Pasar a gestión humana cuando sea necesario
4. **Seguimiento automático**: Recordatorios de leads pendientes

---

## 🔧 Comandos Útiles

### **Gestión Diaria**
```bash
# Ver leads activos
SELECT huesped, telefono, prioridad FROM "LeadsDirectos" 
WHERE estadoLead IN ('nuevo', 'contactado', 'seguimiento') 
ORDER BY prioridad ASC, fechaCreacion ASC;

# Agenda de seguimiento hoy  
SELECT * FROM "LeadsDirectos"
WHERE DATE(proximaAccion) = CURRENT_DATE
ORDER BY prioridad ASC;

# Leads sin gestionar (urgente)
SELECT * FROM "LeadsDirectos" 
WHERE ultimaGestion IS NULL AND prioridad = 'alta';
```

### **Reportes Semanales**
```typescript
// Estadísticas de la semana
const stats = await obtenerEstadisticasLeads();
console.log(`📊 Esta semana: ${stats.nuevos} nuevos leads, ${stats.convertidos} convertidos`);
console.log(`💰 Tasa de conversión: ${(stats.convertidos/stats.total*100).toFixed(1)}%`);
```

---

## 🎉 Estado del Sistema

### **✅ LeadsDirectos - Sistema Principal**
✅ **Tabla LeadsDirectos creada y operativa**  
✅ **20+ funciones de gestión implementadas**  
✅ **Detección automática de leads funcionando**  
✅ **Dashboard de gestión comercial listo**  
✅ **Integración con WhatsApp Bot activa**

### **🗑️ LeadsDescartados - Sistema de Archivo**
✅ **Tabla LeadsDescartados creada y operativa**
✅ **Sistema de categorización de descartes**
✅ **Funciones de reactivación implementadas**
✅ **Análisis de valor perdido disponible**
✅ **Verificación de historial de descartes**

### **🔄 Flujo Completo del Lead**
1. 📱 **Cliente escribe** por WhatsApp
2. 🤖 **Detección automática** → `LeadsDirectos` (nuevo)
3. 👨‍💼 **Gestión comercial** → contactado → seguimiento  
4. ✅ **Éxito**: convertido → reserva confirmada
5. 🗑️ **No éxito**: descartado → `LeadsDescartados`
6. 🔄 **Posible reactivación** → vuelve a `LeadsDirectos`

**El sistema está 100% listo para gestionar el ciclo completo de leads de WhatsApp desde detección hasta conversión o archivo inteligente.**

---

*Sistema desarrollado para maximizar la conversión de consultas de WhatsApp en reservas confirmadas*

**Estado**: ✅ **OPERATIVO** | **Última actualización**: Agosto 2025