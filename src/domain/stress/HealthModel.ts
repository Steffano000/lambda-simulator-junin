/**
 * Paso 06 · Facade de salud: combina las fuentes de estrés de un día y devuelve el
 * nuevo CHI con sus efectos (negativos) o la recuperación (positivo).
 */
import type { Cultivo } from '@/data/types';
import {
  DEFAULT_SOURCES,
  TASAS_SALUD,
  type DiaCultivo,
  type StressEffect,
  type StressSource,
} from './sources';

export type ChiEstado = 'saludable' | 'estresado' | 'critico' | 'muerto';

export const chiEstado = (chi: number): ChiEstado =>
  chi <= 0 ? 'muerto' : chi < 35 ? 'critico' : chi < 70 ? 'estresado' : 'saludable';

export interface DiaSalud {
  salud: number;
  efectos: StressEffect[];
}

export class HealthModel {
  constructor(private readonly sources: readonly StressSource[] = DEFAULT_SOURCES) {}

  /** Efectos del día sin aplicar (para mostrar condiciones actuales). */
  efectos(dia: DiaCultivo, cultivo: Cultivo): StressEffect[] {
    return this.sources.map((s) => s.evaluar(dia, cultivo)).filter((e): e is StressEffect => e !== null);
  }

  step(salud: number, dia: DiaCultivo, cultivo: Cultivo): DiaSalud {
    if (salud <= 0) return { salud: 0, efectos: [] };
    const efectos = this.efectos(dia, cultivo);
    const delta = efectos.length
      ? -efectos.reduce((acc, e) => acc + e.penalidad, 0)
      : TASAS_SALUD.recuperacion;
    return { salud: Math.min(100, Math.max(0, salud + delta)), efectos };
  }
}
