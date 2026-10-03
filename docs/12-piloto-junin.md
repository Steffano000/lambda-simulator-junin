# Paso 12 · Piloto: geovisor NASA + simulador local (Junín)

La app abre en **Mapa Junín**. El botón **Parcela 3D** lleva al simulador 3D de siempre.

## Regla

Lo que se **ve** viene de NASA en vivo (GIBS). Lo que se **calcula** sale de `public/data/junin` (JSON validados).

## Secuencia implementada

| #   | Paso              | Dónde                                                                                       | De dónde salen los datos                                                       |
| --- | ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Mapa              | `src/ui/junin/MapaJunin.tsx`                                                                | NASA GIBS en vivo + `limites/junin_*.geojson`                                  |
| 2   | Delimitar         | Botón «Dibujar parcela» (clics y doble clic), «1 ha / 9 ha aquí» o «Ejemplo 9 ha»           | Leaflet                                                                        |
| 3   | Área              | `areaHa()` en `src/domain/junin/parcela.ts`                                                 | Turf.js                                                                        |
| 4   | ¿Es apta?         | `resumirParcela()`                                                                          | `reglas_uso_suelo.json` + WorldCover (30 m en las parcelas, ~1 km en el resto) |
| 5   | Ubicar            | `puntoMasCercano()`, `pisoEcologico()`, áreas protegidas                                    | `app/puntos.json`, SRTM, WDPA                                                  |
| 6   | Grilla            | `construirChunks()`: chunks de 30 m (crecen si la parcela es grande)                        | `parcelas/*.json` (30 m) o `grillas/junin_1km.json`; servidor en Fase 2        |
| 7   | Escenario         | `climaEscenario()` + `GraficoEscenario.tsx` (lluvia, ET₀, intervalo 80 %, semáforo P/ET₀)   | `simulador_escenarios.json`                                                    |
| 8   | Cultivo           | `menuCultivos()`: los de la provincia; otros con aptitud baja                               | `catalogo_cultivos_junin.json`                                                 |
| 9   | Motor             | `rendimiento()`: muestra qué motor se usó                                                   | FAO-56 / AquaCrop / DRA × aptitud                                              |
| 10  | AquaCrop          | Apoyo para papa y quinua; motor de la cebada                                                | `aquacrop_resumen.json`                                                        |
| 11  | Resultado         | `rendimientoPorChunk()`: t/ha por chunk y total; alertas de helada y déficit; fases y Ks    | Todo lo anterior                                                               |
| 11b | 3D                | «Ver la parcela en 3D»: `parcelaParaSimulador()` carga los chunks reales en el simulador 3D | Suelo, pH, MO y relieve (×3) por chunk; clima de la campaña                    |
| 12  | Rotación          | «Guardar campaña»: el cultivo pasa a ser el anterior de 2027-28                             | `fenologia_cultivos.json`                                                      |

### Rendimiento por chunk

`rendimiento del escenario × uso de suelo × pH relativo`

- Chunk bloqueado (ciudad, agua, nieve…): 0.
- Chunk en advertencia (bosque, bofedal, suelo desnudo): × 0.85 (supuesto editable, `PENALIZACION_ADVERTENCIA`).
- pH: aptitud EcoCrop del chunk dividida por la del suelo del punto de referencia (máximo 1). Así no se castiga dos veces: el rendimiento DRA ya refleja los suelos típicos de la provincia.

### En el simulador 3D

Cada bloque es un chunk. Las celdas fuera del polígono o con cobertura bloqueada salen en gris/azul y no aceptan acciones ni siembra (`TileNode.bloqueado`). El clima de la campaña entra como escenario «Junín · punto · escenario (mes a mes)» y el mes de inicio es el de siembra.

## Capas NASA (comprobadas en GIBS el 3 de octubre de 2026)

| Capa         | Identificador GIBS                           | Nivel | Nota                                       |
| ------------ | -------------------------------------------- | ----- | ------------------------------------------ |
| MODIS        | `MODIS_Terra_CorrectedReflectance_TrueColor` | 9     | Diaria; a veces hay franjas o nubes        |
| VIIRS        | `VIIRS_SNPP_CorrectedReflectance_TrueColor`  | 9     | Diaria                                     |
| HLS 30 m     | `HLS_S30_Nadir_BRDF_Adjusted_Reflectance`    | 12    | Cada 2-5 días; se dibuja encima de MODIS   |
| NDVI         | `MODIS_Terra_L3_NDVI_16Day`                  | 9     | La fecha se ajusta al compuesto disponible |
| Humedad      | `SMAP_L4_Analyzed_Surface_Soil_Moisture`     | 6     | ~4 días de retraso                         |
| Lluvia       | `IMERG_Precipitation_Rate`                   | 6     | ~1 día de retraso                          |
| Nombres      | `Reference_Labels_15m`                       | 13    | Sin fecha                                  |

Se cambian en `src/ui/junin/colores.ts`.

## Fase 2 (opcional): servidor

`server/main.py` (FastAPI + rasterio) lee los TIF a 30 m para cualquier parcela de Junín:

```
cd server
python -m pip install -r requirements.txt
set LAMBDA_DATOS=C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos
uvicorn main:app --reload
```

y en la raíz del repo un archivo `.env.local` con `VITE_API_URL=http://127.0.0.1:8000`. Si el servidor no responde, la app sigue con los datos locales.

## Limitaciones del piloto

- Fuera de las 10 ventanas de 30 m (recuadros amarillos), sin servidor, los chunks usan la grilla de ~1 km: una chacra pequeña sale casi uniforme.
- El clima es el del punto con datos más cercano; la app avisa si está a más de 25 km o a más de 400 m de diferencia de altura.
- El 3D solo siembra los 5 cultivos de `data/cultivos.json`; los demás se simulan solo en el panel.
