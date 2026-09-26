/**
 * Paso 02 · Factory Method de herramientas: resuelve un `ToolId` a su comando
 * sin condicionales (registro de constructores). Agregar una herramienta = una línea.
 */
import { CosecharCommand, DescansarCommand, RemoverCommand, SembrarCommand } from './commands/plantacion';
import { CanalCommand, DrenarCommand, InundarCommand, RegarCommand } from './commands/riego';
import { AbonarCommand, AcidificarCommand, ArarCommand, EncalarCommand } from './commands/tratamientos';
import type { CategoriaAccion, TileCommand } from './TileCommand';

const registry = {
  arar: () => new ArarCommand(),
  encalar: () => new EncalarCommand(),
  acidificar: () => new AcidificarCommand(),
  'abonar-organico': () => new AbonarCommand('organico'),
  'abonar-quimico': () => new AbonarCommand('quimico'),
  regar: () => new RegarCommand(),
  inundar: () => new InundarCommand(),
  drenar: () => new DrenarCommand(),
  canal: () => new CanalCommand(),
  sembrar: () => new SembrarCommand(),
  cosechar: () => new CosecharCommand(),
  remover: () => new RemoverCommand(),
  descansar: () => new DescansarCommand(),
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

  ids(categoria?: CategoriaAccion): ToolId[] {
    return categoria ? TOOL_IDS.filter((id) => this.create(id).categoria === categoria) : TOOL_IDS;
  }
}
