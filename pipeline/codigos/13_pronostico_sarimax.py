# -*- coding: utf-8 -*-
"""
Paso 13 (sin internet). Pronóstico mensual con SARIMAX y escenarios ENSO.

Para cada punto de interés y cada variable (lluvia corregida, ET0, Tmax, Tmed, Tmin,
humedad del suelo 0-7 cm) se ajusta un SARIMAX mensual 1982-hoy con dos variables
exógenas: la anomalía de TSM en Niño 1+2 y en Niño 3.4 (paso 7).

  y_t = SARIMA(p,0,q)(P,1,Q)_12 + b1·Niño12_t + b2·Niño34_t + e_t
  (la lluvia se modela como raíz cuadrada para que el pronóstico no salga negativo)

El orden (p,q)(P,Q) se elige por AIC entre 6 candidatos.

Validación (backtest): se ajusta hasta 5 años antes del último dato, se pronostican esos
60 meses (con el ENSO observado) y se compara contra lo observado y contra la climatología.

Escenarios a 24 meses (el ENSO futuro se impone como dato de entrada):
  actual  : el ENSO del último mes observado se va disipando (vida media de 6 meses)
  neutro  : anomalías 0
  nino    : Niño 1+2 = +3.0 °C, Niño 3.4 = +2.0 °C por 12 meses, luego vuelve a 0
  nina    : Niño 1+2 = -1.0 °C, Niño 3.4 = -1.0 °C por 12 meses, luego vuelve a 0

Salida: datos/pronostico/
  pronostico_<punto>.csv        escenario, mes, variable, media, inf80, sup80
  pronostico_escenarios.json    para el simulador (incluye balance P-ET0 e índice P/ET0)
  validacion_backtest.csv       RMSE, NSE y mejora sobre la climatología
  modelos_elegidos.csv          orden SARIMAX y coeficientes ENSO de cada serie
  escenarios_enso.csv           valores de ENSO usados en cada escenario
"""
import csv
import json
import math
import sys
import warnings
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

import config as C

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
warnings.filterwarnings("ignore")

DATOS = C.CARPETA_DATOS
OUT = DATOS / "pronostico"
OUT.mkdir(parents=True, exist_ok=True)
HORIZONTE = 24
INICIO = "1982-01"
ORDENES = [((1, 0, 0), (0, 1, 1, 12)), ((1, 0, 1), (0, 1, 1, 12)), ((2, 0, 0), (0, 1, 1, 12)),
           ((1, 0, 0), (1, 1, 1, 12)), ((1, 0, 1), (1, 1, 1, 12)), ((2, 0, 0), (1, 1, 1, 12))]
VARIABLES = ["lluvia_mm", "et0_mm", "tmax_c", "tmed_c", "tmin_c", "hum_suelo_m3m3"]
LIMITES = {"lluvia_mm": (0, None), "et0_mm": (0, None), "hum_suelo_m3m3": (0.02, 0.65)}


def log(m):
    print(m, flush=True)


# ---------------------------------------------------------------------------
# Datos
# ---------------------------------------------------------------------------
enso = pd.read_csv(DATOS / "enso" / "enso_mensual.csv")
enso["mes"] = pd.PeriodIndex(enso["mes"], freq="M")
enso = enso.set_index("mes")[["anom_nino12_c", "anom_nino34_c"]].rename(
    columns={"anom_nino12_c": "nino12", "anom_nino34_c": "nino34"})


def serie_punto(punto):
    m = pd.read_csv(DATOS / "clima_era5land" / "et0" / f"clima_mensual_{punto}.csv")
    m = m[m["dias"] >= 28]
    m["mes"] = pd.PeriodIndex(m["mes"], freq="M")
    m = m.set_index("mes")[["lluvia_mm", "et0_mm", "tmed_c", "tmin_c"]]
    d = pd.read_csv(DATOS / "clima_era5land" / f"era5land_diario_{punto}.csv",
                    usecols=["fecha", "tmax_c", "hum_suelo_0_7cm_m3m3"], parse_dates=["fecha"])
    d["mes"] = d["fecha"].dt.to_period("M")
    g = d.groupby("mes").agg(tmax_c=("tmax_c", "mean"), hum_suelo_m3m3=("hum_suelo_0_7cm_m3m3", "mean"))
    df = m.join(g, how="inner").join(enso, how="inner")
    return df[df.index >= pd.Period(INICIO, "M")].dropna()


def transformar(v, y):
    return np.sqrt(np.clip(y, 0, None)) if v == "lluvia_mm" else y


def destransformar(v, y):
    y = np.square(np.clip(y, 0, None)) if v == "lluvia_mm" else y
    lo, hi = LIMITES.get(v, (None, None))
    return np.clip(y, lo, hi)


def ajustar(y, X, orden=None):
    candidatos = [orden] if orden else ORDENES
    mejor = None
    for o, so in candidatos:
        try:
            r = SARIMAX(y, exog=X, order=o, seasonal_order=so,
                        enforce_stationarity=False, enforce_invertibility=False).fit(disp=False, maxiter=200)
            if mejor is None or r.aic < mejor[0].aic:
                mejor = (r, (o, so))
        except Exception:
            continue
    return mejor


# ---------------------------------------------------------------------------
# Escenarios de ENSO
# ---------------------------------------------------------------------------
def escenarios_enso(ultimo_mes):
    futuro = pd.period_range(ultimo_mes + 1, periods=HORIZONTE, freq="M")
    ult = enso.loc[:ultimo_mes].iloc[-1]
    k = np.arange(1, HORIZONTE + 1)
    decae = 0.5 ** (k / 6.0)                                   # vida media de 6 meses
    forma = np.where(k <= 12, 1.0, np.clip(1 - (k - 12) / 6.0, 0, 1))   # 12 meses y luego 6 de transición
    esc = {
        "actual": pd.DataFrame({"nino12": ult["nino12"] * decae, "nino34": ult["nino34"] * decae}, index=futuro),
        "neutro": pd.DataFrame({"nino12": 0.0 * k, "nino34": 0.0 * k}, index=futuro),
        "nino": pd.DataFrame({"nino12": 3.0 * forma, "nino34": 2.0 * forma}, index=futuro),
        "nina": pd.DataFrame({"nino12": -1.0 * forma, "nino34": -1.0 * forma}, index=futuro),
    }
    return esc, ult


NOMBRES_ESC = {"actual": "ENSO actual que se disipa", "neutro": "Neutro",
               "nino": "El Niño fuerte", "nina": "La Niña"}


def clase_indice(i):
    if i is None or not math.isfinite(i):
        return None
    if i >= 1.0:
        return "sin deficit"
    if i >= 0.5:
        return "deficit moderado"
    return "deficit severo"


# ---------------------------------------------------------------------------
# Proceso por punto
# ---------------------------------------------------------------------------
filas_val, filas_mod = [], []
salida_json = {"meta": {
    "metodo": "SARIMAX mensual con anomalías de TSM Niño 1+2 y Niño 3.4 como exógenas (statsmodels)",
    "horizonte_meses": HORIZONTE,
    "escenarios": NOMBRES_ESC,
    "indice_humedad": "P/ET0 mensual: >=1 sin déficit, 0.5-1 déficit moderado, <0.5 déficit severo",
    "balance_mm": "P - ET0 mensual (positivo = excedente, negativo = déficit)",
    "intervalo": "inf80/sup80 = intervalo de predicción del 80 %",
}, "puntos": {}}
escenarios_guardados = None

for punto in C.PUNTOS:
    try:
        df = serie_punto(punto)
    except FileNotFoundError:
        log(f"{punto}: faltan datos, se omite")
        continue
    ultimo = df.index[-1]
    esc, ult = escenarios_enso(ultimo)
    if escenarios_guardados is None:
        escenarios_guardados = (esc, ult, ultimo)
    log(f"\n{punto}: {df.index[0]} a {ultimo} ({len(df)} meses). ENSO último mes: "
        f"Niño1+2 {ult['nino12']:+.2f} °C, Niño3.4 {ult['nino34']:+.2f} °C")
    X = df[["nino12", "nino34"]].astype(float)
    clim = df[(df.index.year >= 1991) & (df.index.year <= 2020)].groupby(df[(df.index.year >= 1991) & (df.index.year <= 2020)].index.month).mean()
    pron = {e: {} for e in esc}
    for v in VARIABLES:
        y = transformar(v, df[v].astype(float).values)
        y = pd.Series(y, index=df.index.to_timestamp())
        Xi = X.set_index(df.index.to_timestamp())
        res = ajustar(y, Xi)
        if res is None:
            log(f"  {v}: no se pudo ajustar")
            continue
        modelo, orden = res
        b = modelo.params
        filas_mod.append([punto, v, str(orden[0]), str(orden[1]), round(modelo.aic, 1),
                          round(float(b.get("nino12", np.nan)), 4), round(float(b.get("nino34", np.nan)), 4)])
        # --- backtest de 60 meses ---
        corte = len(y) - 60
        rb = ajustar(y.iloc[:corte], Xi.iloc[:corte], orden)
        if rb:
            fb = rb[0].get_forecast(60, exog=Xi.iloc[corte:]).predicted_mean.values
            obs = df[v].values[corte:]
            sim = destransformar(v, fb)
            cl = np.array([clim.loc[p.month, v] for p in df.index[corte:]])
            rmse = float(np.sqrt(np.mean((sim - obs) ** 2)))
            rmse_c = float(np.sqrt(np.mean((cl - obs) ** 2)))
            nse = float(1 - np.sum((sim - obs) ** 2) / np.sum((obs - obs.mean()) ** 2))
            filas_val.append([punto, v, f"{df.index[corte]}-{ultimo}", round(rmse, 3), round(rmse_c, 3),
                              round(1 - rmse / rmse_c, 3) if rmse_c else None, round(nse, 3)])
        # --- escenarios ---
        for e, Xf in esc.items():
            Xf_ts = Xf.set_index(Xf.index.to_timestamp())
            f = modelo.get_forecast(HORIZONTE, exog=Xf_ts)
            ci = f.conf_int(alpha=0.2).values
            pron[e][v] = (destransformar(v, f.predicted_mean.values),
                          destransformar(v, ci[:, 0]), destransformar(v, ci[:, 1]))
        log(f"  {v:15s} SARIMA{orden[0]}x{orden[1]}  b_Niño12={b.get('nino12', 0):+.3f}  b_Niño34={b.get('nino34', 0):+.3f}")

    # --- archivos del punto ---
    futuro = list(esc["neutro"].index)
    with open(OUT / f"pronostico_{punto}.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["escenario", "mes", "variable", "media", "inf80", "sup80"])
        for e in esc:
            for v, (m_, lo, hi) in pron[e].items():
                for i, p in enumerate(futuro):
                    w.writerow([e, str(p), v, round(float(m_[i]), 4), round(float(lo[i]), 4), round(float(hi[i]), 4)])
    pj = {"normal_1991_2020": [], "escenarios": {}}
    for mth in range(1, 13):
        r = clim.loc[mth]
        ind = r["lluvia_mm"] / r["et0_mm"] if r["et0_mm"] else None
        pj["normal_1991_2020"].append({"mes": mth, "lluvia_mm": round(r["lluvia_mm"], 1), "et0_mm": round(r["et0_mm"], 1),
                                       "tmax_c": round(r["tmax_c"], 2), "tmed_c": round(r["tmed_c"], 2), "tmin_c": round(r["tmin_c"], 2),
                                       "hum_suelo_m3m3": round(r["hum_suelo_m3m3"], 3),
                                       "balance_mm": round(r["lluvia_mm"] - r["et0_mm"], 1),
                                       "indice_p_et0": round(ind, 2) if ind else None, "clase": clase_indice(ind)})
    for e in esc:
        filas = []
        for i, p in enumerate(futuro):
            reg = {"mes": str(p), "nino12": round(float(esc[e]["nino12"].iloc[i]), 2), "nino34": round(float(esc[e]["nino34"].iloc[i]), 2)}
            for v in pron[e]:
                reg[v] = round(float(pron[e][v][0][i]), 3)
                reg[v + "_inf80"] = round(float(pron[e][v][1][i]), 3)
                reg[v + "_sup80"] = round(float(pron[e][v][2][i]), 3)
            if "lluvia_mm" in reg and "et0_mm" in reg:
                reg["balance_mm"] = round(reg["lluvia_mm"] - reg["et0_mm"], 1)
                ind = reg["lluvia_mm"] / reg["et0_mm"] if reg["et0_mm"] else None
                reg["indice_p_et0"] = round(ind, 2) if ind is not None else None
                reg["clase"] = clase_indice(ind)
            filas.append(reg)
        pj["escenarios"][e] = filas
    lat, lon = C.PUNTOS[punto]
    pj["lat"], pj["lon"] = lat, lon
    salida_json["puntos"][punto] = pj
    # resumen de la próxima campaña (oct-mar) por escenario
    res_txt = []
    for e in esc:
        f = pj["escenarios"][e]
        camp = [r for r in f if int(r["mes"][5:7]) in (10, 11, 12, 1, 2, 3)][:6]
        if camp:
            res_txt.append(f"{e}: lluvia {sum(r['lluvia_mm'] for r in camp):.0f} mm, ET0 {sum(r['et0_mm'] for r in camp):.0f} mm")
    log("  próxima campaña oct-mar → " + " | ".join(res_txt))

with open(OUT / "validacion_backtest.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["punto", "variable", "periodo_validacion", "rmse_sarimax", "rmse_climatologia",
                "mejora_sobre_climatologia", "nse"])
    w.writerows(filas_val)
with open(OUT / "modelos_elegidos.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["punto", "variable", "orden_pdq", "orden_estacional", "aic", "coef_nino12", "coef_nino34"])
    w.writerows(filas_mod)
if escenarios_guardados:
    esc, ult, ultimo = escenarios_guardados
    with open(OUT / "escenarios_enso.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["escenario", "mes", "anom_nino12_c", "anom_nino34_c"])
        for e, d in esc.items():
            for p, r in d.iterrows():
                w.writerow([e, str(p), round(r["nino12"], 2), round(r["nino34"], 2)])
    salida_json["meta"]["ultimo_mes_observado"] = str(ultimo)
    salida_json["meta"]["enso_ultimo_mes"] = {"nino12": round(float(ult["nino12"]), 2), "nino34": round(float(ult["nino34"]), 2)}
def limpiar(o):
    """JSON válido para JavaScript: NaN e infinito pasan a null."""
    if isinstance(o, dict):
        return {k: limpiar(v) for k, v in o.items()}
    if isinstance(o, list):
        return [limpiar(v) for v in o]
    if isinstance(o, float) and not math.isfinite(o):
        return None
    return o


(OUT / "pronostico_escenarios.json").write_text(json.dumps(limpiar(salida_json), ensure_ascii=False, allow_nan=False), encoding="utf-8")

v = pd.DataFrame(filas_val, columns=["punto", "variable", "periodo", "rmse", "rmse_clim", "mejora", "nse"])
if len(v):
    log("\nValidación (promedio de los puntos, 60 meses no usados para ajustar):")
    for var, g in v.groupby("variable"):
        log(f"  {var:15s} NSE {g.nse.mean():.2f}   mejora sobre la climatología {100 * g.mejora.mean():+.0f} %")
log("Listo: datos/pronostico")
