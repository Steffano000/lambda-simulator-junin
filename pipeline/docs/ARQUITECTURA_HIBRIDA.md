# Arquitectura híbrida: geovisor NASA + simulador local (Junín)

**Regla:** lo que se **ve** en el mapa viene de NASA en vivo (GIBS); lo que se **calcula** sale de nuestros datos locales, ya validados. El mapa queda encuadrado en Junín para pedir solo esas teselas.

```
                       APP (Leaflet + Three.js, Vercel)
          ┌──────────────────────┴──────────────────────┐
   RAMA 1: GEOVISOR ("ver")                 RAMA 2: SIMULADOR ("decidir")
   NASA GIBS en vivo, sin guardar nada      JSON locales (~2 MB) + TIF en el servidor
          │                                              ▲
          └──── el usuario elige punto o parcela ────────┘
```

## Qué hace cada carpeta

| Carpeta | Rol en la app | Cómo se usa |
|---|---|---|
| (NASA GIBS, en vivo) | **Geovisor**: imagen y capas visuales | Color verdadero MODIS/VIIRS (o HLS 30 m al acercarse), NDVI, humedad SMAP, lluvia IMERG. Solo para ver; no entra en los cálculos |
| `limites/` | **Geovisor**: encuadre | `junin_provincias.geojson` dibuja el contorno y oscurece lo de afuera; `puntos_interes.csv` marca los 10 puntos con datos |
| `pronostico/` | **Simulador**: núcleo | `simulador_escenarios.json`: 24 meses de clima por escenario (normal, actual, neutro, El Niño, La Niña), P−ET₀, P/ET₀ y rendimiento por cultivo y campaña. `aquacrop_resumen.json`, opcional |
| `cultivos/` | **Simulador**: menú y rendimiento | `catalogo_cultivos_junin.json`: cultivos por provincia, rendimiento y precio DRA, requerimientos EcoCrop |
| `C:\TESIS 2\fenologia_cultivos.json` | **Simulador**: rotación | Efecto de la rotación (por ejemplo, papa después de haba × 1.1), fases y Kc |
| `uso_suelo/` | **Simulador**: reglas | `reglas_uso_suelo.json` (Fase 1) y `worldcover_2021_30m_junin.tif` en el servidor para `/parcela` (Fase 2): bloquea ciudad, agua y nieve |
| `terreno/`, `suelo/` | **Simulador (servidor)**: datos de la parcela | El servidor lee los TIF en `/terreno`: altura, pendiente, textura, pH. Alimentan el terreno 3D |
| `ndvi_sentinel2/` | **Simulador (servidor)**: color del 3D | NDVI por chunk; el NDVI que se ve en el mapa viene de NASA |
| `clima_era5land/`, `pisco/`, `enso/` | **Insumo** (ya procesado) | Son la base de los JSON de `pronostico/`. La app no los lee directo. Se usan para regenerar el pronóstico |
| `humedad_smap/` | **Validación** | Contrasta la humedad simulada. La humedad que se ve en el mapa viene de NASA en vivo |
| `pisco/validacion.csv`, `pronostico/validacion_backtest.csv`, `cultivos/validacion_aptitud.csv` | **Tesis** | Métricas para resultados (NSE, RMSE, sesgo) |
| `_cache*/`, `grillas_junin/` | **Interno** | No van a la app ni a GitHub |

## Flujo del usuario

1. Abre la app → mapa de Junín con imagen satelital de NASA del día elegido.
2. Activa capas NASA (NDVI, humedad, lluvia) para ver el contexto.
3. Hace clic o dibuja su parcela:
   - Fase 1: se toma el punto con datos más cercano (`puntoMasCercano`) y su provincia.
   - Fase 2: el servidor revisa el uso de suelo (`/parcela`) y lee relieve y suelo (`/terreno`).
4. Pasa al simulador: elige escenario → ve lluvia, ET₀ y el semáforo P/ET₀ de 24 meses.
5. Elige cultivo y cultivo anterior → rendimiento = referencia DRA × factor de agua × rotación, con alertas de déficit y helada.
6. Si la parcela está fuera de Junín: el mapa NASA se ve, pero el simulador avisa "disponible solo en Junín".

## Etiquetas obligatorias en la interfaz

- Capas del mapa: **"Imagen NASA (contexto, sin corrección local)"**.
- Números del simulador: **"Simulación validada en Junín (lluvia corregida con PISCO/SENAMHI)"**.

## Qué necesita internet

| Parte | Internet |
|---|---|
| Imagen y capas NASA del mapa | Sí |
| Límites, escenarios, cultivos, reglas, rendimiento | No (JSON locales) |
| Parcela dibujada, relieve y suelo | Solo el servidor propio (Fase 2) |

## Pendiente antes de usarlo

- Volver a correr `EJECUTAR_PRONOSTICO.bat`: los JSON de `pronostico/` aún son la versión anterior y la app no puede leerlos. Ese paso también crea `INTEGRACION_SISTEMAS/public/data`.
