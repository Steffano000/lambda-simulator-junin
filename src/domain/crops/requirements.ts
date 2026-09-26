/**
 * Prerrequisitos de siembra por celda, derivados de data/cultivos.json.
 * `RequirementFactory` construye la lista de cada cultivo (sin condicionales por especie).
 * Las herramientas declaran qué requisito resuelven (`TileCommand.resuelve`).
 */
import type { Cultivo } from '@/data/types';
import type { TileNode } from '../grid';

export type RequirementId =
  'preparacion' | 'ph-bajo' | 'ph-alto' | 'humedad' | 'nitrogeno' | 'materia-organica';

export interface Requirement {
  id: RequirementId;
  /** Nombre corto, p. ej. "pH mínimo" */
  etiqueta: string;
  /** Condición legible, p. ej. "pH ≥ 5.0" */
  condicion: string;
  /** `null` si la celda cumple; si no, el motivo concreto */
  check(tile: TileNode): string | null;
}

/**
 * Umbrales de simulación no presentes en los datos (ajustables).
 * - Humedad: agua fácilmente disponible FAO-56 → humedad ≥ (1 − p)·100; p = 0.5 si falta el dato.
 * - Nitrógeno y materia orgánica: supuestos del simulador hasta calibrar (paso 06).
 */
export const UMBRALES = {
  pPorDefecto: 0.5,
  nitrogenoAltaDemanda: 60,
  nitrogenoExtrae: 40,
  materiaOrganicaMin: 3,
} as const;

export const umbralHumedad = (c: Cultivo): number =>
  Math.round((1 - (c.p_agotamiento ?? UMBRALES.pPorDefecto)) * 100);

function nitrogenoMinimo(c: Cultivo): number {
  const efecto = c.efecto_nitrogeno.toLowerCase();
  if (efecto.includes('fija')) return 0;
  if (efecto.includes('alta')) return UMBRALES.nitrogenoAltaDemanda;
  return UMBRALES.nitrogenoExtrae;
}

export class RequirementFactory {
  static forCrop(c: Cultivo): Requirement[] {
    const reqs: Requirement[] = [
      {
        id: 'preparacion',
        etiqueta: 'Suelo preparado',
        condicion: 'Celda arada y libre',
        check: (t) => {
          if (t.canal) return 'La celda es un canal de riego.';
          if (t.vegetacionId) return 'La celda ya tiene un cultivo.';
          return t.estado === 'arado' ? null : 'Falta arar la celda.';
        },
      },
      {
        id: 'ph-bajo',
        etiqueta: 'pH mínimo',
        condicion: `pH ≥ ${c.ph_opt_min}`,
        check: (t) =>
          t.suelo.ph >= c.ph_opt_min
            ? null
            : `pH ${t.suelo.ph.toFixed(1)} < ${c.ph_opt_min}: suelo muy ácido.`,
      },
      {
        id: 'ph-alto',
        etiqueta: 'pH máximo',
        condicion: `pH ≤ ${c.ph_opt_max}`,
        check: (t) =>
          t.suelo.ph <= c.ph_opt_max
            ? null
            : `pH ${t.suelo.ph.toFixed(1)} > ${c.ph_opt_max}: suelo muy alcalino.`,
      },
      {
        id: 'humedad',
        etiqueta: 'Humedad disponible',
        condicion: `Humedad ≥ ${umbralHumedad(c)} %`,
        check: (t) =>
          t.humedad >= umbralHumedad(c) ? null : `Humedad ${t.humedad} % < ${umbralHumedad(c)} %.`,
      },
    ];

    const nMin = nitrogenoMinimo(c);
    if (nMin > 0) {
      reqs.push({
        id: 'nitrogeno',
        etiqueta: 'Nitrógeno',
        condicion: `N ≥ ${nMin} ppm (${c.efecto_nitrogeno.toLowerCase()})`,
        check: (t) => (t.suelo.n >= nMin ? null : `N ${t.suelo.n} ppm < ${nMin} ppm.`),
      });
    }

    if (c.textura_preferida.toLowerCase().includes('orgánica')) {
      const mo = UMBRALES.materiaOrganicaMin;
      reqs.push({
        id: 'materia-organica',
        etiqueta: 'Materia orgánica',
        condicion: `M.O. ≥ ${mo} % (prefiere suelo orgánico)`,
        check: (t) => (t.suelo.materiaOrganica >= mo ? null : `M.O. ${t.suelo.materiaOrganica} % < ${mo} %.`),
      });
    }

    return reqs;
  }
}
