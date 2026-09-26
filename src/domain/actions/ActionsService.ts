/**
 * Paso 02 · Facade: ÚNICO punto que escribe el estado agronómico de una celda.
 * La UI y los tests usan la misma validación (docs/02 · Arquitectura).
 */
import type { TileNode } from '../grid';
import { CommandFactory, type ToolId } from './CommandFactory';
import type { ActionContext, Cosecha } from './TileCommand';

export interface ActionResult {
  ok: boolean;
  /** Motivo del bloqueo o texto de éxito */
  mensaje: string;
  tiles: TileNode[];
  cosecha?: Cosecha;
}

export class ActionsService {
  constructor(private readonly factory = new CommandFactory()) {}

  execute(tool: ToolId, tileId: string, grid: TileNode[], ctx: ActionContext): ActionResult {
    const command = this.factory.create(tool);
    const outcome = command.run(grid, tileId, ctx);
    if (typeof outcome === 'string') return { ok: false, mensaje: outcome, tiles: grid };
    return { ok: true, mensaje: command.exito, tiles: outcome.tiles, cosecha: outcome.cosecha };
  }

  /** Motivo por el que la herramienta no aplica a la celda (o null). */
  check(tool: ToolId, tile: TileNode, ctx: ActionContext): string | null {
    return this.factory.create(tool).check(tile, ctx);
  }

  etiqueta(tool: ToolId): string {
    return this.factory.create(tool).etiqueta;
  }
}
