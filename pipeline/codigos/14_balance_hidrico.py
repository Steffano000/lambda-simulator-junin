# -*- coding: utf-8 -*-
"""
Paso 14 (sin internet). Balance hídrico por cultivo y escenario (FAO-56) con el suelo de SoilGrids.

1) Suelo del punto (SoilGrids 0-30 cm) -> pedotransferencia de Saxton y Rawls (2006):
     θ1500t = -0.024S + 0.487C + 0.006MO + 0.005(S·MO) - 0.013(C·MO) + 0.068(S·C) + 0.031
     θPMP   = θ1500t + (0.14·θ1500t - 0.02)
     θ33t   = -0.251S + 0.195C + 0.011MO + 0.006(S·MO) - 0.027(C·MO) + 0.452(S·C) + 0.299
     θCC    = θ33t + (1.283·θ33t² - 0.374·θ33t - 0.015)
   (S y C en fracción, MO en %; MO = COS × 1.724, limitada a 8 %)
2) Indicadores del clima, mes a mes:
     balance = P - ET0          (mm; negativo = déficit)
     índice  = P / ET0          (>=1 sin déficit, 0.5-1 moderado, <0.5 severo)
3) Por cultivo (fases, Kc, raíz, p y sensibilidad del equipo en fenologia_cultivos.json):
     ETc = Kc · ET0
     ADT = 1000 · (θCC - θPMP) · Zr ;  AFA = p · ADT
     Dr_i = Dr_(i-1) - P_i + ETa_i     (paso diario; P y ET0 mensuales repartidos por igual)
     Ks = 1 si Dr <= AFA ; si no, (ADT - Dr) / ((1 - p) · ADT) ;  ETa = Ks · ETc
     factor_agua = 1 - Σ sens_agua_fase · (1 - ETa/ETc)_fase      (regla del simulador)
     rendimiento = rendimiento de referencia × factor_agua
   El rendimiento de referencia es el de la DRA 2022 en la provincia del punto (catálogo);
   si el cultivo no está registrado ahí, el de fenologia_cultivos.json.
   Riesgo de helada (señal, no certeza): meses del ciclo con Tmin media < helada letal + 4 °C.

Escenarios: normal 1991-2020 y los 4 del paso 13 (actual, neutro, nino, nina).
Salida: datos/pronostico/
  balance_hidrico_<punto>.csv      mes a mes: P, ET0, P-ET0, P/ET0 y por cultivo Kc, ETc, ETa, Ks
  campanas_resumen.csv             una fila por punto, escenario y cultivo
  simulador_escenarios.json        todo junto, listo para el backend
"""
import calendar
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

import config as C

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DATOS = C.CARPETA_DATOS
OUT = DATOS / "pronostico"
PRON = json.loads((OUT / "pronostico_escenarios.json").read_text(encoding="utf-8"))
CAT = json.loads((DATOS / "cultivos" / "catalogo_cultivos_junin.json").read_text(encoding="utf-8"))
FENO_RUTA = [C.FENOLOGIA, C.CARPETA_BASE.parent / "fenologia_cultivos.json", C.CARPETA_BASE / "fenologia_cultivos.json"]
FENO = None
for r in FENO_RUTA:
    if r.exists():
        FENO = json.loads(r.read_text(encoding="utf-8"))
        break
if FENO is None:
    sys.exit("No encuentro fenologia_cultivos.json (debe estar en C:\\TESIS 2 o en esta carpeta)")
CULTIVOS = {c["id"]: c for c in FENO["cultivos"]}
PROV_DE_PUNTO = {"huayao_igp": "chupaca", "huancayo": "huancayo", "concepcion": "concepcion",
                 "chupaca": "chupaca", "jauja": "jauja", "tarma": "tarma", "junin": "junin",
                 "la_oroya": "yauli", "la_merced": "chanchamayo", "satipo": "satipo"}


def clase(i):
    if i is None or not math.isfinite(i):
        return None
    return "sin deficit" if i >= 1 else ("deficit moderado" if i >= 0.5 else "deficit severo")


# ---------------------------------------------------------------------------
# Suelo
# ---------------------------------------------------------------------------
def saxton_rawls(arena, arcilla, cos):
    S, Cc = arena / 100.0, arcilla / 100.0
    MO = min(cos * 1.724, 8.0)
    t1500t = -0.024 * S + 0.487 * Cc + 0.006 * MO + 0.005 * S * MO - 0.013 * Cc * MO + 0.068 * S * Cc + 0.031
    t1500 = t1500t + (0.14 * t1500t - 0.02)
    t33t = -0.251 * S + 0.195 * Cc + 0.011 * MO + 0.006 * S * MO - 0.027 * Cc * MO + 0.452 * S * Cc + 0.299
    t33 = t33t + (1.283 * t33t ** 2 - 0.374 * t33t - 0.015)
    return round(t33, 3), round(t1500, 3)


def suelo_puntos():
    import rasterio
    from rasterio.windows import Window
    res = {}
    with rasterio.open(DATOS / "suelo" / "suelo_0_30cm_junin.tif") as src:
        for nombre, (lat, lon) in C.PUNTOS.items():
            fila, col = src.index(lon, lat)
            for r in (1, 3, 5, 10):
                v = src.read(window=Window(col - r, fila - r, 2 * r + 1, 2 * r + 1), boundless=True,
                             fill_value=np.nan).astype(float)
                # cada banda con sus propios píxeles válidos (SoilGrids deja huecos distintos por banda)
                validas = [b[np.isfinite(b) & (b > 0)] for b in v]
                if all(x.size for x in validas):
                    med = [float(np.median(x)) for x in validas]
                    break
            else:
                med = [40, 25, 35, 2, 6, 1.2, 2, 15]
            arena, arcilla, limo, cos, ph = med[0], med[1], med[2], med[3], med[4]
            cc, pmp = saxton_rawls(arena, arcilla, cos)
            res[nombre] = {"arena_pct": round(arena, 1), "arcilla_pct": round(arcilla, 1), "limo_pct": round(limo, 1),
                           "cos_pct": round(cos, 2), "ph": round(ph, 2), "cc_m3m3": cc, "pmp_m3m3": pmp,
                           "agua_util_mm_por_m": round(1000 * (cc - pmp), 1)}
    return res


# ---------------------------------------------------------------------------
# Balance diario de un cultivo sobre una serie mensual
# ---------------------------------------------------------------------------
def kc_del_dia(cul, d):
    for f in cul["fases"]:
        if f["dia_ini"] <= d <= f["dia_fin"]:
            return f["kc"], f["n"]
    return cul["fases"][-1]["kc"], cul["fases"][-1]["n"]


def simular(cul, meses, suelo, inicio_idx):
    """meses = lista de dicts {mes 'YYYY-MM', lluvia_mm, et0_mm, tmin_c}. Siembra el día 1 del mes inicio_idx."""
    zr, p = cul["raiz_m"], cul["p_agotamiento"]
    adt = suelo["agua_util_mm_por_m"] * zr
    afa = p * adt
    dr = 0.5 * adt                               # se siembra con el suelo a media capacidad
    fase_etc, fase_eta = {}, {}
    mensual = {}
    d, i = 0, inicio_idx
    while d <= cul["ciclo_dias"] and i < len(meses):
        m = meses[i]
        y, mm = int(m["mes"][:4]), int(m["mes"][5:7])
        nd = calendar.monthrange(y, mm)[1]
        p_d, et0_d = m["lluvia_mm"] / nd, m["et0_mm"] / nd
        acc = mensual.setdefault(m["mes"], {"kc": [], "etc": 0.0, "eta": 0.0, "ks": []})
        for _ in range(nd):
            if d > cul["ciclo_dias"]:
                break
            kc, n = kc_del_dia(cul, d)
            etc = kc * et0_d
            ks = 1.0 if dr <= afa else max(0.0, (adt - dr) / ((1 - p) * adt))
            eta = ks * etc
            dr = min(adt, max(0.0, dr - p_d + eta))
            fase_etc[n] = fase_etc.get(n, 0) + etc
            fase_eta[n] = fase_eta.get(n, 0) + eta
            acc["kc"].append(kc); acc["ks"].append(ks); acc["etc"] += etc; acc["eta"] += eta
            d += 1
        acc["dr_fin_mm"] = round(dr, 1)
        i += 1
    if d <= cul["ciclo_dias"]:
        return None                               # el ciclo no entra en el horizonte
    perdida = 0.0
    for f in cul["fases"]:
        etc, eta = fase_etc.get(f["n"], 0), fase_eta.get(f["n"], 0)
        if etc > 0:
            perdida += f["sens_agua"] * (1 - eta / etc)
    meses_ciclo = [m for m in meses[inicio_idx:i]]
    helada = sum(1 for m in meses_ciclo if m.get("tmin_c") is not None and m["tmin_c"] < cul["helada_letal_c"] + 4)
    return {"etc_mm": round(sum(fase_etc.values()), 1), "eta_mm": round(sum(fase_eta.values()), 1),
            "lluvia_ciclo_mm": round(sum(m["lluvia_mm"] for m in meses_ciclo), 1),
            "factor_agua": round(max(0.0, 1 - perdida), 3), "meses_riesgo_helada": helada,
            "adt_mm": round(adt, 1), "mensual": {k: {"kc": round(float(np.mean(v["kc"])), 2), "etc_mm": round(v["etc"], 1),
                                                     "eta_mm": round(v["eta"], 1), "ks": round(float(np.mean(v["ks"])), 2),
                                                     "dr_fin_mm": v["dr_fin_mm"]} for k, v in mensual.items()}}


# producto de la DRA que corresponde al cultivo del simulador (grano seco, no vaina verde)
PRODUCTO_PREFERIDO = {"haba": "HABA GRANO SECO", "arveja": "ARVEJA GRANO SECO"}


def rendimiento_ref(cid, prov):
    c = CAT["cultivos"].get(cid, {})
    p = c.get("provincias", {}).get(prov, {})
    pref = PRODUCTO_PREFERIDO.get(cid)
    if pref:
        prod = p.get("productos", {}).get(pref)
        if prod and prod.get("rend_kg_ha"):
            return prod["rend_kg_ha"] / 1000.0, f"DRA Junín 2022, {prov} ({pref.lower()})"
        return CULTIVOS[cid]["rendimiento_ref_t_ha"], "fenologia_cultivos.json"
    if p.get("rend_kg_ha"):
        return p["rend_kg_ha"] / 1000.0, f"DRA Junín 2022, {prov}"
    return CULTIVOS[cid]["rendimiento_ref_t_ha"], "fenologia_cultivos.json"


# ---------------------------------------------------------------------------
# Proceso
# ---------------------------------------------------------------------------
suelos = suelo_puntos()
salida = {"meta": {"descripcion": "Clima pronosticado, indicadores hídricos y resultado por cultivo, por punto y escenario",
                   "escenarios": dict({"normal": "Normal 1991-2020"}, **PRON["meta"]["escenarios"]),
                   "ultimo_mes_observado": PRON["meta"].get("ultimo_mes_observado"),
                   "formulas": {"balance_mm": "P - ET0", "indice_p_et0": "P / ET0", "etc": "Kc · ET0",
                                "ks": "FAO-56: 1 si Dr <= AFA; (ADT-Dr)/((1-p)·ADT) si no",
                                "factor_agua": "1 - suma(sens_agua_fase · (1 - ETa/ETc)_fase)",
                                "suelo": "Saxton y Rawls (2006) con SoilGrids 0-30 cm"}},
          "puntos": {}}
filas_res = []
for punto, pj in PRON["puntos"].items():
    prov = PROV_DE_PUNTO.get(punto)
    futuro = pj["escenarios"]["neutro"]
    normal = []
    for r in futuro:                                  # la normal, en los mismos meses del horizonte
        n = pj["normal_1991_2020"][int(r["mes"][5:7]) - 1]
        normal.append({"mes": r["mes"], "lluvia_mm": n["lluvia_mm"], "et0_mm": n["et0_mm"], "tmin_c": n["tmin_c"],
                       "tmed_c": n["tmed_c"], "tmax_c": n["tmax_c"], "hum_suelo_m3m3": n["hum_suelo_m3m3"]})
    escenarios = {"normal": normal}
    escenarios.update(pj["escenarios"])
    sal_p = {"lat": pj["lat"], "lon": pj["lon"], "provincia": prov, "suelo": suelos[punto], "escenarios": {}}
    filas_mes = []
    for esc, meses in escenarios.items():
        for m in meses:
            m["balance_mm"] = round(m["lluvia_mm"] - m["et0_mm"], 1)
            ind = m["lluvia_mm"] / m["et0_mm"] if m["et0_mm"] else None
            m["indice_p_et0"] = round(ind, 2) if ind is not None else None
            m["clase"] = clase(ind)
        res_cult = {}
        for cid, cul in CULTIVOS.items():
            campanas = []
            for idx in [k for k, m in enumerate(meses) if int(m["mes"][5:7]) == cul["mes_siembra_tipico"]]:
                s = simular(cul, meses, suelos[punto], idx)
                if s is None:
                    continue
                ref, fuente = rendimiento_ref(cid, prov)
                s.update({"siembra": meses[idx]["mes"], "rend_ref_t_ha": round(ref, 2), "fuente_rend_ref": fuente,
                          "rend_esperado_t_ha": round(ref * s["factor_agua"], 2)})
                campanas.append(s)
                filas_res.append([punto, prov, esc, cid, s["siembra"], s["lluvia_ciclo_mm"], s["etc_mm"], s["eta_mm"],
                                  s["factor_agua"], s["rend_ref_t_ha"], s["rend_esperado_t_ha"], s["meses_riesgo_helada"], fuente])
            if campanas:
                res_cult[cid] = campanas
        for m in meses:
            fila = [esc, m["mes"], m["lluvia_mm"], m["et0_mm"], m["balance_mm"], m["indice_p_et0"], m["clase"]]
            for cid in CULTIVOS:
                mm = None
                for camp in res_cult.get(cid, []):
                    mm = camp["mensual"].get(m["mes"]) or mm
                fila += [mm["kc"], mm["etc_mm"], mm["eta_mm"], mm["ks"]] if mm else ["", "", "", ""]
            filas_mes.append(fila)
        sal_p["escenarios"][esc] = {"meses": [{k: v for k, v in m.items()} for m in meses],
                                    "cultivos": res_cult}
    with open(OUT / f"balance_hidrico_{punto}.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        cab = ["escenario", "mes", "lluvia_mm", "et0_mm", "balance_p_menos_et0_mm", "indice_p_et0", "clase"]
        for cid in CULTIVOS:
            cab += [f"{cid}_kc", f"{cid}_etc_mm", f"{cid}_eta_mm", f"{cid}_ks"]
        w.writerow(cab)
        w.writerows(filas_mes)
    salida["puntos"][punto] = sal_p
    s = suelos[punto]
    print(f"{punto:12s} suelo: arena {s['arena_pct']}% arcilla {s['arcilla_pct']}% -> CC {s['cc_m3m3']} PMP {s['pmp_m3m3']} "
          f"({s['agua_util_mm_por_m']} mm/m)")

with open(OUT / "campanas_resumen.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["punto", "provincia", "escenario", "cultivo", "siembra", "lluvia_ciclo_mm", "etc_mm", "eta_mm",
                "factor_agua", "rend_ref_t_ha", "rend_esperado_t_ha", "meses_riesgo_helada", "fuente_rend_ref"])
    w.writerows(filas_res)
def limpiar(o):
    """JSON válido para JavaScript: NaN e infinito pasan a null."""
    if isinstance(o, dict):
        return {k: limpiar(v) for k, v in o.items()}
    if isinstance(o, list):
        return [limpiar(v) for v in o]
    if isinstance(o, float) and not math.isfinite(o):
        return None
    return o


(OUT / "simulador_escenarios.json").write_text(json.dumps(limpiar(salida), ensure_ascii=False, allow_nan=False),
                                               encoding="utf-8")

print("\nFactor de agua por escenario (1 = sin pérdida por sequía), por campaña:")
import collections
tab = collections.defaultdict(dict)
for f in filas_res:
    if f[0] in ("huayao_igp", "jauja", "tarma", "satipo"):
        tab[(f[0], f[3] + " " + f[4])][f[2]] = f[8]
for (p, c), d in sorted(tab.items()):
    print(f"  {p:11s} {c:16s} " + "  ".join(f"{e}:{v:.2f}" for e, v in d.items()))
print("Listo: datos/pronostico/simulador_escenarios.json")
