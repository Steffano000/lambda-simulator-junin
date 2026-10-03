# -*- coding: utf-8 -*-
"""
Paso 7. Índice ENSO a partir de NOAA OISST v2.1 (temperatura superficial del mar).
- Serie diaria de TSM media en Niño 1+2 (costa de Perú) y Niño 3.4 (Pacífico central).
- Serie mensual con anomalía respecto a 1991-2020 y media móvil de 3 meses
  (equivalente al ONI para Niño 3.4 y al ICEN para Niño 1+2; no son los valores oficiales).
Salida: datos/enso/
"""
import csv
import json
from collections import defaultdict
from datetime import date

import ee
import config as C
import utils as U

U.iniciar()
OUT = C.CARPETA_DATOS / "enso"
CACHE = OUT / "_cache"
CACHE.mkdir(parents=True, exist_ok=True)
col = ee.ImageCollection(C.OISST_COL).select("sst")
regiones = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Rectangle(bb, None, False), {"region": nombre})
    for nombre, bb in C.NINO_REGIONES.items()
])


def anio(a):
    destino = CACHE / f"oisst_{a}.json"
    if destino.exists():
        return True

    def por_imagen(img):
        fecha = img.date().format("YYYY-MM-dd")
        return (img.multiply(0.01).reduceRegions(regiones, ee.Reducer.mean(), C.ESCALA_OISST)
                .map(lambda f: f.set("fecha", fecha).setGeometry(None)))
    sub = col.filterDate(f"{a}-01-01", f"{a + 1}-01-01")
    try:
        datos = U.con_reintentos(lambda: sub.map(por_imagen).flatten().getInfo())
    except Exception as e:
        U.log(f"  ERROR OISST {a}: {str(e)[:200]}")
        return False
    destino.write_text(json.dumps([f["properties"] for f in datos["features"]]), encoding="utf-8")
    return True


anios = list(range(C.OISST_INICIO, date.today().year + 1))
U.log(f"OISST: TSM diaria en regiones Niño, {anios[0]}-{anios[-1]}")
U.en_paralelo([lambda a=a: anio(a) for a in anios], hilos=4)

diario = defaultdict(dict)
for f in sorted(CACHE.glob("oisst_*.json")):
    for r in json.loads(f.read_text(encoding="utf-8")):
        diario[r["fecha"]][r["region"]] = r.get("mean")
fechas = sorted(diario)
with open(OUT / "tsm_diaria_regiones_nino.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["fecha", "tsm_nino12_c", "tsm_nino34_c"])
    for d in fechas:
        w.writerow([d, diario[d].get("nino12"), diario[d].get("nino34")])

# mensual + anomalía + media móvil 3 meses
mensual = defaultdict(lambda: defaultdict(list))
for d in fechas:
    for reg, v in diario[d].items():
        if v is not None:
            mensual[d[:7]][reg].append(v)
meses = sorted(mensual)
media = {m: {r: sum(v) / len(v) for r, v in mensual[m].items()} for m in meses}
clim = defaultdict(lambda: defaultdict(list))
for m in meses:
    if C.CLIMATOLOGIA[0] <= int(m[:4]) <= C.CLIMATOLOGIA[1]:
        for r, v in media[m].items():
            clim[m[5:]][r].append(v)
clim = {mes: {r: sum(v) / len(v) for r, v in d.items()} for mes, d in clim.items()}
anom = {m: {r: media[m][r] - clim.get(m[5:], {}).get(r, float("nan")) for r in media[m]} for m in meses}

with open(OUT / "enso_mensual.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["mes", "tsm_nino12_c", "anom_nino12_c", "indice_nino12_3m",
                "tsm_nino34_c", "anom_nino34_c", "indice_nino34_3m"])
    for i, m in enumerate(meses):
        fila = [m]
        for r in ("nino12", "nino34"):
            ventana = [anom[x].get(r) for x in meses[max(0, i - 1): i + 2]]
            ventana = [v for v in ventana if v is not None]
            movil = round(sum(ventana) / len(ventana), 3) if len(ventana) == 3 else None
            fila += [round(media[m].get(r, float("nan")), 3), round(anom[m].get(r, float("nan")), 3), movil]
        w.writerow(fila)
U.log(f"Listo: datos/enso  ({len(fechas)} días, {len(meses)} meses)")
