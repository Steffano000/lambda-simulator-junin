# -*- coding: utf-8 -*-
"""
Paso 2b. Velocidad media diaria del viento a 10 m calculada con ERA5-Land HORARIO.

Por qué: ERA5-Land diario solo trae el promedio de las componentes u y v. Si el viento
cambia de dirección en el día (brisa valle-montaña), las componentes se anulan y
sqrt(u_medio² + v_medio²) sale mucho menor que la velocidad real. Aquí se calcula
sqrt(u² + v²) en cada hora y luego se promedia el día, que es lo que pide FAO-56.

Salida: datos/clima_era5land/viento_horario/viento_diario_<punto>.csv
El paso 8 usa este viento automáticamente si el archivo existe.
"""
import csv
import json

import ee
import config as C
import utils as U

U.iniciar()
OUT = C.CARPETA_DATOS / "clima_era5land" / "viento_horario"
CACHE = OUT / "_cache"
CACHE.mkdir(parents=True, exist_ok=True)
horario = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").select(
    ["u_component_of_wind_10m", "v_component_of_wind_10m"])
TRIMESTRES = [("01-01", "04-01"), ("04-01", "07-01"), ("07-01", "10-01"), ("10-01", None)]


def velocidad(img):
    return img.expression("sqrt(u*u + v*v)", {
        "u": img.select("u_component_of_wind_10m"),
        "v": img.select("v_component_of_wind_10m")}).rename("viento")


def trimestre(anio, q):
    destino = CACHE / f"viento_{anio}_q{q + 1}.json"
    if destino.exists():
        return True
    ini_s, fin_s = TRIMESTRES[q]
    ini = ee.Date(f"{anio}-{ini_s}")
    fin = ee.Date(f"{anio}-{fin_s}") if fin_s else ee.Date(f"{anio + 1}-01-01")
    n = fin.difference(ini, "day").round()
    fc = U.puntos_fc()

    def dia(k):
        d = ini.advance(k, "day")
        sub = horario.filterDate(d, d.advance(1, "day"))
        # días sin datos horarios todavía (los más recientes): imagen vacía enmascarada
        img = ee.Image(ee.Algorithms.If(
            sub.size().gt(0), sub.map(velocidad).mean(),
            ee.Image.constant(0).rename("viento").updateMask(ee.Image.constant(0))))
        return (img.reduceRegions(fc, ee.Reducer.first(), C.ESCALA_ERA5)
                .map(lambda f: f.set({"fecha": d.format("YYYY-MM-dd"), "horas": sub.size()})
                     .setGeometry(None)))

    dias = ee.List.sequence(0, n.subtract(1))
    try:
        datos = U.con_reintentos(lambda: ee.FeatureCollection(dias.map(dia)).flatten().getInfo())
    except Exception as e:
        U.log(f"  ERROR viento {anio} T{q + 1}: {str(e)[:200]}")
        U.registrar("02b", destino, "error", str(e))
        return False
    filas = [f["properties"] for f in datos["features"] if f["properties"].get("horas", 0) > 0]
    destino.write_text(json.dumps(filas), encoding="utf-8")
    return True


anios = range(C.ERA5_INICIO_PUNTOS, C.ERA5_FIN + 1)
tareas = [lambda a=a, q=q: trimestre(a, q) for a in anios for q in range(4)]
U.log(f"Viento horario ERA5-Land: {len(tareas)} trimestres")
U.en_paralelo(tareas)

por_punto = {}
for f in sorted(CACHE.glob("viento_*.json")):
    for r in json.loads(f.read_text(encoding="utf-8")):
        por_punto.setdefault(r["punto"], []).append(r)
for punto, filas in por_punto.items():
    filas.sort(key=lambda r: r["fecha"])
    with open(OUT / f"viento_diario_{punto}.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["fecha", "viento10_ms", "horas"])
        for r in filas:
            v = r.get("first")
            w.writerow([r["fecha"], None if v is None else round(v, 3), r.get("horas")])
    U.log(f"  viento_diario_{punto}.csv: {len(filas)} días")
U.log("Listo: datos/clima_era5land/viento_horario")
