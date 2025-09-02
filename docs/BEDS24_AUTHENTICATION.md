# 🔐 BEDS24 AUTHENTICATION GUIDE

## Overview
Este proyecto utiliza dos tipos de tokens para la integración con Beds24 API:
- **Long Life Token** (lectura): Para consultas de disponibilidad y datos
- **Refresh Token** (escritura): Para operaciones que modifican datos

## 🎯 Token Types

### 1. Long Life Token (`BEDS24_TOKEN`)
- **Propósito**: Operaciones de solo lectura
- **Duración**: Larga duración (meses/años)
- **Uso**: Consultar disponibilidad, propiedades, reservas
- **Restricciones IP**: ❌ No tiene restricciones IP

```javascript
// Uso directo en headers
headers: {
  'token': process.env.BEDS24_TOKEN
}
```

### 2. Refresh Token (`BEDS24_WRITE_REFRESH_TOKEN`)  
- **Propósito**: Generar access tokens temporales para escritura
- **Duración**: Permanente si se usa cada < 30 días
- **Uso**: Crear/modificar/eliminar reservas
- **Restricciones IP**: ✅ Solo funciona desde IP donde se generó
- **Auto-mantenimiento**: ✅ Uso diario mantiene token activo

```javascript
// Flow: Refresh Token → Access Token → API Operation
// 1. Obtener access token
const authResponse = await fetch('https://api.beds24.com/v2/authentication/token', {
  method: 'GET',
  headers: {
    'refreshToken': process.env.BEDS24_WRITE_REFRESH_TOKEN
  }
});
const { token: accessToken } = await authResponse.json();

// 2. Usar access token para operaciones
const response = await fetch('https://api.beds24.com/v2/bookings', {
  method: 'POST',
  headers: {
    'token': accessToken
  },
  body: JSON.stringify(bookingData)
});
```

## 🔄 Authentication Flow

### Read Operations (Simple)
```
Client → Beds24 API
Headers: { token: BEDS24_TOKEN }
```

### Write Operations (Two-Step)
```
Step 1: Client → Beds24 Auth
        GET /v2/authentication/token
        Headers: { refreshToken: BEDS24_WRITE_REFRESH_TOKEN }
        ← Response: { token: "access_token", expiresIn: 86400 }

Step 2: Client → Beds24 API  
        POST/PUT/DELETE /v2/bookings
        Headers: { token: "access_token" }
```

## ⚙️ Implementation

### Client Setup
```typescript
export class Beds24Client {
  private apiToken: string;        // Long life token
  private writeToken: string;      // Refresh token
  
  constructor() {
    this.apiToken = process.env.BEDS24_TOKEN || '';
    this.writeToken = process.env.BEDS24_WRITE_REFRESH_TOKEN || '';
  }
  
  // Método privado para obtener access token
  private async getWriteToken(): Promise<string> {
    const authResponse = await fetch(`${this.baseUrl}/authentication/token`, {
      method: 'GET',
      headers: {
        'refreshToken': this.writeToken
      }
    });
    
    const authData = await authResponse.json();
    if (!authResponse.ok || !authData.token) {
      throw new Error('Refresh token failed');
    }
    
    return authData.token; // Valid for 24 hours
  }
}
```

## 🚨 Important Notes

### IP Restrictions
- **BEDS24_TOKEN**: ✅ Works from any IP
- **BEDS24_WRITE_REFRESH_TOKEN**: ⚠️ Only works from IP where it was generated
- **Access Tokens**: ✅ Work from any IP (inherit from refresh token's IP)

### Token Maintenance
- **Refresh Token Expiry**: 30 days of inactivity
- **Production Reality**: Daily bot usage = auto-maintained ✅
- **No Action Required**: Organic usage keeps tokens alive

### Token Lifecycle
```
Invite Code (1-time) → Refresh Token (permanent*, IP-restricted) → Access Token (24h, IP-free)
                                    ↑
                            *permanent if used < 30 days
                             (daily bot usage = auto-maintained)
```

### Error Handling
```javascript
try {
  const accessToken = await this.getWriteToken();
  // Use access token...
} catch (authError) {
  // Fallback to direct token if available
  if (this.writeToken) {
    return this.writeToken;
  }
  throw new Error('No access token available');
}
```

## 🔧 Configuration

### Environment Variables
```bash
# Read operations (required)
BEDS24_TOKEN="gLNPEkfnMxbKUEVPbvy7EWq/..."

# Write operations (optional)
BEDS24_WRITE_REFRESH_TOKEN="NTEMt84pthHT2EHUE51k/..."

# API Configuration
BEDS24_API_URL="https://api.beds24.com/v2"
BEDS24_TIMEOUT="15000"
```

### Railway Deployment
Both tokens must be configured in Railway environment:
```bash
railway variables --set "BEDS24_TOKEN=your_longlife_token"
railway variables --set "BEDS24_WRITE_REFRESH_TOKEN=your_refresh_token"
```

## 🧪 Testing Tokens

### Test Long Life Token
```bash
railway run node -e "
fetch('https://api.beds24.com/v2/properties', { 
  headers: { 'token': process.env.BEDS24_TOKEN } 
}).then(r => r.json()).then(d => 
  console.log('Properties:', Array.isArray(d) ? d.length : 'Error')
)"
```

### Test Refresh Token
```bash
railway run node -e "
fetch('https://api.beds24.com/v2/authentication/token', {
  method: 'GET',
  headers: { 'refreshToken': process.env.BEDS24_WRITE_REFRESH_TOKEN }
}).then(r => r.json()).then(d => 
  console.log('Access Token:', d.token ? 'OK' : 'Failed')
)"
```

## 📚 API Reference

### Read Endpoints (Use BEDS24_TOKEN)
- `GET /v2/properties` - List properties  
- `GET /v2/inventory/rooms/offers` - Check availability
- `GET /v2/bookings` - Search bookings

### Write Endpoints (Use Access Token from Refresh)
- `POST /v2/bookings` - Create booking
- `PUT /v2/bookings` - Update booking  
- `DELETE /v2/bookings` - Delete booking
- `POST /v2/channels/booking` - Channel actions

---

## 🏁 Summary

✅ **BEDS24_TOKEN**: Long-life read token, works from any IP  
✅ **BEDS24_WRITE_REFRESH_TOKEN**: Tested working from Railway IP  
✅ **Access Token Generation**: 24h tokens via GET + refreshToken header  
✅ **Auto-Maintenance**: Daily bot usage keeps refresh token alive  
⚠️ **IP Dependency**: Write operations tied to Railway IP  

**Last Updated**: September 2024  
**Status**: Both tokens tested and working from Railway