/** Control del tiempo: saltos de días y avance de la simulación. */
import { BaseController } from './BaseController';

export const PASO_LIMITES = { min: 1, max: 365 } as const;

export class TimeController extends BaseController {
  setPaso(dias: number): void {
    if (!Number.isFinite(dias)) return;
    this.set({ pasoDias: Math.min(PASO_LIMITES.max, Math.max(PASO_LIMITES.min, Math.round(dias))) });
  }

  incPaso(delta: number): void {
    this.setPaso(this.state.pasoDias + delta);
  }

  /** Avanza el tiempo: balance hídrico, salud y etapas; registra la evolución. */
  advance(dias: number = this.state.pasoDias): void {
    const s = this.state;
    if (!s.terreno) return this.notify('error', 'Elige y confirma un terreno antes de avanzar el tiempo.');

    const { tiles, resumen } = this.deps.clock.advance({
      tiles: s.tiles,
      dias,
      diaInicial: s.dia,
      mesInicio: s.mesInicio,
      escenario: this.escenario(),
      textura: s.terreno.textura,
      soilOf: this.deps.soilOf,
    });
    const dia = s.dia + dias;
    const porId = this.tilesById(tiles);
    const plantaciones = s.plantaciones.map((p) => this.deps.plantations.registrar(p, porId, dia));

    this.set({ tiles, dia, plantaciones, ultimoAvance: resumen });

    const detalle: string[] = [];
    if (resumen.nuevasMaduras) detalle.push(`${resumen.nuevasMaduras} celda(s) llegaron a la etapa Final.`);
    if (resumen.nuevasMuertas) detalle.push(`${resumen.nuevasMuertas} planta(s) murieron.`);
    this.notify(resumen.nuevasMuertas ? 'error' : 'ok', `+${dias} días → día ${dia}.`, detalle);
  }
}
