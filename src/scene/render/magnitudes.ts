/**
 * Magnitudes de la escena, en metros (design.md §1). Un único lugar para el tamaño de la
 * celda: los modelos 3D (bloque, cultivo, marca) los importan en vez de repetirlos.
 */

/** Lado del cubo de celda: siempre 1 m³ (docs/03-dimensiones-grid.md). */
export const TILE_SIZE = 1;

/**
 * Escala lateral del bloque de terreno. El hueco mínimo entre celdas es lo que hace
 * legible la grilla a 1600 celdas: sin ella los bloques se tocan y el relieve se pierde.
 */
export const BLOQUE_GAP = 0.96;
