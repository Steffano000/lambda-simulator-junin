/**
 * Paso 06 · Fuentes de estrés (Strategy): cada una evalúa un día y devuelve su efecto
 * sobre el índice de salud (CHI). El modelo las combina sin conocer su lógica interna.
 *
 * Las tasas son parámetros de simulación provisionales (calibración pendiente, paso 06).
 * El frío "bajo el óptimo" NO penaliza: el rendimiento de referencia de Junín ya
 * refleja el clima local; solo se informa como condición.
 */
import type { Cultivo } from '@/data/types';
import type { Textura } from '../terrain/TerrainProfile';

export const TASAS_SALUD = {
  /** Pérdida máxima diaria por déficit hídrico (con humedad 0 %) */
  hidricoMax: 2,
  /** Pérdida diaria con helada letal */
  helada: 15,
  /** Pérdida diaria con tmed fuera del rango vital (< t_base o > t_opt_max) */
  termico: 1,
  /** Pérdida diaria por anegamiento en suelos pesados saturados */
  anegamiento: 1,
  /** Recuperación diaria sin estrés */
  recuperacion: 0.5,
} as const;

export interface DiaCultivo {
  tmed: number;
  tmin: number;
  humedad: number;
  umbralHumedad: number;
  textura: Textura;
}

export type StressId = 'hidrico' | 'helada' | 'termico' | 'anegamiento';

export interface StressEffect {
  id: StressId;
  /** Penalidad de CHI del día (> 0) */
  penalidad: number;
  descripcion: string;
}

export interface StressSource {
  readonly id: StressId;
  evaluar(dia: DiaCultivo, cultivo: Cultivo): StressEffect | null;
}

export class HidricoStress implements StressSource {
  readonly id = 'hidrico';
  evaluar(d: DiaCultivo): StressEffect | null {
    if (d.humedad >= d.umbralHumedad) return null;
    const deficit = (d.umbralHumedad - d.humedad) / d.umbralHumedad;
    return {
      id: this.id,
      penalidad: TASAS_SALUD.hidricoMax * deficit,
      descripcion: `Déficit hídrico: humedad ${Math.round(d.humedad)} % bajo ${d.umbralHumedad} %.`,
    };
  }
}

export class HeladaStress implements StressSource {
  readonly id = 'helada';
  evaluar(d: DiaCultivo, c: Cultivo): StressEffect | null {
    if (c.helada_letal === null || d.tmin > c.helada_letal) return null;
    return {
      id: this.id,
      penalidad: TASAS_SALUD.helada,
      descripcion: `Helada: tmin ${d.tmin} °C ≤ ${c.helada_letal} °C (letal).`,
    };
  }
}

export class TermicoStress implements StressSource {
  readonly id = 'termico';
  evaluar(d: DiaCultivo, c: Cultivo): StressEffect | null {
    if (c.t_base !== null && d.tmed < c.t_base) {
      return {
        id: this.id,
        penalidad: TASAS_SALUD.termico,
        descripcion: `Frío: tmed ${d.tmed} °C bajo la base (${c.t_base} °C); sin crecimiento.`,
      };
    }
    if (d.tmed > c.t_opt_max) {
      return {
        id: this.id,
        penalidad: TASAS_SALUD.termico,
        descripcion: `Calor: tmed ${d.tmed} °C sobre el óptimo (${c.t_opt_max} °C).`,
      };
    }
    return null;
  }
}

export class AnegamientoStress implements StressSource {
  readonly id = 'anegamiento';
  evaluar(d: DiaCultivo): StressEffect | null {
    if (d.textura !== 'pesada' || d.humedad < 98) return null;
    return {
      id: this.id,
      penalidad: TASAS_SALUD.anegamiento,
      descripcion: 'Anegamiento: suelo pesado saturado, raíces sin aire.',
    };
  }
}

export const DEFAULT_SOURCES: readonly StressSource[] = [
  new HidricoStress(),
  new HeladaStress(),
  new TermicoStress(),
  new AnegamientoStress(),
];
