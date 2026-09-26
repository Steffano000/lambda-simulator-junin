/** Tipos de los JSON canónicos de data/ (nunca se reescriben; ver docs/10). */

export interface Cultivo {
  nombre: string;
  cientifico: string;
  familia: string;
  variedad: string;
  ciclo_dias: number;
  dias_inicial: number;
  dias_desarrollo: number;
  dias_media: number;
  dias_final: number;
  kc_inicial: number;
  kc_medio: number;
  kc_final: number;
  raiz_m: number;
  p_agotamiento: number | null;
  t_base: number | null;
  t_superior: number | null;
  t_opt_min: number;
  t_opt_max: number;
  helada_letal: number | null;
  ph_opt_min: number;
  ph_opt_max: number;
  ph_abs_min: number;
  ph_abs_max: number;
  textura_preferida: string;
  tolerancia_salinidad: string;
  efecto_nitrogeno: string;
  mes_siembra: number;
  rendimiento_junin_2025: number;
  fuente_kc: string;
}

export interface ClimaMes {
  mes: number;
  nombre: string;
  /** Evapotranspiración de referencia (mm/mes) */
  et0: number;
  /** Precipitación (mm/mes) */
  lluvia: number;
  tmed: number;
  tmin: number;
}

export type ClimaEscenarios = Record<string, ClimaMes[]>;

export interface Terreno {
  clase: string;
  clase_en: string;
  cc_min: number;
  cc_max: number;
  pmp_min: number;
  pmp_max: number;
  cc_media: number;
  pmp_media: number;
  agua_util_mm_m: number;
  rew_mm: string;
  tew_mm: string;
}

export interface Meta {
  nombre: string;
  origen: string;
  clima: string;
  unidades: Record<string, string>;
  fuentes: string[];
}
