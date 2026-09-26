# Paso 05 · Fase MVP · Escenarios climáticos y eventos JSON

> EPs: EP-06.1 (Parser y Motor de Eventos Climáticos JSON) · EP-06.2 (Inyección Dinámica de Anomalías)

## Contexto
El corazón del simulador: **probar plantaciones bajo distintos climas**. Se usan los 5 escenarios reales de `clima_escenarios.json` (Promedio 1950–2026, Normal 2001-02, Seco/El Niño, Lluvioso/La Niña, Extremo seco) y se permite **cargar escenarios personalizados en el mismo formato** para variar los datos a preferencia (menos lluvia, ETo mayor, tmed distinta, etc.).

## Objetivo
Seleccionar/crear un perfil climático que alimente el Alcance 04, e inyectar eventos hidrometeorológicos (heladas, granizadas, sequías) desde JSON.

## Funcionalidades
| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Selector de escenario | Menú con los 5 perfiles reales; al cambiar, recalcula el clima del tick siguiente |
| 2 | Editor de escenario personalizado | Form UI o pegado JSON con el formato `clima_escenarios` (12 meses: `et0, lluvia, tmed, tmin`); valida y descarta inválidos |
| 3 | Motor de eventos JSON | Parser del esquema del EP-06.1: `estacion`, `diaSimulado`, `climaGlobal` (temperatura, precipitación, HR, viento), `eventosEspeciales` |
| 4 | Eventos especiales | `HELADA_METEOROLOGICA`, granizada, sequía → delta de temperatura/lluvia por `duracionTicks` |
| 5 | Recalculado inmediato | Un evento activo recalcula en el acto los parámetros climáticos de la matriz |
| 6 | Comparativa simple | Tabla cultivo×escenario: ETc, lluvia, balance, yield estimado (base para experimentos de Alcance 09) |

## Herramientas
React + TypeScript + Vite · Zustand store (escenario activo) · Parser JSON propio (sin librerías de validación externas).

## Arquitectura
Los escenarios (los 5 reales + personalizados) se exponen por una **interface `ClimateScenario`** detrás de `ClimateRepository` (lee `clima_escenarios.json`). El motor `EventEngine` interpreta el JSON de eventos y publica en un clock/reloj de ticks; el clima del día = estrategia activa sobre ese tick. UI selecciona escenario y suscribe resultados.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Strategy | Cada escenario (real o personalizado) como estrategia de `ClimateScenario` | Los 5 perfiles + custom son intercambiables sin condicionales |
| Interpreter | `EventEngine` parsea el esquema del EP-06.1 (climaGlobal, eventosEspeciales, duracionTicks) | Reglas de evento expresadas como datos (facilita escenarios nuevos) |
| Adapter | Adaptador de escenario personalizado → misma interface que los reales | UI/Data uniformes |
| Observer (Pub/Sub) | Clock emite "tick" → suscriptores aplican clima y eventos | Desacoplar reloj del simulador |
| Repository | `ClimateRepository` carga y valida JSONs | Validación centralizada (meses faltantes, rangos) |

## Reglas de negocio
- Un escenario personalizado inválido (meses faltantes, rangos fuera de límite) se rechaza con mensaje, nunca rompe la simulación.
- El clima del día = `climaGlobal` del evento activo si existe, si no el valor mensual del escenario.
- Eventos solo afectan un rango de `diaSimulado`; al expirar se restaura el perfil base.

## Datos de referencia
- `data/clima_escenarios.json` → perfiles reales (ETo, lluvia, tmed, tmin por mes).
- Esquema de evento: ejemplo del EP-06.1 en `spec.md`.

## Validación (criterios de aceptación)
1. Cambiar a "Extremo seco" reduce lluvia y aumenta el déficit hídrico del cultivo activo en los ticks siguientes.
2. Cargar un JSON de 12 meses válido genera un nuevo escenario seleccionable.
3. Un evento `HELADA_METEOROLOGICA` baja temperatura por `factorTemperatutaDelta` durante `duracionTicks` y recalcula celdas.
4. Escenario inválido → error claro, no crash.

## Fuera de alcance
- Daño CHI por helada (06), eventos desde topografía (07), experimentos comparados exportables (09).

## Dependencias
- Alcance 04 (el clima alimenta la fenología).