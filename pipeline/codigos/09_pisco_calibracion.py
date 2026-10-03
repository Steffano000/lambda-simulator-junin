# -*- coding: utf-8 -*-
"""
Paso 9. Calibración de la lluvia de ERA5-Land con PISCOp v3.0 (SENAMHI) para todo Junín.

PISCOp v3.0 une las estaciones del SENAMHI (con control de calidad y relleno de vacíos)
con predictores satelitales, a 0.1°, de 1981 a 2025.
Cita: Gutierrez, L. y Lavado-Casimiro, W. (2026). High-resolution grids of rainfall for
Peru - PISCOp v3.0 dataset. figshare. https://doi.org/10.6084/m9.figshare.32411886.v1

Método (escalamiento lineal mensual, celda por celda):
  F(celda, mes) = suma PISCO del mes / suma ERA5-Land del mes, en el período común
  P_corregida(día) = P_ERA5(día) × F(celda, mes del día)
Validación: se calculan factores con 1981-2010 y se evalúan en 2011-fin (datos que el
factor no vio). Los factores finales usan todo el período común.

Salida:
  datos/pisco/PISCOp_m.nc, readme.txt                    (descarga original)
  datos/pisco/factores_correccion_mensual_junin.tif      (12 bandas, enero a diciembre)
  datos/pisco/comparacion_mensual_puntos.csv
  datos/pisco/validacion.csv                             (métricas antes y después)
  datos/clima_era5land/grillas_junin/precip_corr_mm/     (lluvia diaria corregida, mm)
  datos/clima_era5land/era5land_diario_<punto>.csv       (se agrega la columna precip_corr_mm)
Al final vuelve a correr el paso 8 para que la ET0 y el clima mensual usen la lluvia corregida.
"""
import csv
import re
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import rasterio
import requests
import xarray as xr

import config as C

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUT = C.CARPETA_DATOS / "pisco"
OUT.mkdir(parents=True, exist_ok=True)
GRILLAS = C.CARPETA_DATOS / "clima_era5land" / "grillas_junin" / "precip_m"
GRILLAS_CORR = C.CARPETA_DATOS / "clima_era5land" / "grillas_junin" / "precip_corr_mm"
PISCO_M = OUT / "PISCOp_m.nc"
URLS = {
    PISCO_M: "https://ndownloader.figshare.com/files/64968111",
    OUT / "readme.txt": "https://ndownloader.figshare.com/files/64968015",
}
CALIB = (1981, 2010)
F_MIN, F_MAX = 0.05, 5.0


def log(m):
    print(m, flush=True)


# ---------------------------------------------------------------------------
# 1. Descargar PISCOp v3.0 mensual
# ---------------------------------------------------------------------------
for ruta, url in URLS.items():
    if ruta.exists() and ruta.stat().st_size > 0:
        continue
    log(f"Descargando {ruta.name} ...")
    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        tmp = ruta.with_suffix(ruta.suffix + ".part")
        with open(tmp, "wb") as fh:
            for chunk in r.iter_content(1 << 20):
                fh.write(chunk)
        tmp.replace(ruta)


# ---------------------------------------------------------------------------
# 2. Leer PISCO (detecta nombres de variables y la unidad de tiempo)
# ---------------------------------------------------------------------------
def abrir_pisco(ruta):
    ds = xr.open_dataset(ruta, decode_times=False)
    print("  Estructura del archivo PISCO:")
    print("  " + str(ds).replace("\n", "\n  ")[:1500])
    var = [v for v in ds.data_vars if ds[v].ndim == 3][0]
    da = ds[var]
    dims = list(da.dims)

    def buscar(claves):
        for d in dims:
            dl = d.lower()
            if any(dl == k or dl.startswith(k) for k in claves):
                return d
        return None
    ydim = buscar(("lat", "y"))
    xdim = buscar(("lon", "x"))
    if ydim is None or xdim is None:
        # por los valores: latitudes de Perú entre -19 y 1, longitudes entre -82 y -68 (o 278-292)
        for d in dims:
            v = ds[d].values if d in ds.coords else None
            if v is None or v.ndim != 1 or len(v) < 2:
                continue
            if ydim is None and -20 <= float(v.min()) and float(v.max()) <= 2:
                ydim = d
            elif xdim is None and (-83 <= float(v.min()) <= -67 or 277 <= float(v.min()) <= 293):
                xdim = d
    tdim = [d for d in dims if d not in (ydim, xdim)][0]
    da = da.rename({tdim: "time", ydim: "lat", xdim: "lon"}).transpose("time", "lat", "lon")
    if float(da["lon"].max()) > 180:
        da = da.assign_coords(lon=da["lon"] - 360)
    tvar = ds[tdim] if tdim in ds.variables else None
    unidades = str(tvar.attrs.get("units", "")).lower() if tvar is not None else ""
    valores = tvar.values.astype(float) if tvar is not None else np.arange(da.sizes["time"], dtype=float)
    m = re.search(r"(\w+)\s+since\s+(\d{4})-(\d{1,2})-(\d{1,2})", unidades)
    meses = []
    if m:
        paso, y0, m0 = m.group(1), int(m.group(2)), int(m.group(3))
        d0 = date(y0, m0, int(m.group(4)))
        for v in valores:
            if paso.startswith("month"):
                k = int(round(v))
                meses.append(((y0 * 12 + m0 - 1 + k) // 12, (m0 - 1 + k) % 12 + 1))
            else:
                factor = {"day": 1, "hour": 1 / 24, "minute": 1 / 1440, "second": 1 / 86400}
                f = next((f for k, f in factor.items() if paso.startswith(k)), 1)
                d = d0 + timedelta(days=v * f)
                meses.append((d.year, d.month))
    else:
        log(f"  (aviso) unidad de tiempo desconocida '{unidades}'; se asume mensual desde 1981-01")
        meses = [(1981 + i // 12, i % 12 + 1) for i in range(len(valores))]
    log(f"  PISCO: variable '{var}', {len(meses)} meses ({meses[0][0]}-{meses[0][1]:02d} a "
        f"{meses[-1][0]}-{meses[-1][1]:02d}), unidad '{da.attrs.get('units', '?')}'")
    return da, meses


pisco, pisco_meses = abrir_pisco(PISCO_M)


# ---------------------------------------------------------------------------
# 3. ERA5-Land mensual en la grilla de Junín (desde los GeoTIFF diarios del paso 2)
# ---------------------------------------------------------------------------
archivos = sorted(GRILLAS.glob("precip_m_*.tif"))
if not archivos:
    sys.exit("No hay grillas de lluvia de ERA5-Land. Ejecuta antes: python 02_era5land_clima.py grillas")

with rasterio.open(archivos[0]) as src:
    perfil = src.profile.copy()
    transf, alto, ancho = src.transform, src.height, src.width
filas, cols = np.mgrid[0:alto, 0:ancho]
lon_c, lat_c = rasterio.transform.xy(transf, filas.ravel(), cols.ravel(), offset="center")
lon_c = np.array(lon_c).reshape(alto, ancho)
lat_c = np.array(lat_c).reshape(alto, ancho)


def fechas_de(anio, n):
    inicio = date(1950, 1, 2) if anio == 1950 else date(anio, 1, 1)
    return [inicio + timedelta(days=i) for i in range(n)]


def leer_diario(ruta):
    anio = int(re.search(r"(\d{4})\.tif$", ruta.name).group(1))
    with rasterio.open(ruta) as src:
        arr = src.read(masked=True).astype("float32").filled(np.nan) * 1000.0   # m -> mm
    return anio, arr, fechas_de(anio, arr.shape[0])


log("Sumando ERA5-Land por mes ...")
era5_mes = {}          # (año, mes) -> matriz (alto, ancho) en mm
for ruta in archivos:
    anio, arr, fechas = leer_diario(ruta)
    meses = np.array([f.month for f in fechas])
    for mes in range(1, 13):
        sel = meses == mes
        if sel.sum() == 0:
            continue
        completo = sel.sum() >= 28 or (anio == 1950 and mes == 1)
        if completo:
            era5_mes[(anio, mes)] = np.nansum(arr[sel], axis=0) * np.where(np.isnan(arr[sel][0]), np.nan, 1)

# PISCO llevado a la grilla de ERA5 (vecino más cercano: ambas son de 0.1°)
log("Llevando PISCO a la grilla de ERA5-Land ...")
plat = pisco["lat"].values
plon = pisco["lon"].values
iy = np.abs(plat[:, None] - lat_c[:, 0][None, :]).argmin(axis=0)
ix = np.abs(plon[:, None] - lon_c[0, :][None, :]).argmin(axis=0)
pisco_np = pisco.values
pisco_mes = {}
for k, (y, m) in enumerate(pisco_meses):
    pisco_mes[(y, m)] = pisco_np[k][np.ix_(iy, ix)].astype("float32")

comunes = sorted(set(era5_mes) & set(pisco_mes))
log(f"Período común: {comunes[0][0]}-{comunes[0][1]:02d} a {comunes[-1][0]}-{comunes[-1][1]:02d} ({len(comunes)} meses)")


def factores(periodo):
    F = np.ones((12, alto, ancho), dtype="float32")
    for mes in range(1, 13):
        claves = [k for k in comunes if k[1] == mes and periodo[0] <= k[0] <= periodo[1]]
        sp = np.nansum([pisco_mes[k] for k in claves], axis=0)
        se = np.nansum([era5_mes[k] for k in claves], axis=0)
        with np.errstate(divide="ignore", invalid="ignore"):
            f = np.where(se > len(claves) * 1.0, sp / se, 1.0)
        F[mes - 1] = np.clip(np.nan_to_num(f, nan=1.0), F_MIN, F_MAX)
    return F


def metricas(obs, sim):
    ok = ~(np.isnan(obs) | np.isnan(sim))
    o, s = obs[ok], sim[ok]
    if len(o) < 3:
        return dict(n=len(o), sesgo_pct=np.nan, rmse_mm=np.nan, r=np.nan, nse=np.nan)
    return dict(n=int(len(o)),
                sesgo_pct=round(100 * (s.sum() - o.sum()) / o.sum(), 1),
                rmse_mm=round(float(np.sqrt(np.mean((s - o) ** 2))), 1),
                r=round(float(np.corrcoef(o, s)[0, 1]), 3),
                nse=round(float(1 - np.sum((s - o) ** 2) / np.sum((o - o.mean()) ** 2)), 3))


# ---------------------------------------------------------------------------
# 4. Validación: factores con 1981-2010, evaluación en 2011-fin
# ---------------------------------------------------------------------------
F_cal = factores(CALIB)
valid = [k for k in comunes if k[0] > CALIB[1]]
mascara = ~np.isnan(era5_mes[comunes[0]])

filas_val = []
def evaluar(nombre, sel_fn):
    obs = np.array([sel_fn(pisco_mes[k]) for k in valid]).ravel()
    raw = np.array([sel_fn(era5_mes[k]) for k in valid]).ravel()
    cor = np.array([sel_fn(era5_mes[k] * F_cal[k[1] - 1]) for k in valid]).ravel()
    a, b = metricas(obs, raw), metricas(obs, cor)
    filas_val.append([nombre, f"{valid[0][0]}-{valid[-1][0]}", a["n"],
                      a["sesgo_pct"], b["sesgo_pct"], a["rmse_mm"], b["rmse_mm"],
                      a["r"], b["r"], a["nse"], b["nse"]])

evaluar("toda_junin (todas las celdas)", lambda m: m[mascara])
puntos_idx = {}
for nombre, (lat, lon) in C.PUNTOS.items():
    r_, c_ = rasterio.transform.rowcol(transf, lon, lat)
    puntos_idx[nombre] = (r_, c_)
    evaluar(nombre, lambda m, r_=r_, c_=c_: np.array([m[r_, c_]]))

with open(OUT / "validacion.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["zona", "periodo_validacion", "n_meses", "sesgo_pct_antes", "sesgo_pct_despues",
                "rmse_mm_antes", "rmse_mm_despues", "r_antes", "r_despues", "nse_antes", "nse_despues"])
    w.writerows(filas_val)
log("Validación (lluvia mensual vs PISCO, meses no usados para calibrar):")
for f in filas_val:
    log(f"  {f[0]:32s} sesgo {f[3]:7}% -> {f[4]:6}%   NSE {f[9]:6} -> {f[10]:6}")

# ---------------------------------------------------------------------------
# 5. Factores finales con todo el período común
# ---------------------------------------------------------------------------
F = factores((comunes[0][0], comunes[-1][0]))
F_out = np.where(mascara[None], F, np.nan).astype("float32")
p = perfil.copy()
p.update(count=12, dtype="float32", nodata=np.nan, compress="deflate")
with rasterio.open(OUT / "factores_correccion_mensual_junin.tif", "w", **p) as dst:
    dst.write(F_out)
    dst.descriptions = tuple(f"factor_mes_{m:02d}" for m in range(1, 13))

with open(OUT / "comparacion_mensual_puntos.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["punto", "mes", "pisco_mm", "era5_mm", "era5_corregida_mm"])
    for nombre, (r_, c_) in puntos_idx.items():
        for k in comunes:
            e = era5_mes[k][r_, c_]
            w.writerow([nombre, f"{k[0]}-{k[1]:02d}", round(float(pisco_mes[k][r_, c_]), 1),
                        round(float(e), 1), round(float(e * F[k[1] - 1, r_, c_]), 1)])

# ---------------------------------------------------------------------------
# 6. Lluvia diaria corregida: grillas y CSV de puntos
# ---------------------------------------------------------------------------
log("Escribiendo grillas diarias corregidas ...")
GRILLAS_CORR.mkdir(parents=True, exist_ok=True)
for ruta in archivos:
    anio, arr, fechas = leer_diario(ruta)
    idx_mes = np.array([f.month - 1 for f in fechas])
    corr = (arr * F[idx_mes]).astype("float32")
    p = perfil.copy()
    p.update(count=corr.shape[0], dtype="float32", nodata=np.nan, compress="deflate")
    with rasterio.open(GRILLAS_CORR / f"precip_corr_mm_{anio}.tif", "w", **p) as dst:
        dst.write(corr)

log("Agregando precip_corr_mm a los CSV de puntos ...")
for nombre, (r_, c_) in puntos_idx.items():
    ruta = C.CARPETA_DATOS / "clima_era5land" / f"era5land_diario_{nombre}.csv"
    if not ruta.exists():
        continue
    with open(ruta, encoding="utf-8") as fh:
        filas_csv = list(csv.DictReader(fh))
    if not filas_csv:
        continue
    cab = [c for c in filas_csv[0].keys() if c != "precip_corr_mm"] + ["precip_corr_mm"]
    for fila in filas_csv:
        pr = fila.get("precip_mm")
        mes = int(fila["fecha"][5:7])
        fila["precip_corr_mm"] = "" if pr in ("", None, "None") else round(float(pr) * float(F[mes - 1, r_, c_]), 3)
    with open(ruta, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cab)
        w.writeheader()
        w.writerows(filas_csv)
    log(f"  {nombre}: factores ene-dic = {[round(float(x), 2) for x in F[:, r_, c_]]}")

log("Recalculando ET0 y clima mensual con la lluvia corregida (paso 8) ...")
subprocess.call([sys.executable, str(Path(__file__).with_name("08_et0_y_clima_mensual.py"))])
log("Listo: datos/pisco")
