/**
 * Paso 08 · Presets y casos estáticos (EP-08.1). Ver docs/08-presets-casos.md.
 *
 * Patrones: Registry + Factory · Builder · Memento · Command (`LoadPreset`).
 *
 * TODO(paso-08): builders de Valle Interandino, Altiplano/Puna y Ladera/Terraza.
 */
import type { GridConfig, TileNode } from '../grid';

export type PresetId = 'valle-interandino' | 'altiplano-puna' | 'ladera-terraza';

export interface PresetState {
  config: GridConfig;
  tiles: TileNode[];
  escenario: string;
}

export type PresetBuilder = () => PresetState;

export type PresetRegistry = Record<PresetId, { nombre: string; build: PresetBuilder }>;
