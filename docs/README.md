# README — Alcances del simulador (flujo de ejecución 01 → 10)

Simulador web 3D de plantaciones andinas. Alimentado por datos reales en `data/` (cultivos, clima por escenarios, texturas de suelo). El núcleo de uso: **probar plantaciones** escogiendo cultivo, fecha de siembra y escenario climático (real o personalizado), y comparar resultados (ETc, balance hídrico, rendimiento).

## Enumeración = flujo de ejecución
Cada archivo se nombra `NN-nombre.md`: el número `NN` valida el **orden de implementación** (una fase se construye sobre las anteriores). La fase de entrega (MVP / V1.0 / Final) es una **etiqueta dentro del documento**, no parte del nombre.

| # (flujo) | Fase | Nombre | EPs | Datos |
|---|---|---|---|---|
| 01 | MVP | Grilla con bloques de tierra e información | 01.1, 01.2 | terrenos.json |
| 02 | MVP | Acciones por celda | 03.1(parcial), 05.1 | terrenos.json |
| 03 | MVP | Dimensiones personalizables del grid | 01.1 | — |
| 04 | MVP | Motor de datos reales: ciclo de cultivo **derivado** | 03.2, 04.1, 04.2 | cultivos.json, clima_escenarios.json |
| 05 | MVP | Escenarios climáticos y eventos JSON | 06.1, 06.2 | clima_escenarios.json |
| 06 | V1.0 | Fenología avanzada y estrés (GDD, helada, plagas) | 04.1, 04.2, 05.2 | cultivos.json |
| 07 | V1.0 | Topografía procedural y pisos ecológicos | 02.1, 02.2 | terrenos.json |
| 08 | V1.0 | Presets y casos estáticos de prueba | 08.1 | cultivos/clima/terrenos |
| 09 | V1.0 | Sandbox y experimentos de plantación | 09.1, 09.2 | meta.json |
| 10 | Final | Optimización y carga de datos | 07.1, 07.2 | — |

Cada fase es usable standalone: al llegar a la 05 el MVP ya permite sembrar, regar, cosechar y comparar bajo escenarios.

## Stack transversal
UI: **React + TypeScript + Vite** · 3D: **Three.js** con **@react-three/fiber** y **@react-three/drei** · Estado lógico: **Zustand** (única fuente de verdad; las mallas son vista proyectada) · Assets: **GLTFLoader + DRACOLoader** · Datos: JSON estáticos en `data/`. Cada alcance declara su arquitectura y patrones de diseño en su propio archivo.