# -*- coding: utf-8 -*-
"""
Paso 10. Uso y cobertura del suelo de Junín + áreas protegidas.

Sirve para que el simulador no deje sembrar en una zona urbana, un lago o un nevado,
y para advertir si la parcela cae en bosque, bofedal o área natural protegida.

A) ESA WorldCover v200 (2021): 11 clases, original a 10 m; se baja a 30 m para todo Junín.
B) Google Dynamic World: clase más frecuente de los últimos 12 meses (refleja
   construcciones recientes), a 30 m.
C) Áreas naturales protegidas (WDPA) que tocan Junín, en GeoJSON.
D) Resumen de hectáreas por clase y provincia (CSV).
E) Reglas para el simulador: qué clase se puede sembrar, cuál da advertencia y cuál se bloquea.

Para la parcela, el backend debe consultar WorldCover / Dynamic World a 10 m en vivo.
Salida: datos/uso_suelo/
"""
import csv
import json
from datetime import date, timedelta

import ee
import config as C
import utils as U

U.iniciar()
OUT = C.CARPETA_DATOS / "uso_suelo"
OUT.mkdir(parents=True, exist_ok=True)
geom, bbox = U.junin()
bb = U._coords_bbox(bbox)

ESCALA_USO = 30
WORLDCOVER = "ESA/WorldCover/v200"
DYNAMIC_WORLD = "GOOGLE/DYNAMICWORLD/V1"
WDPA = "WCMC/WDPA/current/polygons"

# código: (nombre, regla para el simulador, mensaje)
CLASES_WORLDCOVER = {
    10: ("Bosque / árboles", "advertencia", "Sembrar aquí implica talar bosque."),
    20: ("Matorral", "permitido", ""),
    30: ("Pastizal", "permitido", ""),
    40: ("Cultivos", "permitido", ""),
    50: ("Zona urbana / construida", "bloqueado", "Es una zona construida o residencial; elige un terreno agrícola."),
    60: ("Suelo desnudo / vegetación escasa", "advertencia", "Suelo pedregoso o con poca vegetación; el rendimiento puede ser bajo."),
    70: ("Nieve y hielo", "bloqueado", "Es un nevado o glaciar."),
    80: ("Agua permanente", "bloqueado", "Es un río, lago o laguna."),
    90: ("Humedal / bofedal", "advertencia", "Los bofedales regulan el agua de la cuenca; no se recomienda cultivarlos."),
    95: ("Manglar", "bloqueado", "Ecosistema protegido."),
    100: ("Musgo y liquen", "bloqueado", "Zona de alta montaña sin suelo agrícola."),
}
CLASES_DW = {
    0: ("Agua", "bloqueado"), 1: ("Árboles", "advertencia"), 2: ("Pasto", "permitido"),
    3: ("Vegetación inundada", "advertencia"), 4: ("Cultivos", "permitido"),
    5: ("Arbustos", "permitido"), 6: ("Construido", "bloqueado"),
    7: ("Suelo desnudo", "advertencia"), 8: ("Nieve y hielo", "bloqueado"),
}

# ---------------------------------------------------------------------------
# A) WorldCover
# ---------------------------------------------------------------------------
U.log(f"ESA WorldCover 2021 a {ESCALA_USO} m")
wc = ee.ImageCollection(WORLDCOVER).first().select("Map").rename("clase")
U.descargar_imagen(wc.toUint8().clip(geom), bb, ESCALA_USO,
                   OUT / f"worldcover_2021_{ESCALA_USO}m_junin.tif", "10")

# ---------------------------------------------------------------------------
# B) Dynamic World (últimos 12 meses)
# ---------------------------------------------------------------------------
# Para todo Junín es demasiado pesado (un año de imágenes Sentinel-2 sobre 44 000 km²).
# Se omite por defecto; el backend lo consultará en vivo solo para la parcela.
# Para forzarlo: python 10_uso_suelo.py dynamicworld
import sys
if len(sys.argv) > 1 and sys.argv[1] == "dynamicworld":
    fin = date.today()
    ini = fin - timedelta(days=365)
    U.log(f"Dynamic World {ini} a {fin} (clase más frecuente) a {ESCALA_USO} m")
    dw = (ee.ImageCollection(DYNAMIC_WORLD).filterBounds(bbox)
          .filterDate(ini.isoformat(), fin.isoformat()).select("label").mode())
    U.descargar_imagen(dw.toUint8().clip(geom), bb, ESCALA_USO,
                       OUT / f"dynamicworld_{fin.year}_{ESCALA_USO}m_junin.tif", "10")
else:
    U.log("Dynamic World omitido para todo Junín (se consultará solo para la parcela)")

# ---------------------------------------------------------------------------
# C) Áreas protegidas
# ---------------------------------------------------------------------------
U.log("Áreas naturales protegidas (WDPA)")
try:
    anp = (ee.FeatureCollection(WDPA).filterBounds(geom)
           .select(["NAME", "DESIG", "IUCN_CAT", "STATUS"])
           .map(lambda f: f.simplify(100)))
    gj = U.con_reintentos(lambda: anp.getInfo())
    (OUT / "areas_protegidas_junin.geojson").write_text(json.dumps(gj), encoding="utf-8")
    nombres = sorted({f["properties"].get("NAME", "") for f in gj["features"]})
    U.log(f"  {len(nombres)} áreas: {', '.join(nombres[:8])}{'...' if len(nombres) > 8 else ''}")
    U.registrar("10", OUT / "areas_protegidas_junin.geojson", "ok")
except Exception as e:
    U.log(f"  ERROR áreas protegidas: {str(e)[:200]}")
    U.registrar("10", "areas_protegidas", "error", str(e))

# ---------------------------------------------------------------------------
# D) Hectáreas por clase y provincia (WorldCover a 100 m: 1 píxel = 1 ha)
# ---------------------------------------------------------------------------
U.log("Resumen de hectáreas por provincia")
try:
    prov = (ee.FeatureCollection(C.GAUL_NIVEL2)
            .filter(ee.Filter.eq("ADM0_NAME", C.PAIS))
            .filter(ee.Filter.inList("ADM1_NAME", C.REGION_NOMBRES)))
    res = U.con_reintentos(lambda: wc.reduceRegions(prov, ee.Reducer.frequencyHistogram(), 100)
                           .select(["ADM2_NAME", "histogram"]).getInfo())
    with open(OUT / "hectareas_por_provincia.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["provincia"] + [f"{k}_{v[0]}" for k, v in CLASES_WORLDCOVER.items()] + ["total_ha"])
        for f in res["features"]:
            h = f["properties"].get("histogram", {}) or {}
            fila = [round(h.get(str(k), 0)) for k in CLASES_WORLDCOVER]
            w.writerow([f["properties"]["ADM2_NAME"]] + fila + [sum(fila)])
    U.registrar("10", OUT / "hectareas_por_provincia.csv", "ok")
except Exception as e:
    U.log(f"  ERROR resumen: {str(e)[:200]}")

# ---------------------------------------------------------------------------
# E) Reglas para el simulador
# ---------------------------------------------------------------------------
reglas = {
    "descripcion": "Qué hace el simulador según la cobertura del suelo del chunk o de la parcela",
    "criterio_parcela": "Si más del 50 % de la parcela es 'bloqueado', no se permite sembrar; "
                        "si hay chunks 'advertencia', se muestra el mensaje y se aplica una penalización.",
    "worldcover": {str(k): {"nombre": v[0], "regla": v[1], "mensaje": v[2]} for k, v in CLASES_WORLDCOVER.items()},
    "dynamic_world": {str(k): {"nombre": v[0], "regla": v[1]} for k, v in CLASES_DW.items()},
    "areas_protegidas": {"regla": "advertencia",
                         "mensaje": "La parcela está dentro de un área natural protegida; la actividad agrícola puede estar restringida."},
    "fuentes": ["Zanaga, D. et al. (2022). ESA WorldCover 10 m 2021 v200. doi:10.5281/zenodo.7254221",
                "Brown, C. F. et al. (2022). Dynamic World, Near real-time global 10 m land use land cover mapping. Scientific Data, 9, 251.",
                "UNEP-WCMC y UICN. World Database on Protected Areas (WDPA)."],
}
(OUT / "reglas_uso_suelo.json").write_text(json.dumps(reglas, ensure_ascii=False, indent=2), encoding="utf-8")
U.log("Listo: datos/uso_suelo")
