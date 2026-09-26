/**
 * Paso 05 · Escenario climático como estrategia intercambiable (Strategy).
 * Los 5 perfiles reales y los personalizados comparten esta misma clase.
 */
import type { ClimaMes } from '@/data/types';

export class ClimateScenario {
  private readonly porMes: ReadonlyMap<number, ClimaMes>;

  constructor(
    readonly nombre: string,
    readonly meses: readonly ClimaMes[],
    readonly personalizado = false,
  ) {
    this.porMes = new Map(meses.map((m) => [m.mes, m]));
  }

  /** Clima del mes calendario (1–12). */
  mes(mes: number): ClimaMes {
    const clima = this.porMes.get(mes);
    if (!clima) throw new Error(`El escenario "${this.nombre}" no tiene datos del mes ${mes}.`);
    return clima;
  }

  /** Lluvia total anual (mm) — útil para comparar escenarios en la UI. */
  get lluviaAnual(): number {
    return this.meses.reduce((acc, m) => acc + m.lluvia, 0);
  }

  get et0Anual(): number {
    return this.meses.reduce((acc, m) => acc + m.et0, 0);
  }
}
