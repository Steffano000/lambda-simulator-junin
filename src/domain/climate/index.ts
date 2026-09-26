/**
 * Paso 05 · Escenarios climáticos y eventos JSON (EP-06.1, 06.2).
 * Ver docs/05-escenarios-climaticos.md.
 *
 * Patrones: Strategy (`ClimateScenario`) · Interpreter (`EventEngine`) ·
 * Adapter (escenario personalizado) · Observer (clock de ticks).
 *
 * TODO(paso-05): parser/validador de escenarios personalizados y EventEngine.
 */
import type { ClimaMes } from '@/data/types';

export interface ClimateScenario {
  nombre: string;
  /** Los 12 meses con et0, lluvia, tmed, tmin */
  meses: readonly ClimaMes[];
  personalizado: boolean;
}

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
