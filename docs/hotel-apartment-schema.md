# Hotel Apartment Schema - extraCharges JSONB

## Esquema Fijo para extraCharges

El campo `extraCharges` es un JSONB que debe seguir esta estructura estricta:

```json
{
  "parking": 15000,      // Parqueadero por día
  "cleaning": 50000,     // Limpieza final 
  "late_checkin": 25000, // Check-in después de 10pm
  "early_checkout": 0,   // Check-out antes de 6am
  "extra_guest": 30000   // Huésped adicional por noche
}
```

## Reglas:
- Todos los valores son números (pesos colombianos)
- 0 significa "sin cargo"
- null o campo faltante = no aplica
- Campos permitidos: parking, cleaning, late_checkin, early_checkout, extra_guest

## Ejemplo de uso:
```typescript
const apartment = {
  roomId: 378318,
  apartmentName: "Aparta Estudio 1722-B",
  maxAdults: 4,
  maxChildren: 2,
  extraCharges: {
    parking: 15000,
    cleaning: 50000,
    late_checkin: 0,
    extra_guest: 30000
  }
}
```