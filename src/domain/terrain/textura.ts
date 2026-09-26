/**
 * Textura agronómica de las clases de suelo. Vive aparte de TerrainProfile porque la
 * usan tanto el perfil como la mezcla (`data/terrenos.json` → textura de la clase).
 */

/** Textura agronómica (la usa `textura_preferida` de data/cultivos.json). */
export type Textura = 'ligera' | 'media' | 'pesada';

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
