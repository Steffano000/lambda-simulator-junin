/**
 * Paso 06 · Fenología avanzada y estrés: GDD diario, CHI y plagas (EP-04.1, 04.2, 05.2).
 * Ver docs/06-fenologia-estres.md.
 *
 * TODO(paso-06): PhenologyController (Facade) que combine las fuentes de estrés.
 */
import type { Cultivo } from '@/data/types';

export type ChiEstado = 'saludable' | 'estresado' | 'critico' | 'muerto';

export interface DiaCultivo {
  tmed: number;
  tmin: number;
  balance: number;
  plagaIntensidad: number;
}

/** Strategy: cada fuente de estrés devuelve una penalidad de CHI (0–100) para el día. */
export interface StressSource {
  readonly id: 'hidrico' | 'termico' | 'helada' | 'plaga';
  penalidad(dia: DiaCultivo, cultivo: Cultivo): number;
}

/** GDD = max(0, min(tmed, t_superior) − t_base) */
export const gddDiario = (tmed: number, c: Pick<Cultivo, 't_base' | 't_superior'>): number =>
  Math.max(0, Math.min(tmed, c.t_superior) - c.t_base);

export const chiEstado = (chi: number): ChiEstado =>
  chi <= 0 ? 'muerto' : chi < 35 ? 'critico' : chi < 70 ? 'estresado' : 'saludable';
