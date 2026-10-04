# Fase 4 · Nubes

## Qué cambió

- **Plan de nubes puro** (`src/scene/weather/cloudPlan.ts`): la base de todas las nubes = punto más alto del terreno (con plantas) + margen (`max(5, 45 % del lado mayor)`: proporcional, bien arriba del relieve). Cada puff es un elipsoide que solo crece hacia arriba desde la base: ninguna nube toca el relieve, aunque la parcela real tenga ×3 de exageración.
- **Suaves**: esferas subdivididas y sombreado continuo (antes icosaedros facetados).
- **Cantidad según el día**: cobertura = 0 si está despejado; 0.25 + 0.5 × probabilidad de lluvia del escenario si hay nubes; 0.6-1 si llueve (según la intensidad).
- **Semilla** (terreno + día): mismas nubes para el mismo día; **tamaño** según la grilla.
- **Lluvia proporcional**: solo cae bajo cada nube (0.25-1.4 gotas por u² según la intensidad, máximo 3 000), más transparente; la gota y su velocidad se ajustan a la altura de caída. Llega a la superficie de cada celda sin atravesar el relieve. Las nubes quedan quietas para que la lluvia caiga debajo de ellas.
- **Cámara**: encuadre inicial un poco más alto y lejos para que entren el terreno y las nubes.
- **Vista** (botón abajo a la derecha): mostrar/ocultar nubes y **sombra de las nubes** opcional (luz direccional con mapa de sombras; solo proyectan las nubes).

## Pruebas

`cloudPlan.test.ts`: para 4 tamaños de grilla × 39 semillas, la nube más baja queda por encima del techo del terreno; misma semilla = mismas nubes; más cobertura = más nubes; día despejado = sin nubes; nubes más grandes en grillas más grandes.

## No verificado

- El tamaño de la nube es visual: en metros reales una nube cubriría toda la parcela.
