/**
 * CONTROLADOR (MVC): traduce intenciones de la vista (clic en celda, elegir escenario,
 * avanzar tiempo…) en llamadas al dominio y confirma el resultado en el store.
 * Las vistas nunca llaman al dominio ni escriben el store directamente.
 */
import type { ActionContext, ToolId } from '@/domain/actions';
import { createGrid, GridConfigBuilder, type SizePreset, type TileNode } from '@/domain/grid';
import { SimulationClock } from '@/domain/simulation';
import { container, type Container } from '@/app/container';
import { soilClasses } from '@/store/gridSlice';
import { useSimStore, type ActiveTool, type Overlay, type SimState } from '@/store/useSimStore';

type Store = typeof useSimStore;

export class SimulationController {
  constructor(
    private readonly store: Store,
    private readonly deps: Container,
  ) {}

  private get state(): SimState {
    return this.store.getState();
  }

  // ---------- Escenario y calendario (paso 05)

  selectScenario(nombre: string): void {
    this.deps.scenarios.create(nombre); // valida que exista
    this.store.setState({ escenario: nombre, mensaje: { tipo: 'ok', texto: `Escenario: ${nombre}.` } });
  }

  setMesInicio(mes: number): void {
    this.store.setState({ mesInicio: Math.min(12, Math.max(1, mes)) });
  }

  mesActual(state: Pick<SimState, 'mesInicio' | 'dia'> = this.state): number {
    return SimulationClock.mesActual(state.mesInicio, state.dia);
  }

  advance(dias: number): void {
    const s = this.state;
    const tiles = this.deps.clock.advance(s.tiles, dias);
    const maduros = tiles.filter((t, i) => t.estado === 'maduro' && s.tiles[i].estado !== 'maduro').length;
    this.store.setState({
      tiles,
      dia: s.dia + dias,
      mensaje: maduros
        ? { tipo: 'ok', texto: `${maduros} celda(s) llegaron a la etapa Final: ya se pueden cosechar.` }
        : null,
    });
  }

  // ---------- Herramientas y cultivo (paso 02)

  selectTool(herramienta: ActiveTool): void {
    this.store.setState({ herramienta, mensaje: null });
  }

  selectCrop(cultivo: string): void {
    this.deps.crops.create(cultivo); // valida que exista
    this.store.setState({ cultivo, herramienta: 'sembrar', mensaje: null });
  }

  /** Clic en una celda: inspecciona o aplica la herramienta activa. */
  clickTile(tileId: string): void {
    const { herramienta } = this.state;
    this.store.setState({ selectedId: tileId });
    if (herramienta !== 'inspeccionar') this.applyTool(herramienta, tileId);
  }

  applyTool(tool: ToolId, tileId: string): void {
    const s = this.state;
    const result = this.deps.actions.execute(tool, tileId, s.tiles, this.context());
    this.store.setState({
      tiles: result.tiles,
      mensaje: { tipo: result.ok ? 'ok' : 'error', texto: result.mensaje },
      cosechas: result.cosecha ? [result.cosecha, ...s.cosechas] : s.cosechas,
    });
  }

  /** Motivo por el que la herramienta activa no aplica a la celda (para el inspector). */
  checkTool(tool: ToolId, tile: TileNode): string | null {
    return this.deps.actions.check(tool, tile, this.context());
  }

  /** Motivos de calendario/clima para el cultivo, independientes de la celda. */
  cropBlockers(nombre: string): string[] {
    const crop = this.deps.crops.create(nombre);
    const mes = this.mesActual();
    const clima = this.deps.scenarios.create(this.state.escenario).mes(mes);
    return [...crop.motivosCalendario(mes), ...crop.motivosClima(clima)];
  }

  private context(): ActionContext {
    const s = this.state;
    const mes = this.mesActual(s);
    return {
      crop: this.deps.crops.find(s.cultivo),
      dia: s.dia,
      mes,
      clima: this.deps.scenarios.create(s.escenario).mes(mes),
      cropOf: (nombre) => this.deps.crops.find(nombre),
      soilOf: this.deps.soilOf,
    };
  }

  // ---------- Grilla y presentación (pasos 01 y 03)

  select(tileId: string | null): void {
    this.store.setState({ selectedId: tileId });
  }

  setOverlay(overlay: Overlay): void {
    this.store.setState({ overlay });
  }

  resizeGrid(preset: SizePreset): void {
    const config = new GridConfigBuilder().preset(preset).seed(this.state.config.seed).build();
    this.store.setState({
      config,
      tiles: createGrid(config, soilClasses),
      selectedId: null,
      dia: 0,
      cosechas: [],
      mensaje: { tipo: 'ok', texto: `Grilla ${config.rows}×${config.cols} regenerada.` },
    });
  }
}

export const simulationController = new SimulationController(useSimStore, container);
