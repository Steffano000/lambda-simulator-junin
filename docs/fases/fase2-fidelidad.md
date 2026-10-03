# Fase 2 · Fidelidad por tamaño de chunk

## Qué cambió

- **Registro de resoluciones** (`src/domain/junin/resolucion.ts`, `CAPAS`): fuente, resolución nativa y cómo llega cada capa al chunk.

  | Capa             | Fuente                                 | Nativa | En la ventana de 30 m       | Fuera de la ventana |
  | ---------------- | -------------------------------------- | ------ | --------------------------- | ------------------- |
  | Uso de suelo     | ESA WorldCover v200 (2021)             | 10 m   | clase más frecuente en 30 m | moda en ~1 km       |
  | Altura           | SRTM                                   | 90 m   | bilineal                    | promedio ~1 km      |
  | Pendiente        | derivada de SRTM                       | 90 m   | celda de 30 m               | media ~1 km         |
  | Suelo            | SoilGrids 2.0, 0-30 cm                 | 250 m  | vecino más cercano          | ~1 km               |
  | NDVI             | Sentinel-2 SR, compuesto a 250 m       | 250 m  | vecino más cercano          | promedio ~1 km      |
  | Clima            | ERA5-Land 0.1° + PISCO v3 en 10 puntos | ~10 km | punto más cercano           | punto más cercano   |
  | Casas            | OpenStreetMap (en vivo)                | vector | contorno + 5 m              | contorno + 5 m      |
  | Áreas protegidas | WDPA (incluye ANP del SERNANP)         | vector | contorno                    | contorno            |

- **Resolución efectiva** de una capa en un chunk = la nativa, nunca más fina que la grilla usada (30 m o ~1 km): remuestrear no agrega detalle.
- **Fidelidad por chunk y por capa**: `real` (dato ≥ chunk), `remuestreado` (chunk más chico que el píxel: hereda el valor, sus vecinos tienen el mismo) y `extrapolado` (clima de un punto más lejano que su celda de 10 km).
- **Mapa**: capa «Fidelidad» en el paso 6, con selector «La más baja / Uso de suelo / Altura / Suelo / Clima». El inspector muestra la fidelidad de cada capa del chunk bajo el cursor.
- **3D**: botón «Fidelidad» en la barra (solo con parcela real), con su leyenda; pinta la más baja de uso de suelo, relieve y suelo.
- **Paso 3**: selector de tamaño de chunk (automático recomendado, o 1-900 m sin pasar del límite), tabla «Resolución efectiva» con advertencias, y el texto «¿Por qué chunks de X m?» separa _dibujar_ (1 m = un surco) de _calcular_ (30 m como máximo detalle real).
- **Límite por equipo** (`src/data/junin/dispositivo.ts`): pantallas táctiles o equipos de ≤ 2 núcleos / ≤ 2 GB usan 50 × 50 chunks como máximo (escritorio: 100 × 100). El panel lo dice.
- **Servidor** (`server/main.py`): `POST /parcela?celda_m=…` acepta el tamaño elegido y lo valida con los mismos límites.
- **Redondeo**: un cuadrado de 300 m ya no pasa a chunks de 5 m por un error de coma flotante (ahora 3 m, 100 × 100); misma tolerancia en la app y el servidor.

## Casos de prueba

| Caso                                      | Chunk | Resolución efectiva | Uso de suelo     | Suelo             | Clima           |
| ----------------------------------------- | ----- | ------------------- | ---------------- | ----------------- | --------------- |
| 1 ha en Jauja (ventana de 30 m)           | 1 m   | 30 m                | remuestreado ×30 | remuestreado ×250 | remuestreado    |
| La misma parcela                          | 30 m  | 30 m                | **real**         | remuestreado ×8   | remuestreado    |
| Huayao 9 ha (automático en escritorio)    | 3 m   | 30 m                | remuestreado ×10 | remuestreado ×83  | remuestreado    |
| 4 ha fuera de las ventanas, punto a 18 km | 2 m   | 1 km                | remuestreado     | remuestreado      | **extrapolado** |

El área y el rendimiento total no cambian con el tamaño de chunk (fracción exacta; diferencia < 0.5 %, probado).

## Pendiente / no verificado

- El límite de 50 × 50 en celulares no se probó en un teléfono real (solo con Chromium sin cabeza, que también entra como equipo modesto).
- La fidelidad del clima por distancia se refina en la Fase 3 (niveles de confianza ≤ 10 / 10-25 / > 25 km y corrección por altura).
- La «resolución» de las casas de OSM depende de quién las mapeó; se marca como vector (exacta) pero puede faltar alguna.
