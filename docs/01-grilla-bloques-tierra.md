# Paso 01 · Fase MVP · Grilla con bloques de tierra e información

> EPs: EP-01.1 (Inicialización, Estructura Lógico-Espacial 3D y Renderizado) · EP-01.2 (Gestión y Carga de Assets 3D)

## Contexto
Fundación visual y lógica del simulador: la grilla 3D es el lienzo donde el usuario ubica todo lo demás. Aquí se define el *TileNode* que toda fase posterior lee y escribe.

## Objetivo
Renderizar una grilla N×M de bloques cúbicos de **1 m × 1 m × 1 m** (plane XZ), con **presentación dinámica**: cara superior = superficie del terreno, y vista interior (corte vertical) para inspeccionar el suelo, todo en estilo **minimalista** (ver `design.md`). Exponer la información interna de cada celda a pedido.

## Funcionalidades
| # | Funcionalidad | Entrada | Salida |
|---|---|---|---|
| 1 | Inicializar matriz lógica N×M | Dimensiones `(N,M)`, lista de clases de suelo | Matriz de `TileNode`: `{id, coords, suelo, humedad, vegetacionId, position3D}` |
| 2 | Instanciar mallas | TileNode por celda | `meshTerrain` = cubo **1×1×1 m** y `meshPlant` (si hay vegetación) en escena Three.js |
| 3 | Presentación dinámica del terreno | Estado de la celda (suelo, humedad, pH, cultivo) | El bloque re-renderiza por estado: color de cara superior, overlay de humedad, altura = elevación (Y) |
| 4 | Vista superior + interior | Toggle de modo visual | Cara superior (superficie viva) ↔ **corte vertical** mostrando capas internas del suelo (perfil minimalista) |
| 5 | Estilo minimalista | Consulta de `design.md` | Materiales flat/low-poly, 1 material por metacategoría, sin texturas innecesarias, para optimizar fps y legibilidad |
| 6 | Cámara sandbox | Canvas objetivo | `PerspectiveCamera` + `OrbitControls`, vista isométrica/God-View, zoom y colisión con el plano base |
| 7 | Inspección de celda | Click/pointer sobre bloque (en corte o superficie) | Panel/mostrador: textura, CC/PMF, humedad, pH, N-P-K, vegetación |
| 8 | Carga de assets 3D | Rutas .glb/.gltf | Malla cargada; fallback a primitiva (cubo/cilindro) sin romper el loop |

## Herramientas
React + TypeScript + Vite · Three.js con @react-three/fiber y drei (OrbitControls) · Zustand (estado lógico) · GLTFLoader + DRACOLoader.

## Arquitectura
Unidireccional Model→View: [Model] Zustand store con la matriz de `TileNode` (estado lógico) → [View] componentes R3F `<TileMesh/>`/`<TilePlant/>` por celda. El render loop de Three.js solo lee el store suscrito; **nunca** escribe estado. Los cambios de celda se hacen por acciones/selectores del store (base para los Alcances 02 y 09).

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Abstract Factory / Factory Method | Crear `meshTerrain`/`meshPlant` por clase de suelo y por cultivo (spec EP-01.1 lo exige) | Variedad de materiales/modelos desacoplada de la creación |
| Registry (registro estático) | Catálogo de texturas y vegetación → da la config al factory | Resolver por clave sin condicionales |
| Adapter | `AssetLoader` envolviendo GLTFLoader/DRACO | Interfaz única con fallback a primitivas |
| Presentational/Container | `<TileMesh/>` (presentacional) consumiendo store (container) | Render puro y testeable |
| Observer (suscripción) | Store → mallas | Sincronizar visual sin tocar Three.js desde el dominio |
| State → Visual (mapeo declarativo) | Estado de celda → color/corte/overlay conforme a `design.md` | Presentación dinámica centralizada en un mapa tipo |

## Reglas de negocio
- El estado lógico es la **única** fuente de verdad; las mallas son una proyección visual sincronizada y **dinámica** (cambia con el estado, no hay estado escondido en la malla).
- Unidad de celda = cubo de 1 m³; la elevación en Y = altitud del piso ecológico (decorativa aquí; funcional en Paso 07).
- El perfil visual sigue `design.md`: 1 material por metacategoría, cambio por estado vía color/overlay, nunca texturas pesadas.
- Un asset inexistente → primitiva colorida, nunca crash.

## Datos de referencia
- `data/terrenos.json` → clases de suelo con CC/PMF/agua útil, para color y para inspección.

## Validación (criterios de aceptación)
1. La grilla se renderiza con N×M bloques cúbicos de 1 m³ (default 10×10).
2. Orbitar/zoom sin salir del plano base.
3. El modo corte muestra el interior del bloque (perfil de capas según clase de suelo).
4. Click en un bloque (superficie o corte) muestra sus datos lógicos.
5. Asset .glb roto → primitiva, sin detener el render.
6. El color/overlay del bloque cambia al mutar humedad o tipo de suelo (presentación dinámica).

## Fuera de alcance
- Edición de estado (Alcance 02), regeneración N×M dinámica (03), deriva fenológica (04), relieve procedural (07).

## Dependencias
- Ninguna (primera fase).