/**
 * MODELO de estado (Zustand): ÚNICA fuente de verdad. Solo contiene datos;
 * las intenciones del usuario pasan por `SimulationController` (src/controllers).
 */
import { create } from 'zustand';
import { createGridSlice, type GridSlice } from './gridSlice';
import { createSimulationSlice, type SimulationSlice } from './simulationSlice';

export type { Overlay, ViewMode } from './gridSlice';
export type { ActiveTool, Mensaje } from './simulationSlice';

export type SimState = GridSlice & SimulationSlice;

export const useSimStore = create<SimState>()((...a) => ({
  ...createGridSlice(...a),
  ...createSimulationSlice(...a),
}));

export const useSelectedTile = () =>
  useSimStore((s) => (s.selectedId ? (s.tiles.find((t) => t.id === s.selectedId) ?? null) : null));
