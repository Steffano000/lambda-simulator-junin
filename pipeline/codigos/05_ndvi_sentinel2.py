# -*- coding: utf-8 -*-
"""
Paso 5. NDVI mensual de Junín con Sentinel-2 SR (2017-04 a hoy).
NDVI = (B8 - B4) / (B8 + B4), mediana mensual con nubes enmascaradas (capa SCL).
Se guarda como entero x10000 (7350 = 0.735) para que los archivos pesen la mitad.
Resolución en config.ESCALA_NDVI (250 m para toda la región).
Salida: datos/ndvi_sentinel2/
"""
from datetime import date

import ee
import config as C
import utils as U

U.iniciar()
OUT = C.CARPETA_DATOS / "ndvi_sentinel2"
geom, bbox = U.junin()
bb = U._coords_bbox(bbox)

# SCL: 3 sombra de nube, 8-9 nube, 10 cirro, 11 nieve, 1 saturado
MALAS = [1, 3, 8, 9, 10, 11]


def ndvi(img):
    scl = img.select("SCL")
    ok = scl.neq(MALAS[0])
    for m in MALAS[1:]:
        ok = ok.And(scl.neq(m))
    return img.normalizedDifference(["B8", "B4"]).rename("ndvi").updateMask(ok)


col = (ee.ImageCollection(C.S2_COL)
       .filterBounds(bbox)
       .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80)))

ini = date.fromisoformat(C.S2_INICIO)
hoy = date.today()
meses = []
y, m = ini.year, ini.month
while (y, m) < (hoy.year, hoy.month):
    meses.append((y, m))
    y, m = (y + 1, 1) if m == 12 else (y, m + 1)

tareas = []
for (y, m) in meses:
    destino = OUT / f"ndvi_x10000_{y}-{m:02d}.tif"
    if destino.exists():
        continue
    def t(y=y, m=m, destino=destino):
        y2, m2 = (y + 1, 1) if m == 12 else (y, m + 1)
        sub = col.filterDate(f"{y}-{m:02d}-01", f"{y2}-{m2:02d}-01")
        # En 2017-2018 Sentinel-2 SR no cubre todo Perú: hay meses sin ninguna imagen
        if U.con_reintentos(lambda: sub.size().getInfo()) == 0:
            U.log(f"  {y}-{m:02d}: sin imágenes Sentinel-2 SR sobre Junín (se omite)")
            U.registrar("05", destino, "sin_imagenes")
            return True
        img = sub.map(ndvi).median().multiply(10000).toInt16().clip(geom)
        return U.descargar_imagen(img, bb, C.ESCALA_NDVI, destino, "05")
    tareas.append(t)

U.log(f"NDVI mensual Sentinel-2: {len(tareas)} meses por bajar")
U.en_paralelo(tareas, hilos=4)
U.log("Listo: datos/ndvi_sentinel2  (meses lluviosos pueden tener huecos por nubes)")
