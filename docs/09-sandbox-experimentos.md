# Paso 09 · Fase V1.0 · Sandbox y experimentos de plantación

> EPs: EP-09.1 (Panel de Control de Variables Ambientales) · EP-09.2 (Inspección y Edición Directa de Celdas)

## Contexto
El propósito del simulador: correr **pruebas de plantación** bajo escenarios reales o personalizados. Este alcance reúne el modo experimento: alterar variables en vivo, forzar estados de celdas y lanzar plantaciones comparadas (misma parcela × varios climas) exportables como casos de estudio.

## Objetivo
Modo latina: control ambiental en tiempo real, inspector/editor de celdas, **conversión de terrenos procedurales a lugares editables** y plantaciones comparadas exportables.

## Funcionalidades
| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Panel de variables | Sliders: temperatura ambiente, tasa de lluvia, radiación solar, incidencia de plagas |
| 2 | Control temporal | Pausa · 1x/5x/20x · Reset/rebobinado al estado inicial |
| 3 | Inspector de celda | Click (superficie o corte) → panel lateral con todos los valores internos (suelo + vegetación + CHI) |
| 4 | Edición forzada | Forzar humedad 100%, pH, eliminar plaga, etc.; el impacto se observa en los siguientes ticks |
| 5 | Plantación comparada | Correr **la misma plantación** con 1 + N escenarios (reales o personalizados del Alcance 05) en paralelo y comparar: ETc, balance, GDD, CHI, yield |
| 6 | Export/Import de caso | Descargar el estado del sandbox como JSON de caso de estudio; reimportarlo como preset (Alcance 08) |
| 7 | Convertir terreno procedural → editable | Congelar la topografía (Paso 07): commit de altitud+suelo al store editable, habilita herramientas (Paso 02) y edición directa; permite "lugares" (ocupaciones continuas) rediseñadas a gusto |

## Herramientas
React + TypeScript + Vite · Three.js (picking de celda) · Zustand (estado sandbox) · JSON export/import propio · Web Storage/local para casos temporales.

## Arquitectura
Dos capas: [Capa de edición] Inspector con `EditorService` que muta celdas vía comandos (con undo/redo en una pila de Mementos) y [Capa de experimentos] `ExperimentRunner` que clona celdas aisladas y corre la misma plantación bajo N escenarios en paralelo, alimentados por el mismo `FenologiaEngine` (Alcance 04). La conversión procedural→editable usa un comando `FreezeTerrain` que commitea la topografía al store y cambia el modo; el sandbox nunca escribe sobre `data/*.json`.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Command | Edición forzada (humedad, pH, plaga) como comandos | Undo/redo del modo experimento |
| Memento | Snapshot de celda antes de editar | Reversibilidad total |
| Observer | Panel inspector suscrito al store de la celda | Reflejo en vivo de cambios |
| Strategy | ExperimentRunner usa cada escenario como estrategia de clima | Comparativa 1+N sin código duplicado |
| Command | `FreezeTerrain` (convertir procedural → editable) y edición forzada | Una sola vía de commit; reversible con undo |
| Facade | `SandboxExporter/Importer` (JSON + meta) | Un solo punto de serialización robusta |

## Reglas de negocio
- Sandbox ≠ dato canónico: una edición forzada nunca escribe sobre `data/*.json`.
- La plantación comparada clona celdas aisladas (sin regular, sin plagas mutuas) para que la única variable sea el clima.
- El caso exportado debe incluir `meta` (unidades, fuentes — de `meta.json`) para ser interpretable.

## Datos de referencia
- `data/meta.json` → unidades (°C, mm, t/ha, días) y fuentes (FAO-56, AquaCrop, INIA…) para notación del inspector y pies de tabla.

## Validación (criterios de aceptación)
1. Los sliders cambian el clima aplicado al siguiente tick sin recargar.
2. Forzar pH 5.5 en una celda de Papa (óptimo 5–6.2) mejora su CHI; fuera del rango absoluto lo degrada.
3. Comparar Papa × {Normal, El Niño, Personalizado(más lluvia)} arroja una tabla con yield distinto y esperable (más lluvia → mejor balance, salvo exceso).
4. El caso exportado se reimporta y reproduce el mismo estado.

## Fuera de alcance
- Optimización de formatos de persistencia (10).

## Dependencias
- Alcances 04, 05, 06, 08.