# Paso 08 · Fase V1.0 · Presets y casos estáticos de prueba

> EP: EP-08.1 (Escenarios Preconfigurados de Prueba / Benchmarks)

## Contexto
Para validación académica y demos se necesitan mapas estáticos reproducibles con suelos, clima y siembras fijas. También sirven de benchmark (Alcance 09 compara presets).

## Objetivo
Cargar en un click un mapa pre-diseñado y bien parametrizado, determinista entre ejecuciones.

## Funcionalidades
| # | Preset | Suelo / clima | Siembra recomendada |
|---|---|---|---|
| 1 | Caso A — Valle Interandino | Fértil (Franco/Franco arcilloso), clima templado | Maíz / Papa |
| 2 | Caso B — Altiplano / Puna | Alta radiación, t bajas, riesgo de helada | Quinua / Cañihua |
| 3 | Caso C — Ladera / Terraza | Pendiente pronunciada, andenería, alta erosión sin control | Papa nativa con terrazas |

## Funcionalidades de sistema
| # | Funcionalidad | Detalle |
|---|---|---|
| 4 | Carga del preset | Re-inicializa tamaño (Alcance 03), suelo/topografía (07), clima (05) y siembras fijas |
| 5 | Parámetros fijos | Posiciones de suelo, clima y cultivos pre-sembrados con parámetros inmutables por defecto |
| 6 | Guardar como preset | Exportar el estado actual de la grilla a un preset reutilizable (vía Alcance 09) |

## Herramientas
React + TypeScript + Vite · Zustand (estado preseteado) · JSON schema mínimo propio para el formato de preset.

## Arquitectura
`PresetRegistry` (registro estático) mapea id → función builder que construye un estado completo (grilla, suelo, clima, siembras). `PresetLoader` orquesta: tamaño (03) → topografía/suelo (07) → clima (05) → siembras (04). El estado se construye **fuera** del store y se aplica de una vez (single commit), garantizando determinismo.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Registry + Factory | `PresetRegistry` → `PresetFactory` por caso (Valle/Altiplano/Ladera) | Nuevos presets = datos, no ramas |
| Builder | `PresetBuilder` por pasos (suelo→clima→siembras) | Encadenar fases del simulador |
| Memento | Snapshot del estado para restaurar/re-ejecutar | Benchmarks y validación determinista |
| Strategy | Cargar preset desde catálogo o desde export (Alcance 09) | Una sola vía de carga |
| Command | `LoadPreset` ejecuta el builder y comitea el store | Reversible via Memento |

## Reglas de negocio
- Un preset no modifica los JSON canónicos de `data/`; es una capa de configuración sobre ellos.
- Los presets deben seguir siendo reproducibles con la misma seed (Alcance 07).

## Datos de referencia
- `data/cultivos.json`, `data/clima_escenarios.json`, `data/terrenos.json` → parametrizar los 3 casos.

## Validación (criterios de aceptación)
1. Cada preset carga en un click con su siembra ya presente.
2. Dos ejecuciones del mismo preset producen el mismo estado final (tolerancia numérica).
3. Caso B rechaza Maíz por incompatibilidad de altitud/temperatura (Alcance 04/07).

## Fuera de alcance
- Experimentos comparados entre presets (09), editor visual de presets.

## Dependencias
- Alcances 01–07.