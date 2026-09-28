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

## Flujo de uso

**Terreno → Acciones → Tratamiento → Validación → Cultivos → Plantación → Estado de plantación → Contexto ambiental → Avance del tiempo → Cosecha**

1. **Terreno** (inicio obligatorio): clase de suelo, reacción (pH) y tamaño. Define la textura, las acciones posibles y los cultivos aptos.
2. **Acciones**: solo se muestran las que corresponden al terreno y a su estado. Al pasar el cursor sobre una acción se ven sus efectos, prerrequisitos, la condición del terreno, a qué cultivo sirve y si hace falta antes de plantar.
3. **Tratamiento por área**: un clic selecciona una celda y arrastrar selecciona un área cuadrada. Las celdas que no cumplen se omiten y se explica por qué. La cámara gira con clic derecho.
4. **Validación**: por cultivo, cada celda se marca como lista o por tratar, con el requisito que falta resaltado en rojo.
5. **Corrección** (flujo alternativo): "Corregir" vuelve a tratamientos con las celdas pendientes seleccionadas y el tratamiento sugerido; al terminar, "Volver a cultivos".
6. **Plantación**: se planta solo en las celdas listas; las demás no bloquean.
7. **Paneles únicos**: _Plantaciones_ (estado, evolución, condiciones, cosecha) y _Contexto ambiental_ (escenario, clima del mes, modificadores, efectos del último avance).
8. **Tiempo**: iconos para saltos de +1, +7, +15 y +30 días, más un control central − / N días / + / Avanzar.
9. **Cosecha**: en el paso 4 se recolectan las celdas maduras y se abre el **informe de recolección**:
   - Las acciones hechas en el área, con cuántas veces y en cuántas celdas se aplicaron, y en qué días.
   - Los insumos usados: abono, cal, azufre, semilla y mano de obra. El agua se cuenta como **tiempo de riego** (horas).
   - El gasto total, lo recuperado al vender y el balance.
   - Qué hacer con el suelo: **dejarlo descansar** los días que pide el cultivo (barbecho) o **rotar** a un cultivo de otra familia que pida menos nitrógeno. Las leguminosas, como la haba, van primero.

   La cosecha se lleva nitrógeno del suelo (la haba lo aporta) y el descanso lo recupera día a día. Las dosis y los precios son supuestos editables en `src/domain/economy/insumos.ts`.

Al seleccionar una celda se abren dos paneles: uno de la **celda** (suelo, surcos, agua y química) y otro del **cultivo** (miniatura 3D, etapa, salud, agua para el cultivo, estrés de hoy y rendimiento estimado).

### Clima: escenarios y sandbox

Se abre con el botón **Clima** de la barra superior y también desde el paso Terreno o el panel de ambiente.

- **Escenarios:** galería de los 5 escenarios reales y de los personalizados. Cada tarjeta muestra la lluvia y la ET0 mensuales, los totales anuales, los meses con déficit y la temperatura mínima. El escenario se cambia en cualquier momento y aplica desde el siguiente día simulado.
- **Comparativa por cultivo:** ETc, lluvia y balance hídrico del ciclo completo en cada escenario. Reproduce los totales de `docs/spec.md` con menos de 1.5 % de diferencia, y hay tests que lo verifican.
- **Sandbox climático:** crea un escenario a partir de cualquier otro. Tiene tres modificadores globales (lluvia ×%, ET0 ×% y temperatura +Δ °C) y una tabla editable por mes, donde lo editado a mano tiene prioridad. Muestra gráficas de agua y temperatura comparadas con la base, y valida rangos y que tmin ≤ tmed.
- **Guardar e intercambiar:** los escenarios propios se guardan en el navegador (`localStorage`) y se pueden exportar o importar en el formato de `data/clima_escenarios.json`. Los JSON inválidos se reportan sin romper la aplicación.

Los prerrequisitos salen de `data/cultivos.json`:

- **pH:** `ph_opt_min` y `ph_opt_max`.
- **Humedad:** mínima = (1 − `p_agotamiento`) × 100, según FAO-56.
- **Nitrógeno:** según `efecto_nitrogeno`; la Haba lo fija, así que no exige mínimo.
- **Materia orgánica:** se exige cuando `textura_preferida` dice "orgánica".
- **Textura del terreno:** debe coincidir con `textura_preferida`.

Las cantidades de cada tratamiento y las tasas de salud son parámetros de simulación provisionales, agrupados como constantes en `commands/tratamientos.ts`, `crops/requirements.ts` y `stress/sources.ts`.

## Estructura

Arquitectura **MVC** en capas unidireccionales. Cada módulo de `src/domain` corresponde a un paso del flujo de `docs/`.

| Capa        | Carpeta                   | Responsabilidad                                                                   |
| ----------- | ------------------------- | --------------------------------------------------------------------------------- |
| Modelo      | `src/domain`, `src/store` | Clases de dominio (fábricas, comandos, entidades) y estado de la simulación       |
| Controlador | `src/controllers`         | Traduce las intenciones de la vista en llamadas al dominio y confirma en el store |
| Vista       | `src/ui`, `src/scene`     | React y Three.js: leen el store y delegan cada acción al controlador              |

`src/app/container.ts` es la raíz de composición: crea una sola vez las fábricas y servicios con los datos de los repositorios. Ningún archivo de lógica supera las **400 líneas**.

| Patrón                    | Dónde                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Factory / Registry        | `TerrainFactory`, `CropFactory`, `RequirementFactory`, `ClimateScenarioFactory`, `CommandFactory`, `materialFactory` |
| Command + Template Method | `TileCommand` → `commands/tratamientos.ts` y `commands/plantacion.ts`                                                |
| Facade                    | `ActionsService` (único punto de escritura) · `HealthModel` · `PlantingValidator`                                    |
| Strategy                  | `ClimateScenario` · fuentes de estrés (`StressSource`) · herramienta activa                                          |
| State                     | Ciclo de la celda: Baldío → Arado → Sembrado → Maduro → Cosechado                                                    |
| MVC                       | `BaseController` → Terrain/Selection/Treatment/Planting/TimeController                                               |

```
Lambda-simulator/
├── data/                     JSON canónicos (cultivos, clima, terrenos, mezclas de suelos, meta). Nunca se reescriben
├── docs/                     Especificación: README, spec, design y pasos 01 → 10
├── public/
│   ├── models/crops/         .glb de cultivos por etapa (EP-01.2)
│   ├── models/terrain/       .glb de rocas, canales…
│   └── draco/                Decodificador DRACO
├── scripts/
│   └── derivar_ciclos.py     Referencia auditable del motor fenológico (paso 04)
├── src/
│   ├── app/                  App + container.ts (raíz de composición / DI)
│   ├── controllers/          CONTROLADOR: un controlador por etapa del flujo + hooks de lectura
│   ├── data/                 Repositories tipados sobre data/*.json
│   ├── domain/               TypeScript PURO: sin React, Three ni store
│   │   ├── shared/           Command, EventBus, PRNG determinista
│   │   ├── grid/             01 · 03  TileNode, GridConfig (Builder), createGrid
│   │   ├── soil/             01 · 02  Reglas físicas del suelo (CC/PMP)
│   │   ├── actions/          02       TileCommand, comandos, CommandFactory, ActionsService, PlantingValidator
│   │   ├── crops/            04       Crop (etapas, Kc FAO-56), CropFactory, requisitos de siembra
│   │   ├── climate/          05       ClimateScenario(Factory), ScenarioBuilder, ScenarioCodec, EnvironmentModel
│   │   ├── simulation/       04       SimulationClock (balance hídrico diario, salud, etapas)
│   │   ├── stress/           06       Fuentes de estrés (Strategy) y HealthModel (CHI)
│   │   ├── plantation/       04 · 06  PlantationService (resumen, evolución, condiciones)
│   │   ├── terrain/          01 · 07  TerrainProfile, TerrainFactory, SoilMix + reparto por manchas (+ contratos procedurales)
│   │   ├── presets/          08       Registry de casos A/B/C
│   │   ├── sandbox/          09       Experimentos, editor, FreezeTerrain
│   │   └── persistence/      10       Codecs compacto/RLE/gzip
│   ├── store/                MODELO de estado: slices de grilla y simulación (Zustand)
│   ├── scene/                VISTA 3D: GridRoot (selección por área), PlantsLayer, SelectionLayer, cámara
│   ├── ui/                   VISTA: steps/ (terreno, tratamiento, cultivos), panels/ (ambiente,
│   │                         plantaciones), components/ (TimeBar, FlowStepper, SelectionCard…)
│   ├── theme/                tokens.ts (paleta) + ramps.ts (estado → color)
│   ├── styles/               index.css (Tailwind + variables de tema)
│   └── workers/              Web Workers (parseo de JSON pesados)
├── tailwind.config.ts        Tema Tailwind generado desde src/theme/tokens.ts
└── .github/                  CI, plantillas de issue por fase y de PR
```

## Flujo de implementación

| #   | Fase  | Paso                                       | Estado                                                                            |
| --- | ----- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| 01  | MVP   | Grilla con bloques de tierra e información | Base lista                                                                        |
| 02  | MVP   | Acciones por celda                         | Implementado                                                                      |
| 03  | MVP   | Dimensiones personalizables del grid       | Base lista                                                                        |
| 04  | MVP   | Motor de datos reales: ciclo derivado      | Parcial: etapas, Kc, ETc y balance diario; falta contrastar con derivar_ciclos.py |
| 05  | MVP   | Escenarios climáticos y eventos JSON       | Parcial: selector, comparativa y sandbox/editor; faltan eventos JSON (heladas…)   |
| 06  | V1.0  | Fenología avanzada y estrés                | Parcial: CHI y estrés hídrico/térmico/helada/anegamiento; faltan GDD y plagas     |
| 07  | V1.0  | Topografía procedural y pisos ecológicos   | Contratos                                                                         |
| 08  | V1.0  | Presets y casos estáticos                  | Contratos                                                                         |
| 09  | V1.0  | Sandbox y experimentos                     | Contratos                                                                         |
| 10  | Final | Optimización y carga de datos              | Contratos                                                                         |

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

## Licencia y Atribución

Este proyecto está bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

### Cómo citar / referenciar este proyecto
Si utilizas este simulador o su código base en investigaciones, trabajos académicos o desarrollos derivados, por favor otorga la correspondiente atribución incluyendo la siguiente cita o enlace:

> **Lambda Simulator** (2026). Simulador web 3D de plantaciones andinas (valle del Mantaro).  
> Autores: UmbraFlare.  
> Repositorio: [https://github.com/UmbraFlare-code/Lambda-simulator](https://github.com/UmbraFlare-code/Lambda-simulator)

