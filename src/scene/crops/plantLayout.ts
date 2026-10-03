/**
 * Fase 3 · Varias plantas por celda según el marco de plantación (INIA).
 *
 * Una celda del 3D mide `ladoM` metros (1 m en el simulador, el tamaño de chunk en la parcela
 * real). Con la distancia entre surcos y entre golpes se ubican las plantas reales de la celda
 * en surcos; la escala de cada planta sale del área que le toca (1 / plantas por m²).
 * Siembra al voleo (cebada, avena): se dibuja una cobertura pareja, sin contar plantas.
 * Si la escena pasaría de MAX_PLANTAS_ESCENA, se dibuja una muestra pareja (el conteo real
 * sigue en el inspector de la celda).
 */
import type { SiembraCultivo } from '@/data/types';

export const MAX_PLANTAS_ESCENA = 12_000;
/** Cobertura visual de la siembra al voleo (plantas dibujadas por m²; no es un dato) */
const VOLEO_VISUAL_M2 = 9;

export interface Disposicion {
  /** Posiciones dentro de la celda (−0.5 a 0.5, en unidades de celda) */
  pos: [number, number][];
  /** Escala de cada planta frente al modelo de 1 m */
  escala: number;
  /** Plantas reales en la celda (null = voleo) */
  reales: number | null;
}

const UNA: Disposicion = { pos: [[0, 0]], escala: 1, reales: 1 };

/** Plantas reales por m² del marco (null si es al voleo o no hay dato) */
export function plantasM2(m: SiembraCultivo | undefined): number | null {
  if (!m) return null;
  if (m.plantas_m2 != null) return m.plantas_m2;
  if (m.entre_surcos_m && m.entre_plantas_m && m.plantas_por_golpe)
    return m.plantas_por_golpe / (m.entre_surcos_m * m.entre_plantas_m);
  return null;
}

/**
 * @param muestra 0-1: fracción a dibujar cuando la escena tiene demasiadas plantas
 */
export function disposicionPlantas(
  m: SiembraCultivo | undefined,
  ladoM: number,
  areaM2: number,
  muestra = 1,
): Disposicion {
  if (!m) return UNA;
  const densidad = plantasM2(m);
  const voleo = densidad == null;
  const entreSurcos = m.entre_surcos_m ?? 1 / Math.sqrt(VOLEO_VISUAL_M2);
  // a lo largo del surco: un golpe cada entre_plantas_m, o la densidad lineal del chorro continuo
  const porMetro = voleo
    ? Math.sqrt(VOLEO_VISUAL_M2)
    : m.entre_plantas_m
      ? (m.plantas_por_golpe ?? 1) / m.entre_plantas_m
      : densidad * entreSurcos;
  let surcos = Math.max(1, Math.round(ladoM / entreSurcos));
  let porSurco = Math.max(1, Math.round(ladoM * porMetro));
  const objetivo = Math.max(1, Math.round(surcos * porSurco * Math.min(1, muestra)));
  if (objetivo < surcos * porSurco) {
    surcos = Math.min(surcos, objetivo);
    porSurco = Math.max(1, Math.round(objetivo / surcos));
  }
  const pos: [number, number][] = [];
  for (let i = 0; i < surcos; i++) {
    const x = (i + 0.5) / surcos - 0.5;
    for (let j = 0; j < porSurco; j++) pos.push([x, (j + 0.5) / porSurco - 0.5]);
  }
  // cada planta dibujada ocupa 1/n de la celda: su tamaño (en unidades de celda) sale de ahí
  const escala = Math.min(1, Math.sqrt(1 / pos.length) * 1.3);
  return {
    pos,
    escala: Math.max(0.06, escala),
    reales: densidad == null ? null : Math.round(densidad * areaM2),
  };
}
