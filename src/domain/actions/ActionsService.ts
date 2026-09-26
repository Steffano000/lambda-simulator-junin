/**
 * Paso 02 · Facade: ÚNICO punto que escribe el estado agronómico de las celdas.
 * La UI y los tests usan la misma validación (docs/02 · Arquitectura).
 */
import type { Crop } from '../crops';
import type { TileNode } from '../grid';
import type { TerrainProfile } from '../terrain';
import { CommandFactory, type ToolId } from './CommandFactory';
import type { ActionContext, CategoriaAccion, Cosecha, TileCommand } from './TileCommand';

export interface ActionResult {
  ok: boolean;
  /** Motivo del bloqueo o texto de éxito */
  mensaje: string;
  tiles: TileNode[];
  cosecha?: Cosecha;
}

export interface Omitida {
  tileId: string;
  motivo: string;
}

export interface BatchResult {
  tiles: TileNode[];
  aplicadas: string[];
  omitidas: Omitida[];
  cosechas: Cosecha[];
  mensaje: string;
}

/** Herramienta disponible para el terreno y su estado actual. */
export interface ToolInfo {
  id: ToolId;
  command: TileCommand;
  /** Celdas (del conjunto evaluado) donde se puede aplicar */
  aplicables: number;
}

export class ActionsService {
  constructor(private readonly factory = new CommandFactory()) {}

  command(tool: ToolId): TileCommand {
    return this.factory.create(tool);
  }

  execute(tool: ToolId, tileId: string, grid: TileNode[], ctx: ActionContext): ActionResult {
    const command = this.factory.create(tool);
    const outcome = command.run(grid, tileId, ctx);
    if (typeof outcome === 'string') return { ok: false, mensaje: outcome, tiles: grid };
    return { ok: true, mensaje: command.exito, tiles: outcome.tiles, cosecha: outcome.cosecha };
  }

  /** Aplica la herramienta a varias celdas; las que no cumplen se omiten sin bloquear al resto. */
  executeMany(tool: ToolId, tileIds: readonly string[], grid: TileNode[], ctx: ActionContext): BatchResult {
    const command = this.factory.create(tool);
    let tiles = grid;
    const aplicadas: string[] = [];
    const omitidas: Omitida[] = [];
    const cosechas: Cosecha[] = [];

    for (const tileId of tileIds) {
      const outcome = command.run(tiles, tileId, ctx);
      if (typeof outcome === 'string') {
        omitidas.push({ tileId, motivo: outcome });
        continue;
      }
      tiles = outcome.tiles;
      aplicadas.push(tileId);
      if (outcome.cosecha) cosechas.push(outcome.cosecha);
    }

    const mensaje = aplicadas.length
      ? `${command.etiqueta}: aplicado en ${aplicadas.length} celda(s)` +
        (omitidas.length ? `, ${omitidas.length} omitida(s).` : '.')
      : `${command.etiqueta}: ninguna celda cumple. ${omitidas[0]?.motivo ?? ''}`;
    return { tiles, aplicadas, omitidas, cosechas, mensaje };
  }

  check(tool: ToolId, tile: TileNode, ctx: ActionContext): string | null {
    return this.factory.create(tool).check(tile, ctx);
  }

  /**
   * Herramientas de una categoría que corresponden al terreno y que se pueden aplicar
   * en al menos una celda del conjunto dado (regla: no mostrar acciones que no apliquen).
   */
  disponibles(
    categoria: CategoriaAccion,
    terreno: TerrainProfile,
    tiles: readonly TileNode[],
    ctx: ActionContext,
  ): ToolInfo[] {
    return this.factory
      .ids(categoria)
      .map((id) => {
        const command = this.factory.create(id);
        if (!command.aplicaA(terreno)) return null;
        const aplicables = tiles.filter((t) => command.check(t, ctx) === null).length;
        return aplicables > 0 ? { id, command, aplicables } : null;
      })
      .filter((t): t is ToolInfo => t !== null);
  }

  /** Cultivos (aptos para el terreno) a los que la herramienta ayuda a cumplir requisitos. */
  sirvePara(tool: ToolId, crops: readonly Crop[]): Crop[] {
    const resuelve = this.factory.create(tool).resuelve;
    return crops.filter((c) => c.requisitos.some((r) => resuelve.includes(r.id)));
  }

  /** Herramientas de tratamiento que resuelven un requisito dado. */
  resolvedoras(requisito: string): ToolId[] {
    return this.factory
      .ids('tratamiento')
      .filter((id) => this.factory.create(id).resuelve.some((r) => r === requisito));
  }
}
