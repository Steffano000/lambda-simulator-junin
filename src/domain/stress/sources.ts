/**
 * Paso 06 · Fuentes de estrés (Strategy): cada una evalúa un día y devuelve su efecto
 * sobre el índice de salud (CHI). El modelo las combina sin conocer su lógica interna.
 *
 * Las tasas son parámetros de simulación provisionales (calibración pendiente, paso 06).
 * El frío "bajo el óptimo" NO penaliza: el rendimiento de referencia de Junín ya
 * refleja el clima local; solo se informa como condición.
 */
import type { Cultivo } from '@/data/types';

export const TASAS_SALUD = {
  /** Pérdida máxima diaria por déficit hídrico (con humedad 0 %) */
  hidricoMax: 2,
  /** Pérdida diaria con helada letal */
  helada: 15,
  /** Pérdida diaria con tmed fuera del rango vital (< t_base o > t_opt_max) */
  termico: 1,
  /** Pérdida diaria con agua gravitacional en el perfil (suelo saturado) */
  exceso: 0.5,
  /** Pérdida diaria base por encharcamiento; crece con los días seguidos */
  anegamiento: 1.5,
  /** Aumento por cada día consecutivo encharcado (asfixia de raíces), con tope */
  anegamientoPorDia: 0.5,
  anegamientoTope: 4,
  /** Recuperación diaria sin estrés */
  recuperacion: 0.5,
} as const;

export interface DiaCultivo {
  tmed: number;
  tmin: number;
  /** % del agua útil (> 100 = agua gravitacional) */
  humedad: number;
  umbralHumedad: number;
  /** Suelo saturado con agua libre encima */
  encharcado: boolean;
  diasEncharcado: number;
}

export type StressId = 'hidrico' | 'helada' | 'termico' | 'exceso' | 'anegamiento';

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
      descripcion: `Déficit hídrico: humedad ${Math.round(d.humedad)} % bajo ${d.umbralHumedad} %; crece más lento.`,
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

/** Agua gravitacional en el perfil (sobre CC) sin llegar a encharcar. */
export class ExcesoStress implements StressSource {
  readonly id = 'exceso';
  evaluar(d: DiaCultivo): StressEffect | null {
    if (d.encharcado || d.humedad <= 100) return null;
    return {
      id: this.id,
      penalidad: TASAS_SALUD.exceso,
      descripcion: 'Exceso de humedad: menos oxígeno en raíces y menor absorción de nutrientes.',
    };
  }
}

/** Suelo saturado con agua encima; el daño crece mientras persiste. */
export class AnegamientoStress implements StressSource {
  readonly id = 'anegamiento';
  evaluar(d: DiaCultivo): StressEffect | null {
    if (!d.encharcado) return null;
    const penalidad = Math.min(
      TASAS_SALUD.anegamientoTope,
      TASAS_SALUD.anegamiento + TASAS_SALUD.anegamientoPorDia * d.diasEncharcado,
    );
    return {
      id: this.id,
      penalidad,
      descripcion: `Encharcamiento (${d.diasEncharcado + 1} día(s) seguidos): asfixia de raíces.`,
    };
  }
}

export const DEFAULT_SOURCES: readonly StressSource[] = [
  new HidricoStress(),
  new HeladaStress(),
  new TermicoStress(),
  new ExcesoStress(),
  new AnegamientoStress(),
];
