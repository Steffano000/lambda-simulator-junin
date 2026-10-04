# Fase 6 · Origen y frescura de los datos

## Qué cambió

- **Registro de fuentes** (`src/data/fuentes.ts`): para cada fuente se indica el proveedor, el modo, el tiempo de vigencia, cada cuánto cambia y para qué se usa.

  | Modo               | Fuentes                                                       | Comportamiento                                                                 |
  | ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
  | Local (pipeline)   | clima, suelo, relieve, uso de suelo, NDVI (public/data/junin) | se cargan una vez por sesión; su fecha es la de descarga del pipeline          |
  | En vivo + respaldo | casas (OpenStreetMap)                                         | copia guardada 24 h en el navegador; si OSM falla, se usa la última y se avisa |
  | En vivo            | NASA GIBS, Esri, EOX                                          | se piden en cada uso; si fallan, la app lo dice                                |
  | Opcional           | servidor TIF a 30 m                                           | solo si existe `VITE_API_URL`                                                  |

- **Registro de consultas** (`src/data/registro.ts`): cada pedido de archivos locales, casas, imágenes y servidor queda anotado con la hora, el tiempo que tardó, cómo terminó (ok, falló, copia vieja u omitido) y un mensaje.
- **Panel «Origen y frescura de los datos»** (último paso del mapa): muestra cuándo se generaron los datos locales y hasta qué mes hay clima observado (después es pronóstico). Para cada fuente da la fecha del dato y su última consulta. Incluye el botón **Actualizar datos** y el registro de las últimas 50 consultas.
- **Actualizar datos**: olvida la caché de la sesión, vuelve a pedir los JSON (`cache: no-cache`), vuelve a consultar las casas sin usar la copia guardada y rearma la parcela abierta.
- **Chequeo de salud** (`npm run salud`, `scripts/salud-fuentes.mjs`): revisa que cada archivo del manifiesto exista, sea JSON válido y no tenga NaN ni Infinity. Avisa si los datos tienen más de 45 días y prueba GIBS, Esri, EOX, OSM y el servidor. Sale con código 1 si fallan los datos locales.

## Pruebas

`src/data/fuentes.test.ts`:

- Cada fuente declara su actualización y su uso.
- Se toma la fecha de descarga más reciente de cada paso del pipeline.
- Una copia vence después de su vigencia.
- Casas sin red pero con copia guardada: se usa el respaldo y se registra como «copia vieja».
- Casas sin red y sin copia: error explícito, nunca «no hay casas».
- Dentro de las 24 h no se vuelve a consultar OSM.

## No verificado

- `npm run salud` desde el entorno de pruebas: los datos locales salieron OK, pero los servicios en vivo dieron 403 por el proxy de ese entorno. Hay que correrlo en tu computadora.
