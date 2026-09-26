/**
 * Reloj de simulación: avanza días y actualiza el ciclo de las celdas sembradas
 * (Sembrado → Maduro al entrar en la etapa Final). Clase pura sin estado propio.
 *
 * TODO(paso-04): consumo de agua diario (ETc = Kc × ETo) y balance hídrico por celda.
 */
import type { CropFactory } from '../crops';
import type { TileNode } from '../grid';

/** Mes de ciclo = span de 365/12 días (docs/04). */
export const DIAS_POR_MES = 365 / 12;

export class SimulationClock {
  constructor(private readonly crops: CropFactory) {}

  /** Mes calendario (1–12) tras `dia` días desde el inicio en `mesInicio`. */
  static mesActual(mesInicio: number, dia: number): number {
    return ((mesInicio - 1 + Math.floor(dia / DIAS_POR_MES)) % 12) + 1;
  }

  advance(tiles: readonly TileNode[], dias: number): TileNode[] {
    return tiles.map((t) => {
      if (t.estado !== 'sembrado' && t.estado !== 'maduro') return t;
      const crop = this.crops.find(t.vegetacionId);
      if (!crop) return t;
      const diasCultivo = t.diasCultivo + dias;
      return { ...t, diasCultivo, estado: crop.estaMaduro(diasCultivo) ? 'maduro' : 'sembrado' };
    });
  }
}
