/** Pasos 2–3 del flujo · Acciones y tratamientos sobre las celdas seleccionadas. */
import type { ToolId, ToolInfo } from '@/domain/actions';
import type { Crop } from '@/domain/crops';
import { BaseController } from './BaseController';

export class TreatmentController extends BaseController {
  selectTool(herramienta: ToolId | null): void {
    this.set({ herramienta });
  }

  /** Tratamientos que corresponden al terreno y a su estado actual (sobre todo el terreno). */
  disponibles(): ToolInfo[] {
    const s = this.state;
    if (!s.terreno) return [];
    return this.deps.actions.disponibles('tratamiento', s.terreno, s.tiles, this.context());
  }

  /** Cuántas celdas de la selección aceptan la herramienta. */
  aplicablesEnSeleccion(tool: ToolId): number {
    const ctx = this.context();
    const command = this.deps.actions.command(tool);
    return this.objetivo().filter((t) => command.check(t, ctx) === null).length;
  }

  /** Cultivos aptos para el terreno a los que ayuda la herramienta. */
  sirvePara(tool: ToolId, aptos: readonly Crop[]): Crop[] {
    return this.deps.actions.sirvePara(tool, aptos);
  }

  /** Aplica la herramienta activa a la selección; las celdas que no cumplen se informan. */
  apply(): void {
    const s = this.state;
    if (!s.herramienta) return this.notify('error', 'Selecciona primero una acción.');
    if (s.seleccion.length === 0)
      return this.notify('error', 'Selecciona las celdas: clic o arrastra un área.');

    const r = this.deps.actions.executeMany(s.herramienta, s.seleccion, s.tiles, this.context());
    const detalle = agruparMotivos(r.omitidas.map((o) => o.motivo));
    this.set({ tiles: r.tiles });
    this.notify(r.aplicadas.length ? 'ok' : 'error', r.mensaje, detalle);
  }

  /** Paso a cultivos: requiere al menos una celda preparada. */
  goToCrops(): void {
    if (!this.state.tiles.some((t) => t.estado === 'arado')) {
      return this.notify('error', 'Aún no hay celdas tratadas: ara al menos un área para ver los cultivos.');
    }
    this.set({ fase: 'cultivos', mensaje: null });
  }

  goToTreatments(): void {
    this.set({ fase: 'tratamiento', mensaje: null });
  }
}

/** "Falta arar la celda." ×12 → "Falta arar la celda. (12 celdas)" */
function agruparMotivos(motivos: string[]): string[] {
  const conteo = new Map<string, number>();
  for (const m of motivos) conteo.set(m, (conteo.get(m) ?? 0) + 1);
  return [...conteo].map(([m, n]) => (n > 1 ? `${m} (${n} celdas)` : m));
}
