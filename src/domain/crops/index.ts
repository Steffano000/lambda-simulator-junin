/**
 * Paso 04 · Motor de datos reales: ciclo de cultivo derivado (EP-03.2, 04.1, 04.2).
 * Ver docs/04-motor-datos-fenologia.md.
 *
 * `FenologiaEngine` es una función PURA y sin estado; recibe los datos por inyección
 * (Repository/DI) y debe cuadrar con scripts/derivar_ciclos.py.
 *
 * Implementado: etapas por días, Kc diario FAO-56, requisitos y zonificación.
 * TODO(paso-04): partición en meses de 30.42 días y yield por balance hídrico (derivar_ciclos.py).
 */
import type { ClimaMes, Cultivo } from '@/data/types';

export { Crop, MESES, type ContextoSiembra, type EtapaVisual, type Faltante } from './Crop';
export { CropFactory } from './CropFactory';
export {
  RequirementFactory,
  UMBRALES,
  umbralHumedad,
  type Requirement,
  type RequirementId,
} from './requirements';

export type EtapaFenologica = 'inicial' | 'desarrollo' | 'media' | 'final';

export interface EstadoCultivo {
  etapa: EtapaFenologica;
  kc: number;
  gdd: number;
  /** mm acumulados */
  etc: number;
  /** lluvia − ETc acumulado (mm) */
  balance: number;
  /** t/ha estimado */
  yield: number;
  /** Motivos de bloqueo de siembra (zonificación) */
  bloqueos: string[];
}

/** Strategy: convención de curva Kc (promedio mensual vs tick diario). */
export interface KcStrategy {
  kc(dia: number, cultivo: Cultivo): number;
}

/** Strategy: cálculo de rendimiento (factor lineal en MVP → CHI en V1.0). */
export interface YieldStrategy {
  yield(cultivo: Cultivo, balanceAcumulado: number, chiMedio?: number): number;
}

export type FenologiaEngine = (dia: number, cultivo: Cultivo, clima: readonly ClimaMes[]) => EstadoCultivo;
export {
  DESCANSO_DIAS,
  ETIQUETA_DEMANDA,
  EXTRACCION_N,
  RECUPERACION_DESCANSO,
  demandaN,
  type DemandaN,
} from './nutrients';
