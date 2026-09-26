# Guía de contribución

## Metodología: flujo de ejecución 01 → 10

El desarrollo sigue el orden de `docs/NN-*.md`: cada paso se construye sobre los anteriores y es usable por sí solo. Las fases de entrega son:

| Fase  | Pasos   | Resultado                                                    |
| ----- | ------- | ------------------------------------------------------------ |
| MVP   | 01 – 05 | Sembrar, regar, cosechar y comparar bajo escenarios reales   |
| V1.0  | 06 – 09 | Estrés diario (CHI), topografía procedural, presets, sandbox |
| Final | 10      | Persistencia compacta y carga asíncrona                      |

No empieces un paso sin que sus **Dependencias** estén cerradas.

## Ramas

- `main`: siempre estable y desplegable.
- `develop`: integración de la fase en curso.
- `feat/NN-descripcion`, por ejemplo `feat/02-acciones-por-celda`
- `fix/NN-descripcion` · `docs/…` · `chore/…`

## Commits: Conventional Commits con el paso como scope

```
feat(02): comando Regar respeta CC/PMP por clase de suelo
fix(01): fallback a primitiva cuando el .glb no existe
docs(design): rampa CHI color-vision-safe
chore(ci): cache de npm
```

## Reglas de arquitectura

1. **`src/domain` es TypeScript puro**: no importa React, Three.js ni el store (ESLint lo bloquea).
2. **El store es la única fuente de verdad.** La escena solo lee; toda escritura pasa por acciones o comandos.
3. **Los JSON de `data/` son canónicos**: se leen solo desde `src/data` (Repository) y nunca se reescriben.
4. **Colores solo desde `src/theme/tokens.ts`**, que alimenta a Tailwind y a Three.js. No se permiten hex sueltos en componentes.
5. Cada paso cierra con los tests de su sección **Validación**.

## Antes de abrir un PR

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
