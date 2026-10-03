# -*- coding: utf-8 -*-
"""
Paso 8 (sin internet). ET0 diaria FAO-56 Penman-Monteith en cada punto y resumen mensual
con las mismas variables que ya usa el simulador (et0_mm, lluvia_mm, tmed_c, tmin_c).

Entrada: datos/clima_era5land/era5land_diario_<punto>.csv  (paso 2)
         datos/limites/puntos_interes.csv                  (paso 1, elevación)
Salida:  datos/clima_era5land/et0/et0_diario_<punto>.csv
         datos/clima_era5land/et0/clima_mensual_<punto>.csv
         datos/clima_era5land/et0/clima_mensual_puntos.json
"""
import csv
import json
import math
import sys
from collections import defaultdict
from datetime import date

import config as C

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ENTRADA = C.CARPETA_DATOS / "clima_era5land"
OUT = ENTRADA / "et0"
OUT.mkdir(parents=True, exist_ok=True)
SIGMA = 4.903e-9  # MJ K-4 m-2 día-1


def e0(t):
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def et0_fao56(tmax, tmin, tdew, rs, u10, p_kpa, z, lat_deg, j):
    tmed = (tmax + tmin) / 2
    es = (e0(tmax) + e0(tmin)) / 2
    ea = e0(tdew)
    delta = 4098 * e0(tmed) / (tmed + 237.3) ** 2
    if p_kpa is None:
        p_kpa = 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26
    gamma = 0.665e-3 * p_kpa
    u2 = u10 * 4.87 / math.log(67.8 * 10 - 5.42)
    # radiación extraterrestre (FAO-56 ec. 21)
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * j / 365)
    dec = 0.409 * math.sin(2 * math.pi * j / 365 - 1.39)
    ws = math.acos(max(-1.0, min(1.0, -math.tan(phi) * math.tan(dec))))
    ra = (24 * 60 / math.pi) * 0.0820 * dr * (ws * math.sin(phi) * math.sin(dec)
                                              + math.cos(phi) * math.cos(dec) * math.sin(ws))
    rso = (0.75 + 2e-5 * z) * ra
    rns = 0.77 * rs
    rel = min(rs / rso, 1.0) if rso > 0 else 0.5
    rnl = SIGMA * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * math.sqrt(ea)) * (1.35 * rel - 0.35)
    rn = rns - rnl
    et0 = (0.408 * delta * rn + gamma * (900 / (tmed + 273)) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2))
    return max(et0, 0.0), u2, ea, rn


def f(x):
    return None if x in ("", "None", None) else float(x)


elev = {}
ruta_pts = C.CARPETA_DATOS / "limites" / "puntos_interes.csv"
if ruta_pts.exists():
    with open(ruta_pts, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            elev[r["punto"]] = f(r["elevacion_m"])

resumen_json = {}
for punto, (lat, lon) in C.PUNTOS.items():
    ruta = ENTRADA / f"era5land_diario_{punto}.csv"
    if not ruta.exists():
        print(f"Falta {ruta.name}; ejecuta antes el paso 2")
        continue
    z = elev.get(punto) or 3300.0
    # viento medio diario calculado con datos horarios (paso 2b), si existe
    viento_h = {}
    ruta_v = ENTRADA / "viento_horario" / f"viento_diario_{punto}.csv"
    if ruta_v.exists():
        with open(ruta_v, encoding="utf-8") as fv:
            for rv in csv.DictReader(fv):
                if rv["viento10_ms"] not in ("", "None"):
                    viento_h[rv["fecha"]] = float(rv["viento10_ms"])
    usa_corr = False
    mensual = defaultdict(lambda: {"et0": 0.0, "p": 0.0, "tmed": [], "tmin": [], "n": 0})
    with open(ruta, encoding="utf-8") as fh, \
         open(OUT / f"et0_diario_{punto}.csv", "w", newline="", encoding="utf-8") as fo:
        w = csv.writer(fo)
        w.writerow(["fecha", "et0_mm", "u2_ms", "ea_kpa", "rn_mj_m2", "precip_mm", "tmax_c", "tmin_c"])
        for r in csv.DictReader(fh):
            tmax, tmin, tdew = f(r["tmax_c"]), f(r["tmin_c"]), f(r["trocio_c"])
            rs, p = f(r["rad_solar_mj_m2"]), f(r["presion_kpa"])
            u10 = viento_h.get(r["fecha"], f(r["viento10_ms"]))
            if f(r.get("precip_corr_mm")) is not None:
                pr, usa_corr = f(r["precip_corr_mm"]), True
            else:
                pr = f(r["precip_mm"])
            if None in (tmax, tmin, tdew, rs, u10):
                continue
            d = date.fromisoformat(r["fecha"])
            et0, u2, ea, rn = et0_fao56(tmax, tmin, tdew, rs, u10, p, z, lat, d.timetuple().tm_yday)
            w.writerow([r["fecha"], round(et0, 3), round(u2, 3), round(ea, 4), round(rn, 3), pr, tmax, tmin])
            m = mensual[r["fecha"][:7]]
            m["et0"] += et0
            m["p"] += pr or 0
            m["tmed"].append((tmax + tmin) / 2)
            m["tmin"].append(tmin)
            m["n"] += 1
    filas = []
    with open(OUT / f"clima_mensual_{punto}.csv", "w", newline="", encoding="utf-8") as fo:
        w = csv.writer(fo)
        w.writerow(["mes", "et0_mm", "lluvia_mm", "tmed_c", "tmin_c", "dias"])
        for mes in sorted(mensual):
            m = mensual[mes]
            fila = {"mes": mes, "et0_mm": round(m["et0"], 1), "lluvia_mm": round(m["p"], 1),
                    "tmed_c": round(sum(m["tmed"]) / m["n"], 2), "tmin_c": round(sum(m["tmin"]) / m["n"], 2),
                    "dias": m["n"]}
            w.writerow(fila.values())
            filas.append(fila)
    resumen_json[punto] = {"lat": lat, "lon": lon, "elevacion_m": z, "meses": filas,
                           "lluvia": "corregida con PISCOp v3.0" if usa_corr else "ERA5-Land sin corregir",
                           "viento": "promedio de datos horarios" if viento_h else "de componentes diarias (subestima)"}
    print(f"{punto}: {len(filas)} meses | lluvia {'corregida' if usa_corr else 'SIN corregir'} | "
          f"viento {'horario' if viento_h else 'diario'}")

(OUT / "clima_mensual_puntos.json").write_text(
    json.dumps({"fuente": "ERA5-Land diario (GEE) + ET0 FAO-56", "puntos": resumen_json}, ensure_ascii=False),
    encoding="utf-8")
print("Listo: datos/clima_era5land/et0")
