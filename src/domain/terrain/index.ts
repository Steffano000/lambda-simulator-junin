/**
 * Paso 07 · Topografía procedural y pisos ecológicos (EP-02.1, 02.2).
 * Ver docs/07-topografia-procedural.md.
 *
 * Pipeline puro y determinista: seed → Noise → altitud → piso → suelo → tmed_celda.
 *
 * TODO(paso-07): NoiseStrategy (Simplex/Perlin), clasificador y TerrainGenerator.
 */

export type PisoEcologico = 'yunga' | 'quechua' | 'suni' | 'puna';

export interface NoiseStrategy {
  /** Valor en [-1, 1] determinista para (x, z) con la semilla dada */
  sample(x: number, z: number, seed: number): number;
}

export interface TerrainCell {
  altitud: number;
  piso: PisoEcologico;
  pendiente: number;
  /** Clase de data/terrenos.json o superficie especial */
  clase: string;
  /** Gradiente térmico a sumar al tmed del escenario */
  deltaT: number;
}

export interface TerrainGenerator {
  generate(rows: number, cols: number, seed: number): TerrainCell[];
}
