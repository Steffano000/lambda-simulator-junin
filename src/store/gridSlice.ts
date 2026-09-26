/** Estado de la grilla y su presentación (pasos 01 y 03). */
import type { StateCreator } from 'zustand';
import { SoilRepository } from '@/data';
import { createGrid, GridConfigBuilder, type GridConfig, type TileNode } from '@/domain/grid';

/** Presentación dinámica (design.md §1) */
export type ViewMode = 'superficie' | 'corte' | 'sandbox';
/** Overlays temáticos sobre la cara superior */
export type Overlay = 'suelo' | 'humedad' | 'ph';

export interface GridSlice {
  config: GridConfig;
  tiles: TileNode[];
  selectedId: string | null;
  viewMode: ViewMode;
  overlay: Overlay;
}

export const soilClasses = SoilRepository.all().map((t) => t.clase);
const initialConfig = new GridConfigBuilder().preset('demo').seed(2026).build();

export const createGridSlice: StateCreator<GridSlice, [], [], GridSlice> = () => ({
  config: initialConfig,
  tiles: createGrid(initialConfig, soilClasses),
  selectedId: null,
  viewMode: 'superficie',
  overlay: 'suelo',
});
