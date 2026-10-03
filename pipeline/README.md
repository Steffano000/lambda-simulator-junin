# Pipeline de datos de Junín

Códigos del equipo de Ingeniería Ambiental (antes en `C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\codigos`).
Bajan los datos de Google Earth Engine, PISCO y la DRA, calculan el pronóstico y el balance hídrico,
y los dejan como JSON en `public/data/junin` para la app.

## Pasos

| Paso  | Archivo                            | Qué hace                                                        |
| ----- | ---------------------------------- | --------------------------------------------------------------- |
| 00-12 | `codigos/00_…` a `12_…`            | Descargas y cálculos base (ver `docs/README_DATOS.md`)          |
| 13    | `13_pronostico_sarimax.py`         | Pronóstico SARIMAX a 24 meses con escenarios ENSO               |
| 14    | `14_balance_hidrico.py`            | Balance hídrico FAO-56 y rendimiento por cultivo                |
| 15    | `15_aquacrop_escenarios.py`        | AquaCrop (papa, quinua, cebada)                                 |
| 16    | `16_exportar_para_app.py`          | JSON livianos de la app (`app/`, tablas, límites)               |
| 17    | `17_exportar_json.py`              | **Toda** la carpeta `datos` a JSON: tablas, grillas, parcelas, series diarias |

## Cómo correrlo (Windows)

1. `EJECUTAR_PRONOSTICO.bat` → pasos 13 a 16.
2. `EJECUTAR_EXPORTAR_JSON.bat` → paso 17 (unos 6 minutos).
3. Revisar `public/data/junin/manifest.json` y correr `npm test`.

La carpeta `datos` (~900 MB) no está en el repositorio. Se busca en este orden:
variable `LAMBDA_DATOS`, `pipeline\datos`, `C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos`.

Grupos del paso 17 (para correr solo una parte): `app, tablas, geo, diario, grillas, parcelas, era5, smap, pisco, ndvi`.

```
python codigos\17_exportar_json.py --solo app,tablas
```
