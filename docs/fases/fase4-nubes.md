# Fase 4 · Nubes

## Qué cambió

- **Plan de nubes puro** (`src/scene/weather/cloudPlan.ts`): la base de todas las nubes = punto más alto del terreno (con plantas) + margen (`max(3, 12 % del lado mayor)`). Cada puff es un elipsoide que solo crece hacia arriba desde la base: ninguna nube toca el relieve, aunque la parcela real tenga ×3 de exageración.
- **Suaves**: esferas subdivididas y sombreado continuo (antes icosaedros facetados).
- **Cantidad según el día**: cobertura = 0 si está despejado; 0.25 + 0.5 × probabilidad de lluvia del escenario si hay nubes; 0.6-1 si llueve (según la intensidad).
- **Semilla** (terreno + día): mismas nubes para el mismo día; **tamaño** según la grilla.
- **Lluvia**: cae desde la base de las nubes hasta la superficie de cada celda (ya no atraviesa el relieve).
- **Vista** (botón abajo a la derecha): mostrar/ocultar nubes y **sombra de las nubes** opcional (luz direccional con mapa de sombras; solo proyectan las nubes).

## Pruebas

`cloudPlan.test.ts`: para 4 tamaños de grilla × 39 semillas, la nube más baja queda por encima del techo del terreno; misma semilla = mismas nubes; más cobertura = más nubes; día despejado = sin nubes; nubes más grandes en grillas más grandes.

## No verificado

- El tamaño de la nube es visual: en metros reales una nube cubriría toda la parcela.
