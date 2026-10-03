# -*- coding: utf-8 -*-
"""
Configuración única para todos los scripts de descarga.
Si cambian la zona, el período o el proyecto, solo se edita este archivo.
"""
import os
from pathlib import Path
from datetime import date

# ---------------------------------------------------------------------------
# Proyecto de Google Cloud registrado en Earth Engine (uso no comercial)
# ---------------------------------------------------------------------------
PROYECTO_GEE = "skllpro"

# ---------------------------------------------------------------------------
# Carpetas
# ---------------------------------------------------------------------------
CARPETA_BASE = Path(__file__).resolve().parent.parent      # ...\Lambda-simulator\pipeline
REPO = CARPETA_BASE.parent                                  # raíz del repositorio

# Los datos crudos (~900 MB) NO van en GitHub. Se buscan en este orden:
#   1) variable de entorno LAMBDA_DATOS (ruta a la carpeta "datos")
#   2) pipeline\datos (si alguien la copia dentro del repo; está en .gitignore)
#   3) C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos (equipo de Ambiental)
_CANDIDATOS = [os.environ.get("LAMBDA_DATOS"), CARPETA_BASE / "datos",
               r"C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos"]
CARPETA_DATOS = next((Path(c) for c in _CANDIDATOS if c and Path(c).exists()), CARPETA_BASE / "datos")
REGISTRO = CARPETA_DATOS.parent / "registro_descargas.csv"

# JSON para la app (los sirve Vite/Vercel desde /data/junin)
CARPETA_JSON_APP = REPO / "public" / "data" / "junin"

# fenologia_cultivos.json (hecho por el equipo): el original (C:\TESIS 2) y, si no está, la copia del repo
FENOLOGIA = next((p for p in [CARPETA_DATOS.parent.parent / "fenologia_cultivos.json",
                              CARPETA_DATOS.parent / "fenologia_cultivos.json",
                              CARPETA_JSON_APP / "app" / "fenologia_cultivos.json"] if p.exists()),
                 CARPETA_JSON_APP / "app" / "fenologia_cultivos.json")

# ---------------------------------------------------------------------------
# Zona de estudio: región Junín completa
# Límite oficial de FAO GAUL 2015 (nivel 1 = región, nivel 2 = provincia)
# ---------------------------------------------------------------------------
GAUL_NIVEL1 = "FAO/GAUL/2015/level1"
GAUL_NIVEL2 = "FAO/GAUL/2015/level2"
PAIS = "Peru"
REGION_NOMBRES = ["Junin", "Junín"]   # GAUL a veces lo guarda sin tilde

# Recuadro de respaldo si GAUL no responde (lon_min, lat_min, lon_max, lat_max)
JUNIN_BBOX_RESPALDO = [-76.55, -12.75, -73.45, -10.65]

# ---------------------------------------------------------------------------
# Puntos de interés para series diarias (lat, lon)
# Huayao es la estación del IGP con la que se calibra la lluvia.
# Las capitales de provincia dan una muestra de todo Junín.
# Cuando tengan su parcela, agréguenla aquí.
# ---------------------------------------------------------------------------
PUNTOS = {
    "huayao_igp":    (-12.0383, -75.3228),
    "huancayo":      (-12.0651, -75.2049),
    "concepcion":    (-11.9180, -75.3140),
    "chupaca":       (-12.0560, -75.2870),
    "jauja":         (-11.7750, -75.5000),
    "tarma":         (-11.4190, -75.6890),
    "junin":         (-11.1590, -75.9930),
    "la_oroya":      (-11.5190, -75.9000),
    "la_merced":     (-11.0550, -75.3290),
    "satipo":        (-11.2540, -74.6380),
}

# ---------------------------------------------------------------------------
# Períodos
# ---------------------------------------------------------------------------
HOY = date.today().isoformat()

ERA5_INICIO_PUNTOS = 1950        # series diarias en los puntos
ERA5_INICIO_GRILLAS = 1950       # mapas diarios de todo Junín (un archivo por año y variable)
ERA5_FIN = date.today().year     # ERA5-Land llega con ~5 días de retraso

SMAP_INICIO = "2015-03-31"
S2_INICIO = "2017-04-01"         # Sentinel-2 SR armonizado en GEE
OISST_INICIO = 1982              # el registro empieza en sep-1981; se toma desde 1982 completo

# ---------------------------------------------------------------------------
# Resoluciones de descarga (metros)
# ---------------------------------------------------------------------------
ESCALA_ERA5 = 11132       # 0.1°
ESCALA_SMAP = 9000
ESCALA_SUELO = 250
ESCALA_SRTM = 90          # 30 m para todo Junín serían ~600 MB; para la parcela usar 30
ESCALA_NDVI = 250         # 250 m para todo Junín (~3 MB por mes); para la parcela usar 10
ESCALA_OISST = 27830      # 0.25°

# ---------------------------------------------------------------------------
# Colecciones de Earth Engine
# ---------------------------------------------------------------------------
ERA5_COL = "ECMWF/ERA5_LAND/DAILY_AGGR"
SMAP_COL = "NASA/SMAP/SPL3SMP_E/006"
S2_COL = "COPERNICUS/S2_SR_HARMONIZED"
SRTM_IMG = "USGS/SRTMGL1_003"
OISST_COL = "NOAA/CDR/OISST/V2_1"
SOILGRIDS = "projects/soilgrids-isric/{prop}_mean"

# Variables de ERA5-Land (nombre en GEE -> nombre corto en los archivos)
ERA5_BANDAS = {
    "temperature_2m_max": "tmax_k",
    "temperature_2m_min": "tmin_k",
    "temperature_2m": "tmed_k",
    "dewpoint_temperature_2m": "trocio_k",
    "total_precipitation_sum": "precip_m",
    "surface_solar_radiation_downwards_sum": "rad_solar_jm2",
    "u_component_of_wind_10m": "u10_ms",
    "v_component_of_wind_10m": "v10_ms",
    "surface_pressure": "presion_pa",
    "volumetric_soil_water_layer_1": "hum_suelo_0_7cm",
    "potential_evaporation_sum": "evap_potencial_m",
}
# Variables que se bajan como mapa diario de todo Junín
ERA5_BANDAS_GRILLA = [
    "temperature_2m_max",
    "temperature_2m_min",
    "dewpoint_temperature_2m",
    "total_precipitation_sum",
    "surface_solar_radiation_downwards_sum",
    "u_component_of_wind_10m",
    "v_component_of_wind_10m",
    "volumetric_soil_water_layer_1",
]

# SoilGrids: propiedades y profundidades (0-30 cm = capa arable)
SUELO_PROPIEDADES = ["sand", "clay", "silt", "soc", "phh2o", "bdod", "nitrogen", "cec"]
SUELO_PROFUNDIDADES = ["0-5cm", "5-15cm", "15-30cm"]

# Regiones Niño (lon_min, lat_min, lon_max, lat_max)
NINO_REGIONES = {
    "nino12": [-90, -10, -80, 0],
    "nino34": [-170, -5, -120, 5],
}
CLIMATOLOGIA = (1991, 2020)

# Descargas en paralelo (Earth Engine tolera bien 4-8)
HILOS = 6
