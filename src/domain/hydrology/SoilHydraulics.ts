/**
 * Variables hídricas de cada tipo de terreno.
 *
 * De data/terrenos.json (FAO-56, tabla 19): CC, PMP, agua útil (retención) y REW/TEW
 * (agua evaporable del suelo desnudo).
 * Supuestos por clase textural (no están en los datos; ajustables aquí):
 *  - Absorción = infiltración básica, rangos FAO (Irrigation Water Management, man. 5).
 *  - Saturación = porosidad total típica por textura (Saxton y Rawls 2006).
 *  - Drenaje = fracción del agua gravitacional (sobre CC) que sale del perfil por día.
 */
import type { Terreno } from '@/data/types';
import { texturaDe, type Textura } from '../terrain/TerrainProfile';

/** Infiltración básica (mm/h) por clase de suelo. */
const INFILTRACION_MM_H: Record<string, number> = {
  Arena: 30,
  'Arena franca': 25,
  'Franco arenoso': 20,
  Franco: 13,
  'Franco limoso': 10,
  Limo: 8,
  'Franco arcillo limoso': 6,
  'Arcilla limosa': 4,
  Arcilla: 3,
  'Franco arcilloso': 6,
};

/** Porosidad total θs (m³/m³) y drenaje diario por textura. */
const POR_TEXTURA: Record<Textura, { porosidad: number; drenajeDia: number; rew: number; tew: number }> = {
  ligera: { porosidad: 0.41, drenajeDia: 0.8, rew: 5, tew: 11 },
  media: { porosidad: 0.46, drenajeDia: 0.5, rew: 9, tew: 20 },
  pesada: { porosidad: 0.5, drenajeDia: 0.2, rew: 10, tew: 25 },
};

/** Profundidad de la capa activa sin cultivo (m); con cultivo manda `raiz_m`. */
export const PROFUNDIDAD_SUELO_M = 0.3;

/** Agua libre que puede guardar la superficie (mm = L/m²). */
export const ALMACEN_SUPERFICIE = {
  /** Surcos de arado: lomos de ~15 cm con un tercio del área en surco. */
  surcos: 50,
  /** Terreno sin arar: microdepresiones; el resto escurre. */
  plano: 5,
} as const;

/** El suelo recién trabajado infiltra mejor que el compactado. */
export const FACTOR_INFILTRACION_ARADO = 1.25;

export interface PropiedadesHidricas {
  clase: string;
  textura: Textura;
  /** Absorción: infiltración básica (mm/h) */
  absorcionMmH: number;
  /** Retención: agua útil entre CC y PMP (mm por metro de suelo) */
  retencionMmM: number;
  /** Drenaje: fracción del agua sobre CC que sale del perfil por día (0–1) */
  drenajeDia: number;
  /** Nivel de saturación en % del agua útil (100 = CC; más = agua gravitacional) */
  saturacionPct: number;
  /** Agua fácilmente evaporable (mm) — FAO-56 */
  rewMm: number;
  /** Agua total evaporable (mm) — FAO-56 */
  tewMm: number;
}

/** "8–12" → 10; "—" o vacío → null. */
function media(rango: string): number | null {
  const nums = rango.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export class SoilHydraulics {
  private static readonly cache = new Map<string, PropiedadesHidricas>();

  static of(terreno: Terreno): PropiedadesHidricas {
    const cached = SoilHydraulics.cache.get(terreno.clase);
    if (cached) return cached;

    const textura = texturaDe(terreno.clase);
    const t = POR_TEXTURA[textura];
    const props: PropiedadesHidricas = {
      clase: terreno.clase,
      textura,
      absorcionMmH: INFILTRACION_MM_H[terreno.clase] ?? 10,
      retencionMmM: terreno.agua_util_mm_m,
      drenajeDia: t.drenajeDia,
      saturacionPct: Math.round(
        ((t.porosidad - terreno.pmp_media) / (terreno.cc_media - terreno.pmp_media)) * 100,
      ),
      rewMm: media(terreno.rew_mm) ?? t.rew,
      tewMm: media(terreno.tew_mm) ?? t.tew,
    };
    SoilHydraulics.cache.set(terreno.clase, props);
    return props;
  }

  /** Capacidad hídrica (mm) de la capa activa: agua útil × profundidad. */
  static capacidadMm(props: PropiedadesHidricas, profundidadM: number): number {
    return props.retencionMmM * profundidadM;
  }
}
