/**
 * Demanda de nitrógeno de cada cultivo (de `efecto_nitrogeno` en data/cultivos.json) y su
 * efecto sobre el suelo: lo que extrae la cosecha y cuánto descanso necesita la tierra.
 *
 * Cantidades de simulación provisionales (ppm de N en la capa arable): ajustables aquí.
 */
import type { Cultivo } from '@/data/types';

export type DemandaN = 'alta' | 'media' | 'fija';

export const ETIQUETA_DEMANDA: Record<DemandaN, string> = {
  alta: 'alta demanda de nitrógeno',
  media: 'demanda media de nitrógeno',
  fija: 'fija nitrógeno (leguminosa)',
};

/** N que se lleva la cosecha (ppm); negativo = lo aporta al suelo. */
export const EXTRACCION_N: Record<DemandaN, number> = { alta: 40, media: 25, fija: -15 };

/** Descanso recomendado tras la cosecha (días). */
export const DESCANSO_DIAS: Record<DemandaN, number> = { alta: 90, media: 60, fija: 0 };

/** Recuperación diaria del suelo en descanso (barbecho). */
export const RECUPERACION_DESCANSO = { nPorDia: 0.4, moPorDia: 0.01 } as const;

export function demandaN(c: Pick<Cultivo, 'efecto_nitrogeno'>): DemandaN {
  const efecto = c.efecto_nitrogeno.toLowerCase();
  if (efecto.includes('fija')) return 'fija';
  if (efecto.includes('alta')) return 'alta';
  return 'media';
}
