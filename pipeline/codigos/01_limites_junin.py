# -*- coding: utf-8 -*-
"""
Paso 1. Límites de Junín y sus provincias (GeoJSON) + elevación de cada punto de interés.
Salida: datos/limites/
"""
import json
import ee
import config as C
import utils as U

U.iniciar()
out = C.CARPETA_DATOS / "limites"
out.mkdir(parents=True, exist_ok=True)

U.log("Límite de la región Junín")
region = (ee.FeatureCollection(C.GAUL_NIVEL1)
          .filter(ee.Filter.eq("ADM0_NAME", C.PAIS))
          .filter(ee.Filter.inList("ADM1_NAME", C.REGION_NOMBRES)))
gj = region.map(lambda f: f.simplify(100)).getInfo()
(out / "junin_region.geojson").write_text(json.dumps(gj), encoding="utf-8")

U.log("Límites provinciales")
prov = (ee.FeatureCollection(C.GAUL_NIVEL2)
        .filter(ee.Filter.eq("ADM0_NAME", C.PAIS))
        .filter(ee.Filter.inList("ADM1_NAME", C.REGION_NOMBRES))
        .select(["ADM2_NAME", "ADM2_CODE"]))
gj = prov.map(lambda f: f.simplify(100)).getInfo()
(out / "junin_provincias.geojson").write_text(json.dumps(gj), encoding="utf-8")
U.log(f"  {len(gj['features'])} provincias")

U.log("Elevación SRTM (30 m) de los puntos de interés")
dem = ee.Image(C.SRTM_IMG).select("elevation")
pts = dem.reduceRegions(U.puntos_fc(), ee.Reducer.first(), 30).getInfo()
with open(out / "puntos_interes.csv", "w", encoding="utf-8") as f:
    f.write("punto,lat,lon,elevacion_m\n")
    for ft in pts["features"]:
        nombre = ft["properties"]["punto"]
        lat, lon = C.PUNTOS[nombre]
        f.write(f"{nombre},{lat},{lon},{ft['properties'].get('first')}\n")
(out / "puntos_interes.geojson").write_text(json.dumps(pts), encoding="utf-8")
U.registrar("01", out, "ok")
U.log("Listo: datos/limites")
