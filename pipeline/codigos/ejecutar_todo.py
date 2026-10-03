# -*- coding: utf-8 -*-
"""
Ejecuta los pasos 1 a 8 en orden. Si alguno falla, sigue con el siguiente y al final
muestra el resumen. Se puede volver a ejecutar: cada paso salta lo que ya bajó.

  python ejecutar_todo.py            -> todo
  python ejecutar_todo.py rapido     -> todo menos los mapas diarios de ERA5-Land (lo más pesado)
"""
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
rapido = len(sys.argv) > 1 and sys.argv[1] == "rapido"

PASOS = [
    ("01_limites_junin.py", []),
    ("07_enso_oisst.py", []),
    ("03_terreno_srtm.py", []),
    ("04_suelos_soilgrids.py", []),
    ("02_era5land_clima.py", ["puntos"]),
    ("08_et0_y_clima_mensual.py", []),
    ("06_smap_humedad.py", []),
    ("05_ndvi_sentinel2.py", []),
]
if not rapido:
    PASOS.append(("02_era5land_clima.py", ["grillas"]))

resultado = []
for script, args in PASOS:
    print("\n" + "=" * 70 + f"\n{script} {' '.join(args)}\n" + "=" * 70, flush=True)
    t0 = time.time()
    rc = subprocess.call([sys.executable, str(AQUI / script)] + args, cwd=str(AQUI))
    resultado.append((script + (" " + " ".join(args) if args else ""), rc, time.time() - t0))

print("\nRESUMEN")
for s, rc, t in resultado:
    print(f"  {'OK   ' if rc == 0 else 'FALLO'}  {s:40s} {t/60:6.1f} min")
