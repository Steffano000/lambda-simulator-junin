# -*- coding: utf-8 -*-
"""Funciones compartidas: conexión a GEE, zona de estudio, descargas con reintentos."""
import csv
import sys
import time
import threading
from datetime import datetime
from pathlib import Path

import ee
import requests

import config as C

# La consola de Windows a veces no acepta tildes
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Conexión
# ---------------------------------------------------------------------------
def iniciar():
    """Inicia Earth Engine con el proyecto del equipo."""
    try:
        ee.Initialize(project=C.PROYECTO_GEE, opt_url="https://earthengine-highvolume.googleapis.com")
    except Exception as e:
        msg = str(e)
        if "authenticate" in msg.lower() or "credentials" in msg.lower():
            print("No hay credenciales. Ejecuta primero: python codigos/00_autenticar.py")
            sys.exit(1)
        raise
    C.CARPETA_DATOS.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Zona de estudio
# ---------------------------------------------------------------------------
def junin():
    """Devuelve (geometría de Junín, rectángulo envolvente)."""
    fc = (ee.FeatureCollection(C.GAUL_NIVEL1)
          .filter(ee.Filter.eq("ADM0_NAME", C.PAIS))
          .filter(ee.Filter.inList("ADM1_NAME", C.REGION_NOMBRES)))
    try:
        n = fc.size().getInfo()
    except Exception:
        n = 0
    if n == 0:
        print("  (aviso) No se encontró Junín en GAUL; se usa el recuadro de respaldo")
        geom = ee.Geometry.Rectangle(C.JUNIN_BBOX_RESPALDO)
    else:
        geom = fc.geometry().simplify(500)
    bbox = geom.bounds(1)
    return geom, bbox


def puntos_fc():
    feats = [ee.Feature(ee.Geometry.Point([lon, lat]), {"punto": nombre})
             for nombre, (lat, lon) in C.PUNTOS.items()]
    return ee.FeatureCollection(feats)


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------
def registrar(script, archivo, estado, detalle=""):
    nuevo = not C.REGISTRO.exists()
    with _lock:
        with open(C.REGISTRO, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if nuevo:
                w.writerow(["fecha_hora", "script", "archivo", "estado", "detalle"])
            w.writerow([datetime.now().isoformat(timespec="seconds"), script, str(archivo), estado, detalle[:300]])


def log(msg):
    with _lock:
        print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Reintentos
# ---------------------------------------------------------------------------
def es_error_de_tamano(texto):
    """Errores que se arreglan pidiendo un recuadro más chico, no reintentando."""
    t = texto.lower()
    return any(k in t for k in ("must be less than", "too large", "total request size",
                                "grid dimension", "timed out", "memory limit", "too many pixels"))


# ---------------------------------------------------------------------------
# (reintentos con espera)
# ---------------------------------------------------------------------------
def con_reintentos(fn, intentos=4, espera=5):
    ultimo = None
    for i in range(intentos):
        try:
            return fn()
        except Exception as e:
            ultimo = e
            texto = str(e)
            # errores de tamaño no se arreglan reintentando
            if es_error_de_tamano(texto):
                raise
            time.sleep(espera * (i + 1))
    raise ultimo


# ---------------------------------------------------------------------------
# Descarga de imágenes a GeoTIFF (con partición automática si es muy grande)
# ---------------------------------------------------------------------------
def _coords_bbox(bbox):
    ring = bbox.coordinates().getInfo()[0]
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def _bajar(img, region, escala, destino):
    def pedir():
        url = img.getDownloadURL({
            "region": region,
            "scale": escala,
            "crs": "EPSG:4326",
            "format": "GEO_TIFF",
        })
        r = requests.get(url, timeout=600)
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        return r.content
    contenido = con_reintentos(pedir)
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(destino.suffix + ".part")
    tmp.write_bytes(contenido)
    tmp.replace(destino)


def descargar_imagen(img, bbox_coords, escala, destino, script="", nivel=0):
    """
    Descarga una ee.Image a GeoTIFF en EPSG:4326.
    bbox_coords = (xmin, ymin, xmax, ymax). Si la petición supera el límite de GEE,
    divide el recuadro en 4 y vuelve a intentar; al final une los pedazos con rasterio.
    Devuelve True si el archivo quedó en disco.
    """
    destino = Path(destino)
    if destino.exists() and destino.stat().st_size > 0:
        return True
    xmin, ymin, xmax, ymax = bbox_coords
    region = ee.Geometry.Rectangle([xmin, ymin, xmax, ymax], None, False)
    try:
        _bajar(img, region, escala, destino)
        registrar(script, destino, "ok")
        return True
    except Exception as e:
        texto = str(e)
        es_tamano = es_error_de_tamano(texto)
        if not es_tamano or nivel >= 4:
            log(f"  ERROR {destino.name}: {texto[:200]}")
            registrar(script, destino, "error", texto)
            return False
    # partir en 4
    xm, ym = (xmin + xmax) / 2, (ymin + ymax) / 2
    partes = [(xmin, ymin, xm, ym), (xm, ymin, xmax, ym), (xmin, ym, xm, ymax), (xm, ym, xmax, ymax)]
    piezas = []
    for i, bb in enumerate(partes):
        p = destino.with_name(f"{destino.stem}__p{nivel}{i}{destino.suffix}")
        if descargar_imagen(img, bb, escala, p, script, nivel + 1):
            piezas.append(p)
    if len(piezas) == 4:
        if unir_geotiffs(piezas, destino):
            for p in piezas:
                p.unlink(missing_ok=True)
            registrar(script, destino, "ok", "unido de 4 partes")
            return True
        log(f"  (aviso) {destino.name} quedó en 4 partes (instala rasterio para unirlas)")
        return True
    return False


def unir_geotiffs(piezas, destino):
    try:
        import rasterio
        from rasterio.merge import merge
    except ImportError:
        return False
    fuentes = [rasterio.open(p) for p in piezas]
    try:
        mosaico, transf = merge(fuentes)
        meta = fuentes[0].meta.copy()
        meta.update({"height": mosaico.shape[1], "width": mosaico.shape[2],
                     "transform": transf, "compress": "deflate"})
        with rasterio.open(destino, "w", **meta) as dst:
            dst.write(mosaico)
            try:
                dst.descriptions = fuentes[0].descriptions
            except Exception:
                pass
    finally:
        for f in fuentes:
            f.close()
    return True


def en_paralelo(tareas, hilos=None):
    """tareas = lista de funciones sin argumentos. Devuelve cuántas salieron bien."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    ok = 0
    total = len(tareas)
    with ThreadPoolExecutor(max_workers=hilos or C.HILOS) as ex:
        futuros = [ex.submit(t) for t in tareas]
        for i, fut in enumerate(as_completed(futuros), 1):
            try:
                if fut.result():
                    ok += 1
            except Exception as e:
                log(f"  ERROR: {str(e)[:200]}")
            if i % 10 == 0 or i == total:
                log(f"  avance {i}/{total} ({ok} bien)")
    return ok
