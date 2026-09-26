# Paso 07 · Fase V1.0 · Topografía procedural y pisos ecológicos

> EPs: EP-02.1 (Generación de Topografía y Microclimas Andinos) · EP-02.2 (Distribución Procedural de Suelos y Agua)

## Contexto
MVP asigna suelos de forma plana/manual. V1.0 genera relieve y distribución de suelo por ruido con semilla, y conecta altitud → piso ecológico → temperatura (que alimenta el GDD del Alcance 06) → compatibilidad de cultivo.

## Objetivo
Generar un terreno andino procedural (Yunga, Quechua, Suni, Puna) con suelos y agua coherentes, regenerable por semilla. El relieve se representa con la altura del cubo (Y) de cada celda de 1 m³; el terreno es **inmutable por defecto** y solo se vuelve editable al convertirse al modo sandbox (Paso 09).

## Funcionalidades
| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Relieve procedural | Perlin/Simplex con `seed` → `altitud(x,z)` por celda |
| 2 | Pisos ecológicos | Mapeo altitud → piso → `temperatura_base` y presión de la celda |
| 3 | Clasificación de suelo | Altitud + pendiente → lecho de río/vertiente, fértil, arcilloso, rocoso, helada/nieve; mapea a clases de `terrenos.json` |
| 4 | Microclima derivado | `tmed_celda = tmed_escenario + gradiente(piso)`, usado por GDD y helada |
| 5 | Regeneración por semilla | Cambiar la semilla → nuevo terreno sin tocar configuración del motor |
| 6 | Erosión (regla) | "A mayor pendiente × lluvia intensa, mayor pérdida de nutrientes sin cobertura" → resta N-P-K cuando no hay vegetación |
| 7 | Export/Import ligero | Estado inicial del terreno (altitud + suelo por celda) en JSON optimizado (Alcance 10) |
| 8 | Relieve con cubos | `altitud(x,z)` → posición Y del cubo 1 m³ (pila de terreno visible en corte); perfil minimalista de `design.md` |
| 9 | Inmutable hasta convertir | El terreno procedural solo se edita tras **Convertir a sandbox** (Paso 09); mientras, la semilla define todo |

## Herramientas
TypeScript (algoritmos de ruido y clasificación, puros) · Three.js (elevación de mallas por altitud) · Zustand (altitud/suelo por celda).

## Arquitectura
Generador procedural = pipeline puro e inyectable: `seed → Noise → altitud(x,z) → pisoEcológico → clasificación de suelo → tmed_celda`. Cada etapa es una función con interface, encadenadas por `TerrainGenerator`; alimenta el store y las mallas se elevan leyendo la altitud (Alcance 01). Determinista: misma seed → mismas salidas en todas las etapas.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Strategy | Algoritmo de ruido (Perlin vs Simplex) como `NoiseStrategy` | Semilla/config sin acoplarse a un ruido concreto |
| Strategy | Clasificador de suelo por altitud + pendiente | Validar reglas de pisos ecológicos aisladamente |
| Factory | Terreno y microclima por piso ecológico (Yunga, Quechua, Suni, Puna) | Composición coherente por piso |
| Builder/Pipeline | `TerrainGenerator` encadena etapas inyectadas | Testable etapa por etapa; añadir etapas sin tocar callers |
| Registry | Semillas y pisos registrados | Presets deterministas (base Alcance 08) |

## Reglas de negocio
- Determinismo: misma seed → mismo mapa.
- El terreno procedural es **de solo lectura**: las herramientas del Paso 02 se habilitan recién cuando se convierte a lugares editables en el sandbox (Paso 09), evitando dos fuentes de verdad.
- La altitud afecta la zonificación de cultivos del EP-03.2: un cultivo de valle no germina en Puna (se bloquea siembra con motivo).
- La erosión requiere suelo sin cobertura vegetal y pendiente > umbral.

## Datos de referencia
- `data/terrenos.json` → clases para la clasificación por altitud/pendiente.
- `data/clima_escenarios.json` → base térmica sobre la que se aplica el gradiente de piso.

## Validación (criterios de aceptación)
1. Misma seed → mapa idéntico (test determinista).
2. Celdas altas = Puna (rocoso/helada); cauces = agua/vertiente; valles = fértil; la altura del cubo refleja la altitud.
3. Cambiar la semilla regenera sin alterar configuración.
4. La erosión reduce N-P-K en laderas sin cobertura tras lluvias intensas.
5. Antes de "Convertir a sandbox", las herramientas de edición están deshabilitadas sobre el terreno procedural.

## Fuera de alcance
- Presets contradictorios con el procedimiento (08), micro-topografía fina (meso-relieve).

## Dependencias
- Alcances 01, 04, 06.