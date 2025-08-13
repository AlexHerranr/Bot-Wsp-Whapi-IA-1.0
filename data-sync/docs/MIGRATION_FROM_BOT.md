## Migración desde el bot

1. Mantén el bot usando `DatabaseService` hasta completar Fase 2.
2. Cuando `data-sync` esté estable, evalúa exponer lecturas por HTTP (opcional) o mantener acceso directo a BD compartida.
3. Al extraer a repo propio (Fase 5), el bot podrá consumir endpoints (`/bookings`, `/leads`, etc.) o seguir usando la misma BD.

