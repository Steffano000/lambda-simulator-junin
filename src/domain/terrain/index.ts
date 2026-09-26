/**
 * Terreno: perfil elegido al inicio del flujo + (paso 07) topografía procedural.
 * Ver docs/07-topografia-procedural.md.
 *
 * TODO(paso-07): NoiseStrategy (Simplex/Perlin), clasificador y TerrainGenerator.
 */
export {
  PH_BASE,
  REACCION_ETIQUETA,
  TEXTURA_ETIQUETA,
  TerrainProfile,
  texturaDe,
  type ReaccionPh,
  type Textura,
} from './TerrainProfile';
export { TerrainFactory, type TerrainOptions } from './TerrainFactory';

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
