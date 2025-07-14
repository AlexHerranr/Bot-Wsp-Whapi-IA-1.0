# 🔒 Seguridad y Despliegue - TeAlquilamos Bot

## 1. Política de Seguridad: Manejo de Claves/API Keys

- **Nunca subas claves API (OpenAI, Whapi, Beds24, etc.) al repositorio.**
- Si una clave se sube por error, OpenAI la bloqueará automáticamente.
- Las claves deben gestionarse SIEMPRE mediante Google Secret Manager.

---

## 2. Archivos Sensibles y .gitignore

- El archivo `.env` y cualquier archivo de configuración con claves **debe estar en `.gitignore`**.
- Ejemplo de líneas relevantes en `.gitignore`:
  ```
  .env
  .env.local
  cloud-run-config.yaml
  update-env.yaml
  ```
- **Nunca hagas commit de archivos con claves reales.**

---

## 3. Actualización de Claves API en Google Cloud

### a) Actualizar una clave en Secret Manager

Desde la terminal de tu proyecto, ejecuta:

```powershell
echo "NUEVA_API_KEY_AQUI" | gcloud secrets versions add OPENAI_API_KEY --project=gen-lang-client-0318357688 --data-file=-
```

Repite el comando cambiando el nombre del secreto si necesitas actualizar otra clave (por ejemplo, `ASSISTANT_ID`, `WHAPI_TOKEN`, etc.).

### b) Ver versiones de un secreto

```powershell
gcloud secrets versions list OPENAI_API_KEY --project=gen-lang-client-0318357688
```

### c) Ver el valor actual de un secreto (solo para verificar, nunca publiques esto):

```powershell
gcloud secrets versions access latest --secret=OPENAI_API_KEY --project=gen-lang-client-0318357688
```

---

## 4. Despliegue y Recarga de Claves

- El bot toma las claves de Secret Manager automáticamente en cada redeploy.
- Si actualizas una clave y quieres que el bot la use de inmediato, **haz un redeploy**:

```powershell
gcloud run services update bot-wsp-whapi-ia --region=northamerica-northeast1 --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest,ASSISTANT_ID=ASSISTANT_ID:latest,WHAPI_TOKEN=WHAPI_TOKEN:latest" --no-traffic
gcloud run services update-traffic bot-wsp-whapi-ia --region=northamerica-northeast1 --to-latest
```

---

## 5. Comandos útiles de Google Cloud desde la terminal

- **Ver estado del servicio:**
  ```powershell
  gcloud run services describe bot-wsp-whapi-ia --region=northamerica-northeast1
  ```
- **Ver logs recientes:**
  ```powershell
  gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bot-wsp-whapi-ia" --limit=10
  ```
- **Ver health check del bot:**
  ```powershell
  Invoke-WebRequest -Uri "https://bot-wsp-whapi-ia-5ydonvm2xa-nn.a.run.app/health" -UseBasicParsing
  ```

---

## 6. Flujo de trabajo recomendado

1. **Desarrollo local:**  
   - Usa `.env` (no lo subas).
   - `npm run dev`

2. **Actualización de claves:**  
   - Usa los comandos de Secret Manager (ver arriba).

3. **Despliegue:**  
   - Haz push a `master` para trigger automático, o usa comandos de Cloud Run para redeploy manual.

4. **Verificación:**  
   - Usa health check y logs para confirmar que todo funciona.

---

## 7. Archivos relevantes tras la limpieza

- `.env` (local, ignorado)
- `.gitignore` (asegura que archivos sensibles no se suban)
- `scripts/update-keys.ps1` (útil para actualizar claves rápido)
- `cloudbuild.yaml` (configuración de despliegue, sin claves)
- **NO** debe haber archivos como `update-env.yaml` o `cloud-run-config.yaml` en el repo.

---

**Última actualización:** Julio 2025 