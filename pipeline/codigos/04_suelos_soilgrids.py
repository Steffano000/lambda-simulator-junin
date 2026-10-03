# -*- coding: utf-8 -*-
"""
Paso 4. Suelo de Junín con SoilGrids 250 m v2.0 (ISRIC).

A) Una capa por propiedad y profundidad (0-5, 5-15, 15-30 cm), unidades originales de SoilGrids.
B) Un GeoTIFF resumen 0-30 cm (promedio ponderado por espesor) en unidades de trabajo:
   arena_pct, arcilla_pct, limo_pct, cos_pct, ph, dap_gcm3, n_gkg, cic_cmolkg
Salida: datos/suelo/
"""
import ee
import config as C
import utils as U

U.iniciar()
OUT = C.CARPETA_DATOS / "suelo"
geom, bbox = U.junin()
bb = U._coords_bbox(bbox)

# factor para pasar de la unidad de SoilGrids a la unidad de trabajo
# sand/clay/silt g/kg -> % (/10) ; soc dg/kg -> % (/100) ; phh2o pH*10 -> pH (/10)
# bdod cg/cm3 -> g/cm3 (/100) ; nitrogen cg/kg -> g/kg (/100) ; cec mmol(c)/kg -> cmol(c)/kg (/10)
FACTOR = {"sand": 10, "clay": 10, "silt": 10, "soc": 100, "phh2o": 10,
          "bdod": 100, "nitrogen": 100, "cec": 10}
NOMBRE = {"sand": "arena_pct", "clay": "arcilla_pct", "silt": "limo_pct", "soc": "cos_pct",
          "phh2o": "ph", "bdod": "dap_gcm3", "nitrogen": "n_gkg", "cec": "cic_cmolkg"}
ESPESOR = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}

tareas = []
resumen = []
for prop in C.SUELO_PROPIEDADES:
    img = ee.Image(C.SOILGRIDS.format(prop=prop))
    nombres = [f"{prop}_{p}_mean" for p in C.SUELO_PROFUNDIDADES]
    capas = img.select(nombres)
    destino = OUT / "por_profundidad" / f"{prop}_0-30cm_soilgrids.tif"
    tareas.append(lambda capas=capas, destino=destino:
                  U.descargar_imagen(capas.toInt16().clip(geom), bb, C.ESCALA_SUELO, destino, "04"))
    pond = None
    for p in C.SUELO_PROFUNDIDADES:
        b = img.select(f"{prop}_{p}_mean").multiply(ESPESOR[p])
        pond = b if pond is None else pond.add(b)
    resumen.append(pond.divide(30).divide(FACTOR[prop]).rename(NOMBRE[prop]))

U.log("SoilGrids: capas por profundidad")
U.en_paralelo(tareas, hilos=4)

U.log("SoilGrids: resumen 0-30 cm en unidades de trabajo")
img_res = ee.Image.cat(resumen).toFloat().clip(geom)
U.descargar_imagen(img_res, bb, C.ESCALA_SUELO, OUT / "suelo_0_30cm_junin.tif", "04")
(OUT / "suelo_0_30cm_bandas.txt").write_text(
    "Bandas de suelo_0_30cm_junin.tif (en este orden):\n" +
    "\n".join(NOMBRE[p] for p in C.SUELO_PROPIEDADES) + "\n", encoding="utf-8")
U.log("Listo: datos/suelo")
