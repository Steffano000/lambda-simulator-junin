# Fase 3 · Condiciones de plantación

## Antes de la Fase 3: arreglo de la cosecha en 3D

En la parcela real cada celda del 3D contaba como 1 m² aunque el chunk midiera 2 m (4 m²): la cosecha, los insumos y el agua salían 4 veces menores que en el panel (3.13 t/ha y 3.5 t en el panel, 938 kg en el 3D). Ahora cada celda guarda su área real (`areaM2` = chunk² × fracción dentro del polígono) y el rendimiento del motor de Junín de cada cultivo del 3D (`rendJuninTHa`). La cosecha = referencia × salud × área. El informe lo explica.

## Qué cambió

- **`evaluarSiembra()`** (`src/domain/junin/condiciones.ts`) devuelve `{ estado, razones[{ codigo, severidad, mensaje_es, dato_usado, fuente }], confianza, correccion, meses, factor_helada, marco }`. Si hay un bloqueo, el estado es «no apta» y el paso 9-11 no muestra rendimiento.

| Regla                  | Umbral                                                                                          | Severidad                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Uso de suelo (Fase 1)  | parcela no apta                                                                                 | bloqueo                                      |
| Altitud del cultivo    | fuera del rango con fuente (`data/siembra_cultivos.json`)                                       | bloqueo                                      |
| Altitud de la variedad | fuera del rango de la variedad INIA de referencia                                               | advertencia                                  |
| Pendiente              | > 15° advierte; > 30° en más del 50 % del área útil bloquea                                     | advertencia / bloqueo                        |
| Corrección por altura  | parcela y punto difieren > 300 m                                                                | info (cambia la temperatura)                 |
| Helada                 | Tmín mensual corregida < helada letal → daño = sensibilidad de la fase; < letal + 2 °C → riesgo | bloqueo si el daño ≥ 50 %, si no advertencia |
| Temperatura            | Tmed corregida < mínimo EcoCrop en más de la mitad del ciclo                                    | advertencia                                  |
| pH                     | fuera del rango absoluto EcoCrop / fuera del óptimo                                             | bloqueo / advertencia                        |
| Textura                | dominante distinta de la preferida                                                              | advertencia                                  |
| Déficit severo         | meses con Ks < 0.5 (balance FAO-56)                                                             | advertencia                                  |
| Provincia              | el cultivo no figura en la DRA 2022 de la provincia                                             | advertencia                                  |
| Confianza              | ≤ 10 km alta, ≤ 25 km media, más lejos baja                                                     | info / advertencia                           |

- **Gradiente térmico calculado, no supuesto**: regresión de la temperatura de los 10 puntos contra su altura (escenario normal: −4.4 °C/km la media, −4.7 °C/km la mínima, r = −0.98).
- **Rango de rendimiento por confianza**: no es un ± inventado; es el rendimiento con el clima de 1, 2 o 3 puntos vecinos según la distancia.
- **Marco de plantación** (`data/siembra_cultivos.json`, con cita textual de cada ficha):

| Cultivo         | Variedad de referencia  | Marco                         | Plantas/m² | Altitud variedad | Altitud cultivo                           |
| --------------- | ----------------------- | ----------------------------- | ---------- | ---------------- | ----------------------------------------- |
| Papa            | INIA 303 Canchán        | 0.9 × 0.3 m, 1 por golpe      | 3.7        | 2 000-3 500 m    | hasta 4 500 m (MINAM 2018)                |
| Maíz amiláceo   | INIA 603 Choclero       | 0.8 × 0.5 m, 2 por golpe      | 5          | 2 600-3 000 m    | hasta 3 500 m (Ventura-Román et al. 2021) |
| Quinua          | Salcedo INIA            | chorro continuo, surcos 0.8 m | 50         | 1 284-3 950 m    | hasta 4 000 m (Gómez y Aguilar 2016)      |
| Haba            | INIA 409 Munay Angélica | 0.85 × 0.275 m, 3 por golpe   | 12.8       | —                | 2 500-4 000 m (INIA)                      |
| Cebada          | INIA 416 La Milagrosa   | voleo, 140 kg/ha              | sin dato   | 2 500-3 800 m    | sin dato                                  |
| Avena forrajera | INIA 901 Mantaro 15M    | voleo, 70-80 kg/ha            | sin dato   | 3 200-4 200 m    | sin dato                                  |

- **Panel**: nuevo paso «8b · Condiciones de plantación» con cada razón y el dato usado, la tabla de temperaturas corregidas y el marco de plantación con su fuente. El resultado muestra «× Helada», el rango por confianza y plantas totales / kg por planta.
- **3D**: varias plantas por celda en surcos según el marco (papa en 1 m: 3 plantas; maíz: 4). Con más de 12 000 plantas se dibuja una muestra pareja; el inspector de la celda da el conteo real y los kg por planta. Los cultivos no aptos cosechan 0 y el mensaje al abrir el 3D lo dice.

## Casos de prueba (escenario normal)

| Caso                                  | Resultado                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Huayao 9 ha, papa                     | apta con advertencias (pH 6.8, textura pesada); 17.67 t/ha, 0.48 kg/planta |
| 1 ha en Suni cerca de Jauja (3 516 m) | apta con advertencias: fuera del rango de Canchán                          |
| Huancayo urbano 0.43 ha               | no apta (100 % bloqueado)                                                  |
| Puna 4 414 m (22 km de Jauja), papa   | no apta: corregida −4.8 °C, Tmín de octubre −1.2 °C < −1 °C letal          |
| Haba en La Merced (815 m)             | no apta: fuera de 2 500-4 000 m                                            |

## Pendiente / no verificado

- La corrección por altura cambia la temperatura (helada, frío) pero no vuelve a correr el balance FAO-56 ni el ET0 del punto: eso necesitaría el pipeline.
- Cebada y avena se siembran al voleo: las fichas no dan plantas por m² y no se inventan.
- Las plantas de las celdas del borde se dibujan en toda la celda (el conteo sí usa el área dentro del polígono).
- No se vio en 3D una celda sembrada en la parcela real (el flujo de tratamientos de la prueba automática no llegó a «listas»); la disposición está cubierta por pruebas.
