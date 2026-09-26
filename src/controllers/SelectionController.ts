/**
 * Selección de celdas: clic = una celda; arrastre = área cuadrada desde un punto de inicio.
 * El ancla del arrastre es estado transitorio de interacción (no del modelo).
 */
import type { Overlay } from '@/store/useSimStore';
import { BaseController } from './BaseController';

export class SelectionController extends BaseController {
  private ancla: { x: number; z: number } | null = null;

  get arrastrando(): boolean {
    return this.ancla !== null;
  }

  begin(tileId: string): void {
    const tile = this.state.tiles.find((t) => t.id === tileId);
    if (!tile) return;
    this.ancla = { ...tile.coords };
    this.set({ seleccion: [tileId] });
  }

  extend(tileId: string): void {
    if (!this.ancla) return;
    const fin = this.state.tiles.find((t) => t.id === tileId)?.coords;
    if (!fin) return;
    const [x0, x1] = [Math.min(this.ancla.x, fin.x), Math.max(this.ancla.x, fin.x)];
    const [z0, z1] = [Math.min(this.ancla.z, fin.z), Math.max(this.ancla.z, fin.z)];
    const seleccion = this.state.tiles
      .filter((t) => t.coords.x >= x0 && t.coords.x <= x1 && t.coords.z >= z0 && t.coords.z <= z1)
      .map((t) => t.id);
    if (seleccion.length !== this.state.seleccion.length) this.set({ seleccion });
  }

  end(): void {
    this.ancla = null;
  }

  select(ids: string[]): void {
    this.set({ seleccion: ids });
  }

  clear(): void {
    this.ancla = null;
    this.set({ seleccion: [] });
  }

  setOverlay(overlay: Overlay): void {
    this.set({ overlay });
  }
}
