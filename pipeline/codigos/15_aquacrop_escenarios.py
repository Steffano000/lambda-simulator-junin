# -*- coding: utf-8 -*-
"""
Paso 15 (sin internet). Rendimiento con AquaCrop (FAO), versión Python AquaCrop-OSPy,
para papa, quinua y cebada en los puntos de la sierra.

1) Histórico 1991-hoy: AquaCrop corre campaña por campaña con el clima diario real
   (Tmin, Tmax, lluvia corregida con PISCO, ET0 FAO-56) y el suelo del punto.
2) Escenarios (paso 13): el pronóstico es mensual, así que se arma un clima diario
   "análogo": para cada mes futuro se toma el mismo mes del año histórico con lluvia
   más parecida y se escala (lluvia y ET0 por la razón de totales, temperatura por la
   diferencia de medias) hasta que el total mensual coincide con el pronóstico.
3) AquaCrop simula sin limitaciones de fertilidad ni plagas, por eso da rendimientos
   mayores que los de campo. Se usa como modelo de ANOMALÍA:
     rendimiento_escenario = rendimiento DRA 2022 × (AquaCrop escenario / AquaCrop promedio 2013-2022)
   La razón DRA / AquaCrop se guarda como "brecha de rendimiento" (útil para la tesis).

Cultivos de AquaCrop usados: PotatoLocalGDD, Quinoa y BarleyGDD.
El maíz se excluyó: el de AquaCrop es de tierras bajas y no representa al maíz amiláceo.

Salida: datos/pronostico/
  aquacrop_historico.csv        rendimiento AquaCrop por campaña y punto
  aquacrop_escenarios.csv       rendimiento por escenario, campaña y cultivo
  aquacrop_resumen.json         para el simulador
"""
import json
import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

import config as C

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
warnings.filterwarnings("ignore")

try:
    from aquacrop import AquaCropModel, Soil, Crop, InitialWaterContent
except ImportError:
    sys.exit("Falta AquaCrop: python -m pip install aquacrop")

DATOS = C.CARPETA_DATOS
OUT = DATOS / "pronostico"
PRON = json.loads((OUT / "pronostico_escenarios.json").read_text(encoding="utf-8"))
SIM = json.loads((OUT / "simulador_escenarios.json").read_text(encoding="utf-8"))
CAT = json.loads((DATOS / "cultivos" / "catalogo_cultivos_junin.json").read_text(encoding="utf-8"))

PUNTOS_SIERRA = [p for p in C.PUNTOS if p not in ("la_merced", "satipo")]
CULTIVOS_AQ = {   # id del catálogo: (cultivo AquaCrop, fecha de siembra mm/dd)
    "papa": ("PotatoLocalGDD", "10/15"),
    "quinua": ("Quinoa", "11/01"),
    "cebada": ("BarleyGDD", "12/15"),
}
# El maíz de AquaCrop es de tierras bajas: en Jauja y Tarma da anomalías absurdas (x3) porque
# casi no llega a madurar con el frío. Para el maíz amiláceo se usa solo el balance FAO-56 (paso 14).
PROV_DE_PUNTO = {"huayao_igp": "chupaca", "huancayo": "huancayo", "concepcion": "concepcion",
                 "chupaca": "chupaca", "jauja": "jauja", "tarma": "tarma", "junin": "junin", "la_oroya": "yauli"}


def clase_textural(arena, arcilla, limo):
    """Triángulo textural USDA -> nombre de suelo de AquaCrop."""
    if limo + 1.5 * arcilla < 15:
        return "Sand"
    if limo + 1.5 * arcilla < 30:
        return "LoamySand"
    if (7 <= arcilla < 20 and arena > 52 and limo + 2 * arcilla >= 30) or (arcilla < 7 and limo < 50 and limo + 2 * arcilla >= 30):
        return "SandyLoam"
    if 7 <= arcilla < 27 and 28 <= limo < 50 and arena <= 52:
        return "Loam"
    if (limo >= 50 and 12 <= arcilla < 27) or (50 <= limo < 80 and arcilla < 12):
        return "SiltLoam"
    if limo >= 80 and arcilla < 12:
        return "Silt"
    if 20 <= arcilla < 35 and limo < 28 and arena > 45:
        return "SandyClayLoam"
    if 27 <= arcilla < 40 and 20 < arena <= 45:
        return "ClayLoam"
    if 27 <= arcilla < 40 and arena <= 20:
        return "SiltClayLoam"
    if arcilla >= 35 and arena > 45:
        return "SandyClay"
    if arcilla >= 40 and limo >= 40:
        return "SiltClay"
    return "Clay"


def clima_diario(punto):
    d = pd.read_csv(DATOS / "clima_era5land" / f"era5land_diario_{punto}.csv",
                    usecols=["fecha", "tmin_c", "tmax_c", "precip_mm", "precip_corr_mm"], parse_dates=["fecha"])
    e = pd.read_csv(DATOS / "clima_era5land" / "et0" / f"et0_diario_{punto}.csv",
                    usecols=["fecha", "et0_mm"], parse_dates=["fecha"])
    d["lluvia"] = d["precip_corr_mm"].fillna(d["precip_mm"])
    w = d.merge(e, on="fecha")
    w = w.rename(columns={"tmin_c": "MinTemp", "tmax_c": "MaxTemp", "lluvia": "Precipitation",
                          "et0_mm": "ReferenceET", "fecha": "Date"})
    w["MaxTemp"] = np.maximum(w["MaxTemp"], w["MinTemp"] + 0.1)
    return w[["MinTemp", "MaxTemp", "Precipitation", "ReferenceET", "Date"]].dropna().reset_index(drop=True)


def correr(w, suelo, cultivo, siembra, inicio, fin):
    m = AquaCropModel(sim_start_time=inicio, sim_end_time=fin, weather_df=w, soil=Soil(suelo),
                      crop=Crop(cultivo, planting_date=siembra), initial_water_content=InitialWaterContent(value=["FC"]))
    m.run_model(till_termination=True)
    r = m.get_simulation_results()
    r = r[["Harvest Date (YYYY/MM/DD)", "Dry yield (tonne/ha)", "Yield potential (tonne/ha)"]].copy()
    r.columns = ["cosecha", "rend_seco_t_ha", "rend_potencial_t_ha"]
    return r


def clima_escenario(hist, meses):
    """Desagrega meses pronosticados a días con años análogos escalados."""
    hist = hist.copy()
    hist["ym"] = hist["Date"].dt.to_period("M")
    mens = hist.groupby("ym").agg(P=("Precipitation", "sum"), E=("ReferenceET", "sum"),
                                  T=("MaxTemp", "mean"), t=("MinTemp", "mean"))
    mens = mens[(mens.index.year >= 1991)]
    partes = []
    for m in meses:
        per = pd.Period(m["mes"], "M")
        cand = mens[mens.index.month == per.month]
        base = (cand["P"] - m["lluvia_mm"]).abs().idxmin()
        dd = hist[hist["ym"] == base].copy()
        nd = per.days_in_month
        dd = dd.iloc[:nd]
        if len(dd) < nd:                                  # febrero de año bisiesto, etc.
            dd = pd.concat([dd, dd.iloc[-(nd - len(dd)):]])
        fP = m["lluvia_mm"] / cand.loc[base, "P"] if cand.loc[base, "P"] > 0 else 1.0
        fE = m["et0_mm"] / cand.loc[base, "E"] if cand.loc[base, "E"] > 0 else 1.0
        dd["Precipitation"] = dd["Precipitation"] * min(fP, 4.0)
        dd["ReferenceET"] = dd["ReferenceET"] * fE
        tmed_f = m.get("tmed_c", (cand.loc[base, "T"] + cand.loc[base, "t"]) / 2)
        dT = tmed_f - (cand.loc[base, "T"] + cand.loc[base, "t"]) / 2
        dd["MaxTemp"] += dT
        dd["MinTemp"] += dT
        dd["Date"] = pd.date_range(per.start_time, periods=nd, freq="D")
        partes.append(dd[["MinTemp", "MaxTemp", "Precipitation", "ReferenceET", "Date"]])
    return pd.concat(partes).reset_index(drop=True)


hist_rows, esc_rows, resumen = [], [], {"meta": {
    "metodo": "AquaCrop-OSPy como modelo de anomalía, escalado al rendimiento DRA 2022 de la provincia",
    "formula": "rend = rend_DRA × AquaCrop_escenario / AquaCrop_promedio_2013_2022"}, "puntos": {}}

for punto in PUNTOS_SIERRA:
    if punto not in SIM["puntos"]:
        continue
    try:
        w = clima_diario(punto)
    except FileNotFoundError:
        print(f"{punto}: faltan datos diarios, se omite")
        continue
    s = SIM["puntos"][punto]["suelo"]
    suelo = clase_textural(s["arena_pct"], s["arcilla_pct"], s["limo_pct"])
    prov = PROV_DE_PUNTO[punto]
    print(f"\n{punto} (suelo {suelo}, provincia {prov})")
    ultimo = w["Date"].max()
    fin_hist = f"{ultimo.year - (1 if ultimo.month < 9 else 0)}/08/31"
    resumen["puntos"][punto] = {"suelo_aquacrop": suelo, "cultivos": {}}
    for cid, (aq, siembra) in CULTIVOS_AQ.items():
        try:
            h = correr(w, suelo, aq, siembra, "1991/09/01", fin_hist)
        except Exception as ex:
            print(f"  {cid}: AquaCrop no pudo simular ({str(ex)[:80]})")
            continue
        h["anio_cosecha"] = pd.to_datetime(h["cosecha"]).dt.year
        for r in h.itertuples():
            hist_rows.append([punto, cid, r.cosecha, round(r.rend_seco_t_ha, 3), round(r.rend_potencial_t_ha, 3)])
        ref_aq = h[(h.anio_cosecha >= 2013) & (h.anio_cosecha <= 2022)]["rend_seco_t_ha"].mean()
        p = CAT["cultivos"].get(cid, {}).get("provincias", {}).get(prov, {})
        rend_dra = p.get("rend_kg_ha", 0) / 1000.0 if p.get("rend_kg_ha") else None
        info = {"aquacrop": aq, "siembra": siembra, "aquacrop_prom_2013_2022_t_ha_seco": round(float(ref_aq), 2),
                "rend_dra_2022_t_ha": rend_dra, "variabilidad_historica_cv": round(float(h["rend_seco_t_ha"].std() / h["rend_seco_t_ha"].mean()), 3),
                "escenarios": {}}
        for esc, datos_esc in SIM["puntos"][punto]["escenarios"].items():
            meses = datos_esc["meses"]
            try:
                wf = clima_escenario(w, meses)
                ini = wf["Date"].min()
                fin = wf["Date"].max()
                r = correr(pd.concat([w[w["Date"] < ini], wf]).reset_index(drop=True), suelo, aq, siembra,
                           ini.strftime("%Y/%m/%d"), fin.strftime("%Y/%m/%d"))
            except Exception as ex:
                print(f"  {cid} {esc}: {str(ex)[:80]}")
                continue
            camp = []
            for rr in r.itertuples():
                if not np.isfinite(rr.rend_seco_t_ha) or rr.rend_seco_t_ha <= 0:
                    continue
                anom = rr.rend_seco_t_ha / ref_aq if ref_aq else None
                rend = round(rend_dra * anom, 2) if (rend_dra and anom) else None
                camp.append({"cosecha": str(rr.cosecha)[:10], "aquacrop_t_ha_seco": round(rr.rend_seco_t_ha, 2),
                             "anomalia": round(anom, 3) if anom else None, "rend_esperado_t_ha": rend})
                esc_rows.append([punto, prov, esc, cid, str(rr.cosecha)[:10], round(rr.rend_seco_t_ha, 3),
                                 round(anom, 3) if anom else None, rend_dra, rend])
            info["escenarios"][esc] = camp
        if rend_dra and ref_aq:
            # AquaCrop da materia seca; la DRA reporta peso de cosecha (papa fresca ~20 % de materia
            # seca; granos ~14 % de humedad). La brecha compara ambos en peso de cosecha.
            ms = 0.20 if cid == "papa" else 0.86
            info["aquacrop_prom_2013_2022_t_ha_cosecha"] = round(float(ref_aq / ms), 2)
            info["brecha_dra_sobre_aquacrop"] = round(rend_dra / (ref_aq / ms), 2)
        resumen["puntos"][punto]["cultivos"][cid] = info
        txt = "  ".join(f"{e}:{(c[0]['anomalia'] if c else float('nan')):.2f}" for e, c in info["escenarios"].items())
        print(f"  {cid:14s} AquaCrop 2013-22 {ref_aq:5.2f} t/ha | DRA {rend_dra} t/ha | anomalía 1a campaña: {txt}")

pd.DataFrame(hist_rows, columns=["punto", "cultivo", "cosecha", "aquacrop_t_ha_seco", "potencial_t_ha"]).to_csv(
    OUT / "aquacrop_historico.csv", index=False)
pd.DataFrame(esc_rows, columns=["punto", "provincia", "escenario", "cultivo", "cosecha", "aquacrop_t_ha_seco",
                                "anomalia", "rend_dra_2022_t_ha", "rend_esperado_t_ha"]).to_csv(
    OUT / "aquacrop_escenarios.csv", index=False)
def limpiar(o):
    """JSON válido para JavaScript: NaN e infinito pasan a null."""
    if isinstance(o, dict):
        return {k: limpiar(v) for k, v in o.items()}
    if isinstance(o, list):
        return [limpiar(v) for v in o]
    if isinstance(o, float) and not math.isfinite(o):
        return None
    return o


(OUT / "aquacrop_resumen.json").write_text(json.dumps(limpiar(resumen), ensure_ascii=False, allow_nan=False), encoding="utf-8")
print("\nListo: datos/pronostico/aquacrop_*.csv y aquacrop_resumen.json")
