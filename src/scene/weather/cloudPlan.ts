/**
 * Fase 4 · Plan de nubes (funciones puras, sin Three.js): dónde va cada nube y de qué tamaño.
 *
 * Reglas:
 * - La BASE de todas las nubes queda por encima del punto más alto del terreno + un margen que
 *   crece con el tamaño de la grilla: ninguna nube toca el relieve, por alto que sea.
 * - Cada nube son varios «puffs» esféricos achatados (forma suave, no pixelada) que solo crecen
 *   hacia arriba desde la base.
 * - Posiciones y tamaños salen de una semilla: la misma parcela y el mismo día dan las mismas nubes.
 * - Cuántas nubes: según la cobertura del día (probabilidad de lluvia del escenario y si llueve).
 */
import type { Intensidad } from '@/domain/climate';
import { createRng } from '@/domain/shared/random';

export interface PuffNube {
  x: number;
  y: number;
  z: number;
  /** Radios del elipsoide */
  rx: number;
  ry: number;
  rz: number;
}

export interface PlanNubes {
  puffs: PuffNube[];
  /** Altura de la base de las nubes (todas quedan por encima) */
  base: number;
  /** Centro y radio de cada nube (para su sombra) */
  nubes: { x: number; z: number; r: number }[];
}

export interface EntradaNubes {
  rows: number;
  cols: number;
  /** Altura de la cara superior más alta del terreno (unidades de la escena) */
  techo: number;
  /** 0-1 */
  cobertura: number;
  seed: number;
}

/**
 * Margen entre el terreno y la base de las nubes: proporcional a la parcela (45 % del lado mayor,
 * mínimo 5 u). No es la altura real (una nube está a cientos de metros), es una proporción que
 * las deja bien arriba del relieve sin salirse del encuadre.
 */
export const MARGEN_NUBES = { minimo: 5, fraccionLado: 0.45 } as const;
export const margenNubes = (rows: number, cols: number) =>
  Math.max(MARGEN_NUBES.minimo, MARGEN_NUBES.fraccionLado * Math.max(rows, cols));

/** Cobertura del cielo (0-1) a partir del tiempo del día */
export function coberturaDia(nubes: boolean, probabilidad: number, lluvia: Intensidad | null): number {
  if (lluvia) return { debil: 0.6, moderada: 0.8, fuerte: 1, 'muy-fuerte': 1 }[lluvia];
  if (!nubes) return 0;
  return Math.min(1, 0.25 + Math.max(0, probabilidad) * 0.5);
}

export function planNubes({ rows, cols, techo, cobertura, seed }: EntradaNubes): PlanNubes {
  const lado = Math.max(rows, cols);
  const base = techo + margenNubes(rows, cols);
  if (cobertura <= 0) return { puffs: [], base, nubes: [] };
  const azar = createRng(seed >>> 0 || 1);
  const nMax = Math.min(14, Math.max(3, Math.round(lado / 6)));
  const n = Math.max(1, Math.round(nMax * cobertura));
  const radioNube = Math.min(9, Math.max(1.2, 0.07 * lado));
  const puffs: PuffNube[] = [];
  const nubes: PlanNubes['nubes'] = [];
  for (let k = 0; k < n; k++) {
    const cx = (azar() - 0.5) * 1.2 * cols;
    const cz = (azar() - 0.5) * 1.2 * rows;
    const R = radioNube * (0.8 + 0.4 * azar());
    nubes.push({ x: cx, z: cz, r: R });
    const partes = 5 + Math.floor(azar() * 4);
    for (let p = 0; p < partes; p++) {
      const a = (p / partes) * Math.PI * 2 + azar() * 0.6;
      const d = p === 0 ? 0 : R * (0.35 + 0.35 * azar());
      const r = R * (p === 0 ? 0.85 : 0.5 + 0.35 * azar());
      const ry = r * 0.55;
      // el puff se apoya en la base y solo crece hacia arriba
      puffs.push({
        x: cx + Math.cos(a) * d,
        y: base + ry + azar() * ry * 0.4,
        z: cz + Math.sin(a) * d * 0.7,
        rx: r,
        ry,
        rz: r * 0.8,
      });
    }
  }
  return { puffs, base, nubes };
}

/** Punto más bajo de todas las nubes (para comprobar que no tocan el terreno) */
export const fondoNubes = (p: PlanNubes): number =>
  p.puffs.length ? Math.min(...p.puffs.map((q) => q.y - q.ry)) : Infinity;
