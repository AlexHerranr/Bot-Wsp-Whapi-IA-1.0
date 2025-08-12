# Operaciones Provisionales (Hotel Ops)

Carpeta para scripts y utilidades de soporte operativo que NO forman parte del runtime del bot.

Principios:
- No importar estos archivos desde el core del bot ni registrarlos como plugins.
- Usar únicamente cuando se necesiten tareas puntuales (dump de datos, actualizaciones masivas, migraciones pequeñas, verificaciones).
- Cargar secretos desde variables de entorno, no hardcodear.

Estructura:
- `beds24/`: utilidades y scripts temporales para interactuar con la API de Beds24.
- `whapi/`: utilidades y scripts temporales para interactuar con la API de WHAPI.

Sugerencia de ejecución (sin tocar el runtime):
- Usar `tsx` o `ts-node` desde la raíz del proyecto, apuntando a archivos dentro de `src/plugins/hotel/ops/**`.
- Ejemplo:
  - `npx tsx src/plugins/hotel/ops/beds24/example.ts`
  - `npx tsx src/plugins/hotel/ops/whapi/example.ts`

Nota: Estos ejemplos exportan funciones y no ejecutan nada por defecto. Puedes temporalmente añadir un `main()` al final del archivo que quieras ejecutar y luego retirarlo.


