/**
 * Perfil del terreno elegido al inicio del flujo (punto de partida obligatorio).
 * Determina la mezcla de suelos de la parcela, la textura dominante, la reacción del
 * suelo y, con ello, qué acciones, prerrequisitos y cultivos aplican.
 */
import type { Terreno } from '@/data/types';
import type { GridConfig } from '../grid';
import type { ClaveDistribucion } from './soilDistribution';
import type { SoilMix } from './soilMix';
import { TEXTURA_ETIQUETA, texturaDe, type Textura } from './textura';

export { TEXTURA_ETIQUETA, texturaDe, type Textura } from './textura';

/** Reacción inicial del suelo: fija el pH base de las celdas. */
export type ReaccionPh = 'acido' | 'neutro' | 'alcalino';

export const PH_BASE: Record<ReaccionPh, number> = {
  acido: 5.2,
  neutro: 6.5,
  alcalino: 7.8,
};

export const REACCION_ETIQUETA: Record<ReaccionPh, string> = {
  acido: 'Ácido',
  neutro: 'Neutro',
  alcalino: 'Alcalino',
};

export class TerrainProfile {
  constructor(
    /** Suelo dominante de la mezcla: el de mayor porcentaje. */
    readonly suelo: Readonly<Terreno>,
    readonly reaccion: ReaccionPh,
    readonly config: GridConfig,
    /** Mezcla completa de la parcela (data/terrenos_mezclas.json, editable). */
    readonly mezcla: SoilMix,
    /** Cómo se reparte la mezcla por la grilla (manchas o aleatorio). */
    readonly distribucion: ClaveDistribucion = 'manchas',
  ) {}

  /** Clase dominante: define la textura y los cultivos aptos de toda la parcela. */
  get clase(): string {
    return this.mezcla.dominante;
  }

  get textura(): Textura {
    return texturaDe(this.clase);
  }

  get phBase(): number {
    return PH_BASE[this.reaccion];
  }

  /** Nº de clases distintas que aparecen en la mezcla. */
  get variedadClases(): number {
    return this.mezcla.partes().length;
  }

  get descripcion(): string {
    return `${this.clase} ${this.mezcla.porcentajeDominante}% · ${TEXTURA_ETIQUETA[this.textura]} · ${REACCION_ETIQUETA[this.reaccion]} · ${this.variedadClases} clases · ${this.config.rows}×${this.config.cols}`;
  }
}
