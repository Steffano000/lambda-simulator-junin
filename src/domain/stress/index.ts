/**
 * Paso 06 · Fenología avanzada y estrés: CHI y fuentes de estrés (EP-04.1, 04.2, 05.2).
 * Ver docs/06-fenologia-estres.md.
 *
 * Implementado: fuentes de estrés (Strategy) y HealthModel (Facade).
 * TODO(paso-06): transición de etapa por GDD, plagas y propagación a vecinas.
 */
import type { Cultivo } from '@/data/types';

export { chiEstado, HealthModel, type ChiEstado, type DiaSalud } from './HealthModel';
export {
  AnegamientoStress,
  DEFAULT_SOURCES,
  HeladaStress,
  HidricoStress,
  TASAS_SALUD,
  TermicoStress,
  type DiaCultivo,
  type StressEffect,
  type StressId,
  type StressSource,
} from './sources';

/** GDD = max(0, min(tmed, t_superior) − t_base); `null` si el cultivo no tiene t_base. */
export const gddDiario = (tmed: number, c: Pick<Cultivo, 't_base' | 't_superior'>): number | null =>
  c.t_base === null ? null : Math.max(0, Math.min(tmed, c.t_superior ?? tmed) - c.t_base);
