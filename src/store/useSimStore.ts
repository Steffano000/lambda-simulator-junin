/**
 * MODELO de estado (Zustand): ÚNICA fuente de verdad. Solo contiene datos;
 * las intenciones del usuario pasan por los controladores (src/controllers).
 */
import { create } from 'zustand';
import { createClimateSlice, type ClimateSlice } from './climateSlice';
import { createGridSlice, type GridSlice } from './gridSlice';
import { createSimulationSlice, type SimulationSlice } from './simulationSlice';

export type { BorradorClima, VistaClima } from './climateSlice';
export type { Overlay } from './gridSlice';
export type { Correccion, Fase, Mensaje } from './simulationSlice';

export type SimState = GridSlice & SimulationSlice & ClimateSlice;

export const useSimStore = create<SimState>()((...a) => ({
  ...createGridSlice(...a),
  ...createSimulationSlice(...a),
  ...createClimateSlice(...a),
}));

export type SimStore = typeof useSimStore;
