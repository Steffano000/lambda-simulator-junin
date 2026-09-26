# Paso 03 · Fase MVP · Dimensiones personalizables del grid

> EP: EP-01.1 (Parámetros de Grilla Espacial)

## Contexto
MVP arranca con una grilla fija de demo; el simulador debe ajustarse a parcelas de distintos tamaños. Este alcance hace la grilla **configurable y regenerable** sin recargar la página, y deja preparado el terreno para presets distintos (Alcance 08).

## Objetivo
Configurar filas × columnas antes de iniciar y regenerar la grilla en caliente conservando la configuración de cámara y escena.

## Funcionalidades
| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Preconfiguración N×M | Inputs de filas/columnas (rangos validados, ej. 3–100) antes de inicializar |
| 2 | Regeneración en vivo | Re-construir matriz lógica + mallas (cubos de 1 m³) de forma atómica |
| 3 | Presets de tamaño | Tamaños rápidos: Demo (10×10), Parcela (20×20), Microcuenca (40×40) |
| 4 | Ajuste de cámara | Recálculo de distancia/zoom límite según la diagonal del nuevo terreno |
| 5 | Reset | Volver al estado inicial (dimensiones, suelo, cámara) |

## Herramientas
React + TypeScript + Vite · Three.js (@react-three/fiber) · Zustand store (config del grid).

## Arquitectura
`GridConfig` (N, M, semilla, tamaño celda) vive en el store; el container `GridRoot` re-lee la config y recrea la escena de celdas al cambiar (Alcance 01). La regeneración es un **comando** que detiene el render loop, re-hidrata la matriz y relanza; cámara se ajusta por evento `grid-resized`.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Builder | Construcción de `GridConfig` (N×M + seed + presets de tamaño) | Config legible y validada antes de instanciar |
| Command | Comandos `RegenerateGrid`, `ResetGrid` | Reversible/auditable; base para undo |
| Observer | Evento `grid-resized` → reajuste de cámara | Desacoplar tamaño del terreno de la lógica de cámara |
| Registry de presets | Demo/Parcela/Microcuenca | Tamaños comunes como datos, no código |

## Reglas de negocio
- Regenerar destruye la escena de celdas y la reconstruye con el mismo `seed/config` → mapeo estado→malla siempre coherente.
- El estado de la simulación (humedad, cultivos) se reinicia con el nuevo tamaño; no se conserva por defecto.
- La celda mantiene su unidad 1 m³; N×M define el área de celdas, no el tamaño del cubo (ver `design.md`).

## Datos de referencia
- Ninguna nueva; usa la configuración de Alcance 01 y las clases de `terrenos.json` para el color de base.

## Validación (criterios de aceptación)
1. Cambiar 10×10→40×40 regenera en <1s sin recargar la página.
2. La cámara mantiene todo el terreno visible tras el cambio.
3. El reset vuelve a valores por defecto.

## Fuera de alcance
- Distribución procedural de suelos al regenerar (07), carga de presets completos (08).

## Dependencias
- Alcance 01.