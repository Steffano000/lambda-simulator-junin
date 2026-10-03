# Resumen del proyecto: Simulador de cultivos de Junín (versión 2)

## Contexto
- Software de simulación (no juego) de rotación de cultivos para la región Junín, Perú. Equipo de 3: 1 Ingeniería Ambiental (datos y modelos) y 2 Ingeniería de Sistemas (app).
- Versión 1 ya desplegada en Vercel (simuladordecultivos.vercel.app), hecha en una hackatón, con terreno por chunks (estilo Minecraft) y Three.js.
- Objetivos: tesis de "desarrollo tecnológico" (Universidad Continental) y NASA Space Apps Challenge 2026 (reto "Field Shift: Adapting Farms with NASA Data"; hackatón 14-15 nov 2026; retos oficiales salen el 28 oct).
- Alcance: solo Junín (no mundial), pero replicable cambiando el polígono.

## Carpeta "DATOS PARA LA VERSION MEJORADA" (~890 MB)
Todo se genera con 16 códigos Python (carpeta `codigos/`) que se ejecutan con archivos .bat. Proyecto de Google Earth Engine: `skllpro`.

| Carpeta (dentro de datos/) | Contenido | Formato | Fuente |
|---|---|---|---|
| clima_era5land/ | Clima diario 1950-2026 en 10 puntos (Huayao + 9 capitales de provincia), con lluvia corregida `precip_corr_mm`; mapas diarios de Junín en grillas_junin/; ET0 y clima mensual en et0/; viento horario en viento_horario/ | CSV, TIF, JSON | ERA5-Land (ECMWF) |
| pisco/ | Lluvia observada mensual 1981-2025, factores de corrección por mes y celda, validación | NC, TIF, CSV | PISCOp v3.0 (SENAMHI) |
| enso/ | TSM diaria e índice ENSO mensual (Niño 1+2 y 3.4) | CSV | NOAA OISST v2.1 |
| terreno/ | Elevación y pendiente (x10) de Junín a 90 m | TIF | SRTM (NASA) |
| suelo/ | Suelo 0-30 cm en 8 bandas: arena, arcilla, limo, COS, pH, densidad, N, CIC | TIF | SoilGrids 250 m (ISRIC) |
| ndvi_sentinel2/ | NDVI mensual 2017-2026 a 250 m (valor x10000) | TIF | Sentinel-2 (ESA) |
| humedad_smap/ | Humedad del suelo 0-5 cm diaria, puntos y mapas | CSV, TIF | SMAP (NASA) |
| uso_suelo/ | Cobertura 30 m, áreas protegidas, hectáreas por provincia, reglas del simulador | TIF, GeoJSON, CSV, JSON | ESA WorldCover, WDPA |
| cultivos/ | Catálogo de 45 cultivos por provincia (rendimiento, precio, requerimientos), aptitud EcoCrop; PDF originales | JSON, CSV, PDF | DRA Junín 2022, FAO EcoCrop |
| pronostico/ | Pronóstico SARIMAX, balance hídrico, AquaCrop, validaciones | JSON, CSV | cálculos propios |
| limites/ | Límite de Junín, provincias, 10 puntos con altura | GeoJSON, CSV | FAO GAUL |

Fuera de esa carpeta: `C:\TESIS 2\fenologia_cultivos.json` (fases, Kc, sensibilidad al agua y efectos de rotación de 5 cultivos, hecho por el equipo).

## Modelos ya hechos (y validados)
1. Lluvia de ERA5-Land corregida con PISCO (escalamiento lineal mensual por celda). Validación 2011-2025: NSE de 0.02 a 0.80 en todo Junín; sesgo de +45 % a -1.6 %.
2. ET0 diaria FAO-56 Penman-Monteith (probada contra el ejemplo 18 de FAO-56: 3.88 vs 3.9 mm/día).
3. Pronóstico SARIMAX mensual a 24 meses (sep 2026 - ago 2028) de lluvia, ET0, Tmax, Tmed, Tmin y humedad del suelo, con anomalías de Niño 1+2 y Niño 3.4 como exógenas. 4 escenarios: actual (ENSO que se disipa), neutro, El Niño fuerte, La Niña. Intervalo del 80 %. Validación de 60 meses: NSE ~0.8 en ET0 y humedad; la lluvia no supera a la climatología.
4. Balance hídrico: P-ET0, índice P/ET0 (>=1 sin déficit, 0.5-1 moderado, <0.5 severo), ETc = Kc·ET0, balance diario del suelo FAO-56 (Ks), capacidad de campo y punto de marchitez con Saxton y Rawls (2006). Factor de agua por campaña para papa, maíz amiláceo, quinua, haba y avena.
5. AquaCrop-OSPy (papa, quinua, cebada) usado como anomalía de rendimiento por escenario. El maíz se excluyó (falla en zonas frías).
6. Aptitud de cultivos con EcoCrop (0 a 1); funciona en sierra y selva, subestima la puna.

## Archivos que usa la app
- `pronostico/simulador_escenarios.json` (principal, ~1 MB): `puntos -> {lat, lon, provincia, suelo, escenarios -> {normal, actual, neutro, nino, nina} -> {meses[24], cultivos{id: [campañas]}}}`.
  - meses[]: mes, lluvia_mm, et0_mm, tmax_c, tmed_c, tmin_c, hum_suelo_m3m3 (cada una con _inf80 y _sup80), balance_mm, indice_p_et0, clase.
  - campaña: siembra, factor_agua, rend_ref_t_ha, rend_esperado_t_ha, meses_riesgo_helada, etc_mm, eta_mm, mensual{kc, ks...}.
- `cultivos/catalogo_cultivos_junin.json`: provincias{prov: {cultivos[{id, porcentaje}]}}, cultivos{id: {nombre, provincias, ecocrop}}, pisos_ecologicos[].
- `uso_suelo/reglas_uso_suelo.json`: por código WorldCover: permitido / advertencia / bloqueado + mensaje.
- `fenologia_cultivos.json`: rotacion.efectos[{anterior, siguiente, efecto_rendimiento}].
- `pronostico/aquacrop_resumen.json` (opcional).
- Fórmula de rendimiento: rend = rend_ref (DRA de la provincia) x factor_agua x efecto_rotacion; cultivos fuera de su provincia x aptitud EcoCrop.

## Código de integración listo (carpeta INTEGRACION_SISTEMAS/, probado con datos reales)
- `public/data/`: copia de los JSON (la llena el paso 16 al correr EJECUTAR_PRONOSTICO.bat).
- `frontend/simulador.js`: cargarDatos(), puntoMasCercano(), menuCultivos(), climaEscenario(), efectoRotacion(), rendimiento().
- `backend/main.py` (FastAPI + rasterio): GET /escenarios/{punto}, GET /terreno?lat&lon (elevación, cobertura, suelo), POST /parcela (GeoJSON -> % de cada cobertura y si se puede sembrar).
- Resultados de prueba: papa después de haba en Huayao con El Niño = 19.34 t/ha; parcela en el centro de Huancayo = 97.5 % urbano, no se puede sembrar.

## Plan
- Fase 1 (sin servidor): JSON en public/data -> panel de escenarios, menú de cultivos, rendimiento. Es el producto mínimo de la tesis.
- Fase 2 (servidor FastAPI): parcela dibujada (Leaflet + Leaflet.draw sobre OpenStreetMap), validación de uso de suelo, terreno 3D.
- Fase 3 (opcional): Earth Engine en vivo solo para la parcela.
- Para la Space Apps: agregar datos de NASA (GPM IMERG para lluvia, NASA POWER para clima, HLS en vez de Sentinel-2), análisis del inicio de lluvias 1981-2025 (en Huayao varía hasta 2 meses entre años; la tendencia de corrimiento es débil), botón de inglés, código abierto en GitHub, arte low-poly (Kenney, Quaternius, CC0) que cambie según la fase y el estrés del cultivo.
- Para la tesis: validar el simulador contra rendimientos históricos de la DRA, prueba de usabilidad SUS (meta >= 68), ajustar con factores Ky de FAO-33 (papa 1.1, maíz 1.25, frijol 1.15).
- Ideas para después: plagas (ILCYM del CIP, agricolae en R), máscara agrícola con GLAD + WorldCover + EVI/NDWI.

## Decisiones tomadas
- No consultar Earth Engine en cada clic: todo precalculado.
- No subir la carpeta datos (~890 MB) a GitHub; a la app solo van los JSON (~2 MB).
- No usar PostGIS ni un clasificador propio por ahora.
- Usar siempre la lluvia corregida (precip_corr_mm / lluvia_mm de los JSON), nunca precip_mm.

## Limitaciones
- Clima a ~10 km: un solo valor por chacra; dentro de ella solo varían relieve, suelo y NDVI.
- Balance hídrico solo para 5 cultivos.
- La lluvia mensual se reparte igual en todos los días del mes (suaviza el estrés).
- EcoCrop subestima cultivos andinos de puna (maca); ahí manda el rendimiento DRA.
- Los escenarios ENSO cambian poco el rendimiento en el valle.
- Sensibilidad al agua por fase y efectos de rotación son propuestas del equipo.
