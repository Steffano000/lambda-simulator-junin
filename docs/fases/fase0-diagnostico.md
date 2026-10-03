# Fase 0 · Diagnóstico de Lambda Simulator · Junín

Revisión de solo lectura del código en el commit `262dd2f` (rama `version-mejorada-junin`). No se cambió ningún archivo. Las referencias son `archivo:línea`.

## Resumen en 5 líneas

1. Lo que se **ve** (NASA GIBS, Esri, EOX) se pide en vivo, tesela por tesela. Lo que se **calcula** sale de JSON precalculados el 2 de octubre de 2026; ningún cálculo usa la fecha del mapa.
2. El clima de toda la parcela es el del punto con datos más cercano, sin distancia máxima ni corrección por altura. Una parcela a 4 100 m recibe el mismo rendimiento que el valle.
3. No existe un estado "sin dato" por chunk. Los nulos se rellenan con valores por defecto en silencio: pH 6.5, materia orgánica 2 %, P 25, K 150, humedad 50 % y la textura dominante; un pH desconocido cuenta como apto.
4. Áreas protegidas, diferencia de altura y distancia al punto solo generan texto naranja; no cambian "Se puede sembrar" ni el rendimiento.
5. El 3D usa columnas flotantes de un bloque, que se ven escalonadas. Las nubes están a una altura fija según el tamaño de la grilla, sin mirar el relieve, y pueden cortar el terreno.

**Correcciones a supuestos del documento de fases:**

- Los chunks no son "siempre de 2 m": van de 1 a 30 m o más, según el tamaño de la parcela (`parcela.ts:100-112`).
- No hay "río" en el código: las celdas azules son agua de WorldCover (código 80, bloqueada) o canales de riego del simulador.
- "VIPS" en el documento es VIIRS.

---

## A. Datos: en vivo, precalculados o fijos

| Fuente                                   | Cómo llega a la app                                                                   | Frescura del dato                                                                | Caché                                                              | Si falla                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| NASA GIBS: MODIS y VIIRS color verdadero | En vivo, teselas WMTS (`colores.ts:297-300`, `MapaJunin.tsx:112`)                     | La fecha del selector; MODIS a veces tiene franjas sin imagen sobre Junín        | Solo la caché HTTP del navegador                                   | Con más de 3 errores de tesela avisa "Sin imagen…" (`MapaJunin.tsx:117-123`). **Una tesela negra con respuesta 200 no se detecta.** |
| NASA GIBS: HLS S30 30 m                  | En vivo, encima de MODIS                                                              | Cada 2 a 5 días según pasada                                                     | Navegador                                                          | Igual que la anterior; donde no hubo pasada, transparente                                                                           |
| NDVI MODIS 16 días                       | En vivo; la fecha se ajusta al compuesto de unos 32 días antes (`colores.ts:284-295`) | ~5 semanas de retraso                                                            | Navegador                                                          | Sin aviso específico                                                                                                                |
| SMAP L4 humedad                          | En vivo, fecha −4 días                                                                | ~4 días                                                                          | Navegador                                                          | Sin aviso específico                                                                                                                |
| IMERG lluvia                             | En vivo, fecha −1 día                                                                 | ~1 día                                                                           | Navegador                                                          | Sin aviso específico                                                                                                                |
| Esri World Imagery y nombres             | En vivo (`colores.ts:194-205`); nativo hasta zoom 17                                  | Fecha de toma variable según zona; Esri no la expone                             | Navegador                                                          | Sin aviso                                                                                                                           |
| EOX Sentinel-2 sin nubes                 | En vivo (`colores.ts:208`)                                                            | Compuesto 2023                                                                   | Navegador                                                          | Sin aviso                                                                                                                           |
| ERA5-Land, ET₀ FAO-56, clima mensual     | **Precalculado** (`public/data/junin/clima/*`)                                        | Diario hasta **2026-09-24**; mensual hasta **2026-08**; climatología 1991-2020   | En memoria durante la sesión, sin TTL (`JuninDataSource.ts:34-44`) | El núcleo o la grilla fallan con mensaje "No se pudieron cargar los datos" (`JuninController.ts:69`)                                |
| PISCO (corrección de lluvia)             | Precalculado; ya aplicado a la lluvia de ERA5-Land                                    | 1981-2025; factores fijos                                                        | Sesión                                                             | Igual                                                                                                                               |
| Pronóstico SARIMAX y 5 escenarios        | Precalculado (`app/simulador_escenarios.json`)                                        | Generado el 2026-10-02; observado hasta 2026-08; horizonte **2026-09 → 2028-08** | Sesión                                                             | Igual                                                                                                                               |
| FAO-56 (balance) y AquaCrop              | Precalculado por punto, cultivo y escenario                                           | Misma corrida (2026-10-02)                                                       | Sesión                                                             | Igual                                                                                                                               |
| SoilGrids 0-30 cm                        | Precalculado: grilla de 1 km y 10 parcelas a 30 m                                     | Estático (SoilGrids 2.0)                                                         | Sesión                                                             | **Si falla una parcela de 30 m, se descarta en silencio** (`JuninController.ts:65`) y esa zona usa la grilla de 1 km sin avisar     |
| ESA WorldCover                           | Precalculado (1 km por moda; 30 m en las parcelas)                                    | 2021                                                                             | Sesión                                                             | Igual                                                                                                                               |
| Áreas protegidas (WDPA)                  | Precalculado (GeoJSON)                                                                | Descarga del paso 10                                                             | Sesión                                                             | Si falla, no se evalúa y no hay aviso específico                                                                                    |
| DRA (rendimiento y precio)               | Precalculado (`catalogo_cultivos_junin.json`)                                         | Estadística de 2022                                                              | Sesión                                                             | Igual que el núcleo                                                                                                                 |
| ENSO OISST                               | Precalculado                                                                          | Hasta 2026-09                                                                    | Sesión                                                             | Solo para análisis                                                                                                                  |
| Servidor Fase 2 (opcional)               | En vivo si existe `VITE_API_URL` (`servidor.ts:8-30`)                                 | TIF locales                                                                      | No                                                                 | Tiempo límite de 2.5 s; si falla, vuelve a los datos locales; avisa solo si la URL está configurada                                 |

**¿La fecha del mapa afecta los cálculos? No.** `fecha` solo se lee en `urlGibs` y `fechaCapa` (`colores.ts:284-300`) y en `MapaJunin.tsx`. En `src/domain/junin/*`, `useJunin.ts` y el resto del controlador no aparece. Lo que la interfaz dice ("no entran en los cálculos") es cierto.

**Nada se actualiza solo.** Para refrescar los datos hay que correr `pipeline\EJECUTAR_PRONOSTICO.bat` y `EJECUTAR_EXPORTAR_JSON.bat`. No hay job programado ni TTL, y la interfaz no muestra la fecha de cada dato (`manifest.json` sí la tiene: `generado: 2026-10-02T21:24`).

## B. Celdas sin dato: cómo se rellena cada chunk

**Clima:** no es por chunk. Toda la parcela usa el punto más cercano (`simulador.ts:37`, `JuninController.ts:149`), **sin distancia máxima**. La distancia y la diferencia de altura solo se muestran como texto (`PanelJunin.tsx:362` si supera 400 m, `:369` si supera 25 km).

**Suelo, cobertura, altura y pendiente** (`parcela.ts:181-251`):

- **Dentro de una de las 10 ventanas de 30 m:** el valor es el de la celda de 30 m que contiene al chunk. La altura se interpola de forma bilineal (`:215`); la fuente queda como `'30m'`.
- **Fuera de esas ventanas:** se usa la celda de la grilla de ~1 km. La altura es bilineal (`:240`) y la fuente queda como `'1km'`. Toda una chacra queda con un solo valor de suelo y cobertura.
- **Sin dato (nulo):** el valor queda `null` en el chunk. Pasa en zona urbana o agua, donde SoilGrids no tiene dato. Después se rellena **en silencio**:
  - en el puente al 3D: textura → la clase dominante o `'Franco'` (`puente.ts:60, 83`); pH → el pH medio o **6.5** (`:91`); materia orgánica → **2 %** (`:84`); P **25** y K **150** fijos (`:94-95`); humedad **50 %** (`:98`);
  - en el rendimiento: un pH nulo cuenta como apto (`aptitudPh` devuelve 1, `parcela.ts:332`); la aptitud faltante vale 1 (`simulador.ts:205, 262`).
- **No existe un indicador "sin dato" por chunk.** Solo están `fuente` (`30m`/`1km`) y `regla` (permitido/advertencia/bloqueado).

**Línea base medida hoy** (cuadrados generados por código; para comparar en las fases siguientes):

| Caso                                    | Área    | Chunk | Apta                     | Altura             | Punto (rend. papa, escenario normal) | Rend. parcela | Observación                                            |
| --------------------------------------- | ------- | ----- | ------------------------ | ------------------ | ------------------------------------ | ------------- | ------------------------------------------------------ |
| Centro de Huancayo, 65.6 m de lado      | 0.43 ha | 1 m   | **No** (100 % bloqueado) | 3 263 m            | huancayo 14.32                       | 0             | pH nulo en los 4 356 chunks                            |
| Centro de Jauja, 100 m de lado          | 1.00 ha | 2 m   | No (urbano)              | 3 388 m            | jauja 15.89                          | 0             | Cae en zona urbana                                     |
| Puna al oeste de Jauja (-11.62, -75.60) | 1.00 ha | 2 m   | **Sí**                   | **4 101 m (puna)** | jauja 15.89                          | **15.89**     | Mismo rendimiento que el valle, a ~700 m más de altura |

Las parcelas exactas de tus capturas (Jauja/Suni de 1 ha, a 28.2 km del punto; Huancayo de 0.43 ha) no se pueden reproducir sin sus coordenadas. Para que sirvan como casos de prueba fijos, pásame sus vértices o exporta el polígono.

## C. Terreno 3D

- **Origen de la altura:** SRTM a 90 m. Llega promediado a la grilla de 1 km, o bilineal a 30 m en las ventanas, y de ahí bilineal a cada chunk.
- **Cálculo** (`puente.ts:82, 88`): `(altura − mínima) / tamaño de chunk × 3` (`EXAGERACION_RELIEVE = 3`, `:21`), redondeado a 0.1 bloque.
- **Por qué se ve escalonado:** cada celda se dibuja como una caja de altura fija (1 bloque, o 0.94 si está trabajada) colocada sobre su elevación (`TileField.tsx:33-34`). Son columnas flotantes, no una superficie continua, así que en pendiente se ven cortes y huecos. No hay malla continua.
- **Celdas grises del borde:** la grilla es el rectángulo que envuelve al polígono. Las celdas fuera del polígono quedan `bloqueado` ("Fuera de la parcela dibujada", gris `#C9CDD2`) a altura 0 (`puente.ts:62-88`). Se dibujan como terreno gris, no como hueco.

## D. Nubes

- **Altura** (`WeatherLayer.tsx:125`): `7 + √(filas² + columnas²) × 0.25` bloques. **Solo depende del tamaño de la grilla**, no del relieve ni del tamaño de chunk.
- **Forma y posición** (`:32-50`): puffs de radio fijo (0.9-1.5 bloques) repartidos en círculo (radio 0.32 × lado mayor). Son deterministas (sin azar) y el grupo gira despacio.
- **Cuándo aparecen:** cuando el generador de clima del día marca `nubes`.
- **Riesgo de que corten el terreno:** en una grilla de 100 × 100 las nubes van a ~42 bloques. Una parcela de 100 m con 20° de pendiente sube unos 36 m, que con ×3 son ~109 bloques. El terreno pasa por encima de las nubes.

## E. Uso de suelo y aptitud

**Reglas actuales:**

1. Fuera de Junín (por el centroide): no se simula (`PanelJunin.tsx:105`).
2. Cobertura WorldCover (`app/reglas_uso_suelo.json`):
   - permitido: matorral, pastizal, cultivos;
   - advertencia: bosque, suelo desnudo, bofedal;
   - bloqueado: urbano, nieve, agua, manglar, musgo.
3. Apta = hay chunks dentro **y** el bloqueado es ≤ 50 % (`parcela.ts:315`).
4. Chunk en advertencia: rendimiento × 0.85 (`parcela.ts:328`). Chunk bloqueado: 0 (`:365`).
5. pH de cada chunk frente al pH del punto: factor ≤ 1 (EcoCrop).

**Lo que hoy no bloquea ni cambia el resultado:**

- **Área protegida:** solo se prueba si el centroide cae dentro (`JuninController.ts:151`) y solo muestra texto naranja (`PanelJunin.tsx:333`). Por eso Nor Yauyos-Cochas sale como "Se puede sembrar 100 %".
- **Diferencia de altura con el punto** (por ejemplo +476 m): texto si supera 400 m. No corrige la temperatura ni cambia el rendimiento.
- **Distancia al punto** (por ejemplo 28 km): texto si supera 25 km. No baja la confianza.
- No hay rango altitudinal por cultivo, límite de pendiente, helada por altitud de la parcela ni ventana de siembra. La helada sale del clima del punto, no de la parcela.
- Los 10 meses con déficit severo no afectan la aptitud; solo el factor de agua del balance FAO-56 de los 5 cultivos que lo tienen.

## Riesgos, de mayor a menor

1. **Alto · Extrapolación de clima sin corrección.** Parcelas en suni o puna reciben el clima y el rendimiento del valle. En la línea base, 4 101 m da 15.89 t/ha, igual que Jauja.
2. **Alto · Valores por defecto silenciosos** (pH 6.5, MO 2 %, P 25, K 150, humedad 50 %, clase dominante, aptitud 1). Contradice la regla 2 del prompt maestro.
3. **Alto · Áreas protegidas sin efecto** en la aptitud, evaluadas solo por el centroide. Necesita una decisión tuya: ¿bloquear o advertir?
4. **Medio · Falsa precisión:** chunks de 1-2 m sobre datos de 30 m a 10 km, sin indicador de fidelidad por chunk (solo el texto "¿Por qué chunks de X m?").
5. **Medio · Fallos silenciosos de datos:** si falla una parcela de 30 m, se cae a 1 km sin aviso; las teselas NASA negras no se detectan.
6. **Medio · Frescura invisible:** la interfaz no muestra la fecha de cada dato; el pronóstico está fijo de 2026-09 a 2028-08; no hay TTL ni job de actualización.
7. **Medio · 3D escalonado:** columnas flotantes y un borde gris que parece terreno.
8. **Bajo/medio · Nubes desacopladas del relieve:** pueden cortar el terreno en parcelas con pendiente.
9. **Bajo · Imagen de dibujo no NASA (Esri/EOX):** está etiquetada, pero conviene tenerlo en cuenta para la Space Apps.

## Decisiones que necesito antes de ciertas fases

| Decisión                                                                             | Fase  | Propuesta por defecto                      |
| ------------------------------------------------------------------------------------ | ----- | ------------------------------------------ |
| Distancia máxima al punto con datos (`MAX_DIST_DATO_M`)                              | 1     | Ninguna; definir con el equipo             |
| Área protegida: ¿bloquear o advertir?                                                | 3     | **Tu decisión**                            |
| Umbrales de altura (corrección y bloqueo), pendiente y rango altitudinal por cultivo | 3     | Los del documento de fases: 300 m, 15°/30° |
| ¿Algún cálculo debe usar datos en vivo (IMERG, SMAP)?                                | 6     | No; mantener cálculo local validado        |
| Coordenadas de las parcelas de prueba (Jauja/Suni 1 ha, Huancayo 0.43 ha)            | Todas | Pásame los vértices                        |
