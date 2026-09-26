/**
 * Paso 09 · Sandbox y experimentos de plantación (EP-09.1, 09.2).
 * Ver docs/09-sandbox-experimentos.md.
 *
 * TODO(paso-09): EditorService (Command + Memento), ExperimentRunner y FreezeTerrain.
 */
import type { EstadoCultivo } from '../crops';

export type TimeScale = 0 | 1 | 5 | 20;

export interface ControlesAmbientales {
  temperatura: number;
  lluviaMmH: number;
  radiacion: number;
  incidenciaPlagas: number;
}

export interface ResultadoExperimento {
  escenario: string;
  estadoFinal: EstadoCultivo;
}

export interface ExperimentRunner {
  run(cultivo: string, escenarios: string[]): ResultadoExperimento[];
}
