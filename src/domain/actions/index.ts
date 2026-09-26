/**
 * Paso 02 · Acciones por celda (EP-05.1). Ver docs/02-acciones-por-celda.md.
 *
 * Patrones: Command (cada herramienta) · Strategy (herramienta activa) ·
 * State (ciclo de la celda) · Facade (`ActionsService`, único punto de escritura).
 *
 * TODO(paso-02): implementar comandos Arar, Abonar, Regar, InstalarCanal, Sembrar, Cosechar, Remover.
 */
import type { TileNode } from '../grid';
import type { Command } from '../shared';

/** Máquina de estados de la celda: Baldío → Arado → Sembrado → Maduro → Cosechado. */
export type CellLifecycle = 'baldio' | 'arado' | 'sembrado' | 'maduro' | 'cosechado';

export type ToolId = 'arar' | 'abonar' | 'regar' | 'canal' | 'sembrar' | 'cosechar' | 'remover';

export type TileCommand = Command<TileNode>;

export interface ActionResult {
  ok: boolean;
  /** Motivo del bloqueo, p. ej. "Coseche antes de arar" */
  motivo?: string;
  tiles: TileNode[];
}

export interface ActionsService {
  execute(tool: ToolId, target: TileNode, grid: readonly TileNode[]): ActionResult;
}
