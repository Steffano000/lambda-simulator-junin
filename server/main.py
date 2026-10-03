# -*- coding: utf-8 -*-
"""
Servidor de la Fase 2 (opcional). Lee los GeoTIFF de la carpeta `datos` a su resolución
original para la parcela que dibuja el usuario. La app lo usa si existe VITE_API_URL;
si no, trabaja solo con los JSON de public/data/junin (Fase 1).

    cd server
    python -m pip install -r requirements.txt
    set LAMBDA_DATOS=C:\\TESIS 2\\DATOS PARA LA VERSION MEJORADA\\datos
    uvicorn main:app --reload

Endpoints
    GET  /salud                      -> {"ok": true}
    GET  /terreno?lat=&lon=          -> altura, pendiente, cobertura y suelo en un punto
    POST /parcela  (GeoJSON Polygon) -> grilla de chunks de 30 m (mismo formato que la app)
    GET  /escenarios/{punto}         -> clima y cultivos del punto (simulador_escenarios.json)
"""
import json
import math
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from rasterio.crs import CRS
from rasterio.warp import Resampling, reproject

REPO = Path(__file__).resolve().parent.parent
_CAND = [os.environ.get("LAMBDA_DATOS"), REPO / "pipeline" / "datos",
         r"C:\TESIS 2\DATOS PARA LA VERSION MEJORADA\datos"]
DATOS = next((Path(c) for c in _CAND if c and Path(c).exists()), REPO / "pipeline" / "datos")
JSON_APP = REPO / "public" / "data" / "junin" / "app"

CELDA_BASE = 30.0
CELDA_MIN = 1.0      # un surco / celda del simulador 3D
MAX_LADO = 100       # límite de la grilla 3D
PASOS_FINOS = [1, 2, 3, 5, 6, 10, 15, 30]
M_GRADO = 111_320.0
WGS84 = CRS.from_epsg(4326)
CLASES_APP = {"Franco arcillo arenoso": "Franco arcilloso", "Arcilla arenosa": "Arcilla"}

app = FastAPI(title="Lambda Simulator · Junín (Fase 2)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@lru_cache(maxsize=None)
def reglas():
    r = json.loads((JSON_APP / "reglas_uso_suelo.json").read_text(encoding="utf-8"))
    return {int(k): v for k, v in r["worldcover"].items()}


@lru_cache(maxsize=None)
def ndvi_reciente() -> Path:
    fs = sorted((DATOS / "ndvi_sentinel2").glob("ndvi_x10000_*.tif"), key=lambda f: f.stat().st_size)
    grandes = [f for f in fs if f.stat().st_size > 500_000] or fs
    return sorted(grandes)[-1]


def fuentes():
    return {
        "elev": DATOS / "terreno" / "elevacion_srtm_90m_junin.tif",
        "pend": DATOS / "terreno" / "pendiente_x10_90m_junin.tif",
        "suelo": DATOS / "suelo" / "suelo_0_30cm_junin.tif",
        "wc": DATOS / "uso_suelo" / "worldcover_2021_30m_junin.tif",
        "ndvi": ndvi_reciente(),
    }


def textura_usda(a, c, l):
    vals = [a, c, l]
    if any(v is None or not math.isfinite(v) for v in vals) or sum(vals) <= 0:
        return None
    t = sum(vals)
    s, c, si = 100 * a / t, 100 * c / t, 100 * l / t
    if si + 1.5 * c < 15:
        k = "Arena"
    elif si + 2 * c < 30:
        k = "Arena franca"
    elif (7 <= c < 20 and s > 52) or (c < 7 and si < 50):
        k = "Franco arenoso"
    elif 7 <= c < 27 and 28 <= si < 50 and s <= 52:
        k = "Franco"
    elif (si >= 50 and 12 <= c < 27) or (50 <= si < 80 and c < 12):
        k = "Franco limoso"
    elif si >= 80 and c < 12:
        k = "Limo"
    elif 20 <= c < 35 and si < 28 and s > 45:
        k = "Franco arcillo arenoso"
    elif 27 <= c < 40 and 20 < s <= 45:
        k = "Franco arcilloso"
    elif 27 <= c < 40 and s <= 20:
        k = "Franco arcillo limoso"
    elif c >= 35 and s > 45:
        k = "Arcilla arenosa"
    elif c >= 40 and si >= 40:
        k = "Arcilla limosa"
    elif c >= 40:
        k = "Arcilla"
    else:
        k = "Franco"
    return CLASES_APP.get(k, k)


def leer_en(ruta: Path, banda: int, tr: Affine, ancho: int, alto: int, metodo: str, escala=1.0):
    """Lee solo la ventana necesaria del TIF y la lleva a la grilla de chunks."""
    with rasterio.open(ruta) as src:
        oeste, norte = tr.c, tr.f
        este, sur = oeste + tr.a * ancho, norte + tr.e * alto
        win = rasterio.windows.from_bounds(oeste, sur, este, norte, src.transform).round_offsets().round_lengths()
        pad = 3
        win = rasterio.windows.Window(max(0, win.col_off - pad), max(0, win.row_off - pad), win.width + 2 * pad, win.height + 2 * pad)
        a = src.read(banda, window=win, boundless=True, fill_value=src.nodata if src.nodata is not None else 0).astype("float32")
        if src.nodata is not None and math.isfinite(src.nodata):
            a[a == src.nodata] = np.nan
        a[~np.isfinite(a)] = np.nan
        if ruta.name.startswith("worldcover"):
            a[a == 0] = np.nan
        dst = np.full((alto, ancho), np.nan, dtype="float32")
        reproject(a, dst, src_transform=src.window_transform(win), src_crs=WGS84, dst_transform=tr, dst_crs=WGS84,
                  resampling=getattr(Resampling, metodo), src_nodata=np.nan, dst_nodata=np.nan)
    return dst / escala


def dentro_poligono(lon, lat, anillo):
    """Ray casting (suficiente para parcelas)."""
    d = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i]
        xj, yj = anillo[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi:
            d = not d
        j = i
    return d


def num(v, nd=2):
    v = float(v)
    return round(v, nd) if math.isfinite(v) else None


@app.get("/salud")
def salud():
    return {"ok": True, "datos": str(DATOS), "existe": DATOS.exists()}


@app.get("/terreno")
def terreno(lat: float, lon: float):
    tr = Affine(1e-5, 0, lon - 5e-6, 0, -1e-5, lat + 5e-6)
    f = fuentes()
    if not f["elev"].exists():
        raise HTTPException(503, f"No encuentro los TIF en {DATOS}")
    v = {
        "elevacion_m": num(leer_en(f["elev"], 1, tr, 1, 1, "bilinear")[0, 0], 1),
        "pendiente_grados": num(leer_en(f["pend"], 1, tr, 1, 1, "bilinear", 10)[0, 0], 1),
        "worldcover": num(leer_en(f["wc"], 1, tr, 1, 1, "nearest")[0, 0], 0),
    }
    for b, k in enumerate(["arena_pct", "arcilla_pct", "limo_pct", "cos_pct", "ph"], start=1):
        v[k] = num(leer_en(f["suelo"], b, tr, 1, 1, "nearest")[0, 0])
    wc = v["worldcover"]
    v["cobertura"] = reglas().get(int(wc), {}).get("nombre") if wc is not None else None
    v["regla"] = reglas().get(int(wc), {}).get("regla") if wc is not None else None
    return v


@app.post("/parcela")
def parcela(geom: dict, celda_m: float | None = None):
    """celda_m opcional (?celda_m=5): tamaño de chunk elegido en la app; si no, el automático."""
    if geom.get("type") != "Polygon":
        raise HTTPException(400, "Se espera un GeoJSON Polygon")
    anillo = geom["coordinates"][0]
    lons = [p[0] for p in anillo]
    lats = [p[1] for p in anillo]
    oeste, este, sur, norte = min(lons), max(lons), min(lats), max(lats)
    lat0 = (norte + sur) / 2
    lado = max((norte - sur) * M_GRADO, (este - oeste) * M_GRADO * math.cos(math.radians(lat0)))
    ideal = lado / MAX_LADO - 1e-6  # tolerancia al redondeo, igual que la app
    if ideal <= CELDA_BASE:  # mismo criterio que la app (src/domain/junin/parcela.ts)
        celda = float(next(p for p in PASOS_FINOS if p >= max(CELDA_MIN, ideal)))
    else:
        celda = CELDA_BASE * max(1, math.ceil(lado / (CELDA_BASE * MAX_LADO) - 1e-6))
    if celda_m is not None:
        if celda_m < CELDA_MIN or lado / celda_m > MAX_LADO + 1e-6:
            raise HTTPException(400, f"celda_m={celda_m} da más de {MAX_LADO} chunks por lado o es menor a {CELDA_MIN} m")
        celda = float(celda_m)
    dlat = celda / M_GRADO
    dlon = celda / (M_GRADO * math.cos(math.radians(lat0)))
    filas = max(1, math.ceil((norte - sur) / dlat - 1e-6))
    columnas = max(1, math.ceil((este - oeste) / dlon - 1e-6))
    tr = Affine(dlon, 0, oeste, 0, -dlat, norte)
    f = fuentes()
    if not f["elev"].exists():
        raise HTTPException(503, f"No encuentro los TIF en {DATOS}")
    el = leer_en(f["elev"], 1, tr, columnas, filas, "bilinear")
    pe = leer_en(f["pend"], 1, tr, columnas, filas, "bilinear", 10)
    wc = leer_en(f["wc"], 1, tr, columnas, filas, "mode" if celda > 30 else "nearest")
    su = [leer_en(f["suelo"], b, tr, columnas, filas, "nearest") for b in range(1, 6)]
    nd = leer_en(f["ndvi"], 1, tr, columnas, filas, "nearest", 10000)
    R = reglas()
    chunks = []
    for i in range(filas):
        for j in range(columnas):
            lat = norte - (i + 0.5) * dlat
            lon = oeste + (j + 0.5) * dlon
            w = wc[i, j]
            a, c, l, cos, ph = (float(x[i, j]) for x in su)
            chunks.append({
                "fila": i, "columna": j, "lat": lat, "lon": lon,
                "dentro": dentro_poligono(lon, lat, anillo),
                "elevacion_m": num(el[i, j], 1), "pendiente_grados": num(pe[i, j], 1),
                "worldcover": int(w) if math.isfinite(w) else None,
                "regla": R.get(int(w), {}).get("regla") if math.isfinite(w) else None,
                "arena_pct": num(a), "arcilla_pct": num(c), "limo_pct": num(l), "cos_pct": num(cos), "ph": num(ph),
                "ndvi": num(nd[i, j], 3) if -1 <= float(nd[i, j]) <= 1 else None,
                "textura": textura_usda(a, c, l),
                "fuente": "servidor",
            })
    return {"celda_m": celda, "filas": filas, "columnas": columnas, "bbox": [oeste, sur, este, norte],
            "dlat": dlat, "dlon": dlon, "chunks": chunks, "origen": "servidor"}


@app.get("/escenarios/{punto}")
def escenarios(punto: str):
    sim = json.loads((JSON_APP / "simulador_escenarios.json").read_text(encoding="utf-8"))
    if punto not in sim["puntos"]:
        raise HTTPException(404, f"Punto desconocido: {punto}")
    return sim["puntos"][punto]
