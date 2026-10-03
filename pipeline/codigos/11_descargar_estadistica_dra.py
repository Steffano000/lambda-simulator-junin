# -*- coding: utf-8 -*-
"""
Paso 11. Descarga las estadísticas agrícolas oficiales de la Dirección Regional de
Agricultura Junín (https://www.agrojunin.gob.pe/estadistica_agraria/):
- Producción agrícola 2022 de cada una de las 9 provincias (cosecha en ha, producción,
  rendimiento y precio en chacra por cultivo).
- Resumen regional 2022 y superficie sembrada por campaña 2009-10 a 2019-20.
Son PDF; Claude los lee después para armar el catálogo de cultivos por zona.
Salida: datos/cultivos/fuentes_dra_junin/
"""
import sys
import requests
import config as C

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUT = C.CARPETA_DATOS / "cultivos" / "fuentes_dra_junin"
OUT.mkdir(parents=True, exist_ok=True)

ARCHIVOS = {
    "prov_chanchamayo_2022.pdf": "https://www.dropbox.com/s/40aaa4g0xcq8j1n/PROV%20CHANCHAMAYO%202022.pdf?dl=1",
    "prov_chupaca_2022.pdf": "https://www.dropbox.com/s/mhqz3pzytvule3i/PROV%20CHUPACA%202022.pdf?dl=1",
    "prov_concepcion_2022.pdf": "https://www.dropbox.com/s/73g10v220adpgqz/PROV%20CONCEPCION%202022.pdf?dl=1",
    "prov_huancayo_2022.pdf": "https://www.dropbox.com/s/ihm8kvbw35sooqg/PROV%20HUANCAYO%202022.pdf?dl=1",
    "prov_jauja_2022.pdf": "https://www.dropbox.com/s/pbjdn28lkaof0n3/PROV%20JAUJA%202022.pdf?dl=1",
    "prov_junin_2022.pdf": "https://www.dropbox.com/s/6jaw5zj4eenyv8o/PROV%20JUNIN%202022.pdf?dl=1",
    "prov_satipo_2022.pdf": "https://www.dropbox.com/s/3y7hnfgu1y171ew/PROV%20SATIPO%202022.pdf?dl=1",
    "prov_tarma_2022.pdf": "https://www.dropbox.com/s/e2wtf70lr3o5jt8/PROV%20TARMA%202022.pdf?dl=1",
    "prov_yauli_2022.pdf": "https://www.dropbox.com/s/toba47ab1qn2era/PROV%20YAULI%202022.pdf?dl=1",
    "region_junin_2022.pdf": "https://www.dropbox.com/s/54olwk8fj2vpm55/PRODUCCION%20AGRICOLA%202022.pdf?dl=1",
    "siembra_2009-10_a_2019-20.pdf": "https://www.dropbox.com/s/emjdfevdwfl0wlo/SIEMBRA%202009-10%20A%202019-20.pdf?dl=1",
}

for nombre, url in ARCHIVOS.items():
    destino = OUT / nombre
    if destino.exists() and destino.stat().st_size > 1000:
        print(f"ya existe {nombre}")
        continue
    try:
        r = requests.get(url, timeout=120, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        if not r.content.startswith(b"%PDF"):
            raise RuntimeError("Dropbox no devolvió un PDF")
        destino.write_bytes(r.content)
        print(f"ok  {nombre}  ({len(r.content) / 1e6:.1f} MB)")
    except Exception as e:
        print(f"ERROR {nombre}: {e}")
print("Listo: datos/cultivos/fuentes_dra_junin")
