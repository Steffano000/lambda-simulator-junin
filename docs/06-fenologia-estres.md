# Paso 06 · Fase V1.0 · Fenología avanzada y estrés (GDD, helada, plagas)

> EPs: EP-04.1 (Modelo Fenológico) · EP-04.2 (Consumo de Recursos y ETc) · EP-05.2 (Propagación)

## Contexto
MVP (Alcance 04) deriva el ciclo con promedios mensuales. V1.0 refina a **tick diario**: acumulación de GDD, daño por helada/estrés térmico con *Crop Health Index* (CHI) y propagación de plagas de un cultivo a sus vecinos (monocultivo).

## Objetivo
Que el rendimiento final refleje el estrés acumulado día a día (hídrico, térmico, plaga), no solo la resta de balances.

## Funcionalidades
| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | GDD diario | `GDD = max(0, min(tmed, t_superior) − t_base)`; transición de etapa por GDD acumulado, no por calendario |
| 2 | CHI (Crop Health Index) | 0–100; decrece por: helada (`tmed < helada_letal`), ola de calor (`tmed > t_opt_max`), déficit hídrico, plaga |
| 3 | Daño térmico | Conteo de días-grado fuera del rango `[t_opt_min, t_opt_max]` → penalidad a CHI |
| 4 | Déficit hídrico | Fracción de días con `balance < 0` → reducción de crecimiento (ETc no cubierta) |
| 5 | Plagas | Evento plaga asigna `intensidad`; se propaga probabilísticamente a celdas vecinas con el **mismo cultivo** (monocultivo = mayor riesgo) |
| 6 | Yield por estrés | `yield = rendimiento_junin_2025 × CHI_medio/100 × factor_hídrico` mejorado (respecto al factor lineal del MVP) |

## Herramientas
TypeScript (dominio) · Zustand (CHI por celda) · React + Three.js solo como vista del CHI (color del mesh, overlay de estado).

## Arquitectura
`PhenologyController` orquesta el tick diario: GDD (Alcance 04) → fuentes de estrés → CHI → yield. Cada fuente de estrés es una estrategia que recibe el estado del día y devuelve una penalidad; el controller las combina y persiste en el store. La propagación de plagas es un evento de dominio que el controller procesa con la topología de vecinas.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Strategy | Estrés hídrico, térmico, helada y plaga como `EstrésSource` | Sumar/remover fuentes sin tocar el controller |
| Facade | `PhenologyController` (GDD + CHI + ETc + yield) | API simple para UI y tests |
| Observer | Evento "plaga" publicado a vecinas del mismo cultivo | Propagación probabilística desacoplada (EP-05.2) |
| State | CHI con estados Saludable/Estresado/Crítico/Muerto | Reglas visuales y de cosecha claras |
| Strategy | Transición por GDD acumulado vs calendario | Calibrable contra el ciclo de referencia |

## Reglas de negocio
- La transición de etapa usa GDD acumulado como fuente primaria; los días/etapa del archivo quedan como *cielo* (máximo) para calibrar.
- CHI nunca es negativo; 0 = pérdida total (la celda queda con planta muerta hasta Remover).
- Propagación: `P(vecino) = P_base × coef(plaga) × 1( mismo cultivo )` con radio 1–2 celdas.

## Datos de referencia
- `data/cultivos.json` → t_base, t_superior, t_opt, helada_letal, `rendimiento_junin_2025`.

## Validación (criterios de aceptación)
1. Escenario "Extremo seco × Papa": el CHI desciende en los meses de balance negativo y el yield final < 21.78 t/ha.
2. Una helada tipo `HELADA_METEOROLOGICA` bajo `helada_letal` reduce CHI ostensiblemente en las celdas afectadas.
3. Plaga en monocultivo se propaga a contiguos; un policultivo la contiene (mismo cultivo es condición).
4. Al remover un cultivo muerto, la celda vuelve a ararse/sembrarse.

## Fuera de alcance
- Erosión/deriva por pendiente (07), experimentos comparados (09), modelado de suelos por capas.

## Dependencias
- Alcances 04 y 05.