# 🚀 Funcionalidades Futuras con PostgreSQL

## 📋 Resumen

PostgreSQL habilita funcionalidades avanzadas de marketing, análisis y gestión de clientes que no son posibles con archivos JSON.

## 🎯 Funcionalidades de Marketing

### **1. Base de Datos de Clientes Históricos**

#### **Propósito:**
Mantener historial completo de todos los clientes, incluso los inactivos, para campañas de marketing y análisis.

#### **Estructura:**
```sql
CREATE TABLE historical_clients (
    id SERIAL PRIMARY KEY,
    phone_number TEXT UNIQUE,
    user_name TEXT,
    contact_name TEXT,
    labels JSONB,
    total_interactions INTEGER DEFAULT 0,
    last_interaction TIMESTAMP,
    booking_status TEXT, -- 'booked', 'interested', 'inactive', 'lost'
    marketing_consent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP
);
```

#### **Uso:**
```sql
-- Mover clientes inactivos a tabla histórica
INSERT INTO historical_clients (phone_number, user_name, labels, booking_status)
SELECT phone_number, user_name, labels, 'inactive'
FROM guest_profiles 
WHERE last_interaction < NOW() - INTERVAL '30 days';
```

### **2. Análisis de Conversión**

#### **Métricas Clave:**
```sql
-- Tasa de conversión por etiqueta
SELECT 
    labels,
    COUNT(*) as total_clients,
    COUNT(CASE WHEN booking_status = 'booked' THEN 1 END) as bookings,
    ROUND(
        COUNT(CASE WHEN booking_status = 'booked' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as conversion_rate
FROM historical_clients 
GROUP BY labels;

-- Clientes más activos
SELECT 
    phone_number,
    user_name,
    total_interactions,
    last_interaction
FROM historical_clients 
WHERE booking_status = 'interested'
ORDER BY total_interactions DESC
LIMIT 10;
```

#### **Dashboard de Marketing:**
```sql
-- Resumen general para dashboard
SELECT 
    COUNT(*) as total_clients,
    COUNT(CASE WHEN booking_status = 'booked' THEN 1 END) as total_bookings,
    COUNT(CASE WHEN booking_status = 'interested' THEN 1 END) as interested_clients,
    COUNT(CASE WHEN last_interaction > NOW() - INTERVAL '7 days' THEN 1 END) as active_this_week,
    AVG(total_interactions) as avg_interactions_per_client
FROM historical_clients;
```

### **3. Campañas de Re-engagement**

#### **Segmentación de Clientes:**
```sql
-- Clientes inactivos por más de 90 días
SELECT phone_number, user_name, last_interaction
FROM historical_clients 
WHERE last_interaction < NOW() - INTERVAL '90 days'
AND marketing_consent = true
AND booking_status != 'booked';

-- Clientes interesados en cotizaciones
SELECT phone_number, user_name, labels
FROM historical_clients 
WHERE labels @> '["cotización"]'::jsonb 
AND booking_status = 'interested'
AND last_interaction > NOW() - INTERVAL '30 days';

-- Clientes que reservaron antes
SELECT phone_number, user_name, last_interaction
FROM historical_clients 
WHERE booking_status = 'booked'
AND last_interaction < NOW() - INTERVAL '6 months';
```

#### **Automatización de Campañas:**
```sql
-- Clientes para campaña de "Vuelve a visitarnos"
SELECT 
    phone_number,
    user_name,
    last_interaction,
    CASE 
        WHEN last_interaction < NOW() - INTERVAL '6 months' THEN 'campaña_anual'
        WHEN last_interaction < NOW() - INTERVAL '3 months' THEN 'campaña_trimestral'
        ELSE 'campaña_mensual'
    END as tipo_campaña
FROM historical_clients 
WHERE booking_status = 'booked'
AND marketing_consent = true;
```

## 📊 Análisis Avanzado

### **1. Análisis Temporal**

#### **Patrones de Actividad:**
```sql
-- Actividad por hora del día
SELECT 
    EXTRACT(HOUR FROM last_interaction) as hora,
    COUNT(*) as mensajes
FROM guest_profiles 
WHERE last_interaction > NOW() - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM last_interaction)
ORDER BY hora;

-- Actividad por día de la semana
SELECT 
    EXTRACT(DOW FROM last_interaction) as dia_semana,
    COUNT(*) as mensajes
FROM guest_profiles 
WHERE last_interaction > NOW() - INTERVAL '30 days'
GROUP BY EXTRACT(DOW FROM last_interaction)
ORDER BY dia_semana;
```

#### **Tendencias de Crecimiento:**
```sql
-- Nuevos clientes por mes
SELECT 
    DATE_TRUNC('month', created_at) as mes,
    COUNT(*) as nuevos_clientes
FROM guest_profiles 
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mes DESC;
```

### **2. Análisis de Etiquetas**

#### **Efectividad de Etiquetas:**
```sql
-- Etiquetas más efectivas para conversión
SELECT 
    label,
    COUNT(*) as total_usuarios,
    COUNT(CASE WHEN booking_status = 'booked' THEN 1 END) as conversiones,
    ROUND(
        COUNT(CASE WHEN booking_status = 'booked' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as tasa_conversion
FROM (
    SELECT 
        jsonb_array_elements_text(labels) as label,
        booking_status
    FROM historical_clients
) subquery
GROUP BY label
ORDER BY tasa_conversion DESC;
```

#### **Correlación de Etiquetas:**
```sql
-- Etiquetas que aparecen juntas
SELECT 
    label1,
    label2,
    COUNT(*) as frecuencia
FROM (
    SELECT 
        a.label as label1,
        b.label as label2
    FROM (
        SELECT phone_number, jsonb_array_elements_text(labels) as label
        FROM historical_clients
    ) a
    JOIN (
        SELECT phone_number, jsonb_array_elements_text(labels) as label
        FROM historical_clients
    ) b ON a.phone_number = b.phone_number AND a.label < b.label
) combinations
GROUP BY label1, label2
ORDER BY frecuencia DESC
LIMIT 10;
```

## 🎯 Funcionalidades de Gestión

### **1. Sistema de Notas y Seguimiento**

#### **Estructura:**
```sql
CREATE TABLE client_notes (
    id SERIAL PRIMARY KEY,
    phone_number TEXT REFERENCES historical_clients(phone_number),
    note_type TEXT, -- 'general', 'preference', 'issue', 'follow_up'
    content TEXT,
    created_by TEXT, -- 'bot', 'agent', 'system'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **Uso:**
```sql
-- Agregar nota de seguimiento
INSERT INTO client_notes (phone_number, note_type, content, created_by)
VALUES ('573003913251', 'follow_up', 'Cliente interesado en apartamento 2 habitaciones', 'agent');

-- Ver historial de notas
SELECT 
    cn.content,
    cn.note_type,
    cn.created_at,
    hc.user_name
FROM client_notes cn
JOIN historical_clients hc ON cn.phone_number = hc.phone_number
WHERE cn.phone_number = '573003913251'
ORDER BY cn.created_at DESC;
```

### **2. Sistema de Prioridades**

#### **Cálculo Automático de Prioridad:**
```sql
-- Función para calcular prioridad de cliente
CREATE OR REPLACE FUNCTION calculate_client_priority(phone_number TEXT)
RETURNS INTEGER AS $$
DECLARE
    priority INTEGER := 0;
    client_record RECORD;
BEGIN
    SELECT * INTO client_record 
    FROM historical_clients 
    WHERE phone_number = $1;
    
    -- Base priority
    priority := 10;
    
    -- Booking status bonus
    IF client_record.booking_status = 'booked' THEN
        priority := priority + 50;
    ELSIF client_record.booking_status = 'interested' THEN
        priority := priority + 30;
    END IF;
    
    -- Activity bonus
    IF client_record.last_interaction > NOW() - INTERVAL '7 days' THEN
        priority := priority + 20;
    ELSIF client_record.last_interaction > NOW() - INTERVAL '30 days' THEN
        priority := priority + 10;
    END IF;
    
    -- Interaction count bonus
    priority := priority + LEAST(client_record.total_interactions * 2, 20);
    
    RETURN priority;
END;
$$ LANGUAGE plpgsql;
```

#### **Lista de Clientes Prioritarios:**
```sql
-- Clientes con mayor prioridad para seguimiento
SELECT 
    phone_number,
    user_name,
    booking_status,
    total_interactions,
    last_interaction,
    calculate_client_priority(phone_number) as priority_score
FROM historical_clients 
WHERE last_interaction > NOW() - INTERVAL '90 days'
ORDER BY calculate_client_priority(phone_number) DESC
LIMIT 20;
```

## 🤖 Integración con IA

### **1. Análisis Predictivo**

#### **Predicción de Conversión:**
```sql
-- Factores que predicen conversión
SELECT 
    CASE 
        WHEN total_interactions > 10 THEN 'high_engagement'
        WHEN total_interactions > 5 THEN 'medium_engagement'
        ELSE 'low_engagement'
    END as engagement_level,
    COUNT(*) as total_clients,
    COUNT(CASE WHEN booking_status = 'booked' THEN 1 END) as conversions,
    ROUND(
        COUNT(CASE WHEN booking_status = 'booked' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as conversion_rate
FROM historical_clients 
GROUP BY engagement_level
ORDER BY conversion_rate DESC;
```

#### **Segmentación Automática:**
```sql
-- Clientes por segmento automático
SELECT 
    phone_number,
    user_name,
    CASE 
        WHEN booking_status = 'booked' AND last_interaction > NOW() - INTERVAL '6 months' THEN 'repeat_customer'
        WHEN booking_status = 'booked' THEN 'new_customer'
        WHEN total_interactions > 10 THEN 'high_interest'
        WHEN total_interactions > 5 THEN 'medium_interest'
        ELSE 'low_interest'
    END as segment
FROM historical_clients;
```

### **2. Personalización de Respuestas**

#### **Perfil de Cliente para IA:**
```sql
-- Generar contexto personalizado para OpenAI
SELECT 
    phone_number,
    user_name,
    booking_status,
    total_interactions,
    labels,
    CASE 
        WHEN booking_status = 'booked' THEN 'Cliente que ya reservó'
        WHEN total_interactions > 10 THEN 'Cliente muy interesado'
        WHEN last_interaction < NOW() - INTERVAL '30 days' THEN 'Cliente inactivo'
        ELSE 'Cliente regular'
    END as client_type
FROM historical_clients 
WHERE phone_number = '573003913251';
```

## 📈 APIs para Marketing

### **1. API de Segmentación**

#### **Endpoint: GET /api/marketing/segments**
```typescript
// Retorna clientes por segmento
interface MarketingSegment {
    segment: string;
    clients: Client[];
    count: number;
    conversion_rate: number;
}

// Uso:
GET /api/marketing/segments?type=inactive&days=90
```

#### **Endpoint: POST /api/marketing/campaign**
```typescript
// Crear campaña de marketing
interface Campaign {
    name: string;
    segment: string;
    message: string;
    scheduled_date: string;
}

// Uso:
POST /api/marketing/campaign
{
    "name": "Re-engagement 90 días",
    "segment": "inactive_90_days",
    "message": "¡Hola! Tenemos ofertas especiales para ti",
    "scheduled_date": "2025-01-20T10:00:00Z"
}
```

### **2. API de Análisis**

#### **Endpoint: GET /api/analytics/conversion**
```typescript
// Métricas de conversión
interface ConversionMetrics {
    total_clients: number;
    total_bookings: number;
    conversion_rate: number;
    by_segment: SegmentMetrics[];
    by_time_period: TimeMetrics[];
}

// Uso:
GET /api/analytics/conversion?period=30_days
```

## 🔄 Automatización

### **1. Tareas Programadas**

#### **Limpieza Automática:**
```sql
-- Mover clientes inactivos a tabla histórica (ejecutar diariamente)
INSERT INTO historical_clients (phone_number, user_name, labels, booking_status)
SELECT phone_number, user_name, labels, 'inactive'
FROM guest_profiles 
WHERE last_interaction < NOW() - INTERVAL '30 days'
ON CONFLICT (phone_number) DO NOTHING;
```

#### **Actualización de Métricas:**
```sql
-- Actualizar total_interactions (ejecutar semanalmente)
UPDATE historical_clients 
SET total_interactions = (
    SELECT COUNT(*) 
    FROM guest_profiles 
    WHERE phone_number = historical_clients.phone_number
);
```

### **2. Alertas Automáticas**

#### **Clientes de Alto Valor:**
```sql
-- Alertar sobre clientes que podrían reservar
SELECT 
    phone_number,
    user_name,
    total_interactions,
    last_interaction
FROM historical_clients 
WHERE booking_status = 'interested'
AND total_interactions > 15
AND last_interaction > NOW() - INTERVAL '7 days';
```

## 📊 Dashboard de Marketing

### **1. Métricas Principales**
- Total de clientes activos
- Tasa de conversión
- Clientes por segmento
- Actividad reciente

### **2. Campañas Activas**
- Campañas programadas
- Resultados de campañas
- ROI por campaña

### **3. Análisis de Tendencias**
- Crecimiento de clientes
- Patrones de actividad
- Efectividad de etiquetas

## 🎯 Roadmap de Implementación

### **Fase 1: Base (Completada)**
- ✅ Migración a PostgreSQL
- ✅ Cache de contexto
- ✅ Estructura básica

### **Fase 2: Análisis (Próxima)**
- 📊 Dashboard básico
- 📈 Métricas de conversión
- 🎯 Segmentación simple

### **Fase 3: Marketing (Futura)**
- 📧 Campañas automatizadas
- 🤖 IA predictiva
- 📱 APIs de marketing

### **Fase 4: Avanzado (Futura)**
- 🎯 Personalización avanzada
- 📊 Análisis predictivo
- 🔄 Automatización completa

## 💡 Beneficios Esperados

### **Inmediatos:**
- 📊 Datos persistentes y confiables
- 🎯 Análisis de clientes en tiempo real
- 📈 Métricas de conversión precisas

### **Mediano Plazo:**
- 📧 Campañas de marketing efectivas
- 🤖 Respuestas personalizadas
- 📊 Decisiones basadas en datos

### **Largo Plazo:**
- 🎯 Marketing automatizado
- 📈 Crecimiento sostenible
- 💰 ROI optimizado

¡PostgreSQL abre un mundo de posibilidades para el crecimiento del negocio! 🚀 