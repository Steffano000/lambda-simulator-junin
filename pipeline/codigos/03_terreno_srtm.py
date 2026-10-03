# -*- coding: utf-8 -*-
"""
Paso 3. Relieve de Junín con SRTM (NASA): elevación (m) y pendiente (grados).
Resolución definida en config.ESCALA_SRTM (90 m para toda la región).
Salida: datos/terreno/
"""
import ee
import config as C
import utils as U

U.iniciar()
OUT = C.CARPETA_DATOS / "terreno"
geom, bbox = U.junin()
bb = U._coords_bbox(bbox)

dem = ee.Image(C.SRTM_IMG).select("elevation")
pend = ee.Terrain.slope(dem).rename("pendiente_grados")

U.log(f"Elevación SRTM a {C.ESCALA_SRTM} m")
U.descargar_imagen(dem.toInt16().clip(geom), bb, C.ESCALA_SRTM,
                   OUT / f"elevacion_srtm_{C.ESCALA_SRTM}m_junin.tif", "03")
U.log(f"Pendiente a {C.ESCALA_SRTM} m")
U.descargar_imagen(pend.multiply(10).toInt16().clip(geom), bb, C.ESCALA_SRTM,
                   OUT / f"pendiente_x10_{C.ESCALA_SRTM}m_junin.tif", "03")
U.log("Listo: datos/terreno  (la pendiente está multiplicada por 10: 125 = 12.5°)")
