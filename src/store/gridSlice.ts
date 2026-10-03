/** Estado del terreno, sus celdas, la selección por área y la presentación. */
import type { StateCreator } from 'zustand';
import { container } from '@/app/container';
import type { GridConfig, TileNode } from '@/domain/grid';
import type { TerrainOptions, TerrainProfile } from '@/domain/terrain';

/** Overlays temáticos sobre la cara superior */
export type Overlay = 'suelo' | 'humedad' | 'hidratacion' | 'ph' | 'salud' | 'fidelidad';

export interface GridSlice {
  /** Terreno confirmado; `null` mientras se elige (fase "terreno") */
  terreno: TerrainProfile | null;
  /** Opciones del terreno en edición (vista previa) */
  opcionesTerreno: TerrainOptions;
  config: GridConfig;
  tiles: TileNode[];
  /** Celdas seleccionadas (clic o arrastre de área) */
  seleccion: string[];
  overlay: Overlay;
}

/** Mezcla inicial: el primer preset de data/terrenos_mezclas.json (Valle de altiplano). */
export const OPCIONES_INICIALES: TerrainOptions = {
  mezcla: container.terrains.mezclaPorDefecto().datos,
  reaccion: 'neutro',
  tamano: 'demo',
};

const preview = container.terrains.createProfile(OPCIONES_INICIALES);

export const createGridSlice: StateCreator<GridSlice, [], [], GridSlice> = () => ({
  terreno: null,
  opcionesTerreno: OPCIONES_INICIALES,
  config: preview.config,
  tiles: container.terrains.createTiles(preview),
  seleccion: [],
  overlay: 'suelo',
});
