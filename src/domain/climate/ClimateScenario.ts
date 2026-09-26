/**
 * Paso 05 · Escenario climático como estrategia intercambiable (Strategy).
 * Los 5 perfiles reales y los personalizados comparten esta misma clase.
 */
import type { ClimaMes } from '@/data/types';

export interface ResumenClima {
  lluviaAnual: number;
  et0Anual: number;
  /** lluvia − ET0 anual (mm) */
  balanceAnual: number;
  /** Meses con lluvia < ET0 */
  mesesDeficit: number;
  /** Temperatura mínima más baja del año (°C) */
  tminMin: number;
  tmedMedia: number;
}

export class ClimateScenario {
  private readonly porMes: ReadonlyMap<number, ClimaMes>;

  constructor(
    readonly nombre: string,
    readonly meses: readonly ClimaMes[],
    readonly personalizado = false,
    /** Escenario real del que deriva (solo personalizados) */
    readonly base: string | null = null,
  ) {
    this.porMes = new Map(meses.map((m) => [m.mes, m]));
  }

  /** Clima del mes calendario (1–12). */
  mes(mes: number): ClimaMes {
    const clima = this.porMes.get(mes);
    if (!clima) throw new Error(`El escenario "${this.nombre}" no tiene datos del mes ${mes}.`);
    return clima;
  }

  /** Meses en orden calendario (1 → 12). */
  get ordenados(): ClimaMes[] {
    return [...this.meses].sort((a, b) => a.mes - b.mes);
  }

  get lluviaAnual(): number {
    return this.meses.reduce((acc, m) => acc + m.lluvia, 0);
  }

  get et0Anual(): number {
    return this.meses.reduce((acc, m) => acc + m.et0, 0);
  }

  get resumen(): ResumenClima {
    const lluviaAnual = this.lluviaAnual;
    const et0Anual = this.et0Anual;
    return {
      lluviaAnual,
      et0Anual,
      balanceAnual: lluviaAnual - et0Anual,
      mesesDeficit: this.meses.filter((m) => m.lluvia < m.et0).length,
      tminMin: Math.min(...this.meses.map((m) => m.tmin)),
      tmedMedia: this.meses.reduce((acc, m) => acc + m.tmed, 0) / this.meses.length,
    };
  }
}
