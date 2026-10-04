# Fase 5 · Terreno continuo

## Qué cambió

- **Superficie continua** (`src/scene/terrain/`): las alturas de las celdas pasan a los vértices (promedio de las celdas vecinas); la malla es lisa (normales del gradiente) y cada celda conserva el color de la capa activa (suelo, humedad, pH, fidelidad, bloqueos).
- **Recortada al polígono**: las celdas del borde se cortan con el polígono que dibujaste (Sutherland-Hodgman + triangulación); el borde ya no es una escalera.
- **Suavizado** 0-3 pasadas (Laplaciano que no deforma planos ni rampas) y **exageración vertical** 1-3×.
- **Bloques / Continuo**: interruptor en «Vista» (la parcela real abre en continuo). Surcos, plantas y marcas se apoyan sobre la superficie en los dos modos.
- **Pendiente recalculada** por diferencias finitas sobre la superficie: tan θ = |∇h| / exageración; «Vista» la compara con la pendiente SRTM.
- **Bloqueado / sin dato**: siguen pintados con su color; las celdas sin altura medida no deforman el relieve. La selección funciona con el punto tocado.

## Pruebas

`heightfield.test.ts`: plano → plano y pendiente 0 (con y sin suavizado); rampa → misma pendiente en todo el interior (5.71° para 0.3 u por celda con ×3); continuidad entre celdas; celdas fuera de la parcela sin vértices; recorte del borde con área exacta.

## Pendiente

- Sin «falda» bajo el borde: desde un ángulo muy bajo la superficie se ve delgada.
