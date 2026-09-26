/**
 * Recomendación tras la cosecha: cuánto dejar descansar el suelo según lo que se llevó el
 * cultivo, o qué sembrar en su lugar que pida menos nitrógeno (rotación).
 *
 * Reglas: el descanso depende de la demanda de N del cultivo cosechado; las alternativas
 * pertenecen a otra familia botánica (rotación) y piden igual o menos N, priorizando las
 * leguminosas que lo fijan.
 */
import { DESCANSO_DIAS, UMBRALES, demandaN, type Crop, type DemandaN } from '../crops';
import type { Textura } from '../terrain';

export interface Alternativa {
  cultivo: string;
  demanda: DemandaN;
  /** N mínimo que pide para sembrarse (ppm) */
  nMinimo: number;
  /** El N actual del suelo alcanza sin abonar */
  alcanzaN: boolean;
  motivo: string;
}

export interface Recomendacion {
  demanda: DemandaN;
  diasDescanso: number;
  /** N medio del suelo tras la cosecha (ppm) */
  nSuelo: number;
  motivo: string;
  alternativas: Alternativa[];
}

const ORDEN: Record<DemandaN, number> = { fija: 0, media: 1, alta: 2 };

export const nMinimoDe = (d: DemandaN): number =>
  d === 'fija' ? 0 : d === 'alta' ? UMBRALES.nitrogenoAltaDemanda : UMBRALES.nitrogenoExtrae;

export class FallowAdvisor {
  static recomendar(
    cosechado: Crop,
    nSuelo: number,
    candidatos: readonly Crop[],
    textura?: Textura,
  ): Recomendacion {
    const demanda = demandaN(cosechado.datos);
    const diasDescanso = DESCANSO_DIAS[demanda];

    const alternativas = candidatos
      .filter((c) => c.nombre !== cosechado.nombre && c.datos.familia !== cosechado.datos.familia)
      .filter((c) => !textura || c.texturaCompatible(textura))
      .map((c) => {
        const d = demandaN(c.datos);
        const nMinimo = nMinimoDe(d);
        return { c, d, nMinimo };
      })
      .filter(({ d }) => ORDEN[d] <= ORDEN[demanda])
      .sort((a, b) => ORDEN[a.d] - ORDEN[b.d] || a.nMinimo - b.nMinimo)
      .map(({ c, d, nMinimo }) => ({
        cultivo: c.nombre,
        demanda: d,
        nMinimo,
        alcanzaN: nSuelo >= nMinimo,
        motivo:
          d === 'fija'
            ? 'Leguminosa: fija nitrógeno y devuelve fertilidad al suelo.'
            : `Otra familia (${c.datos.familia}): rompe el ciclo de plagas; pide N ≥ ${nMinimo} ppm.`,
      }));

    const motivo =
      diasDescanso > 0
        ? `${cosechado.nombre} ${demanda === 'alta' ? 'extrae mucho' : 'extrae'} nitrógeno: el suelo quedó con ${nSuelo.toFixed(0)} ppm. Déjalo descansar ${diasDescanso} días o rota a un cultivo que pida menos.`
        : `${cosechado.nombre} fija nitrógeno: el suelo quedó con ${nSuelo.toFixed(0)} ppm y puede volver a sembrarse sin descanso.`;

    return { demanda, diasDescanso, nSuelo, motivo, alternativas };
  }
}
