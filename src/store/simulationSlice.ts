/** Estado del flujo: fase, escenario, calendario, herramienta, cultivo y plantaciones. */
import type { StateCreator } from 'zustand';
import { ClimateRepository } from '@/data';
import type { Cosecha, ToolId } from '@/domain/actions';
import type { RegistroAccion, ReporteCosecha } from '@/domain/economy';
import type { OrientacionSurco } from '@/domain/grid';
import type { Plantacion } from '@/domain/plantation';
import type { ResumenAvance } from '@/domain/simulation';

/** Flujo: Terreno → Tratamiento → Cultivos (la plantación y el ambiente son paneles fijos). */
export type Fase = 'terreno' | 'tratamiento' | 'cultivos' | 'cosecha';

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
  /** Orientación de los surcos al arar */
  direccionArado: OrientacionSurco;
  /** Vista previa translúcida del cultivo elegido sobre las celdas listas (fase cultivos) */
  previaCultivo: boolean;
  /** Bitácora de acciones aplicadas (fuente del resumen de cosecha) */
  bitacora: RegistroAccion[];
  /** Informes de recolección completada */
  reportes: ReporteCosecha[];
  /** Informe de cosecha abierto en pantalla */
  reporteAbierto: string | null;
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
  direccionArado: 'x',
  previaCultivo: true,
  bitacora: [],
  reportes: [],
  reporteAbierto: null,
  cultivo: null,
  correccion: null,
  plantaciones: [],
  cosechas: [],
  ultimoAvance: null,
  pasoDias: 10,
  mensaje: null,
});
