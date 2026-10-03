# -*- coding: utf-8 -*-
"""
Paso 17 (sin internet). Convierte TODA la carpeta datos/ a JSON para el simulador web.

Entrada : datos/ (CSV, GeoJSON, GeoTIFF, NetCDF y JSON de los pasos 01-16)
Salida  : public/data/junin/ del repositorio Lambda-simulator (o la carpeta que se indique)

Qué hace con cada formato
- JSON          -> se valida y se limpia (NaN e Infinity pasan a null, que JavaScript sí entiende).
- CSV           -> tabla JSON (lista de objetos). Las series diarias largas van en columnas.
- GeoJSON       -> se copia redondeando las coordenadas a 5 decimales (~1 m).
- GeoTIFF/NetCDF-> grillas JSON (arreglos planos fila por fila, de norte a sur y de oeste a este)
                   a una resolución que el navegador pueda cargar, más una "parcela" de 40 x 40
                   celdas de 30 m alrededor de cada punto con datos (terreno real para el 3D).

Uso:
    python codigos/17_exportar_json.py                       # usa config.py
    python codigos/17_exportar_json.py --salida RUTA         # otra carpeta de salida
    python codigos/17_exportar_json.py --solo app,tablas     # solo algunos grupos

Grupos: app, tablas, geo, diario, grillas, parcelas, era5, smap, pisco, ndvi
Requiere: numpy, pandas, rasterio.
"""
import argparse
import csv
import json
import math
import os
import shutil
import sys
import warnings
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
warnings.filterwarnings("ignore", category=RuntimeWarning)

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
try:
    import config as C  # noqa: E402
    DATOS_DEF = C.CARPETA_DATOS
    BASE_DEF = C.CARPETA_BASE
except Exception:  # config.py importa cosas de Earth Engine en algunos equipos
    BASE_DEF = AQUI.parent
    DATOS_DEF = BASE_DEF / "datos"

PUNTOS = {
    "huayao_igp": (-12.0383, -75.3228),
    "huancayo": (-12.0651, -75.2049),
    "concepcion": (-11.9180, -75.3140),
    "chupaca": (-12.0560, -75.2870),
    "jauja": (-11.7750, -75.5000),
    "tarma": (-11.4190, -75.6890),
    "junin": (-11.1590, -75.9930),
    "la_oroya": (-11.5190, -75.9000),
    "la_merced": (-11.0550, -75.3290),
    "satipo": (-11.2540, -74.6380),
}

# Rejilla regional común (Junín): 0.01° ~ 1.1 km
BBOX = (-76.52, -12.69, -73.35, -10.65)          # oeste, sur, este, norte
RES_1KM = 0.01
RES_2KM = 0.02

MANIFIESTO = []      # archivos generados
AVISOS = []          # avisos de datos
OMITIDOS = []        # lo que no se convierte y por qué


# ---------------------------------------------------------------------------
# Utilidades JSON
# ---------------------------------------------------------------------------
def limpiar(x):
    """NaN, Infinity y tipos de numpy -> valores JSON válidos para JavaScript."""
    if isinstance(x, dict):
        return {str(k): limpiar(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [limpiar(v) for v in x]
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating, float)):
        v = float(x)
        return v if math.isfinite(v) else None
    if isinstance(x, np.ndarray):
        return limpiar(x.tolist())
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


def contar_no_validos(x):
    if isinstance(x, dict):
        return sum(contar_no_validos(v) for v in x.values())
    if isinstance(x, list):
        return sum(contar_no_validos(v) for v in x)
    if isinstance(x, float) and not math.isfinite(x):
        return 1
    return 0


def escribir(ruta: Path, obj, descripcion: str, fuente: str, uso: str):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(limpiar(obj), ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    ruta.write_text(texto, encoding="utf-8")
    rel = ruta.relative_to(SALIDA).as_posix()
    MANIFIESTO.append({"archivo": rel, "bytes": ruta.stat().st_size, "descripcion": descripcion,
                       "fuente": fuente, "uso": uso})
    print(f"  ok  {rel:58s} {ruta.stat().st_size / 1e6:7.2f} MB")


def leer_json(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


def num(v):
    if v is None:
        return None
    s = str(v).strip()
    if s == "" or s.lower() in ("nan", "na", "none", "null"):
        return None
    try:
        f = float(s)
    except ValueError:
        return s
    if not math.isfinite(f):
        return None
    return int(f) if f.is_integer() and "." not in s and "e" not in s.lower() else f


def tabla_csv(ruta: Path, agrupar_por=None):
    """CSV -> lista de objetos (o dict de listas agrupado por una columna)."""
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        filas = [{k: num(v) for k, v in r.items()} for r in csv.DictReader(f)]
    if agrupar_por:
        out = {}
        for r in filas:
            out.setdefault(str(r.pop(agrupar_por)), []).append(r)
        return out
    return filas


def redondear_geometria(g):
    if not g:
        return
    if "coordinates" in g:
        g["coordinates"] = redondear_coords(g["coordinates"])
    for sub in g.get("geometries", []):
        redondear_geometria(sub)


def redondear_coords(geom, nd=5):
    if isinstance(geom, list):
        if geom and isinstance(geom[0], (int, float)):
            return [round(c, nd) for c in geom]
        return [redondear_coords(g, nd) for g in geom]
    return geom


# ---------------------------------------------------------------------------
# Utilidades ráster
# ---------------------------------------------------------------------------
def rejilla(res, bbox=BBOX):
    from rasterio.transform import from_origin
    w, s, e, n = bbox
    ancho = int(round((e - w) / res))
    alto = int(round((n - s) / res))
    return from_origin(w, n, res, res), ancho, alto


def leer_float(src, banda=1):
    a = src.read(banda).astype("float32")
    nd = src.nodata
    if nd is not None and math.isfinite(nd):
        a[a == nd] = np.nan
    a[~np.isfinite(a)] = np.nan
    return a


def reproyectar(arr, src_transform, dst_transform, ancho, alto, metodo):
    from rasterio.warp import reproject, Resampling
    from rasterio.crs import CRS
    dst = np.full((alto, ancho), np.nan, dtype="float32")
    reproject(arr.astype("float32"), dst, src_transform=src_transform, src_crs=CRS.from_epsg(4326),
              dst_transform=dst_transform, dst_crs=CRS.from_epsg(4326),
              resampling=getattr(Resampling, metodo), src_nodata=np.nan, dst_nodata=np.nan)
    return dst


def reproyectar_clases(arr, src_transform, dst_transform, ancho, alto, metodo="mode", nodata=0):
    from rasterio.warp import reproject, Resampling
    from rasterio.crs import CRS
    dst = np.zeros((alto, ancho), dtype="uint8")
    reproject(arr, dst, src_transform=src_transform, src_crs=CRS.from_epsg(4326),
              dst_transform=dst_transform, dst_crs=CRS.from_epsg(4326),
              resampling=getattr(Resampling, metodo), src_nodata=nodata, dst_nodata=nodata)
    return dst


def capa(arr, unidad, escala=1.0, decimales=None, descripcion=""):
    """Arreglo 2D -> capa JSON. Si escala != 1, los valores guardados son valor*escala (enteros)."""
    plano = arr.ravel().astype("float64")
    if escala != 1.0:
        datos = [None if not math.isfinite(v) else int(round(v * escala)) for v in plano]
    elif decimales is not None:
        datos = [None if not math.isfinite(v) else round(v, decimales) for v in plano]
    else:
        datos = [None if not math.isfinite(v) else (int(v) if float(v).is_integer() else v) for v in plano]
    c = {"unidad": unidad, "datos": datos}
    if escala != 1.0:
        c["escala"] = escala
        c["nota"] = f"valor real = dato / {escala:g}"
    if descripcion:
        c["descripcion"] = descripcion
    return c


def cabecera_grilla(transform, ancho, alto, res, extra=None):
    w, n = transform.c, transform.f
    d = {"crs": "EPSG:4326", "resolucion_grados": res, "ancho": ancho, "alto": alto,
         "bbox": [round(w, 6), round(n - alto * res, 6), round(w + ancho * res, 6), round(n, 6)],
         "orden": "fila por fila, de norte a sur; dentro de cada fila, de oeste a este",
         "indice": "i = fila * ancho + columna; lon = oeste + (columna + 0.5) * res; lat = norte - (fila + 0.5) * res"}
    if extra:
        d.update(extra)
    return d


# ---------------------------------------------------------------------------
# Textura USDA y reglas de uso de suelo
# ---------------------------------------------------------------------------
def textura_usda(arena, arcilla, limo):
    """Triángulo textural USDA. Devuelve (clase USDA en español, clase equivalente en data/terrenos.json)."""
    if any(v is None or not math.isfinite(v) for v in (arena, arcilla, limo)):
        return None, None
    t = arena + arcilla + limo
    if t <= 0:
        return None, None
    s, c, si = 100 * arena / t, 100 * arcilla / t, 100 * limo / t
    if si + 1.5 * c < 15:
        k = "Arena"
    elif si + 1.5 * c >= 15 and si + 2 * c < 30:
        k = "Arena franca"
    elif (7 <= c < 20 and s > 52 and si + 2 * c >= 30) or (c < 7 and si < 50 and si + 2 * c >= 30):
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
    elif c >= 40 and s <= 45 and si < 40:
        k = "Arcilla"
    else:
        k = "Franco"
    # data/terrenos.json no tiene las dos clases arenosas-arcillosas: se usa la más parecida
    app = {"Franco arcillo arenoso": "Franco arcilloso", "Arcilla arenosa": "Arcilla"}.get(k, k)
    return k, app


def reglas_uso():
    r = leer_json(DATOS / "uso_suelo" / "reglas_uso_suelo.json")
    return {int(k): v for k, v in r.get("worldcover", {}).items()}


# ---------------------------------------------------------------------------
# Grupos de exportación
# ---------------------------------------------------------------------------
def g_app():
    """Núcleo que lee la app (Fase 1): validado y sin NaN/Infinity."""
    print("\n[app] JSON principales")
    pron = PRONOSTICO
    archivos = [
        (pron / "simulador_escenarios.json", "app/simulador_escenarios.json",
         "Clima pronosticado a 24 meses, indicadores hídricos y rendimiento por cultivo, por punto y escenario",
         "Pasos 13-14 (SARIMAX + balance FAO-56)"),
        (pron / "aquacrop_resumen.json", "app/aquacrop_resumen.json",
         "Rendimiento AquaCrop (papa, quinua, cebada) por punto y escenario; anomalía sobre DRA", "Paso 15 (AquaCrop-OSPy)"),
        (DATOS / "cultivos" / "catalogo_cultivos_junin.json", "app/catalogo_cultivos_junin.json",
         "Catálogo de cultivos por provincia y piso ecológico: rendimiento, precio y requerimientos EcoCrop",
         "Paso 12 (DRA Junín 2022 + FAO EcoCrop)"),
        (DATOS / "uso_suelo" / "reglas_uso_suelo.json", "app/reglas_uso_suelo.json",
         "Qué cobertura WorldCover permite, advierte o bloquea la siembra", "Paso 10"),
        (FENOLOGIA, "app/fenologia_cultivos.json",
         "Fases, Kc, sensibilidad al agua y efectos de rotación de 5 cultivos", "Equipo (FAO-56, SENAMHI, INIA)"),
    ]
    avisos = []
    for origen, destino, desc, fuente in archivos:
        if not origen.exists():
            print(f"  FALTA {origen}")
            avisos.append(f"falta {origen.name}")
            continue
        obj = json.loads(origen.read_text(encoding="utf-8"))
        malos = contar_no_validos(obj)
        if malos:
            avisos.append(f"{origen.name}: {malos} valores NaN/Infinity convertidos a null")
        escribir(SALIDA / destino, obj, desc, fuente, "app")

    # Puntos con datos: coordenadas, elevación, provincia y piso ecológico
    sim = leer_json(pron / "simulador_escenarios.json") if (pron / "simulador_escenarios.json").exists() else {"puntos": {}}
    cat = leer_json(DATOS / "cultivos" / "catalogo_cultivos_junin.json")
    elev = {r["punto"]: r["elevacion_m"] for r in tabla_csv(DATOS / "limites" / "puntos_interes.csv")}
    pisos = cat.get("pisos_ecologicos", [])
    puntos = []
    for pid, (lat, lon) in PUNTOS.items():
        e = elev.get(pid)
        piso = next((p["id"] for p in pisos if e is not None and p["alt_min_m"] <= e < p["alt_max_m"]), None)
        sp = sim["puntos"].get(pid, {})
        puntos.append({"id": pid, "lat": lat, "lon": lon, "elevacion_m": e,
                       "provincia": sp.get("provincia"), "piso_ecologico": piso,
                       "suelo": sp.get("suelo")})
    escribir(SALIDA / "app" / "puntos.json", {"puntos": puntos}, "Los 10 puntos con datos: coordenadas, elevación, provincia, piso ecológico y suelo",
             "config.py + SRTM + SoilGrids", "app")
    for a in avisos:
        print("  aviso:", a)
    return avisos


def g_tablas():
    print("\n[tablas] CSV -> JSON")
    pron = PRONOSTICO
    # Pronóstico SARIMAX por punto (formato largo -> punto/escenario/variable)
    pr = {}
    for pid in PUNTOS:
        f = pron / f"pronostico_{pid}.csv"
        if f.exists():
            pr[pid] = tabla_csv(f)
    escribir(SALIDA / "pronostico" / "pronostico_puntos.json", {"puntos": pr},
             "Pronóstico SARIMAX mensual (media e intervalo del 80 %) por punto, escenario y variable", "Paso 13", "analisis")
    bh = {pid: tabla_csv(pron / f"balance_hidrico_{pid}.csv") for pid in PUNTOS if (pron / f"balance_hidrico_{pid}.csv").exists()}
    escribir(SALIDA / "pronostico" / "balance_hidrico.json", {"puntos": bh},
             "Balance hídrico mensual por punto y escenario: P-ET0, P/ET0 y Kc, ETc, ETa, Ks por cultivo", "Paso 14", "analisis")
    sueltos = [
        (pron / "campanas_resumen.csv", "pronostico/campanas_resumen.json", "Resumen por campaña: lluvia, ETc, ETa, factor de agua y rendimiento", "Paso 14", "analisis"),
        (pron / "escenarios_enso.csv", "pronostico/escenarios_enso.json", "Anomalías Niño 1+2 y 3.4 supuestas en cada escenario", "Paso 13", "analisis"),
        (pron / "modelos_elegidos.csv", "pronostico/modelos_elegidos.json", "Orden SARIMAX elegido por punto y variable", "Paso 13", "validacion"),
        (pron / "validacion_backtest.csv", "pronostico/validacion_backtest.json", "Validación de 60 meses: RMSE, NSE y mejora sobre la climatología", "Paso 13", "validacion"),
        (pron / "aquacrop_escenarios.csv", "pronostico/aquacrop_escenarios.json", "AquaCrop por escenario: rendimiento seco, anomalía y rendimiento esperado", "Paso 15", "analisis"),
        (pron / "aquacrop_historico.csv", "pronostico/aquacrop_historico.json", "AquaCrop histórico por campaña", "Paso 15", "validacion"),
        (DATOS / "pisco" / "comparacion_mensual_puntos.csv", "pisco/comparacion_mensual_puntos.json", "Lluvia mensual PISCO vs ERA5-Land cruda y corregida en los puntos", "Paso 09", "validacion"),
        (DATOS / "pisco" / "validacion.csv", "pisco/validacion.json", "Validación de la corrección de lluvia 2011-2025 (sesgo, RMSE, r, NSE)", "Paso 09", "validacion"),
        (DATOS / "enso" / "enso_mensual.csv", "enso/enso_mensual.json", "Índice ENSO mensual (TSM, anomalía 1991-2020 y media móvil de 3 meses)", "NOAA OISST v2.1 (paso 07)", "analisis"),
        (DATOS / "cultivos" / "aptitud_puntos.csv", "cultivos/aptitud_puntos.json", "Aptitud EcoCrop (0-1) de cada cultivo en cada punto", "Paso 12", "app"),
        (DATOS / "cultivos" / "produccion_2022_provincias.csv", "cultivos/produccion_2022_provincias.json", "Producción agrícola 2022 por provincia y cultivo DRA", "DRA Junín (paso 11)", "analisis"),
        (DATOS / "cultivos" / "validacion_aptitud.csv", "cultivos/validacion_aptitud.json", "Validación de la aptitud EcoCrop contra lo que se siembra", "Paso 12", "validacion"),
        (DATOS / "uso_suelo" / "hectareas_por_provincia.csv", "uso_suelo/hectareas_por_provincia.json", "Hectáreas de cada cobertura WorldCover por provincia", "Paso 10", "analisis"),
        (DATOS / "limites" / "puntos_interes.csv", "limites/puntos_interes.json", "Puntos con datos y su elevación", "Paso 01", "app"),
    ]
    for origen, destino, desc, fuente, uso in sueltos:
        if origen.exists():
            escribir(SALIDA / destino, tabla_csv(origen), desc, fuente, uso)
        else:
            print(f"  FALTA {origen}")
    # JSON de pronóstico y clima mensual que no son del núcleo
    for origen, destino, desc, fuente, uso in [
        (pron / "pronostico_escenarios.json", "pronostico/pronostico_escenarios.json", "Pronóstico por escenario en formato JSON del paso 13", "Paso 13", "analisis"),
        (DATOS / "clima_era5land" / "et0" / "clima_mensual_puntos.json", "clima/clima_mensual_puntos.json", "Clima mensual 1950-2026 en los puntos (ET0, lluvia corregida, Tmed, Tmin)", "ERA5-Land + PISCO (paso 08)", "analisis"),
    ]:
        if origen.exists():
            escribir(SALIDA / destino, leer_json(origen), desc, fuente, uso)
    # ENSO diario (columnas)
    f = DATOS / "enso" / "tsm_diaria_regiones_nino.csv"
    if f.exists():
        d = pd.read_csv(f, parse_dates=["fecha"]).set_index("fecha").asfreq("D")
        escribir(SALIDA / "enso" / "tsm_diaria.json", serie_columnas(d, {"tsm_nino12_c": ("°C", 3), "tsm_nino34_c": ("°C", 3)}),
                 "TSM diaria en Niño 1+2 y Niño 3.4", "NOAA OISST v2.1", "analisis")
    # Registro de descargas (procedencia)
    f = BASE / "registro_descargas.csv"
    if f.exists():
        escribir(SALIDA / "meta" / "registro_descargas.json", tabla_csv(f), "Registro de cada descarga (fecha, script, estado)", "Pasos 01-15", "meta")


def g_geo():
    print("\n[geo] GeoJSON")
    for origen, destino, desc, uso in [
        (DATOS / "limites" / "junin_region.geojson", "limites/junin_region.geojson", "Límite de la región Junín", "app"),
        (DATOS / "limites" / "junin_provincias.geojson", "limites/junin_provincias.geojson", "Límites de las 9 provincias", "app"),
        (DATOS / "limites" / "puntos_interes.geojson", "limites/puntos_interes.geojson", "Puntos con datos", "app"),
        (DATOS / "uso_suelo" / "areas_protegidas_junin.geojson", "uso_suelo/areas_protegidas_junin.geojson", "Áreas naturales protegidas (WDPA)", "app"),
    ]:
        if not origen.exists():
            print(f"  FALTA {origen}")
            continue
        g = leer_json(origen)
        for ft in g.get("features", []):
            redondear_geometria(ft.get("geometry"))
        escribir(SALIDA / destino, g, desc, "FAO GAUL 2015 / WDPA", uso)


def serie_columnas(df, variables):
    """DataFrame diario (índice fecha continuo) -> JSON en columnas."""
    out = {"inicio": df.index[0].strftime("%Y-%m-%d"), "fin": df.index[-1].strftime("%Y-%m-%d"),
           "paso": "1 día", "n": len(df), "variables": {}, "datos": {}}
    for col, (unidad, nd) in variables.items():
        if col not in df:
            continue
        v = df[col].astype("float64").round(nd)
        out["variables"][col] = {"unidad": unidad}
        out["datos"][col] = [None if not math.isfinite(x) else x for x in v.tolist()]
    return out


def g_diario():
    """Series diarias de cada punto (ERA5-Land + ET0 + viento horario + SMAP) en un solo JSON por punto."""
    print("\n[diario] series diarias por punto")
    variables = {
        "tmax_c": ("°C", 2), "tmin_c": ("°C", 2), "tmed_c": ("°C", 2), "trocio_c": ("°C", 2),
        "precip_corr_mm": ("mm/día (corregida con PISCOp v3.0)", 2), "rad_solar_mj_m2": ("MJ/m²/día", 2),
        "viento10_ms": ("m/s (media de 24 valores horarios)", 3), "presion_kpa": ("kPa", 2),
        "hum_suelo_0_7cm_m3m3": ("m³/m³ (ERA5-Land)", 4), "evap_potencial_mm": ("mm/día", 2),
        "et0_mm": ("mm/día (FAO-56 Penman-Monteith)", 2), "u2_ms": ("m/s a 2 m", 3), "ea_kpa": ("kPa", 4),
        "rn_mj_m2": ("MJ/m²/día", 2), "smap_am_m3m3": ("m³/m³ (SMAP 0-5 cm, 6 a.m.)", 4),
        "smap_pm_m3m3": ("m³/m³ (SMAP 0-5 cm, 6 p.m.)", 4),
    }
    for pid in PUNTOS:
        f = DATOS / "clima_era5land" / f"era5land_diario_{pid}.csv"
        if not f.exists():
            print(f"  FALTA {f.name}")
            continue
        d = pd.read_csv(f, parse_dates=["fecha"]).set_index("fecha")
        d = d.drop(columns=[c for c in ("precip_mm", "u10_ms", "v10_ms") if c in d], errors="ignore")
        d = d.rename(columns={"hum_suelo_0_7cm_m3m3": "hum_suelo_0_7cm_m3m3"})
        fe = DATOS / "clima_era5land" / "et0" / f"et0_diario_{pid}.csv"
        if fe.exists():
            e = pd.read_csv(fe, parse_dates=["fecha"]).set_index("fecha")[["et0_mm", "u2_ms", "ea_kpa", "rn_mj_m2"]]
            d = d.join(e, how="outer")
        fv = DATOS / "clima_era5land" / "viento_horario" / f"viento_diario_{pid}.csv"
        if fv.exists():
            v = pd.read_csv(fv, parse_dates=["fecha"]).set_index("fecha")
            d["viento10_ms"] = v["viento10_ms"].reindex(d.index).combine_first(d.get("viento10_ms"))
        fs = DATOS / "humedad_smap" / f"smap_diario_{pid}.csv"
        if fs.exists():
            s = pd.read_csv(fs, parse_dates=["fecha"]).set_index("fecha")
            s = s.groupby(level=0).mean(numeric_only=True)
            d = d.join(s.rename(columns={"humedad_am_m3m3": "smap_am_m3m3", "humedad_pm_m3m3": "smap_pm_m3m3"})[
                ["smap_am_m3m3", "smap_pm_m3m3"]], how="left")
        d = d[~d.index.duplicated()].sort_index().asfreq("D")
        obj = serie_columnas(d, variables)
        obj.update({"punto": pid, "lat": PUNTOS[pid][0], "lon": PUNTOS[pid][1],
                    "nota": "Fechas implícitas: el valor i corresponde a inicio + i días. "
                            "La lluvia es la corregida con PISCO; la lluvia cruda de ERA5-Land no se exporta."})
        escribir(SALIDA / "clima" / "diario" / f"{pid}.json", obj,
                 f"Serie diaria 1950-2026 en {pid}: ERA5-Land, ET0, viento horario y SMAP", "ERA5-Land, SMAP, FAO-56", "analisis")


def g_grillas():
    """Terreno, suelo, cobertura y NDVI de todo Junín a ~1 km."""
    import rasterio
    print("\n[grillas] Junín a 0.01° (~1.1 km)")
    tr, an, al = rejilla(RES_1KM)
    capas = {}
    with rasterio.open(DATOS / "terreno" / "elevacion_srtm_90m_junin.tif") as s:
        capas["elevacion_m"] = capa(reproyectar(leer_float(s), s.transform, tr, an, al, "average"), "m", descripcion="SRTM, promedio de la celda")
    with rasterio.open(DATOS / "terreno" / "pendiente_x10_90m_junin.tif") as s:
        capas["pendiente_grados"] = capa(reproyectar(leer_float(s) / 10.0, s.transform, tr, an, al, "average"), "grados", escala=10, descripcion="pendiente media de la celda")
    nombres = ["arena_pct", "arcilla_pct", "limo_pct", "cos_pct", "ph", "dap_gcm3", "n_gkg", "cic_cmolkg"]
    unidades = ["%", "%", "%", "%", "pH", "g/cm³", "g/kg", "cmol/kg"]
    escalas = [10, 10, 10, 100, 100, 100, 100, 10]
    with rasterio.open(DATOS / "suelo" / "suelo_0_30cm_junin.tif") as s:
        suelo = {}
        for i, (nm, un, es) in enumerate(zip(nombres, unidades, escalas), start=1):
            a = reproyectar(leer_float(s, i), s.transform, tr, an, al, "average")
            suelo[nm] = a
            capas[nm] = capa(a, un, escala=es, descripcion="SoilGrids 0-30 cm")
    # textura USDA por celda
    clases_app = ["Arena", "Arena franca", "Franco arenoso", "Franco", "Franco limoso", "Limo",
                  "Franco arcillo limoso", "Arcilla limosa", "Arcilla", "Franco arcilloso"]
    tex = np.full(an * al, np.nan)
    for i, (a, c, l) in enumerate(zip(suelo["arena_pct"].ravel(), suelo["arcilla_pct"].ravel(), suelo["limo_pct"].ravel())):
        _, k = textura_usda(float(a), float(c), float(l))
        if k:
            tex[i] = clases_app.index(k)
    capas["textura_app"] = capa(tex.reshape(al, an), "índice en 'leyendas.textura_app'", descripcion="clase textural USDA llevada a data/terrenos.json")
    with rasterio.open(DATOS / "uso_suelo" / "worldcover_2021_30m_junin.tif") as s:
        wc = reproyectar_clases(s.read(1), s.transform, tr, an, al, "mode", 0).astype("float32")
        wc[wc == 0] = np.nan
        capas["worldcover"] = capa(wc, "código ESA WorldCover", descripcion="clase más frecuente de la celda (30 m -> 1 km)")
    ndvi_med, ndvi_ult, _ = ndvi_compuestos()
    capas["ndvi_medio"] = capa(reproyectar(ndvi_med, NDVI_TR, tr, an, al, "average"), "NDVI", escala=1000, descripcion="promedio 2017-2026")
    capas["ndvi_ultimo_anio"] = capa(reproyectar(ndvi_ult, NDVI_TR, tr, an, al, "average"), "NDVI", escala=1000, descripcion="promedio de los últimos 12 meses descargados")
    reglas = reglas_uso()
    obj = cabecera_grilla(tr, an, al, RES_1KM, {
        "descripcion": "Terreno, suelo, cobertura y NDVI de Junín en una sola rejilla",
        "leyendas": {"textura_app": clases_app,
                     "worldcover": {str(k): {"nombre": v["nombre"], "regla": v["regla"]} for k, v in reglas.items()}},
        "capas": capas})
    escribir(SALIDA / "grillas" / "junin_1km.json", obj, "Rejilla de Junín a ~1 km: elevación, pendiente, 8 propiedades del suelo, textura, WorldCover y NDVI",
             "SRTM, SoilGrids, ESA WorldCover, Sentinel-2", "app")

    # Suelo por profundidad a ~2 km
    tr2, an2, al2 = rejilla(RES_2KM)
    prof = {}
    props = {"sand": ("arena_pct", "%", 10), "clay": ("arcilla_pct", "%", 10), "silt": ("limo_pct", "%", 10),
             "soc": ("cos", "dg/kg (SoilGrids)", 1), "phh2o": ("ph_x10", "pH×10 (SoilGrids)", 1),
             "bdod": ("dap", "cg/cm³ (SoilGrids)", 1), "nitrogen": ("n", "cg/kg (SoilGrids)", 1), "cec": ("cic", "mmol(c)/kg (SoilGrids)", 1)}
    for f in sorted((DATOS / "suelo" / "por_profundidad").glob("*.tif")):
        clave = f.name.split("_")[0]
        nm, un, es = props.get(clave, (clave, "", 1))
        with rasterio.open(f) as s:
            for b, profundidad in enumerate(["0-5cm", "5-15cm", "15-30cm"][: s.count], start=1):
                a = leer_float(s, b)
                if clave in ("sand", "clay", "silt"):
                    a = a / 10.0           # SoilGrids guarda g/kg
                prof[f"{nm}_{profundidad}"] = capa(reproyectar(a, s.transform, tr2, an2, al2, "average"), un.replace("%", "%"), escala=es)
    escribir(SALIDA / "grillas" / "suelo_profundidades_2km.json",
             cabecera_grilla(tr2, an2, al2, RES_2KM, {"descripcion": "SoilGrids por profundidad (0-5, 5-15, 15-30 cm)", "capas": prof}),
             "Suelo por profundidad a ~2 km (8 propiedades x 3 profundidades)", "SoilGrids 250 m (ISRIC)", "analisis")


NDVI_CACHE = {}
NDVI_TR = None


def ndvi_compuestos():
    """Promedio total, promedio del último año y climatología mensual del NDVI (resolución original)."""
    global NDVI_TR
    if NDVI_CACHE:
        return NDVI_CACHE["med"], NDVI_CACHE["ult"], NDVI_CACHE["clim"]
    import rasterio
    fs = sorted((DATOS / "ndvi_sentinel2").glob("ndvi_x10000_*.tif"))
    suma = cnt = None
    suma_m = {m: None for m in range(1, 13)}
    cnt_m = {m: None for m in range(1, 13)}
    ult = []
    series = {pid: {} for pid in PUNTOS}
    for f in fs:
        mes = f.stem.split("_")[-1]
        with rasterio.open(f) as s:
            a = leer_float(s) / 10000.0
            a[(a < -1) | (a > 1)] = np.nan
            NDVI_TR = s.transform
            for pid, (lat, lon) in PUNTOS.items():
                r, c = s.index(lon, lat)
                v = a[max(r - 1, 0): r + 2, max(c - 1, 0): c + 2]
                series[pid][mes] = round(float(np.nanmedian(v)), 3) if np.isfinite(v).any() else None
        if suma is None:
            suma = np.zeros_like(a)
            cnt = np.zeros_like(a)
        ok = np.isfinite(a)
        suma[ok] += a[ok]
        cnt[ok] += 1
        m = int(mes[5:7])
        if suma_m[m] is None:
            suma_m[m] = np.zeros_like(a)
            cnt_m[m] = np.zeros_like(a)
        suma_m[m][ok] += a[ok]
        cnt_m[m][ok] += 1
        ult.append(f)
    with np.errstate(invalid="ignore", divide="ignore"):
        med = np.where(cnt > 0, suma / cnt, np.nan)
        clim = {m: np.where(cnt_m[m] > 0, suma_m[m] / cnt_m[m], np.nan) for m in suma_m if suma_m[m] is not None}
    su = np.zeros_like(med)
    cu = np.zeros_like(med)
    for f in ult[-12:]:
        with rasterio.open(f) as s:
            a = leer_float(s) / 10000.0
            a[(a < -1) | (a > 1)] = np.nan
        ok = np.isfinite(a)
        su[ok] += a[ok]
        cu[ok] += 1
    with np.errstate(invalid="ignore", divide="ignore"):
        ultimo = np.where(cu > 0, su / cu, np.nan)
    NDVI_CACHE.update({"med": med, "ult": ultimo, "clim": clim, "series": series,
                       "meses": [f.stem.split("_")[-1] for f in fs], "ultimos": [f.stem.split("_")[-1] for f in ult[-12:]]})
    return med, ultimo, clim


def g_ndvi():
    print("\n[ndvi] climatología y series en los puntos")
    _, _, clim = ndvi_compuestos()
    tr2, an2, al2 = rejilla(RES_2KM)
    capas = {f"mes_{m:02d}": capa(reproyectar(a, NDVI_TR, tr2, an2, al2, "average"), "NDVI", escala=1000) for m, a in sorted(clim.items())}
    escribir(SALIDA / "grillas" / "ndvi_climatologia_2km.json",
             cabecera_grilla(tr2, an2, al2, RES_2KM, {"descripcion": "NDVI medio de cada mes del año (2017-2026)", "capas": capas}),
             "NDVI promedio por mes del año a ~2 km", "Sentinel-2 SR (ESA)", "app")
    escribir(SALIDA / "ndvi" / "ndvi_series_puntos.json",
             {"descripcion": "NDVI mensual (mediana 3x3 píxeles de 250 m) en cada punto", "meses": NDVI_CACHE["meses"],
              "puntos": NDVI_CACHE["series"]}, "NDVI mensual 2017-2026 en los 10 puntos", "Sentinel-2 SR (ESA)", "validacion")


FECHAS_CSV = {}


def fechas_banda(anio, n, csv_ref=None):
    """Fecha de cada banda de un GeoTIFF anual (una banda por imagen de GEE).
    Los TIF no guardan la fecha, pero el CSV diario del mismo script sale de la misma colección:
    si el número de fechas de ese año coincide con el de bandas, se usan esas fechas.
    Si no, y el año está completo (365/366 bandas), se asume 1 de enero en adelante."""
    if csv_ref is not None and csv_ref.exists():
        if csv_ref not in FECHAS_CSV:
            FECHAS_CSV[csv_ref] = pd.read_csv(csv_ref, usecols=["fecha"], parse_dates=["fecha"])["fecha"]
        f = FECHAS_CSV[csv_ref]
        f = sorted({d.date() for d in f[f.dt.year == anio]})
        if len(f) == n:
            return f
    dias = (date(anio + 1, 1, 1) - date(anio, 1, 1)).days
    if n == dias:
        return [date(anio, 1, 1) + timedelta(days=i) for i in range(n)]
    return None


def g_era5():
    """Mapas diarios ERA5-Land -> climatología mensual 1991-2020 y lluvia mensual 1991-2026."""
    import rasterio
    print("\n[era5] grillas diarias -> climatología y lluvia mensual")
    base = DATOS / "clima_era5land" / "grillas_junin"
    vars_ = {
        "precip_corr_mm": ("lluvia_mm", "mm/mes (corregida con PISCO)", "suma", lambda a: a),
        "tmax_k": ("tmax_c", "°C", "media", lambda a: a - 273.15),
        "tmin_k": ("tmin_c", "°C", "media", lambda a: a - 273.15),
        "trocio_k": ("trocio_c", "°C", "media", lambda a: a - 273.15),
        "rad_solar_jm2": ("rad_solar_mj_m2", "MJ/m²/día", "media", lambda a: a / 1e6),
        "u10_ms": ("u10_ms", "m/s", "media", lambda a: a),
        "v10_ms": ("v10_ms", "m/s", "media", lambda a: a),
        "hum_suelo_0_7cm": ("hum_suelo_m3m3", "m³/m³", "media", lambda a: a),
    }
    capas, tr0, dims = {}, None, None
    lluvia_mensual = {}
    cache = AQUI.parent / ".cache" / "era5"
    cache.mkdir(parents=True, exist_ok=True)  # fuera de public/: no se publica
    limite = int(os.environ.get("ERA5_MAX_VARS", "99"))
    hechas = 0
    for carpeta, (nombre, unidad, agg, conv) in vars_.items():
        d = base / carpeta
        if not d.exists():
            print(f"  FALTA {d}")
            continue
        cf = cache / f"{carpeta}.json"
        if cf.exists():
            c = leer_json(cf)
            capas[nombre] = c["capa"]
            lluvia_mensual.update({k: np.array(v, dtype="float64") for k, v in c.get("lluvia", {}).items()})
            tr0 = __import__("affine").Affine(*c["transform"])
            dims = tuple(c["dims"])
            continue
        if hechas >= limite:
            print(f"  pendiente {carpeta} (vuelve a correr el grupo era5)")
            return
        hechas += 1
        suma = {m: None for m in range(1, 13)}
        nanios = {m: 0 for m in range(1, 13)}
        for anio in range(1991, 2027 if carpeta == "precip_corr_mm" else 2021):
            f = d / f"{carpeta}_{anio}.tif"
            if not f.exists():
                continue
            with rasterio.open(f) as s:
                arr = s.read().astype("float32")
                tr0, dims = s.transform, (s.height, s.width)
                if s.nodata is not None and math.isfinite(s.nodata):
                    arr[arr == s.nodata] = np.nan
            arr[~np.isfinite(arr)] = np.nan
            arr = conv(arr)
            fechas = fechas_banda(anio, arr.shape[0], DATOS / "clima_era5land" / "era5land_diario_huayao_igp.csv")
            if fechas is None:
                print(f"  aviso: {f.name} tiene {arr.shape[0]} bandas y no se pudo fechar; se omite")
                AVISOS.append(f"{f.name}: bandas sin fecha, omitido")
                continue
            meses = np.array([f_.month for f_ in fechas])
            for m in range(1, 13):
                sel = meses == m
                if not sel.any():
                    continue
                dias_mes = (date(anio + (m == 12), m % 12 + 1, 1) - date(anio, m, 1)).days
                completo = sel.sum() == dias_mes
                if not completo:
                    continue
                with np.errstate(invalid="ignore"):
                    v = np.nansum(arr[sel], axis=0) if agg == "suma" else np.nanmean(arr[sel], axis=0)
                    v[np.all(~np.isfinite(arr[sel]), axis=0)] = np.nan
                if carpeta == "precip_corr_mm":
                    lluvia_mensual[f"{anio}-{m:02d}"] = v
                if anio <= 2020:
                    suma[m] = v if suma[m] is None else suma[m] + v
                    nanios[m] += 1
        for m in range(1, 13):
            if suma[m] is not None and nanios[m]:
                capas.setdefault(nombre, {"unidad": unidad, "meses": {}})["meses"][f"{m:02d}"] = \
                    [None if not math.isfinite(x) else round(float(x), 3) for x in (suma[m] / nanios[m]).ravel()]
        if tr0 is not None and nombre in capas:
            extra = {k: [None if not math.isfinite(x) else round(float(x), 1) for x in v.ravel()]
                     for k, v in lluvia_mensual.items()} if carpeta == "precip_corr_mm" else {}
            cf.write_text(json.dumps({"capa": capas[nombre], "transform": list(tr0)[:6], "dims": list(dims), "lluvia": extra}), encoding="utf-8")
    if tr0 is None:
        return
    alto, ancho = dims
    res = abs(tr0.a)
    cab = cabecera_grilla(tr0, ancho, alto, round(res, 4))
    escribir(SALIDA / "clima" / "era5land_climatologia_1991_2020.json",
             dict(cab, descripcion="Climatología mensual 1991-2020 de ERA5-Land en la rejilla de 0.1°", periodo="1991-2020", variables=capas),
             "Climatología mensual 1991-2020 en grilla de 0.1° (lluvia corregida, temperaturas, radiación, viento, humedad)",
             "ERA5-Land (ECMWF) + PISCO", "app")
    meses = sorted(lluvia_mensual)
    escribir(SALIDA / "clima" / "era5land_lluvia_mensual_1991_2026.json",
             dict(cab, descripcion="Lluvia mensual corregida con PISCO, cada celda de 0.1°", unidad="mm/mes", meses=meses,
                  datos=[[None if not math.isfinite(x) else round(float(x), 1) for x in np.asarray(lluvia_mensual[k], dtype="float64").ravel()] for k in meses]),
             "Lluvia mensual corregida 1991-2026 en grilla de 0.1° (solo meses completos)", "ERA5-Land + PISCO", "analisis")


def g_smap():
    import rasterio
    print("\n[smap] mapas diarios -> medias mensuales")
    d = DATOS / "humedad_smap" / "grillas_junin"
    if not d.exists():
        return
    meses, tr0, dims = {}, None, None
    for f in sorted(d.glob("smap_am_*.tif")):
        anio = int(f.stem.split("_")[-1])
        with rasterio.open(f) as s:
            arr = s.read().astype("float32")
            tr0, dims = s.transform, (s.height, s.width)
        arr[~np.isfinite(arr) | (arr < 0) | (arr > 1)] = np.nan
        fechas = fechas_banda(anio, arr.shape[0], DATOS / "humedad_smap" / "smap_diario_huayao_igp.csv")
        if fechas is None:
            print(f"  aviso: {f.name} tiene {arr.shape[0]} bandas y no se pudo fechar; se omite")
            AVISOS.append(f"{f.name}: bandas sin fecha, omitido")
            continue
        ms = np.array([f_.month for f_ in fechas])
        for m in sorted(set(ms.tolist())):
            sel = ms == m
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                v = np.nanmean(arr[sel], axis=0)
            meses[f"{anio}-{m:02d}"] = [None if not math.isfinite(x) else round(float(x), 3) for x in v.ravel()]
    if tr0 is None:
        return
    alto, ancho = dims
    ks = sorted(meses)
    escribir(SALIDA / "humedad" / "smap_mensual.json",
             dict(cabecera_grilla(tr0, ancho, alto, round(abs(tr0.a), 5)), descripcion="Humedad del suelo 0-5 cm (SMAP L3 9 km, pasada 6 a.m.), media mensual",
                  unidad="m³/m³", meses=ks, datos=[meses[k] for k in ks]),
             "Humedad del suelo SMAP: media mensual 2015-2026 en grilla de 9 km", "NASA SMAP L3 Enhanced", "app")


def g_pisco():
    import rasterio
    from rasterio.windows import from_bounds
    print("\n[pisco] factores y lluvia observada mensual")
    f = DATOS / "pisco" / "factores_correccion_mensual_junin.tif"
    if f.exists():
        with rasterio.open(f) as s:
            caps = {f"mes_{b:02d}": capa(leer_float(s, b), "factor (lluvia PISCO / lluvia ERA5-Land)", decimales=3) for b in range(1, s.count + 1)}
            cab = cabecera_grilla(s.transform, s.width, s.height, round(abs(s.transform.a), 4))
        escribir(SALIDA / "pisco" / "factores_correccion.json", dict(cab, descripcion="Factor multiplicativo mensual de corrección de la lluvia", capas=caps),
                 "Factores de corrección de lluvia por mes y celda", "PISCOp v3.0 (paso 09)", "analisis")
    f = DATOS / "pisco" / "PISCOp_m.nc"
    if f.exists():
        with rasterio.open(f) as s:
            w = from_bounds(-76.6, -12.7, -73.3, -10.6, s.transform).round_offsets().round_lengths()
            arr = s.read(window=w).astype("float32")
            trw = s.window_transform(w)
        arr[~np.isfinite(arr) | (arr < 0) | (arr > 5000)] = np.nan
        meses = []
        y, m = 1981, 1
        for _ in range(arr.shape[0]):
            meses.append(f"{y}-{m:02d}")
            m += 1
            if m == 13:
                y, m = y + 1, 1
        escribir(SALIDA / "pisco" / "piscop_mensual_1981_2025.json",
                 dict(cabecera_grilla(trw, arr.shape[2], arr.shape[1], 0.1), descripcion="Lluvia mensual observada PISCOp v3.0 recortada a Junín",
                      unidad="mm/mes", meses=meses,
                      datos=[[None if not math.isfinite(x) else round(float(x), 1) for x in b.ravel()] for b in arr]),
                 "Lluvia mensual PISCOp v3.0 1981-2025 (0.1°, recorte de Junín)", "SENAMHI PISCOp v3.0", "validacion")


def g_parcelas():
    """40 x 40 celdas de 30 m alrededor de cada punto: terreno real para la grilla 3D del simulador."""
    import rasterio
    from affine import Affine
    print("\n[parcelas] 40 x 40 celdas de 30 m por punto")
    N, CELDA = 40, 30.0
    reglas = reglas_uso()
    sim_path = SALIDA / "app" / "simulador_escenarios.json"
    sim = leer_json(sim_path) if sim_path.exists() else {"puntos": {}}
    ndvi_med, ndvi_ult, _ = ndvi_compuestos()
    fuentes = {
        "elev": rasterio.open(DATOS / "terreno" / "elevacion_srtm_90m_junin.tif"),
        "pend": rasterio.open(DATOS / "terreno" / "pendiente_x10_90m_junin.tif"),
        "suelo": rasterio.open(DATOS / "suelo" / "suelo_0_30cm_junin.tif"),
        "wc": rasterio.open(DATOS / "uso_suelo" / "worldcover_2021_30m_junin.tif"),
    }
    elev_a, pend_a = leer_float(fuentes["elev"]), leer_float(fuentes["pend"]) / 10.0
    suelo_a = [leer_float(fuentes["suelo"], b) for b in range(1, 9)]
    wc_a = fuentes["wc"].read(1)
    nombres = ["arena_pct", "arcilla_pct", "limo_pct", "cos_pct", "ph", "dap_gcm3", "n_gkg", "cic_cmolkg"]
    for pid, (lat, lon) in PUNTOS.items():
        dlat = CELDA / 111320.0
        dlon = CELDA / (111320.0 * math.cos(math.radians(lat)))
        oeste, norte = lon - N / 2 * dlon, lat + N / 2 * dlat
        tr = Affine(dlon, 0, oeste, 0, -dlat, norte)
        el = reproyectar(elev_a, fuentes["elev"].transform, tr, N, N, "bilinear")
        pe = reproyectar(pend_a, fuentes["pend"].transform, tr, N, N, "bilinear")
        su = [reproyectar(a, fuentes["suelo"].transform, tr, N, N, "nearest") for a in suelo_a]
        wc = reproyectar_clases(wc_a, fuentes["wc"].transform, tr, N, N, "nearest", 0).astype("float32")
        wc[wc == 0] = np.nan
        nm = reproyectar(ndvi_med, NDVI_TR, tr, N, N, "nearest")
        nu = reproyectar(ndvi_ult, NDVI_TR, tr, N, N, "nearest")
        tex, tex_app, regla = [], [], []
        for i in range(N * N):
            a, c, l = (float(su[k].ravel()[i]) for k in range(3))
            k, kapp = textura_usda(a, c, l)
            tex.append(k)
            tex_app.append(kapp)
            code = wc.ravel()[i]
            regla.append(reglas.get(int(code), {}).get("regla") if math.isfinite(code) else None)
        n_val = sum(r is not None for r in regla) or 1
        pct = {r: round(100 * regla.count(r) / n_val, 1) for r in ("permitido", "advertencia", "bloqueado")}
        cobertura = {}
        for code in wc.ravel():
            if math.isfinite(code):
                cobertura[str(int(code))] = cobertura.get(str(int(code)), 0) + 1
        cobertura = {k: round(100 * v / n_val, 1) for k, v in sorted(cobertura.items())}
        conteo_tex = {}
        for k in tex_app:
            if k:
                conteo_tex[k] = conteo_tex.get(k, 0) + 1
        capas = {"elevacion_m": capa(el, "m", decimales=1), "pendiente_grados": capa(pe, "grados", decimales=1)}
        for nmb, arr in zip(nombres, su):
            capas[nmb] = capa(arr, {"arena_pct": "%", "arcilla_pct": "%", "limo_pct": "%", "cos_pct": "%", "ph": "pH",
                                    "dap_gcm3": "g/cm³", "n_gkg": "g/kg", "cic_cmolkg": "cmol/kg"}[nmb], decimales=2)
        capas["textura_usda"] = {"unidad": "clase", "datos": tex}
        capas["textura_app"] = {"unidad": "clase de data/terrenos.json", "datos": tex_app}
        capas["worldcover"] = capa(wc, "código ESA WorldCover")
        capas["regla_uso"] = {"unidad": "permitido | advertencia | bloqueado", "datos": regla}
        capas["ndvi_medio"] = capa(nm, "NDVI", decimales=3)
        capas["ndvi_ultimo_anio"] = capa(nu, "NDVI", decimales=3)
        sp = sim["puntos"].get(pid, {})
        obj = {
            "punto": pid, "lat": lat, "lon": lon, "provincia": sp.get("provincia"),
            "filas": N, "columnas": N, "celda_m": CELDA,
            "bbox": [round(oeste, 6), round(norte - N * dlat, 6), round(oeste + N * dlon, 6), round(norte, 6)],
            "orden": "fila por fila, de norte a sur; dentro de cada fila, de oeste a este (i = fila * 40 + columna)",
            "resolucion_original": {"elevacion": "90 m (bilineal)", "suelo": "250 m (vecino más cercano)", "worldcover": "30 m", "ndvi": "250 m"},
            "resumen": {
                "elevacion_media_m": round(float(np.nanmean(el)), 1) if np.isfinite(el).any() else None,
                "desnivel_m": round(float(np.nanmax(el) - np.nanmin(el)), 1) if np.isfinite(el).any() else None,
                "pendiente_media_grados": round(float(np.nanmean(pe)), 1) if np.isfinite(pe).any() else None,
                "cobertura_pct": cobertura, "reglas_pct": pct,
                "se_puede_sembrar": pct.get("bloqueado", 0) <= 50,
                "texturas_pct": {k: round(100 * v / (N * N), 1) for k, v in sorted(conteo_tex.items(), key=lambda x: -x[1])},
            },
            "capas": capas,
        }
        escribir(SALIDA / "parcelas" / f"{pid}.json", obj, f"Parcela real de 1.2 x 1.2 km (40 x 40 celdas de 30 m) en {pid}",
                 "SRTM, SoilGrids, ESA WorldCover, Sentinel-2", "app")
    for s in fuentes.values():
        s.close()


GRUPOS = {"app": g_app, "tablas": g_tablas, "geo": g_geo, "diario": g_diario, "grillas": g_grillas,
          "ndvi": g_ndvi, "era5": g_era5, "smap": g_smap, "pisco": g_pisco, "parcelas": g_parcelas}


def main():
    global DATOS, BASE, SALIDA, PRONOSTICO, FENOLOGIA
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datos", default=os.environ.get("LAMBDA_DATOS", str(DATOS_DEF)))
    ap.add_argument("--pronostico", default=None, help="carpeta con los resultados de los pasos 13-15 (por defecto datos/pronostico)")
    ap.add_argument("--fenologia", default=None)
    ap.add_argument("--salida", default=os.environ.get("LAMBDA_SALIDA", str(AQUI.parent.parent / "public" / "data" / "junin")))
    ap.add_argument("--solo", default=",".join(GRUPOS))
    a = ap.parse_args()
    DATOS = Path(a.datos)
    BASE = DATOS.parent
    PRONOSTICO = Path(a.pronostico) if a.pronostico else DATOS / "pronostico"
    cand = [Path(a.fenologia)] if a.fenologia else [BASE.parent / "fenologia_cultivos.json", BASE / "fenologia_cultivos.json",
                                                   DATOS / "fenologia_cultivos.json", Path(a.salida) / "app" / "fenologia_cultivos.json"]
    FENOLOGIA = next((c for c in cand if c.exists()), cand[0])
    SALIDA = Path(a.salida)
    SALIDA.mkdir(parents=True, exist_ok=True)
    print(f"Datos: {DATOS}\nSalida: {SALIDA}")
    avisos = AVISOS
    for g in a.solo.split(","):
        r = GRUPOS[g.strip()]()
        if isinstance(r, list):
            avisos += r
    # El manifiesto acumula lo ya exportado en corridas anteriores
    man_path = SALIDA / "manifest.json"
    previo = leer_json(man_path)["archivos"] if man_path.exists() else []
    nuevos = {m["archivo"] for m in MANIFIESTO}
    archivos = sorted([m for m in previo if m["archivo"] not in nuevos] + MANIFIESTO, key=lambda m: m["archivo"])
    man = {
        "nombre": "Datos ambientales de Junín para Lambda Simulator (versión mejorada)",
        "generado": datetime.now().isoformat(timespec="seconds"),
        "generador": "pipeline/codigos/17_exportar_json.py",
        "reglas": [
            "Todo es JSON válido para JavaScript: NaN e Infinity se guardan como null.",
            "La lluvia es siempre la corregida con PISCOp v3.0; la lluvia cruda de ERA5-Land no se exporta.",
            "Las grillas son arreglos planos fila por fila de norte a sur; si una capa trae 'escala', valor = dato / escala.",
            "uso = app (lo lee el simulador), analisis (gráficos y regenerar modelos), validacion (tesis), meta (procedencia).",
        ],
        "puntos": list(PUNTOS),
        "total_mb": round(sum(m["bytes"] for m in archivos) / 1e6, 2),
        "archivos": archivos,
        "avisos": avisos,
        "no_convertidos": [
            {"origen": "datos/cultivos/fuentes_dra_junin/*.pdf", "motivo": "Documentos fuente; sus cifras ya están en cultivos/produccion_2022_provincias.json y app/catalogo_cultivos_junin.json"},
            {"origen": "datos/clima_era5land/grillas_junin/precip_m", "motivo": "Lluvia cruda de ERA5-Land (sobreestima ~2x); se usa precip_corr_mm"},
            {"origen": "datos/clima_era5land/grillas_junin/* (diario)", "motivo": "~640 MB de mapas diarios; se exportan la climatología 1991-2020 y la lluvia mensual"},
            {"origen": "datos/humedad_smap/grillas_junin (diario)", "motivo": "Se exportan medias mensuales; la serie diaria de los puntos está en clima/diario"},
            {"origen": "datos/uso_suelo/dynamicworld_2026_30m_junin__p00__p10.tif", "motivo": "Descarga parcial (una sola tesela del sur-oeste); usar WorldCover"},
            {"origen": "datos/ndvi_sentinel2/*.tif (mensual 250 m)", "motivo": "Se exportan promedio, último año, climatología a 2 km y series en los puntos"},
            {"origen": "datos/pisco/PISCOp_m.nc fuera de Junín", "motivo": "Se recorta a la caja de Junín"},
        ],
    }
    man_path.write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nListo: {len(archivos)} archivos, {man['total_mb']} MB -> {SALIDA}")
    for x in avisos:
        print("AVISO:", x)


if __name__ == "__main__":
    main()
