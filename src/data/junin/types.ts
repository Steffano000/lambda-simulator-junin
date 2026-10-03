/**
 * Tipos de los JSON de public/data/junin (versión mejorada, región Junín).
 * Los genera pipeline/codigos/17_exportar_json.py a partir de la carpeta `datos`.
 * Todo valor faltante llega como `null` (nunca NaN ni Infinity).
 */

export type EscenarioId = 'normal' | 'actual' | 'neutro' | 'nino' | 'nina';
export type ClaseHidrica = 'sin deficit' | 'deficit moderado' | 'deficit severo';
export type ReglaUso = 'permitido' | 'advertencia' | 'bloqueado';

// ---------------------------------------------------------------------------
// app/simulador_escenarios.json
// ---------------------------------------------------------------------------
export interface MesEscenario {
  /** 'YYYY-MM' */
  mes: string;
  lluvia_mm: number;
  et0_mm: number;
  tmax_c: number;
  tmed_c: number;
  tmin_c: number;
  hum_suelo_m3m3: number | null;
  /** P − ET0 (mm) */
  balance_mm: number;
  /** P / ET0 */
  indice_p_et0: number;
  clase: ClaseHidrica;
  /** Intervalo del 80 % (no viene en el escenario 'normal') */
  lluvia_mm_inf80?: number;
  lluvia_mm_sup80?: number;
  et0_mm_inf80?: number;
  et0_mm_sup80?: number;
  tmin_c_inf80?: number;
  tmin_c_sup80?: number;
  [extra: string]: number | string | null | undefined;
}

export interface MesCampana {
  kc: number;
  etc_mm: number;
  eta_mm: number;
  ks: number;
  dr_fin_mm: number;
}

export interface Campana {
  /** 'YYYY-MM' */
  siembra: string;
  etc_mm: number;
  eta_mm: number;
  lluvia_ciclo_mm: number;
  factor_agua: number;
  meses_riesgo_helada: number;
  adt_mm: number;
  rend_ref_t_ha: number;
  rend_esperado_t_ha: number;
  fuente_rend_ref: string;
  mensual: Record<string, MesCampana>;
}

export interface SueloPunto {
  arena_pct: number;
  arcilla_pct: number;
  limo_pct: number;
  cos_pct: number | null;
  ph: number;
  cc_m3m3: number | null;
  pmp_m3m3: number | null;
  agua_util_mm_por_m: number | null;
}

export interface EscenarioPunto {
  meses: MesEscenario[];
  /** Solo los 5 cultivos con balance FAO-56: dos campañas (2026-27 y 2027-28) */
  cultivos: Record<string, Campana[]>;
}

export interface PuntoSimulador {
  lat: number;
  lon: number;
  provincia: string;
  suelo: SueloPunto;
  escenarios: Record<EscenarioId, EscenarioPunto>;
}

export interface SimuladorEscenarios {
  meta: {
    descripcion: string;
    escenarios: Record<EscenarioId, string>;
    ultimo_mes_observado: string;
    formulas?: Record<string, string>;
  };
  puntos: Record<string, PuntoSimulador>;
}

// ---------------------------------------------------------------------------
// app/catalogo_cultivos_junin.json
// ---------------------------------------------------------------------------
export interface EcoCrop {
  t_opt_min_c: number | null;
  t_opt_max_c: number | null;
  t_min_c: number | null;
  t_max_c: number | null;
  lluvia_opt_min_mm: number | null;
  lluvia_opt_max_mm: number | null;
  lluvia_min_mm: number | null;
  lluvia_max_mm: number | null;
  ph_opt_min: number | null;
  ph_opt_max: number | null;
  ph_min: number | null;
  ph_max: number | null;
  t_helada_letal_c: number | null;
  ciclo_min_dias: number | null;
  ciclo_max_dias: number | null;
}

export interface ProduccionProvincia {
  cosecha_ha: number;
  rend_kg_ha: number;
  precio_s_kg?: number | null;
  productos?: Record<string, { cosecha_ha: number; rend_kg_ha: number; precio_s_kg?: number | null }>;
}

export interface CultivoCatalogo {
  nombre: string;
  nombre_cientifico: string;
  categoria: string;
  nombres_dra: string[];
  junin_2022?: { cosecha_ha: number; rend_kg_ha: number };
  provincias: Record<string, ProduccionProvincia>;
  ecocrop: EcoCrop;
  ajuste_local?: Record<string, unknown>;
}

export interface ProvinciaCatalogo {
  nombre: string;
  region_natural: string;
  cosecha_total_ha_2022: number;
  cultivos: { id: string; cosecha_ha: number; porcentaje: number }[];
}

export interface PisoEcologico {
  id: string;
  nombre: string;
  alt_min_m: number;
  alt_max_m: number;
}

export interface CatalogoCultivos {
  meta: Record<string, unknown>;
  pisos_ecologicos: PisoEcologico[];
  provincias: Record<string, ProvinciaCatalogo>;
  cultivos: Record<string, CultivoCatalogo>;
}

// ---------------------------------------------------------------------------
// app/fenologia_cultivos.json
// ---------------------------------------------------------------------------
export interface FaseCultivo {
  n: number;
  fase: string;
  dia_ini: number;
  dia_fin: number;
  kc: number;
  t_opt_c?: [number, number];
  sens_agua: number;
  sens_helada?: number;
  nota?: string;
}

export interface CultivoFenologia {
  id: string;
  nombre: string;
  familia: string;
  ciclo_dias: number;
  rendimiento_ref_t_ha: number;
  fases: FaseCultivo[];
  [extra: string]: unknown;
}

export interface EfectoRotacion {
  anterior: string;
  siguiente: string;
  efecto_rendimiento: number;
  motivo: string;
}

export interface Fenologia {
  meta: Record<string, unknown>;
  cultivos: CultivoFenologia[];
  rotacion: { regla_familia: string; efectos: EfectoRotacion[]; nota?: string };
  [extra: string]: unknown;
}

// ---------------------------------------------------------------------------
// app/aquacrop_resumen.json
// ---------------------------------------------------------------------------
export interface CampanaAquaCrop {
  cosecha: string;
  aquacrop_t_ha_seco: number;
  anomalia: number;
  rend_esperado_t_ha: number;
}

export interface CultivoAquaCrop {
  aquacrop: string;
  siembra: string;
  aquacrop_prom_2013_2022_t_ha_seco: number;
  rend_dra_2022_t_ha: number;
  variabilidad_historica_cv: number | null;
  escenarios: Partial<Record<EscenarioId, CampanaAquaCrop[]>>;
}

export interface AquaCropResumen {
  meta: Record<string, string>;
  puntos: Record<string, { suelo_aquacrop: string; cultivos: Record<string, CultivoAquaCrop> }>;
}

// ---------------------------------------------------------------------------
// app/reglas_uso_suelo.json, app/puntos.json, cultivos/aptitud_puntos.json
// ---------------------------------------------------------------------------
export interface ReglasUsoSuelo {
  descripcion: string;
  criterio_parcela: string;
  worldcover: Record<string, { nombre: string; regla: ReglaUso; mensaje: string }>;
  [extra: string]: unknown;
}

export interface PuntoDatos {
  id: string;
  lat: number;
  lon: number;
  elevacion_m: number | null;
  provincia: string | null;
  piso_ecologico: string | null;
  suelo: SueloPunto | null;
}

export interface AptitudPunto {
  punto: string;
  provincia: string;
  piso_ecologico: string;
  cultivo: string;
  /** 0 a 1 (EcoCrop) */
  aptitud: number | null;
  mejor_mes_siembra: number | null;
  factor_limitante: string | null;
  registrado_por_dra_en_provincia: 'si' | 'no' | string;
}

// ---------------------------------------------------------------------------
// Grillas (grillas/*.json, clima/*, humedad/*, pisco/*) y parcelas (parcelas/*.json)
// ---------------------------------------------------------------------------
export interface CapaGrilla<T = number | null> {
  unidad: string;
  /** Si existe: valor real = dato / escala */
  escala?: number;
  descripcion?: string;
  datos: T[];
}

export interface CabeceraGrilla {
  crs: 'EPSG:4326';
  resolucion_grados: number;
  ancho: number;
  alto: number;
  /** [oeste, sur, este, norte] */
  bbox: [number, number, number, number];
}

export interface GrillaCapas extends CabeceraGrilla {
  descripcion: string;
  leyendas?: Record<string, unknown>;
  capas: Record<string, CapaGrilla>;
}

/** Series mensuales en grilla (lluvia PISCO, lluvia ERA5-Land, SMAP) */
export interface GrillaMensual extends CabeceraGrilla {
  descripcion: string;
  unidad: string;
  meses: string[];
  /** datos[k][i] = mes k, celda i */
  datos: (number | null)[][];
}

export interface Parcela {
  punto: string;
  lat: number;
  lon: number;
  provincia: string | null;
  filas: number;
  columnas: number;
  celda_m: number;
  bbox: [number, number, number, number];
  resumen: {
    elevacion_media_m: number | null;
    desnivel_m: number | null;
    pendiente_media_grados: number | null;
    cobertura_pct: Record<string, number>;
    reglas_pct: Record<ReglaUso, number>;
    se_puede_sembrar: boolean;
    texturas_pct: Record<string, number>;
  };
  capas: {
    elevacion_m: CapaGrilla;
    pendiente_grados: CapaGrilla;
    arena_pct: CapaGrilla;
    arcilla_pct: CapaGrilla;
    limo_pct: CapaGrilla;
    cos_pct: CapaGrilla;
    ph: CapaGrilla;
    dap_gcm3: CapaGrilla;
    n_gkg: CapaGrilla;
    cic_cmolkg: CapaGrilla;
    textura_usda: CapaGrilla<string | null>;
    textura_app: CapaGrilla<string | null>;
    worldcover: CapaGrilla;
    regla_uso: CapaGrilla<ReglaUso | null>;
    ndvi_medio: CapaGrilla;
    ndvi_ultimo_anio: CapaGrilla;
  };
}

/** clima/diario/{punto}.json: columnas; la fecha del valor i es inicio + i días */
export interface SerieDiaria {
  punto: string;
  lat: number;
  lon: number;
  inicio: string;
  fin: string;
  n: number;
  variables: Record<string, { unidad: string }>;
  datos: Record<string, (number | null)[]>;
}

export interface Manifiesto {
  nombre: string;
  generado: string;
  puntos: string[];
  total_mb: number;
  archivos: { archivo: string; bytes: number; descripcion: string; fuente: string; uso: string }[];
  avisos: string[];
  no_convertidos: { origen: string; motivo: string }[];
}

/** Lo mínimo que necesita el simulador (Fase 1, sin servidor) */
export interface NucleoJunin {
  sim: SimuladorEscenarios;
  catalogo: CatalogoCultivos;
  fenologia: Fenologia;
  aquacrop: AquaCropResumen;
  reglas: ReglasUsoSuelo;
  puntos: PuntoDatos[];
  aptitud: AptitudPunto[];
}
