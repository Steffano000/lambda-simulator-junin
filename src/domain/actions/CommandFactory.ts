/**
 * Paso 02 · Factory Method de herramientas: resuelve un `ToolId` a su comando
 * sin condicionales (registro de constructores). Agregar una herramienta = una línea.
 */
import {
  AbonarCommand,
  ArarCommand,
  CanalCommand,
  CosecharCommand,
  RegarCommand,
  RemoverCommand,
  SembrarCommand,
} from './commands';
import type { TileCommand } from './TileCommand';

const registry = {
  arar: () => new ArarCommand(),
  'abonar-organico': () => new AbonarCommand('organico'),
  'abonar-quimico': () => new AbonarCommand('quimico'),
  regar: () => new RegarCommand(),
  canal: () => new CanalCommand(),
  sembrar: () => new SembrarCommand(),
  cosechar: () => new CosecharCommand(),
  remover: () => new RemoverCommand(),
} satisfies Record<string, () => TileCommand>;

export type ToolId = keyof typeof registry;

export const TOOL_IDS = Object.keys(registry) as ToolId[];

export class CommandFactory {
  private readonly cache = new Map<ToolId, TileCommand>();

  create(tool: ToolId): TileCommand {
    let command = this.cache.get(tool);
    if (!command) {
      command = registry[tool]();
      this.cache.set(tool, command);
    }
    return command;
  }

  all(): TileCommand[] {
    return TOOL_IDS.map((id) => this.create(id));
  }
}
