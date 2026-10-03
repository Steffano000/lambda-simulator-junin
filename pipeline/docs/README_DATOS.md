# Datos para la versión mejorada del simulador

Códigos para bajar de Google Earth Engine (proyecto `skllpro`) todos los datos ambientales de la región Junín que usará la versión 2 del simulador.

## Cómo ejecutarlo

Opción fácil: doble clic en `EJECUTAR.bat`. Instala las librerías, abre el navegador para autorizar Earth Engine (solo la primera vez) y baja todo.

Opción manual, desde esta carpeta en PowerShell:

```
python -m pip install -r requirements.txt
python codigos\00_autenticar.py
python codigos\ejecutar_todo.py           # todo (varias horas la primera vez)
python codigos\ejecutar_todo.py rapido    # todo menos los mapas diarios de ERA5-Land
```

Cada paso también se puede correr solo (`python codigos\05_ndvi_sentinel2.py`). Si algo se corta, se vuelve a ejecutar y salta lo que ya está en disco. Lo que salió bien o mal queda anotado en `registro_descargas.csv`.

## Qué baja cada paso

| Paso | Fuente | Qué produce | Carpeta |
|---|---|---|---|
| 01 | FAO GAUL 2015 + SRTM | Límite de Junín, provincias y elevación de los puntos de interés | `datos/limites` |
| 02 | ERA5-Land (ECMWF) | **A)** CSV diario 1950–hoy en Huayao y las 9 capitales de provincia (°C, mm, MJ/m², kPa). **B)** Mapas diarios de todo Junín, un GeoTIFF por variable y año | `datos/clima_era5land` |
| 03 | SRTM (NASA) | Elevación y pendiente de Junín a 90 m | `datos/terreno` |
| 04 | SoilGrids 250 m (ISRIC) | Arena, arcilla, limo, carbono orgánico, pH, densidad aparente, N y CIC a 0–5, 5–15 y 15–30 cm, y un resumen 0–30 cm | `datos/suelo` |
| 05 | Sentinel-2 SR (ESA) | NDVI mensual de Junín 2017–hoy a 250 m (valor × 10000) | `datos/ndvi_sentinel2` |
| 06 | SMAP L3 Enhanced (NASA) | Humedad del suelo 0–5 cm: CSV diario en los puntos y mapas diarios 2015–hoy | `datos/humedad_smap` |
| 07 | NOAA OISST v2.1 | TSM diaria en Niño 1+2 y Niño 3.4; índice mensual con anomalía 1991–2020 y media móvil de 3 meses | `datos/enso` |
| 02b | ERA5-Land horario | Velocidad media diaria del viento en los puntos, promediando cada hora (corrige la subestimación del viento diario) | `datos/clima_era5land/viento_horario` |
| 08 | (cálculo local) | ET₀ diaria FAO-56 Penman-Monteith y clima mensual (`et0_mm`, `lluvia_mm`, `tmed_c`, `tmin_c`) en el formato del simulador | `datos/clima_era5land/et0` |
| 09 | PISCOp v3.0 (SENAMHI) | Factores de corrección mensual de la lluvia para cada celda de Junín, validación 1981-2010 → 2011-2025, lluvia diaria corregida (grillas y CSV) | `datos/pisco` |
| 10 | ESA WorldCover, Dynamic World, WDPA | Uso y cobertura del suelo de Junín a 30 m, áreas naturales protegidas, hectáreas por provincia y reglas para el simulador (dónde se puede sembrar) | `datos/uso_suelo` |
| 11 | DRA Junín | PDF oficiales de producción agrícola 2022 por provincia | `datos/cultivos/fuentes_dra_junin` |
| 12 | DRA Junín + FAO EcoCrop | `catalogo_cultivos_junin.json` (cultivos por provincia y piso ecológico, rendimientos, precios, requerimientos de clima y pH) y aptitud de cada cultivo en los puntos | `datos/cultivos` |
| 13 | (cálculo local, statsmodels) | Pronóstico mensual SARIMAX a 24 meses de lluvia, ET0, temperaturas y humedad del suelo, con 4 escenarios ENSO (actual, neutro, El Niño, La Niña) y validación de 60 meses | `datos/pronostico` |
| 14 | (cálculo local) | Balance hídrico: P − ET0, índice P/ET0, ETc = Kc·ET0, balance de suelo FAO-56 con pedotransferencia Saxton-Rawls, factor de agua y rendimiento esperado por cultivo, campaña y escenario | `datos/pronostico` |
| 15 | (cálculo local, AquaCrop-OSPy) | Rendimiento AquaCrop (papa, quinua, cebada) histórico y por escenario, usado como anomalía sobre el rendimiento DRA | `datos/pronostico` |

Los pasos 13 a 15 se corren con `EJECUTAR_PRONOSTICO.bat`. El archivo para el simulador es `datos/pronostico/simulador_escenarios.json`.

La segunda parte (pasos 05 reintento, 02b y 09) se corre con `EJECUTAR_PASO2.bat`, y el paso 10 con `EJECUTAR_USO_SUELO.bat`.

## Cosas a tener en cuenta

- **Unidades de los mapas de ERA5-Land**: están en las unidades originales (K, m de lluvia, J/m², m/s, m³/m³). Los CSV de puntos ya vienen convertidos.
- **Día de ERA5-Land**: cada día va de 00 a 24 h UTC, que en Perú es de 19:00 del día anterior a 19:00 del día indicado.
- **Lluvia**: ERA5-Land sobreestima mucho la lluvia en Junín (en Huayao da ~1680 mm/año). Usen siempre `precip_corr_mm` (corregida con PISCOp v3.0 en el paso 9), no `precip_mm`.
- **Viento**: el viento de los CSV diarios (`viento10_ms`) sale de componentes promediadas y subestima la velocidad. El paso 8 usa el del paso 2b cuando existe.
- **Temperatura**: ERA5-Land suaviza los extremos (en Huayao da Tmax ~15 °C y Tmin ~5.7 °C de promedio). Si hace falta, se puede calibrar igual que la lluvia con PISCOt.
- **Resolución**: ERA5-Land (~11 km) y SMAP (9 km) dan un solo valor para una chacra; SoilGrids, SRTM y Sentinel-2 sí varían dentro de ella.
- **Para la parcela**: cuando la tengan dibujada, agreguen su punto en `PUNTOS` dentro de `codigos/config.py` y bajen SRTM a 30 m y NDVI a 10 m solo para esa zona.
- **ENSO**: el índice se calcula con OISST, así que es parecido al ONI y al ICEN, pero no es el valor oficial.
- **Tamaño aproximado**: unos 1–1.5 GB en total, casi todo de los mapas diarios de ERA5-Land.

## Referencias

- Muñoz-Sabater, J. et al. (2021). ERA5-Land: a state-of-the-art global reanalysis dataset for land applications. *Earth System Science Data*, 13, 4349–4383.
- Poggio, L. et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. *SOIL*, 7, 217–240.
- Entekhabi, D. et al. (2010). The Soil Moisture Active Passive (SMAP) Mission. *Proceedings of the IEEE*, 98(5), 704–716.
- Dirección Regional de Agricultura Junín (2023). Producción agrícola provincial 2022. https://www.agrojunin.gob.pe/estadistica_agraria/
- Hijmans, R. J. et al. (2001). Computer tools for spatial analysis of plant genetic resources data: 1. DIVA-GIS. *Plant Genetic Resources Newsletter*, 127, 15–19. (modelo EcoCrop)
- Ramírez-Villegas, J. et al. (2013). Implications of regional improvement in global climate models for agricultural impact research. *Environmental Research Letters*, 8, 024018.
- Huang, B. et al. (2021). Improvements of the Daily Optimum Interpolation Sea Surface Temperature (DOISST) Version 2.1. *Journal of Climate*, 34, 2923–2939.
- Gutierrez, L. y Lavado-Casimiro, W. (2026). High-resolution grids of rainfall for Peru - PISCOp v3.0 dataset. figshare. https://doi.org/10.6084/m9.figshare.32411886.v1
- Saxton, K. E. y Rawls, W. J. (2006). Soil water characteristic estimates by texture and organic matter for hydrologic solutions. *Soil Science Society of America Journal*, 70, 1569–1578.
- Foster, T. et al. (2017). AquaCrop-OS: An open source version of FAO's crop water productivity model. *Agricultural Water Management*, 181, 18–22.
- Kelly, T. D. y Foster, T. (2021). AquaCrop-OSPy: Bridging the gap between research and practice in crop-water modelling. *Agricultural Water Management*, 254, 106976.
- Seabold, S. y Perktold, J. (2010). statsmodels: Econometric and statistical modeling with Python. *Proceedings of the 9th Python in Science Conference*.
- Allen, R. G. et al. (1998). *Crop evapotranspiration*. FAO Riego y Drenaje n.º 56.
