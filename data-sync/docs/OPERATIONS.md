## Operaciones

### Backups (Windows)

1) Configura `DATABASE_URL` en `data-sync/.env`.
2) Ejecuta:

```powershell
pwsh -File .\scripts\windows\backup-db.ps1
```

Salida: `data-sync/backups/backup-YYYYMMDD-HHMMSS.dump`

Restore ejemplo:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" --dbname=$env:DATABASE_URL --clean --if-exists --no-owner --no-privileges .\data-sync\backups\backup-YYYYMMDD-HHMMSS.dump
```

Recomendado: programar tarea diaria 02:00 y subir el dump a almacenamiento externo (OneDrive/Drive/S3).

### Cutover (mover BD a otro proyecto)

1) Provisión de nueva BD → `prisma migrate deploy` → aplicar `prisma/views.sql`.
2) pg_dump origen → pg_restore destino.
3) Cambiar `DATABASE_URL` en bot y data-sync → validar `/health` y consultas.
4) Mantener BD antigua en read-only como backup temporal.

