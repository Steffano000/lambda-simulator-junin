# -*- coding: utf-8 -*-
"""
Paso 2. Clima diario ERA5-Land (1950 a hoy).

A) Series diarias en los puntos de interés (Huayao + capitales de provincia), en CSV
   con unidades ya convertidas: °C, mm, MJ/m², kPa.
B) Mapas diarios de todo Junín: un GeoTIFF por variable y por año (una banda por día),
   en unidades originales de ERA5-Land (K, m, J/m², m/s, m³/m³).

Uso:
  python 02_era5land_clima.py            -> A y B
  python 02_era5land_clima.py puntos     -> solo A
  python 02_era5land_clima.py grillas    -> solo B
Si se corta, vuelve a ejecutarlo: salta lo que ya está descargado.
"""
import csv
import json
import math
import sys

import ee
import config as C
import utils as U

U.iniciar()
modo = sys.argv[1] if len(sys.argv) > 1 else "todo"
OUT = C.CARPETA_DATOS / "clima_era5land"
CACHE = OUT / "_cache_puntos"
CACHE.mkdir(parents=True, exist_ok=True)

col = ee.ImageCollection(C.ERA5_COL)
bandas = list(C.ERA5_BANDAS.keys())


# ---------------------------------------------------------------------------
# A) Series en puntos
# ---------------------------------------------------------------------------
def anio_puntos(anio):
    destino = CACHE / f"puntos_{anio}.json"
    if destino.exists() and destino.stat().st_size > 0:
        return True
    fc = U.puntos_fc()

    def por_imagen(img):
        fecha = img.date().format("YYYY-MM-dd")
        return (img.select(bandas)
                .reduceRegions(fc, ee.Reducer.first(), C.ESCALA_ERA5)
                .map(lambda f: f.set("fecha", fecha).setGeometry(None)))

    sub = col.filterDate(f"{anio}-01-01", f"{anio + 1}-01-01")
    def pedir():
        return sub.map(por_imagen).flatten().getInfo()
    try:
        datos = U.con_reintentos(pedir)
    except Exception as e:
        U.log(f"  ERROR puntos {anio}: {str(e)[:200]}")
        U.registrar("02", destino, "error", str(e))
        return False
    filas = [f["properties"] for f in datos["features"]]
    destino.write_text(json.dumps(filas), encoding="utf-8")
    return True


def k_a_c(v):
    return None if v is None else round(v - 273.15, 3)


def armar_csv_puntos():
    por_punto = {p: [] for p in C.PUNTOS}
    for f in sorted(CACHE.glob("puntos_*.json")):
        for fila in json.loads(f.read_text(encoding="utf-8")):
            por_punto.setdefault(fila["punto"], []).append(fila)
    cab = ["fecha", "tmax_c", "tmin_c", "tmed_c", "trocio_c", "precip_mm", "rad_solar_mj_m2",
           "u10_ms", "v10_ms", "viento10_ms", "presion_kpa", "hum_suelo_0_7cm_m3m3",
           "evap_potencial_mm"]
    for punto, filas in por_punto.items():
        filas.sort(key=lambda r: r["fecha"])
        ruta = OUT / f"era5land_diario_{punto}.csv"
        with open(ruta, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(cab)
            for r in filas:
                g = r.get
                u, v = g("u_component_of_wind_10m"), g("v_component_of_wind_10m")
                viento = None if u is None or v is None else round(math.hypot(u, v), 3)
                pr = g("total_precipitation_sum")
                rs = g("surface_solar_radiation_downwards_sum")
                ps = g("surface_pressure")
                ep = g("potential_evaporation_sum")
                w.writerow([
                    r["fecha"],
                    k_a_c(g("temperature_2m_max")), k_a_c(g("temperature_2m_min")),
                    k_a_c(g("temperature_2m")), k_a_c(g("dewpoint_temperature_2m")),
                    None if pr is None else round(pr * 1000, 3),
                    None if rs is None else round(rs / 1e6, 3),
                    None if u is None else round(u, 3), None if v is None else round(v, 3), viento,
                    None if ps is None else round(ps / 1000, 3),
                    None if g("volumetric_soil_water_layer_1") is None else round(g("volumetric_soil_water_layer_1"), 4),
                    None if ep is None else round(-ep * 1000, 3),   # ERA5 guarda la evaporación como negativa
                ])
        U.log(f"  {ruta.name}: {len(filas)} días")


# ---------------------------------------------------------------------------
# B) Mapas diarios de Junín
# ---------------------------------------------------------------------------
def grillas():
    geom, bbox = U.junin()
    bb = U._coords_bbox(bbox)
    tareas = []
    for banda in C.ERA5_BANDAS_GRILLA:
        corto = C.ERA5_BANDAS[banda]
        for anio in range(C.ERA5_INICIO_GRILLAS, C.ERA5_FIN + 1):
            destino = OUT / "grillas_junin" / corto / f"{corto}_{anio}.tif"
            if destino.exists():
                continue
            def t(banda=banda, anio=anio, destino=destino):
                img = (col.filterDate(f"{anio}-01-01", f"{anio + 1}-01-01")
                       .select(banda).toBands().toFloat().clip(geom))
                return U.descargar_imagen(img, bb, C.ESCALA_ERA5, destino, "02")
            tareas.append(t)
    U.log(f"Mapas ERA5-Land de Junín: {len(tareas)} archivos por bajar")
    U.en_paralelo(tareas)


if modo in ("todo", "puntos"):
    anios = list(range(C.ERA5_INICIO_PUNTOS, C.ERA5_FIN + 1))
    U.log(f"Series diarias ERA5-Land en {len(C.PUNTOS)} puntos, {anios[0]}-{anios[-1]}")
    U.en_paralelo([lambda a=a: anio_puntos(a) for a in anios])
    armar_csv_puntos()

if modo in ("todo", "grillas"):
    grillas()

U.log("Listo: datos/clima_era5land")
