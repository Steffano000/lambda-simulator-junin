/** Estado de la simulación: escenario, calendario, herramienta, cultivo y bitácora. */
import type { StateCreator } from 'zustand';
import { ClimateRepository, CropRepository } from '@/data';
import type { Cosecha, ToolId } from '@/domain/actions';

/** Herramienta activa: una acción del paso 02 o solo inspeccionar. */
export type ActiveTool = ToolId | 'inspeccionar';

export interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
}

export interface SimulationSlice {
  escenario: string;
  /** Mes calendario en que empieza la simulación (1–12) */
  mesInicio: number;
  /** Día simulado desde el inicio */
  dia: number;
  herramienta: ActiveTool;
  cultivo: string;
  mensaje: Mensaje | null;
  cosechas: Cosecha[];
}

const escenarios = ClimateRepository.scenarioNames();
const cultivos = CropRepository.all();

export const createSimulationSlice: StateCreator<SimulationSlice, [], [], SimulationSlice> = () => ({
  // "Normal 2001-02" si existe; si no, el primero disponible
  escenario: escenarios.find((e) => e.startsWith('Normal')) ?? escenarios[0],
  mesInicio: cultivos[0]?.mes_siembra ?? 10,
  dia: 0,
  herramienta: 'inspeccionar',
  cultivo: cultivos[0]?.nombre ?? '',
  mensaje: null,
  cosechas: [],
});
