# Paso 02 · Fase MVP · Acciones por celda

> EPs: EP-03.1 (Dinámica Física del Suelo Andino, base) · EP-05.1 (Interacciones del Usuario / Herramientas)

## Contexto
El usuario modifica el terreno y los cultivos tocando cada bloque. Este alcance convierte la grilla pasiva (Alcance 01) en un terreno manipulable: preparar, fertilizar, regar, sembrar y cosechar. La siembra aquí es un *stub* que marca `vegetacionId`; el crecimiento real llega en Alcance 04.

## Objetivo
Aplicar acciones por celda con validación de precondiciones y propagación de efectos hídricos a celdas adyacentes.

## Funcionalidades
| # | Herramienta | Precondición | Efecto |
|---|---|---|---|
| 1 | Arar | Sin cultivo maduro (o tras cosechar) | Suelo listo para siembra; descompacta |
| 2 | Abonar (orgánico/químico) | Suelo arado | +N, +P, +K y/o +Materia Orgánica según tipo |
| 3 | Regar | Suelo seco / cultivo estresado | +humedad hasta CC (según clase de suelo) |
| 4 | Instalar canal de riego | Celdas libres contiguas | +humedad residual en radio R según pendiente (gradiente) |
| 5 | Sembrar | Suelo arado, cultivo compatible (Alcance 04) | `vegetacionId = cultivo`; arranca ciclo día 0 |
| 6 | Cosechar | Cultivo en etapa Final (Alcance 04) | +yield; libera la celda |
| 7 | Remover cultivo | Cualquier vegetación | Limpia la celda (no conserva nada) |

## Herramientas
React + TypeScript + Vite · Three.js (@react-three/fiber) para selección por raycaster · Zustand store para acciones y estado por celda.

## Arquitectura
La UI (toolbar) nunca muta celdas directo: lanza **comandos** hacia una fachada de dominio `ActionsService` que valida precondiciones y muta el store de celdas; el store emite el cambio (Observer) al raycaster/UI. `ActionsService` es el único punto que escribe el estado agronómico de una celda → centraliza las reglas del EP-05.1 (misma validación para UI y tests).

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Command | Cada herramienta (arar, abonar, regar…) = comando con `canExecute()`/`execute()` | Validación de precondiciones antes de mutar; habilita undo/redo luego |
| Strategy | Toolbase seleccionada desde el toolbar | Intercambiar herramienta sin condicionales |
| State | Estados de celda: Baldío → Arado → Sembrado → Maduro → Cosechado | Transiciones válidas explicitadas como máquina de estados |
| Facade | `ActionsService` | Un solo punto de escritura y reglas |
| Observer (eventos de dominio) | Propagación de canal de riego por gradiente | Efecto contiguo desacoplado de la acción origen |

## Reglas de negocio
- Regla central: **no se arranca/siembra una celda ocupada sin acción previa válida**; cada acción valida y consume estado.
- Riego respeta CC/PMF de la clase de suelo (`terrenos.json`): no se puede inundar una arenosa igual que una arcillosa.
- Propagación del canal: humedad decrece con la distancia y se cancela con pendiente contraria (gradiente), base del EP-05.2.

## Datos de referencia
- `data/terrenos.json` → CC_min/CC_max, PMF_min/PMF_max, agua útil por clase (límites de riego y humedad residual).

## Validación (criterios de aceptación)
1. Cada acción inválida se bloquea mostrando el motivo (ej. "Coseche antes de arar").
2. Abonar incrementa N-P-K/M.O. en la celda objetivo, visible en el inspector (Alcance 01).
3. Un canal eleva la humedad de vecinas de forma gradual y decreciente con la distancia.
4. Sembrar solo con arado previo.

## Fuera de alcance
- Crecimiento fenológico y rendimiento real (04), plagas (06), erosión por pendiente (07).

## Dependencias
- Alcance 01.