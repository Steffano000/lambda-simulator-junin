# Fase 1 · No generar terreno donde no hay datos

## Qué cambió

- **Estado de cada chunk** (`src/domain/junin/estadoChunk.ts`): `con_dato` (30 m), `interpolado` (~1 km), `sin_dato` (falta altura, suelo, cobertura o la estación de clima está a más de `MAX_DIST_DATO_M` = 50 km) y `bloqueado` (cobertura bloqueada, área natural protegida o casa). Cada chunk guarda su `motivo`.
- **Área exacta**: cada chunk guarda la fracción de su área dentro del polígono (recorte Sutherland-Hodgman). El área de los chunks coincide con la del polígono (< 0.5 % de diferencia, probado).
- **Áreas protegidas bloqueadas** chunk por chunk (antes solo se miraba el centroide y era una advertencia).
- **Casas en vivo** desde OpenStreetMap (Overpass): cada casa bloquea los chunks a menos de `MARGEN_CASA_M` = 5 m. Si la consulta falla, el panel lo dice ("las casas NO se verificaron"); nunca se asume que no hay casas. En el campo de Junín OSM tiene pocas casas mapeadas.
- **Sin rellenos silenciosos**: los chunks sin dato no entran en promedios, área efectiva ni rendimiento. P, K y humedad inicial del 3D se declaran como supuestos del simulador al cargar la parcela.
- **Datos insuficientes**: si menos del 50 % (`UMBRAL_COBERTURA_PCT`) del área no bloqueada tiene datos, el paso 4 lo dice y no se calcula rendimiento.
- **3D**: las celdas fuera del polígono ya no se dibujan (sin borde gris). Bloqueadas y sin dato son losas planas de color según el motivo y no aceptan acciones.
- **Mapa**: los chunks se dibujan recortados con el polígono (borde limpio), nueva capa «Datos», contorno rojo de las casas, y el inspector muestra estado, motivo y % dentro.

## Casos de prueba (escenario normal, papa)

| Caso                                 | Antes                              | Después                                     |
| ------------------------------------ | ---------------------------------- | ------------------------------------------- |
| Huayao 9 ha                          | apta, 17.67 t/ha del punto         | apta, 17.67 t/ha, 157.4 t en 8.91 ha útiles |
| Huancayo urbano 0.43 ha              | bloqueada                          | bloqueada (100 %)                           |
| Nor Yauyos-Cochas (-12.133, -75.834) | «Se puede sembrar» con advertencia | **bloqueada**: área natural protegida       |
| Ilish Pichacoto (-11.944, -75.237)   | advertencia                        | **bloqueada**                               |
| Puna a 4 101 m, 20 km de Jauja       | 15.89 t/ha                         | igual (corrección por altura: Fase 3)       |
