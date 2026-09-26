/**
 * Store lógico (Zustand): ÚNICA fuente de verdad. La escena 3D solo lee de aquí (docs/01).
 * Nuevos slices por fase (clima, sandbox…) se agregan en este directorio.
 */
import { create } from 'zustand';
import { SoilRepository } from '@/data';
import { createGrid, GridConfigBuilder, type GridConfig, type TileNode } from '@/domain/grid';

/** Presentación dinámica (design.md §1) */
export type ViewMode = 'superficie' | 'corte' | 'sandbox';
/** Overlays temáticos sobre la cara superior */
export type Overlay = 'suelo' | 'humedad' | 'ph';

interface SimState {
  config: GridConfig;
  tiles: TileNode[];
  selectedId: string | null;
  viewMode: ViewMode;
  overlay: Overlay;
  regenerate: (config: GridConfig) => void;
  select: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setOverlay: (overlay: Overlay) => void;
}

const soilClasses = SoilRepository.all().map((t) => t.clase);
const initialConfig = new GridConfigBuilder().preset('demo').seed(2026).build();

export const useSimStore = create<SimState>()((set) => ({
  config: initialConfig,
  tiles: createGrid(initialConfig, soilClasses),
  selectedId: null,
  viewMode: 'superficie',
  overlay: 'suelo',
  regenerate: (config) => set({ config, tiles: createGrid(config, soilClasses), selectedId: null }),
  select: (selectedId) => set({ selectedId }),
  setViewMode: (viewMode) => set({ viewMode }),
  setOverlay: (overlay) => set({ overlay }),
}));

export const useSelectedTile = () =>
  useSimStore((s) => (s.selectedId ? (s.tiles.find((t) => t.id === s.selectedId) ?? null) : null));
