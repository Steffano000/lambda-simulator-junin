/**
 * Sandbox climático · Builder de escenarios personalizados.
 * Parte de un escenario base y aplica, en este orden:
 *   1. Modificadores globales (lluvia ×%, ET0 ×%, temperatura +Δ °C).
 *   2. Ediciones puntuales por mes (tienen prioridad sobre los modificadores).
 */
import type { ClimaMes } from '@/data/types';
import type { ClimateScenario } from './ClimateScenario';

export interface Modificadores {
  /** Porcentaje de la lluvia base (100 = sin cambio) */
  lluviaPct: number;
  /** Porcentaje de la ET0 base (100 = sin cambio) */
  et0Pct: number;
  /** Desplazamiento de tmed y tmin (°C) */
  deltaT: number;
}

export type CampoClima = 'lluvia' | 'et0' | 'tmed' | 'tmin';

/** Valores editados a mano, por mes (1–12). */
export type Ediciones = Partial<Record<number, Partial<Record<CampoClima, number>>>>;

export const MODIFICADORES_NEUTROS: Modificadores = { lluviaPct: 100, et0Pct: 100, deltaT: 0 };

export const LIMITES_MODIFICADORES = {
  lluviaPct: { min: 0, max: 300, paso: 5 },
  et0Pct: { min: 50, max: 200, paso: 5 },
  deltaT: { min: -8, max: 8, paso: 0.5 },
} as const;

const r1 = (v: number) => Math.round(v * 10) / 10;

export class ScenarioBuilder {
  private modificadores: Modificadores = { ...MODIFICADORES_NEUTROS };
  private ediciones: Ediciones = {};

  private constructor(private readonly base: readonly ClimaMes[]) {}

  static from(base: ClimateScenario): ScenarioBuilder {
    return new ScenarioBuilder(base.ordenados);
  }

  static fromMonths(meses: readonly ClimaMes[]): ScenarioBuilder {
    return new ScenarioBuilder([...meses].sort((a, b) => a.mes - b.mes));
  }

  withModificadores(m: Partial<Modificadores>): this {
    this.modificadores = { ...this.modificadores, ...m };
    return this;
  }

  withEdiciones(e: Ediciones): this {
    this.ediciones = e;
    return this;
  }

  build(): ClimaMes[] {
    const { lluviaPct, et0Pct, deltaT } = this.modificadores;
    return this.base.map((m) => {
      const e = this.ediciones[m.mes] ?? {};
      return {
        ...m,
        lluvia: e.lluvia ?? r1((m.lluvia * lluviaPct) / 100),
        et0: e.et0 ?? r1((m.et0 * et0Pct) / 100),
        tmed: e.tmed ?? r1(m.tmed + deltaT),
        tmin: e.tmin ?? r1(m.tmin + deltaT),
      };
    });
  }
}
