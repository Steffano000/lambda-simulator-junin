# design.md — Sistema de coherencia visual

Referenciado por los pasos 01, 03 y 07. Define cómo se **presentan** los datos del simulador; no reemplaza la lógica del motor (ver pasos 04/06). Principio rector: *minimalista y legible a 1600 celdas*.

## 1 · Geometría y presentación de la grilla

- Cada terreno es una grilla de celdas **cúbicas de 1 m × 1 m × 1 m** (paso 03). El caso más común es que cada celda se dibuje con **altura 1** (planicie) y que solo el **relieve** modifique la altura Y del bloque (paso 07).
- La celda se orienta en: **X** = eje del plano (columnas), **Z** = fondo del plano (filas), **Y** = altitud (relieve).
- **Presentación dinámica por estado** (paso 01): la escena no es estática, muestran tres modos según el estado del sistema:
  - **Modo superficie (default)**: se ve la cara superior de la grilla; overlays temáticos (humedad, pH, CHI, etapa) se proyectan sobre ella.
  - **Modo corte vertical / interior**: al inspeccionar o al activar la vista de perfil, se hace corte (cutaway) para ver el interior de los bloques: textura del suelo, raíces y capa de humedad/fertilizante dentro del cubo.
  - **Modo sandbox (lugar edificable)**: tras `FreezeTerrain` (paso 09) el terreno procedural pasa a ser editable; la presentación cambia a "lugar" donde cada cubo puede rediseñarse a gusto.
- La transición superficie ↔ corte es **animada y continua**, sin saltos de cámara (ver límites de cámara en paso 01).

## 2 · Estilo (minimalista)

- **Bajo poligonaje (low-poly)**: bloques box y geometrías discretas; sin texturas foto-realistas por celda.
- **Un solo material por metacategoría**: un material compartido para todas las celdas de la misma clase, actualizado por estado; no se crea material por celda.
- **Sin oclusión ambiental fuerte ni profundidad de campo**: la legibilidad del estado gana al realismo.
- **Instancing** para celdas repetidas en superficie; las celdas únicas (inspeccionadas/en edición) se individualizan solo al requerirlo (paso 10).
- **Overlays**: el estado sobre la grilla (humedad, pH, CHI, pendiente, etapa) se pinta como capa de color sobre la cara superior; la **leyenda** es obligatoria y visible (paso 01, validación WCAG).

## 3 · Paleta y rampas de estado

- **Clases de suelo** (`clase_es` de `terrenos.json`): rampa opaca saturada — Arena (clara), Franco (media), Arcilla (oscura); la franco-arcillosa comparte la rampa arcilla. Rojo/gris reservado para **agua/roca/nieve** (EP-02.2) en madera de los mapas y no en los suelos.
- **Humedad** (0–100 %): escala azul progresiva, de blanquecino (seco) a azul profundo (CC/saturado), independiente de la clase (distingue la clase por su rampa base y la humedad por el azul encima).
- **CHI** (índice de salud): rampa **rojo → ámbar → verde**, con corte "déficit severo" en rojo intenso (ancla de anulación de yield, paso 06).
- **pH / NPK**: rampas divergentes (bajo = frío, alto = cálido) para lectura de gradiente.
- **Etapa fenológica**: 1 color por etapa (Siembra, Germinación, Desarrollo, Media, Final, Cosecha), reutilizado en marcadores y gráficas.
- **Referencia vs paleta**: la paleta es **color-vision-safe** (deuteranopia/protanopia); nunca el color es el único canal — overlay corre acompañado de leyenda y, al inspeccionar, del valor numérico por texto.

## 4 · Mapeo estado → visual

Transformación **declarativa y única**: `estado_celda → visual_celda` (patrón State→Visual, paso 01). Una celda sin cambio de estado no se redibuja. Primero se mide el costo de redibujo; solo si es problema se optimiza (paso 10).

## 5 · Referencias cruzadas

| Tema | Paso |
|---|---|
| Presentación dinámica y regla de la grilla | 01 |
| Dimensiones y unidad 1 m³ | 03 |
| Relieve como altura Y + inmovilidad procedural | 07 |
| Conversión procedural → lugar editable (FreezeTerrain) | 09 |
| Presupuesto de mallas / instancing | 10 |
| Datos de clases de suelo | `data/terrenos.json` |

## 6 · Fuera de alcance (de este doc)

Texturas foto-realistas, iluminación fotorrealista, leyendas de color definidas por contenido (se derivan de la paleta aquí fijada en los pasos 01 y 06).