# -*- coding: utf-8 -*-
"""
Paso 16 (sin internet). Deja listos los JSON que lee la app en public/data/junin/ del repositorio.

Antes copiaba los archivos a INTEGRACION_SISTEMAS/public/data y fallaba si había NaN o Infinity.
Ahora llama al paso 17 solo con los grupos livianos (app y tablas): valida, limpia los NaN/Infinity
(pasan a null) y actualiza public/data/junin/manifest.json.

Para regenerar también las grillas, parcelas y series diarias:
    python codigos\\17_exportar_json.py
"""
import runpy
import sys
from pathlib import Path

sys.argv = [sys.argv[0], "--solo", "app,tablas,geo"] + sys.argv[1:]
runpy.run_path(str(Path(__file__).with_name("17_exportar_json.py")), run_name="__main__")
