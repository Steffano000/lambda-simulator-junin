# -*- coding: utf-8 -*-
"""
Paso 6. Humedad superficial del suelo (0-5 cm) con SMAP L3 Enhanced 9 km (NASA), 2015 a hoy.
A) Serie diaria en los puntos de interés (CSV), pasada de la mañana (AM) y de la tarde (PM).
B) Mapa diario de Junín: un GeoTIFF por año (una banda por día), m³/m³, pasada AM.
Salida: datos/humedad_smap/
"""
import csv
import json
from datetime import date

import ee
import config as C
import utils as U

U.iniciar()
OUT = C.CARPETA_DATOS / "humedad_smap"
CACHE = OUT / "_cache_puntos"
CACHE.mkdir(parents=True, exist_ok=True)
col = ee.ImageCollection(C.SMAP_COL)
BANDAS = ["soil_moisture_am", "soil_moisture_pm", "retrieval_qual_flag_am"]
ini = int(C.SMAP_INICIO[:4])
fin = date.today().year


def anio_puntos(anio):
    destino = CACHE / f"smap_{anio}.json"
    if destino.exists():
        return True
    fc = U.puntos_fc()

    def por_imagen(img):
        fecha = img.date().format("YYYY-MM-dd")
        return (img.select(BANDAS).reduceRegions(fc, ee.Reducer.first(), C.ESCALA_SMAP)
                .map(lambda f: f.set("fecha", fecha).setGeometry(None)))
    sub = col.filterDate(f"{anio}-01-01", f"{anio + 1}-01-01")
    try:
        datos = U.con_reintentos(lambda: sub.map(por_imagen).flatten().getInfo())
    except Exception as e:
        U.log(f"  ERROR SMAP {anio}: {str(e)[:200]}")
        return False
    destino.write_text(json.dumps([f["properties"] for f in datos["features"]]), encoding="utf-8")
    return True


U.log("SMAP: series diarias en puntos")
U.en_paralelo([lambda a=a: anio_puntos(a) for a in range(ini, fin + 1)])
por_punto = {}
for f in sorted(CACHE.glob("smap_*.json")):
    for r in json.loads(f.read_text(encoding="utf-8")):
        por_punto.setdefault(r["punto"], []).append(r)
for punto, filas in por_punto.items():
    filas.sort(key=lambda r: r["fecha"])
    with open(OUT / f"smap_diario_{punto}.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["fecha", "humedad_am_m3m3", "humedad_pm_m3m3", "bandera_calidad_am"])
        for r in filas:
            w.writerow([r["fecha"], r.get("soil_moisture_am"), r.get("soil_moisture_pm"),
                        r.get("retrieval_qual_flag_am")])

U.log("SMAP: mapas diarios de Junín")
geom, bbox = U.junin()
bb = U._coords_bbox(bbox)
tareas = []
for anio in range(ini, fin + 1):
    destino = OUT / "grillas_junin" / f"smap_am_{anio}.tif"
    def t(anio=anio, destino=destino):
        img = (col.filterDate(f"{anio}-01-01", f"{anio + 1}-01-01")
               .select("soil_moisture_am").toBands().toFloat().clip(geom))
        return U.descargar_imagen(img, bb, C.ESCALA_SMAP, destino, "06")
    tareas.append(t)
U.en_paralelo(tareas, hilos=4)
U.log("Listo: datos/humedad_smap")
