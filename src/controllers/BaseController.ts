/**
 * Base de los CONTROLADORES (MVC): acceso al store y al contenedor de dominio,
 * y construcción del contexto de acción. Los controladores concretos solo
 * orquestan: la lógica de negocio vive en src/domain.
 */
import type { ActionContext } from '@/domain/actions';
import type { ClimateScenario } from '@/domain/climate';
import { EnvironmentModel } from '@/domain/climate';
import type { TileNode } from '@/domain/grid';
import type { Container } from '@/app/container';
import type { Mensaje, SimState, SimStore } from '@/store/useSimStore';

export abstract class BaseController {
  constructor(
    protected readonly store: SimStore,
    protected readonly deps: Container,
  ) {}

  protected get state(): SimState {
    return this.store.getState();
  }

  protected set(partial: Partial<SimState>): void {
    this.store.setState(partial);
  }

  protected notify(tipo: Mensaje['tipo'], texto: string, detalle?: string[]): void {
    this.set({ mensaje: { tipo, texto, detalle } });
  }

  dismissMessage(): void {
    this.set({ mensaje: null });
  }

  mesActual(state: Pick<SimState, 'mesInicio' | 'dia'> = this.state): number {
    return EnvironmentModel.mesActual(state.mesInicio, state.dia);
  }

  protected escenario(state: SimState = this.state): ClimateScenario {
    return this.deps.scenarios.create(state.escenario);
  }

  protected tilesById(tiles: readonly TileNode[] = this.state.tiles): Map<string, TileNode> {
    return new Map(tiles.map((t) => [t.id, t]));
  }

  /** Celdas de la selección; si no hay selección, todas. */
  protected objetivo(state: SimState = this.state): TileNode[] {
    if (state.seleccion.length === 0) return state.tiles;
    const ids = new Set(state.seleccion);
    return state.tiles.filter((t) => ids.has(t.id));
  }

  context(state: SimState = this.state): ActionContext {
    const mes = this.mesActual(state);
    return {
      crop: this.deps.crops.find(state.cultivo),
      dia: state.dia,
      mes,
      clima: this.escenario(state).mes(mes),
      cropOf: (nombre) => this.deps.crops.find(nombre),
      soilOf: this.deps.soilOf,
    };
  }
}
