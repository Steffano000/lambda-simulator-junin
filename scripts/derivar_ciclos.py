"""
Referencia auditable de la derivación del ciclo de cultivo (docs/04-motor-datos-fenologia.md).

Debe implementar el MISMO método que `FenologiaEngine` (src/domain/crops) para contrastar
resultados: curva Kc piecewise FAO-56, meses de ciclo de 30.42 días desde `mes_siembra`,
ETc = Kc × ETo, balance = lluvia − ETc y yield por factor hídrico.

Uso:
    python scripts/derivar_ciclos.py "Papa" "Normal 2001-02"

TODO(paso-04): implementar la derivación.
"""

import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def cargar(nombre: str) -> dict:
    with open(DATA / nombre, encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    cultivo_nombre, escenario_nombre = sys.argv[1], sys.argv[2]
    cultivos = {c["nombre"]: c for c in cargar("cultivos.json")["cultivos"]}
    escenarios = cargar("clima_escenarios.json")["clima_escenarios"]

    if cultivo_nombre not in cultivos:
        sys.exit(f"Cultivo desconocido. Opciones: {', '.join(cultivos)}")
    if escenario_nombre not in escenarios:
        sys.exit(f"Escenario desconocido. Opciones: {', '.join(escenarios)}")

    raise NotImplementedError("Derivación pendiente (paso 04).")


if __name__ == "__main__":
    main()
