/**
 * Paso 10 · Optimización y carga de datos (EP-07.1, 07.2). Ver docs/10-optimizacion-datos.md.
 *
 * `PersistenceLayer` (Facade): canónico ↔ compacto (claves cortas) ↔ RLE ↔ gzip.
 *
 * TODO(paso-10): codecs compacto/RLE, CompressionStream y parsing en Web Worker.
 */

/** Strategy: codec intercambiable. */
export interface Codec<TIn, TOut> {
  readonly id: 'canonico' | 'compacto' | 'rle';
  encode(value: TIn): TOut;
  decode(value: TOut): TIn;
}

/** Diccionario de claves cortas (semántica documentada en data/meta.json). */
export const SHORT_KEYS = {
  x: 'columna',
  y: 'fila',
  t: 'textura',
  h: 'humedad',
  n: 'nitrogeno',
} as const;

/** JSON mayores a este tamaño se parsean en Web Worker (EP-07.2). */
export const WORKER_PARSE_THRESHOLD_BYTES = 5 * 1024 * 1024;
