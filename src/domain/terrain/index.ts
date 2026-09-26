/**
 * Terreno: perfil elegido al inicio del flujo + reparto procedural de la mezcla de
 * suelos (paso 07). Ver docs/07-topografia-procedural.md.
 */
export { PH_BASE, REACCION_ETIQUETA, TerrainProfile, type ReaccionPh } from './TerrainProfile';
export { TEXTURA_ETIQUETA, texturaDe, type Textura } from './textura';
export { SoilMix, TOTAL_PORCENTAJE, normalizarPorcentajes, type ParteMezcla } from './soilMix';
export {
  DISTRIBUCIONES,
  DISTRIBUCION_POR_DEFECTO,
  POR_ALEATORIO,
  POR_MANCHAS,
  builders as distribuciones,
  celdasAisladas,
  repartirSuelos,
  repartoReal,
  type ClaveDistribucion,
  type DistribucionSuelos,
  type RepartoSuelos,
} from './soilDistribution';
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
