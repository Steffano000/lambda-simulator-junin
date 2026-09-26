/**
 * Paso 02 · Acciones por celda (EP-05.1). Ver docs/02-acciones-por-celda.md.
 *
 * Patrones: Command + Template Method (`TileCommand`) · Factory Method (`CommandFactory`) ·
 * State (`CellLifecycle` en TileNode) · Facade (`ActionsService`, único punto de escritura).
 */
export {
  ActionsService,
  type ActionResult,
  type BatchResult,
  type Omitida,
  type ToolInfo,
} from './ActionsService';
export { CommandFactory, TOOL_IDS, type ToolId } from './CommandFactory';
export { ABONOS, ENMIENDAS } from './commands/tratamientos';
export { CANAL, DRENAJE, INUNDACION, RIEGO } from './commands/riego';
export { PlantingValidator, type Pendiente, type ValidacionSiembra } from './PlantingValidator';
export { TileCommand, type ActionContext, type CategoriaAccion, type Cosecha } from './TileCommand';
export type { CellLifecycle } from '../grid';
