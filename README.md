# Lambda Simulator

Simulador web 3D de plantaciones andinas (valle del Mantaro, Junín) alimentado por datos reales de cultivos, clima por escenarios y texturas de suelo. El núcleo del uso es **probar plantaciones**: elegir cultivo, fecha de siembra y escenario climático (real o personalizado), y comparar ETc, balance hídrico y rendimiento.

## Stack

| Capa    | Herramienta                                                       |
| ------- | ----------------------------------------------------------------- |
| UI      | React 19 · TypeScript · Vite                                      |
| 3D      | Three.js · @react-three/fiber · @react-three/drei                 |
| Estado  | Zustand (única fuente de verdad; las mallas son vista proyectada) |
| Estilos | Tailwind CSS v4 con tokens compartidos con Three.js               |
| Assets  | GLTFLoader + DRACOLoader                                          |
| Calidad | ESLint · Prettier · Vitest · GitHub Actions                       |
| Datos   | JSON estáticos en `data/`                                         |

## Inicio rápido

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | Qué hace                                  |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                    |
| `npm run build`     | Typecheck + build de producción           |
| `npm test`          | Tests unitarios (Vitest)                  |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | Chequeo de tipos                          |
| `npm run format`    | Prettier (ordena también clases Tailwind) |

## Estructura

Arquitectura **MVC** en capas unidireccionales. Cada módulo de `src/domain` corresponde a un paso del flujo de `docs/`.

| Capa        | Carpeta                   | Responsabilidad                                                                   |
| ----------- | ------------------------- | --------------------------------------------------------------------------------- |
| Modelo      | `src/domain`, `src/store` | Clases de dominio (fábricas, comandos, entidades) y estado de la simulación       |
| Controlador | `src/controllers`         | Traduce las intenciones de la vista en llamadas al dominio y confirma en el store |
| Vista       | `src/ui`, `src/scene`     | React y Three.js: leen el store y delegan cada acción al controlador              |

`src/app/container.ts` es la raíz de composición: crea una sola vez las fábricas y servicios con los datos de los repositorios. Ningún archivo de lógica supera las **400 líneas**.

| Patrón                    | Dónde                                                                        |
| ------------------------- | ---------------------------------------------------------------------------- |
| Factory / Registry        | `CropFactory`, `ClimateScenarioFactory`, `CommandFactory`, `materialFactory` |
| Command + Template Method | `TileCommand` y sus herramientas (`commands.ts`)                             |
| Facade                    | `ActionsService`: único punto que escribe el estado agronómico               |
| Strategy                  | `ClimateScenario` (escenarios intercambiables) · herramienta activa          |
| State                     | Ciclo de la celda: Baldío → Arado → Sembrado → Maduro → Cosechado            |

```
Lambda-simulator/
├── data/                     JSON canónicos (cultivos, clima, terrenos, meta). Nunca se reescriben
├── docs/                     Especificación: README, spec, design y pasos 01 → 10
├── public/
│   ├── models/crops/         .glb de cultivos por etapa (EP-01.2)
│   ├── models/terrain/       .glb de rocas, canales…
│   └── draco/                Decodificador DRACO
├── scripts/
│   └── derivar_ciclos.py     Referencia auditable del motor fenológico (paso 04)
├── src/
│   ├── app/                  App + container.ts (raíz de composición / DI)
│   ├── controllers/          CONTROLADOR: SimulationController + hooks de lectura
│   ├── data/                 Repositories tipados sobre data/*.json
│   ├── domain/               TypeScript PURO: sin React, Three ni store
│   │   ├── shared/           Command, EventBus, PRNG determinista
│   │   ├── grid/             01 · 03  TileNode, GridConfig (Builder), createGrid
│   │   ├── soil/             01 · 02  Reglas físicas del suelo (CC/PMP)
│   │   ├── actions/          02       TileCommand, CommandFactory, ActionsService
│   │   ├── crops/            04       Crop, CropFactory (etapas, zonificación)
│   │   ├── climate/          05       ClimateScenario, ClimateScenarioFactory
│   │   ├── simulation/       04       SimulationClock (avance de días)
│   │   ├── stress/           06       GDD diario, CHI, fuentes de estrés
│   │   ├── terrain/          07       Ruido, pisos ecológicos, TerrainGenerator
│   │   ├── presets/          08       Registry de casos A/B/C
│   │   ├── sandbox/          09       Experimentos, editor, FreezeTerrain
│   │   └── persistence/      10       Codecs compacto/RLE/gzip
│   ├── store/                MODELO de estado: slices de grilla y simulación (Zustand)
│   ├── scene/                VISTA 3D: GridRoot, PlantsLayer (instancing), cámara, assets
│   ├── ui/                   VISTA: panels/ (escenario, cultivos, herramientas, tiempo), components/
│   ├── theme/                tokens.ts (paleta) + ramps.ts (estado → color)
│   ├── styles/               index.css (Tailwind + variables de tema)
│   └── workers/              Web Workers (parseo de JSON pesados)
├── tailwind.config.ts        Tema Tailwind generado desde src/theme/tokens.ts
└── .github/                  CI, plantillas de issue por fase y de PR
```

## Flujo de implementación

| #   | Fase  | Paso                                       | Estado                                                   |
| --- | ----- | ------------------------------------------ | -------------------------------------------------------- |
| 01  | MVP   | Grilla con bloques de tierra e información | Base lista                                               |
| 02  | MVP   | Acciones por celda                         | Implementado                                             |
| 03  | MVP   | Dimensiones personalizables del grid       | Base lista                                               |
| 04  | MVP   | Motor de datos reales: ciclo derivado      | Parcial: etapas y zonificación; falta ETc/balance/yield  |
| 05  | MVP   | Escenarios climáticos y eventos JSON       | Parcial: selector de escenarios; faltan eventos y editor |
| 06  | V1.0  | Fenología avanzada y estrés                | Contratos                                                |
| 07  | V1.0  | Topografía procedural y pisos ecológicos   | Contratos                                                |
| 08  | V1.0  | Presets y casos estáticos                  | Contratos                                                |
| 09  | V1.0  | Sandbox y experimentos                     | Contratos                                                |
| 10  | Final | Optimización y carga de datos              | Contratos                                                |

"Contratos" significa que las interfaces del módulo ya están definidas según su documento y que la implementación está marcada con `TODO(paso-NN)`.

## Sistema visual (Tailwind + Three.js)

`src/theme/tokens.ts` es la **única fuente de color** (ver `docs/design.md`). La leen tanto Tailwind, para la interfaz, como Three.js, para la grilla, así que la leyenda y el bloque 3D siempre coinciden.

| Token     | Clases de ejemplo                      | Uso                                             |
| --------- | -------------------------------------- | ----------------------------------------------- |
| `soil`    | `bg-soil-franco`, `bg-soil-arcilla`    | Clases de suelo: arena clara → arcilla oscura   |
| `surface` | `bg-surface-agua`, `bg-surface-roca`   | Agua, roca, nieve (reservados, EP-02.2)         |
| `humedad` | `bg-humedad-0` … `bg-humedad-100`      | Rampa azul de humedad                           |
| `chi`     | `bg-chi-25`, `text-chi-critico`        | Salud del cultivo: rojo → ámbar → verde azulado |
| `div`     | `bg-div-n2`, `bg-div-p1`               | pH y N-P-K (divergente: frío ↔ cálido)          |
| `etapa`   | `bg-etapa-siembra`, `bg-etapa-cosecha` | 1 color por etapa fenológica (Okabe-Ito)        |
| `ui`      | `bg-ui-panel`, `text-ui-ink-muted`     | Interfaz con tema claro/oscuro                  |

Todas las rampas son aptas para daltonismo y el color nunca va solo: siempre lo acompaña una leyenda y el valor numérico.

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para la metodología de ramas, commits y reglas de arquitectura.
