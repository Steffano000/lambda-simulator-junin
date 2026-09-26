/** Estado del flujo: fase, escenario, calendario, herramienta, cultivo y plantaciones. */
import type { StateCreator } from 'zustand';
import { ClimateRepository } from '@/data';
import type { Cosecha, ToolId } from '@/domain/actions';
import type { Plantacion } from '@/domain/plantation';
import type { ResumenAvance } from '@/domain/simulation';

/** Flujo: Terreno → Tratamiento → Cultivos (la plantación y el ambiente son paneles fijos). */
export type Fase = 'terreno' | 'tratamiento' | 'cultivos';

export interface Mensaje {
  tipo: 'ok' | 'error';
  texto: string;
  /** Detalle opcional (p. ej. celdas omitidas) */
  detalle?: string[];
}

/** Corrección en curso: volver a tratamientos para cumplir los requisitos de un cultivo. */
export interface Correccion {
  cultivo: string;
  tileIds: string[];
}

export interface SimulationSlice {
  fase: Fase;
  escenario: string;
  /** Mes calendario en que empieza la simulación (1–12) */
  mesInicio: number;
  /** Día simulado desde el inicio */
  dia: number;
  herramienta: ToolId | null;
  cultivo: string | null;
  correccion: Correccion | null;
  plantaciones: Plantacion[];
  cosechas: Cosecha[];
  ultimoAvance: ResumenAvance | null;
  /** Días del salto personalizado (control central de tiempo) */
  pasoDias: number;
  mensaje: Mensaje | null;
}

const escenarios = ClimateRepository.scenarioNames();

export const createSimulationSlice: StateCreator<SimulationSlice, [], [], SimulationSlice> = () => ({
  fase: 'terreno',
  // "Normal 2001-02" si existe; si no, el primero disponible
  escenario: escenarios.find((e) => e.startsWith('Normal')) ?? escenarios[0],
  mesInicio: 10,
  dia: 0,
  herramienta: null,
  cultivo: null,
  correccion: null,
  plantaciones: [],
  cosechas: [],
  ultimoAvance: null,
  pasoDias: 10,
  mensaje: null,
});
