# Paso 11 · Datos ambientales de Junín (versión mejorada)

> Origen: `C:\TESIS 2\DATOS PARA LA VERSION MEJORADA` (códigos y datos del equipo de Ingeniería Ambiental).

## Regla de la arquitectura híbrida

Lo que se **ve** en el mapa viene de NASA en vivo (GIBS). Lo que se **calcula** sale de estos JSON locales, ya validados.

- Capas del mapa: **"Imagen NASA (contexto, sin corrección local)"**.
- Números del simulador: **"Simulación validada en Junín (lluvia corregida con PISCO/SENAMHI)"** (`ETIQUETA_SIMULACION` en `src/domain/junin`).

## Dónde está cada cosa

| Carpeta del repo                  | Qué es                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `pipeline/codigos/`               | Los 18 códigos Python (00-16) y el nuevo `17_exportar_json.py`                             |
| `pipeline/*.bat`                  | Ejecutables de Windows (`EJECUTAR_PRONOSTICO.bat`, `EJECUTAR_EXPORTAR_JSON.bat`, …)        |
| `pipeline/docs/`                  | README de los datos, arquitectura híbrida y resumen del proyecto                           |
| `public/data/junin/`              | **Todos los datos convertidos a JSON** (~46 MB). Vite/Vercel los sirven en `/data/junin/` |
| `src/data/junin/`                 | Tipos y repositorio (`JuninRepository`) que lee esos JSON con `fetch` y caché              |
| `src/domain/junin/`               | Motor: punto más cercano, menú de cultivos, clima, rotación, rendimiento, grillas, parcelas |

Los datos crudos (~900 MB de TIF, NetCDF y CSV) **no** van a GitHub. Para regenerar los JSON:
`pipeline\EJECUTAR_PRONOSTICO.bat` (pasos 13-16) y luego `pipeline\EJECUTAR_EXPORTAR_JSON.bat` (paso 17).
El código busca la carpeta `datos` en `LAMBDA_DATOS`, luego en `pipeline\datos` y luego en `C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos`.

## Contenido de `public/data/junin`

`manifest.json` lista cada archivo con su tamaño, fuente y uso (`app`, `analisis`, `validacion`, `meta`).

| Carpeta       | Archivos                                                                                                         | Uso                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `app/`        | `simulador_escenarios`, `catalogo_cultivos_junin`, `fenologia_cultivos`, `aquacrop_resumen`, `reglas_uso_suelo`, `puntos` | Núcleo del simulador   |
| `parcelas/`   | 10 parcelas reales de 40 × 40 celdas de 30 m (relieve, pendiente, 8 propiedades del suelo, textura, WorldCover, regla de uso, NDVI) | Grilla 3D              |
| `grillas/`    | `junin_1km` (terreno, suelo, cobertura y NDVI de todo Junín), `ndvi_climatologia_2km`, `suelo_profundidades_2km` | Clic en el mapa        |
| `clima/`      | `diario/{punto}` (1950-2026), `clima_mensual_puntos`, climatología ERA5-Land 1991-2020 y lluvia mensual en grilla | Gráficos y validación  |
| `pronostico/` | Pronóstico SARIMAX, balance hídrico, campañas, AquaCrop, escenarios ENSO, modelos y backtest                     | Análisis y tesis       |
| `pisco/`      | Factores de corrección, lluvia PISCOp v3.0 1981-2025, comparación y validación                                   | Validación             |
| `humedad/`    | SMAP mensual 2015-2026 en grilla de 9 km                                                                         | Contraste de humedad   |
| `enso/`       | Índice ENSO mensual y TSM diaria                                                                                 | Contexto               |
| `cultivos/`   | Aptitud EcoCrop por punto, producción DRA 2022 y validación de aptitud                                          | Menú y tesis           |
| `uso_suelo/`  | Áreas protegidas y hectáreas por provincia                                                                      | Mapa                   |
| `limites/`    | Región, provincias y puntos (GeoJSON)                                                                           | Encuadre del mapa      |
| `ndvi/`       | NDVI mensual 2017-2026 en los 10 puntos                                                                         | Validación             |
| `meta/`       | Registro de descargas                                                                                            | Procedencia            |

### Formatos

- **Tablas** (antes CSV): lista de objetos; las vacías llegan como `null`.
- **Series diarias**: en columnas. `datos.et0_mm[i]` es el día `inicio + i`.
- **Grillas**: cabecera (`bbox`, `ancho`, `alto`, `resolucion_grados`) y capas como arreglos planos, fila por fila de norte a sur. Si la capa trae `escala`, valor = dato / escala.
- **GeoJSON**: igual que el original, con coordenadas a 5 decimales.

### Lo que no se convierte

Los PDF de la DRA (sus cifras ya están en `cultivos/`), la lluvia cruda de ERA5-Land (sobreestima ~2×), los mapas diarios completos (se exportan la climatología y las series mensuales) y la tesela parcial de Dynamic World. El detalle está en `manifest.json → no_convertidos`.

## Uso desde la app

```ts
import { JuninRepository } from '@/data/junin';
import { puntoMasCercano, menuCultivos, climaEscenario, rendimiento, celdasDeParcela, escenariosComoClima } from '@/domain/junin';

const n = await JuninRepository.nucleo();
const punto = puntoMasCercano(-12.03, -75.31, n.sim); // 'huayao_igp'
const menu = menuCultivos(punto, n); // cultivos de la provincia y su motor
const clima = climaEscenario(punto, 'nino', n.sim); // 24 meses + semáforo P/ET0
const r = rendimiento(punto, 'nino', 'papa', 'haba', n); // motor, t/ha, alertas
const celdas = celdasDeParcela(await JuninRepository.parcela(punto)); // terreno real 40×40
const clima12 = escenariosComoClima(n.sim, punto); // entra directo a ClimateScenarioFactory
```

### Qué motor usa cada cultivo

| Motor                    | Cultivos                                            | Fórmula                                                 |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| Balance hídrico FAO-56   | papa, maíz amiláceo, quinua, haba, avena forrajera  | referencia DRA × factor de agua × rotación              |
| AquaCrop (apoyo)         | papa, quinua, cebada                                | referencia DRA × anomalía AquaCrop del escenario        |
| DRA × aptitud            | el resto                                            | rendimiento DRA de la provincia × aptitud EcoCrop       |

Fuera de su provincia, el rendimiento se multiplica además por la aptitud EcoCrop. El resultado trae `motor_etiqueta` para mostrar en la interfaz qué motor se usó.

## Validación

`src/domain/junin/junin.test.ts` comprueba que todo lo del manifiesto existe y es JSON válido sin NaN/Infinity, la fórmula de rendimiento, la rotación, el semáforo, que la parcela de Huayao es agrícola y franco arcillosa y que la del centro de Huancayo está bloqueada (urbana).
