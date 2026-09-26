# Paso 10 · Fase Final · Optimización y carga de datos

> EPs: EP-07.1 (Estructuración Ligera de Datos e Inmutabilidad) · EP-07.2 (Carga Progresiva y Parsing Asíncrono)

## Contexto
Una grilla 40×40 (Alcance 03) y presets exportados (09) generan JSON grandes. Esta fase asegura que persistencia, transmisión y carga no degraden la experiencia.

## Objetivo
Reducir el tamaño del estado persistido y evitar que la carga/parseo congele el hilo principal.

## Funcionalidades
| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Codificación ligera | Claves cortas en persistencia (`x,y,t,h,n` en vez de `fila, columna, textura, humedad, nitrogeno`) |
| 2 | RLE | Run-Length Encoding para celdas contiguas idénticas (evita repetir clave-valor por celda) |
| 3 | Compresión nativa | Gzip/Deflate vía Streams API antes de transmitir/almacenar |
| 4 | Parsing en Web Worker | JSON >5MB se parsea fuera del hilo principal |
| 5 | Progreso de carga | Barra de porcentaje para mapas/presets grandes |

## Herramientas
TypeScript · Streams API nativa (CompressionStream Gzip/Deflate) · Web Workers (API `worker_threads` web) · Zustand con selectores para slices.

## Arquitectura
`PersistenceLayer` = fachada único punto de serialización: canónico (data/*.json) ↔ compacto (claves cortas) ↔ RLE ↔ gzip. El parsing pesado corre en un Web Worker que devuelve el estado ya hidratado; el cliente solo actualiza el store. Los selectores de Zustand recortan suscripciones para no re-renderizar la grilla completa.

## Patrones de diseño
| Patrón | Dónde | Por qué |
|---|---|---|
| Strategy (Codec) | Codecs canónico/compacto/RLE intercambiables | Combinar formatos sin condicionales en la fachada |
| Facade | `PersistenceLayer` (codec + gzip + worker) | API simple para Alcance 08/09 |
| Adapter | Envolver `CompressionStream` y el Web Worker | Reemplazar implementación sin tocar callers |
| Command | `ExportState` / `ImportState` | Reversibles y auditables |
| Proxy/Lazy | Carga progresiva por chunks con progreso | Grilla grande responsiva (EP-07.2) |

## Reglas de negocio
- La codificación ligera es transpariente: un lector de datos puede reconstruir el formato canónico (Alcance 05/09) y viceversa.
- Formato canónico (data/*.json) nunca se reescribe en compacto; solo las exportaciones/persistencias.

## Datos de referencia
- `data/meta.json` → mantiene el significado semántico de las claves cortas (diccionario de reducción).

## Validación (criterios de aceptación)
1. Exportar un microcaso 40×40: el JSON compacto+RLE+gzip es ≤50% del tamaño canónico.
2. Cargar un mapa de 5–8 MB no congela el hilo principal (interacción fluida durante el parseo).
3. Importar un archivo compacto reconstruye el estado idéntico al original.

## Fuera de alcance
- Compresión de mesh 3D (pipeline de assets, Alcance 01), multipartición por rejilla.

## Dependencias
- Alcances 01 (grilla), 03 (tamaños), 08/09 (persistencia).