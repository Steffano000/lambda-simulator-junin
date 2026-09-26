/**
 * Perfil del terreno elegido al inicio del flujo (punto de partida obligatorio).
 * Determina la textura dominante, la reacción del suelo y, con ello, qué acciones,
 * prerrequisitos y cultivos aplican.
 */
import type { Terreno } from '@/data/types';
import type { GridConfig } from '../grid';

/** Textura agronómica (la usa `textura_preferida` de data/cultivos.json). */
export type Textura = 'ligera' | 'media' | 'pesada';

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

export const TEXTURA_ETIQUETA: Record<Textura, string> = {
  ligera: 'Ligera (arenosa)',
  media: 'Media (franca)',
  pesada: 'Pesada (arcillosa)',
};

/** Clasificación textural de las clases de data/terrenos.json. */
const TEXTURA_POR_CLASE: Record<string, Textura> = {
  Arena: 'ligera',
  'Arena franca': 'ligera',
  'Franco arenoso': 'ligera',
  Franco: 'media',
  'Franco limoso': 'media',
  Limo: 'media',
  'Franco arcillo limoso': 'pesada',
  'Arcilla limosa': 'pesada',
  Arcilla: 'pesada',
  'Franco arcilloso': 'pesada',
};

export const texturaDe = (clase: string): Textura => TEXTURA_POR_CLASE[clase] ?? 'media';

export class TerrainProfile {
  constructor(
    readonly suelo: Readonly<Terreno>,
    readonly reaccion: ReaccionPh,
    readonly config: GridConfig,
  ) {}

  get clase(): string {
    return this.suelo.clase;
  }

  get textura(): Textura {
    return texturaDe(this.suelo.clase);
  }

  get phBase(): number {
    return PH_BASE[this.reaccion];
  }

  get descripcion(): string {
    return `${this.clase} · ${TEXTURA_ETIQUETA[this.textura]} · ${REACCION_ETIQUETA[this.reaccion]} · ${this.config.rows}×${this.config.cols}`;
  }
}
