# -*- coding: utf-8 -*-
"""
Paso 0. Autenticación con Google Earth Engine (solo la primera vez en cada PC).
Abre el navegador: elige tu cuenta de Google, acepta los permisos y vuelve aquí.
Las credenciales quedan guardadas en tu usuario de Windows (.config/earthengine).
"""
import sys
import ee
import config as C

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

print("Abriendo el navegador para autorizar Earth Engine...")
ee.Authenticate()
ee.Initialize(project=C.PROYECTO_GEE)

# Prueba rápida: altura de la estación Huayao según SRTM
lat, lon = C.PUNTOS["huayao_igp"]
z = (ee.Image(C.SRTM_IMG).select("elevation")
     .reduceRegion(ee.Reducer.first(), ee.Geometry.Point([lon, lat]), 30)
     .get("elevation").getInfo())
print(f"Conexión correcta con el proyecto '{C.PROYECTO_GEE}'.")
print(f"Prueba: elevación SRTM en Huayao = {z} m (la estación está a ~3313 m)")
