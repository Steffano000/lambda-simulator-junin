# -*- coding: utf-8 -*-
"""
Paso 12 (sin internet). Aptitud climática de cada cultivo del catálogo (método EcoCrop, FAO).

Funciones para el backend:
  piso_ecologico(altitud_m)                 -> id del piso de Pulgar Vidal
  aptitud(cultivo, clima_12_meses, ph)      -> {"aptitud": 0..1, "mes_siembra": 1..12, "limitante": "..."}
     clima_12_meses = lista de 12 dicts {"tmed_c", "tmin_c", "lluvia_mm"} (enero a diciembre)

Método EcoCrop (Hijmans et al. 2001; Ramírez-Villegas et al. 2013), con datos mensuales:
  - Para cada mes de siembra posible se toman los meses del ciclo del cultivo.
  - Temperatura: 1 dentro del rango óptimo, 0 fuera del rango absoluto, lineal entre ambos;
    se usa el peor mes. Si la Tmin media de un mes baja de (T helada letal + 4 °C), es 0.
  - Lluvia del ciclo: igual, con los rangos de lluvia.
  - Aptitud del ciclo = temperatura × lluvia; se elige el mejor mes de siembra.
  - pH del suelo: multiplica con la misma forma (1 en el óptimo, 0 fuera del absoluto).
Para papa, maíz amiláceo, haba, quinua y cebada se usan los rangos locales del equipo.

Al ejecutarlo como script, calcula la aptitud de todos los cultivos en los puntos de interés
(normal 1991-2020, lluvia corregida con PISCO, pH de SoilGrids) y la compara con lo que la DRA
registra en cada provincia. Salida: datos/cultivos/aptitud_puntos.csv y validacion_aptitud.csv
"""
import csv
import json
import math
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

AQUI = Path(__file__).resolve().parent
DATOS = AQUI.parent / "datos"
CATALOGO = json.loads((DATOS / "cultivos" / "catalogo_cultivos_junin.json").read_text(encoding="utf-8"))


def piso_ecologico(alt):
    for p in CATALOGO["pisos_ecologicos"]:
        if p["alt_min_m"] <= alt < p["alt_max_m"]:
            return p["id"]
    return "rupa_rupa" if alt < 400 else "janca"


def _trapecio(x, amin, omin, omax, amax):
    if None in (x, amin, omin, omax, amax):
        return 1.0
    if x <= amin or x >= amax:
        return 0.0
    if omin <= x <= omax:
        return 1.0
    if x < omin:
        return (x - amin) / (omin - amin) if omin > amin else 1.0
    return (amax - x) / (amax - omax) if amax > omax else 1.0


def parametros(cid):
    c = CATALOGO["cultivos"][cid]
    e = dict(c.get("ecocrop") or {})
    if not e:
        return None
    a = c.get("ajuste_local")
    if a:
        if a.get("t_opt_c"):
            e["t_opt_min_c"], e["t_opt_max_c"] = a["t_opt_c"]
        if a.get("t_base_c") is not None:
            e["t_min_c"] = a["t_base_c"]
        if a.get("t_helada_letal_c") is not None:
            e["t_helada_letal_c"] = a["t_helada_letal_c"]
        if a.get("ph_optimo"):
            e["ph_opt_min"], e["ph_opt_max"] = a["ph_optimo"]
        if a.get("ph_absoluto"):
            e["ph_min"], e["ph_max"] = a["ph_absoluto"]
        if a.get("ciclo_dias"):
            e["ciclo_min_dias"] = e["ciclo_max_dias"] = a["ciclo_dias"]
    return e


def aptitud(cid, clima, ph=None):
    e = parametros(cid)
    if e is None:
        return {"aptitud": None, "mes_siembra": None, "limitante": "sin parámetros EcoCrop"}
    gmin, gmax = e.get("ciclo_min_dias") or 0, e.get("ciclo_max_dias") or 0
    dias = (gmin + gmax) / 2 if gmax else 365
    meses = 12 if dias == 0 or dias >= 330 else max(1, min(12, round(dias / 30)))
    k = e.get("t_helada_letal_c")
    mejor = (0.0, None, "temperatura")
    for s in range(12):
        idx = [(s + i) % 12 for i in range(meses)]
        ft = min(_trapecio(clima[i]["tmed_c"], e["t_min_c"], e["t_opt_min_c"], e["t_opt_max_c"], e["t_max_c"]) for i in idx)
        if k is not None and any(clima[i]["tmin_c"] < k + 4 for i in idx):
            ft = 0.0
        lluvia = sum(clima[i]["lluvia_mm"] for i in idx)
        if meses < 12:   # EcoCrop da rangos anuales: se escalan a la duración del ciclo
            f = meses / 12
            fr = _trapecio(lluvia, e["lluvia_min_mm"] * f, e["lluvia_opt_min_mm"] * f,
                           e["lluvia_opt_max_mm"] * f, e["lluvia_max_mm"] * f)
        else:
            fr = _trapecio(lluvia, e["lluvia_min_mm"], e["lluvia_opt_min_mm"], e["lluvia_opt_max_mm"], e["lluvia_max_mm"])
        v = ft * fr
        if v > mejor[0]:
            mejor = (v, s + 1, "temperatura" if ft <= fr else "lluvia")
    fph = _trapecio(ph, e.get("ph_min"), e.get("ph_opt_min"), e.get("ph_opt_max"), e.get("ph_max")) if ph else 1.0
    lim = mejor[2] if mejor[0] <= fph else "pH"
    return {"aptitud": round(mejor[0] * fph, 3), "mes_siembra": mejor[1],
            "limitante": lim if mejor[0] * fph < 1 else "ninguno"}


# ---------------------------------------------------------------------------
# Script: aptitud en los puntos de interés y comparación con la DRA
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import config as C
    PROV_DE_PUNTO = {"huayao_igp": "chupaca", "huancayo": "huancayo", "concepcion": "concepcion",
                     "chupaca": "chupaca", "jauja": "jauja", "tarma": "tarma", "junin": "junin",
                     "la_oroya": "yauli", "la_merced": "chanchamayo", "satipo": "satipo"}
    elev = {}
    with open(DATOS / "limites" / "puntos_interes.csv", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            elev[r["punto"]] = float(r["elevacion_m"])
    ph_pt = {}
    try:
        import rasterio
        import numpy as np
        from rasterio.windows import Window
        with rasterio.open(DATOS / "suelo" / "suelo_0_30cm_junin.tif") as src:
            for nombre, (lat, lon) in C.PUNTOS.items():
                # SoilGrids no tiene datos en zonas urbanas: se toma la mediana de los
                # píxeles con dato más cercanos (ventanas de 3, 7, 11 y 21 píxeles de 250 m)
                fila, col = src.index(lon, lat)
                ph_pt[nombre] = None
                for r in (1, 3, 5, 10):
                    win = Window(col - r, fila - r, 2 * r + 1, 2 * r + 1)
                    v = src.read(5, window=win, boundless=True, fill_value=np.nan).astype(float)
                    v = v[np.isfinite(v) & (v > 0)]
                    if v.size:
                        ph_pt[nombre] = round(float(np.median(v)), 2)
                        break
    except Exception as e:
        print("(aviso) no se pudo leer el pH de SoilGrids:", e)

    filas, val = [], []
    for punto in C.PUNTOS:
        ruta = DATOS / "clima_era5land" / "et0" / f"clima_mensual_{punto}.csv"
        if not ruta.exists():
            continue
        acc = {m: {"tmed_c": [], "tmin_c": [], "lluvia_mm": []} for m in range(1, 13)}
        with open(ruta, encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                y, m = int(r["mes"][:4]), int(r["mes"][5:7])
                if 1991 <= y <= 2020:
                    for k in acc[m]:
                        acc[m][k].append(float(r[k]))
        clima = [{k: sum(v) / len(v) for k, v in acc[m].items()} for m in range(1, 13)]
        prov = PROV_DE_PUNTO[punto]
        presentes = {c["id"] for c in CATALOGO["provincias"][prov]["cultivos"] if c["porcentaje"] >= 1}
        piso = piso_ecologico(elev.get(punto, 3300))
        res = {}
        for cid in CATALOGO["cultivos"]:
            a = aptitud(cid, clima, ph_pt.get(punto))
            res[cid] = a
            filas.append([punto, prov, piso, cid, a["aptitud"], a["mes_siembra"], a["limitante"],
                          "si" if cid in presentes else "no"])
        con = [res[c]["aptitud"] for c in presentes if res[c]["aptitud"] is not None]
        sin = [v["aptitud"] for c, v in res.items() if c not in presentes and v["aptitud"] is not None]
        val.append([punto, prov, piso, len(con),
                    round(sum(con) / len(con), 3) if con else None,
                    round(sum(sin) / len(sin), 3) if sin else None,
                    sum(1 for v in con if v >= 0.5)])
    out = DATOS / "cultivos"
    with open(out / "aptitud_puntos.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["punto", "provincia", "piso_ecologico", "cultivo", "aptitud", "mejor_mes_siembra",
                    "factor_limitante", "registrado_por_dra_en_provincia"])
        w.writerows(filas)
    with open(out / "validacion_aptitud.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["punto", "provincia", "piso", "n_cultivos_dra_>=1pct", "aptitud_media_cultivos_dra",
                    "aptitud_media_otros_cultivos", "cultivos_dra_con_aptitud_>=0.5"])
        w.writerows(val)
    for v in val:
        print(f"{v[0]:12s} {v[2]:9s} cultivos DRA: {v[3]:2d}  aptitud media DRA {v[4]}  vs otros {v[5]}  (>=0.5: {v[6]})")
    print("Listo: datos/cultivos/aptitud_puntos.csv y validacion_aptitud.csv")
