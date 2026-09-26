# Paso 04 · Fase MVP · Motor de datos reales: ciclo de cultivo derivado

> EPs: EP-03.2 (Zonificación y Restricciones de Cultivo) · EP-04.1 (Modelo Fenológico) · EP-04.2 (Consumo de Recursos y Evapotranspiración)

## Contexto — decisión de datos
El MVP usa **`cultivos.json` como única fuente de cultivo**; no existe `ciclos.json` en `data/`. Todos los valores del ciclo (meses, etapas, Kc por mes, ETc, balance hídrico) son **derivados en runtime** a partir de:

- `cultivos.json` → parámetros fenológicos (días por etapa, Kc por etapa, t_base, mes_siembra, kc de referencia).
- `clima_escenarios.json` → ETo y lluvia mensual del escenario activo.

La derivación vive en `scripts/derivar_ciclos.py` (mismo método del motor, en Python, para auditar/generar el ciclo bajo demanda). Convención: mes de ciclo = span de 30.42 días (`365/12`) desde `mes_siembra`, con `fraccion_mes` para el mes final parcial.

## Objetivo
Dado un cultivo, fecha de siembra y escenario climático: evolucionar el cultivo día a día (etapa, Kc, ETc, balance hídrico) y obtener rendimiento al cosechar, **sin datos pre-computados**.

## Funcionalidades de derivación
| # | Cálculo | Fórmula / método |
|---|---|---|
| 1a | Curva Kc diaria | Piecewise lineal FAO-56: `Kc_inicial` en fase inicial → rampa a `Kc_medio` en desarrollo → constante en media → rampa a `Kc_final` en final |
| 1b | Etapa del día | Acumular días contra `dias_inicial/desarrollo/media/final` |
| 2 | Kc mensual | Promediar Kc diario de los días del mes cubiertos por el ciclo |
| 3 | ETc mensual | `ETc = Kc̄ × ETo(mes, escenario)`; acumula fracciones de mes parcial (borde inicial/final) |
| 4a | Balance hídrico | `balance = lluvia(mes) − ETc(mes)`; acumulado por cultivo y escenario |
| 4b | Partición por meses | Mes de ciclo = span de 30.42 días desde `mes_siembra` → N meses por ciclo según `ciclo_dias` |
| 5 | GDD (base V1.0) | `GDD = max(0, tmed − t_base)` acumulado por día |
| 6 | Rendimiento | `yield = rendimiento_junin_2025 × factor(balance hídrico acumulado)`; factor = 1 si balance ≥ 0, escala lineal hasta 0 en déficit severo |

## Herramientas
TypeScript (núcleo de dominio puro, sin UI) · Zustand store para estado por celda · `scripts/derivar_ciclos.py` como referencia auditable de la derivación.

## Arquitectura
Servicio de dominio `FenologiaEngine` = **función pura y sin estado**: `estado(día, cultivo, climaCelda) → {etapa, kc, gdd, etc, yield, bloqueos}`. Es el único consumidor de `cultivos.json` (vía capa de datos `CropRepository`). Cada celda llama al motor con su clima; como es puro, es barato, trazable y reproducible celda a celda. UI solo suscribe el resultado.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Strategy | Estrategias de curva Kc (promedio mensual vs tick diario) y partición de meses inter-cambiables | Cambiar de convención sin reescribir el motor |
| Strategy | Cálculo de yield (factor lineal MVP → CHI en V1.0) | Evolucionar sin tocar el flujo |
| Template Method | Fases (Inicial→Desarrollo→Media→Final) avanzan con método plantilla | Estructura fija, etapa concretable |
| Repository | `CropRepository` (lee cultivos.json) y clima | JSONs no se leen en el motor; se inyectan |
| Pure Service / DI | Motor sin estado, dependencias inyectadas | Testable contra `scripts/derivar_ciclos.py` |

## Reglas de negocio
- Zonificación: sembrar se bloquea si la celda no cumple `ph_opt_min/max`, temperatura `t_opt_min/max`, y el mes de siembra ≠ `mes_siembra` del cultivo.
- Helada (umbral `helada_letal`) aplica daño → en MVP reduce yield directamente; en V1.0 (Alcance 06) alimenta CHI.
- Un cultivo puede sembrarse a la vez en N celdas/escenarios: la derivación es función pura `(cultivo, día, escenario) → estado` (reutilizable por todas las celdas, barata).

## Datos de referencia
- `data/cultivos.json` → días por etapa, Kc, t_base/t_superior, pH, helada, `rendimiento_junin_2025`, `mes_siembra`.
- `data/clima_escenarios.json` → `et0`, `lluvia`, `tmed`, `tmin` mensuales del escenario.

## Validación (criterios de aceptación)
1. Sembrar Papa el mes correcto avanza Inicial→Desarrollo→Media→Final y cosecha con yield ≈ 21.78 t/ha × factor.

## Fuera de alcance
- Estrés por helada/plagas con CHI por día (06), topografía afectando temperatura (07), comparación entre escenarios (09).

## Dependencias
- Alcance 02 (sembrar/cosechar disparan el motor).