/**
 * Paso 05 · Escenarios climáticos y eventos JSON (EP-06.1, 06.2).
 * Ver docs/05-escenarios-climaticos.md.
 *
 * Patrones: Strategy (`ClimateScenario`) · Factory/Registry (`ClimateScenarioFactory`) ·
 * Builder (`ScenarioBuilder`) · Adapter (`ScenarioCodec`) · Interpreter (`EventEngine`).
 *
 * TODO(paso-05): EventEngine (heladas, granizadas, sequías por eventos JSON).
 */
export { ClimateScenario, type ResumenClima } from './ClimateScenario';
export { ClimateScenarioFactory, LIMITES_CLIMA } from './ClimateScenarioFactory';
export {
  LIMITES_MODIFICADORES,
  MODIFICADORES_NEUTROS,
  ScenarioBuilder,
  type CampoClima,
  type Ediciones,
  type Modificadores,
} from './ScenarioBuilder';
export { ScenarioCodec, type EscenarioImportado } from './ScenarioCodec';
export {
  DIAS_POR_MES,
  EnvironmentModel,
  FRIO_NOCTURNO_C,
  type ClimaDia,
  type Modificador,
  type TipoModificador,
} from './EnvironmentModel';

export type TipoEvento = 'HELADA_METEOROLOGICA' | 'GRANIZADA' | 'SEQUIA';

export interface EventoEspecial {
  tipo: TipoEvento;
  intensidad: 'LEVE' | 'MODERADA' | 'SEVERA';
  /** Se respeta la clave del esquema EP-06.1 tal como está en spec.md */
  factorTemperatutaDelta?: number;
  factorLluviaDelta?: number;
  duracionTicks: number;
}

export interface EventoClimatico {
  estacion: string;
  diaSimulado: number;
  climaGlobal: {
    temperaturaAmbiente: number;
    precipitacionMm: number;
    humedadRelativaPct: number;
    vientoKmH: number;
  };
  eventosEspeciales: EventoEspecial[];
}
