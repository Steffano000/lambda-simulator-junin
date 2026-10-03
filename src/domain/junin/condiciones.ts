/**
 * Fase 3 · Condiciones de plantación: ¿se puede sembrar ESTE cultivo en ESTA parcela y campaña?
 *
 * evaluarSiembra() junta todas las reglas en una sola respuesta:
 *   { estado, razones[{ codigo, severidad, mensaje_es, dato_usado }], confianza, ... }
 * Si alguna razón es «bloqueo» el estado es «no_apta» y el motor de rendimiento no se muestra.
 *
 * Reglas (cada umbral es una constante con nombre):
 * - uso de suelo / áreas protegidas / casas (Fase 1): bloqueo
 * - altitud vs. rango del cultivo (bloqueo) y de la variedad INIA de referencia (advertencia)
 * - pendiente: > 15° advertencia, > 30° bloqueo (si cubre más de la mitad del área útil)
 * - temperatura corregida por altura cuando la parcela y el punto con datos difieren > 300 m,
 *   con el gradiente térmico calculado con los 10 puntos de Junín (no un valor de libro)
 * - helada: Tmín mensual corregida de los meses del ciclo vs. la helada letal del cultivo
 * - pH: rango absoluto (bloqueo) y óptimo (advertencia) de FAO EcoCrop
 * - textura dominante vs. textura preferida del cultivo
 * - ventana de siembra y meses con déficit severo (Ks < 0.5) del balance FAO-56
 * - cultivo de la provincia o no (DRA 2022) y área útil frente al área dibujada
 * - confianza por distancia al punto con datos: ≤ 10 km alta, ≤ 25 km media, más lejos baja,
 *   con un rango de rendimiento calculado con los puntos vecinos (no un ± inventado)
 */
import type { SiembraCultivo, SiembraCultivos } from '@/data/types';
import type { EscenarioId, NucleoJunin } from '@/data/junin/types';
import { usable } from './estadoChunk';
import type { GrillaChunks, ResumenParcela } from './parcela';
import { texturaDe } from '../terrain/textura';
import { rendimiento } from './simulador';

export type Severidad = 'info' | 'advertencia' | 'bloqueo';
export type EstadoSiembra = 'apta' | 'con_advertencias' | 'no_apta';
export type NivelConfianza = 'alta' | 'media' | 'baja';

export interface Razon {
  codigo: string;
  severidad: Severidad;
  mensaje_es: string;
  /** El dato con el que se decidió (para que se pueda revisar) */
  dato_usado: string;
  fuente?: string;
}

/** Diferencia de altura a partir de la cual se corrige la temperatura del punto */
export const UMBRAL_CORRECCION_ALTURA_M = 300;
export const PENDIENTE_ADVERTENCIA_GRADOS = 15;
export const PENDIENTE_BLOQUEO_GRADOS = 30;
/** Si más de este % del área útil supera la pendiente de bloqueo, la parcela no es apta */
export const PCT_AREA_PENDIENTE_BLOQUEO = 50;
/**
 * Margen sobre la helada letal: la Tmín MENSUAL es un promedio y no ve las heladas de una
 * noche (fenologia_cultivos.json, reglas.nota_helada_mensual). Supuesto del piloto.
 */
export const MARGEN_HELADA_C = 2;
/** Déficit severo en un mes: Ks del balance FAO-56 por debajo de este valor */
export const KS_DEFICIT_SEVERO = 0.5;
export const DISTANCIA_CONFIANZA_KM = { alta: 10, media: 25 } as const;
/** Puntos vecinos con los que se arma el rango del rendimiento según la confianza */
const VECINOS: Record<NivelConfianza, number> = { alta: 1, media: 2, baja: 3 };

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
const nombreMes = (yyyymm: string) => `${MESES_ES[Number(yyyymm.slice(5, 7)) - 1]} ${yyyymm.slice(2, 4)}`;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------
// Gradiente térmico (°C por km) calculado con los 10 puntos de Junín
// ---------------------------------------------------------------------------

export interface GradienteTermico {
  /** °C por cada 1000 m (negativo: hace más frío al subir) */
  tmed_c_km: number;
  tmin_c_km: number;
  /** Correlación de la recta (cuanto más cerca de -1, más confiable) */
  r_tmed: number;
  r_tmin: number;
  n_puntos: number;
}

function recta(x: number[], y: number[]): { b: number; r: number } {
  const n = x.length;
  const mx = x.reduce((a, v) => a + v, 0) / n;
  const my = y.reduce((a, v) => a + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return { b: sxy / (sxx || 1), r: sxy / Math.sqrt(sxx * syy || 1) };
}

/** Regresión de la temperatura media del escenario contra la altura de cada punto */
export function gradienteTermico(nucleo: NucleoJunin, escenario: EscenarioId): GradienteTermico {
  const x: number[] = [];
  const tmed: number[] = [];
  const tmin: number[] = [];
  for (const p of nucleo.puntos) {
    const meses = nucleo.sim.puntos[p.id]?.escenarios[escenario]?.meses;
    if (p.elevacion_m == null || !meses?.length) continue;
    x.push(p.elevacion_m);
    tmed.push(meses.reduce((a, m) => a + m.tmed_c, 0) / meses.length);
    tmin.push(meses.reduce((a, m) => a + m.tmin_c, 0) / meses.length);
  }
  const a = recta(x, tmed);
  const b = recta(x, tmin);
  return {
    tmed_c_km: r2(a.b * 1000),
    tmin_c_km: r2(b.b * 1000),
    r_tmed: r2(a.r),
    r_tmin: r2(b.r),
    n_puntos: x.length,
  };
}

// ---------------------------------------------------------------------------
// Marco de plantación (INIA): plantas por m² y por celda
// ---------------------------------------------------------------------------

export interface MarcoPlantacion {
  variedad: string;
  metodo: string;
  entre_surcos_m: number | null;
  entre_plantas_m: number | null;
  /** null = siembra al voleo: no se cuentan plantas */
  plantas_m2: number | null;
  semilla_kg_ha: number | null;
  fuente: string;
}

export function marcoDe(s: SiembraCultivo | undefined): MarcoPlantacion | null {
  if (!s) return null;
  let plantas = s.plantas_m2;
  if (plantas == null && s.entre_surcos_m && s.entre_plantas_m && s.plantas_por_golpe)
    plantas = s.plantas_por_golpe / (s.entre_surcos_m * s.entre_plantas_m);
  return {
    variedad: s.variedad,
    metodo: s.metodo,
    entre_surcos_m: s.entre_surcos_m,
    entre_plantas_m: s.entre_plantas_m,
    plantas_m2: plantas == null ? null : r2(plantas),
    semilla_kg_ha: s.semilla_kg_ha,
    fuente: s.fuente_marco,
  };
}

/** Plantas en una celda de `area_m2` (redondeado; null si se siembra al voleo) */
export const plantasEnCelda = (m: MarcoPlantacion | null, area_m2: number): number | null =>
  m?.plantas_m2 == null ? null : Math.round(m.plantas_m2 * area_m2);

/** kg por planta = rendimiento (t/ha) / plantas por hectárea */
export const kgPorPlanta = (m: MarcoPlantacion | null, rend_t_ha: number): number | null =>
  m?.plantas_m2 ? r2((rend_t_ha * 1000) / (m.plantas_m2 * 10_000)) : null;

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

export interface EntradaSiembra {
  cultivo: string;
  escenario: EscenarioId;
  campana: number;
  anterior: string | null;
  punto: string;
  distancia_km: number;
  chunks: GrillaChunks;
  resumen: ResumenParcela;
  nucleo: NucleoJunin;
  siembra: SiembraCultivos;
}

export interface MesCorregido {
  mes: string;
  tmin_punto: number;
  tmin_parcela: number;
  tmed_parcela: number;
  fase: string | null;
  sens_helada: number | null;
}

export interface EvaluacionSiembra {
  estado: EstadoSiembra;
  razones: Razon[];
  confianza: {
    nivel: NivelConfianza;
    distancia_km: number;
    /** Rango del rendimiento en el punto con el clima de los puntos vecinos (t/ha) */
    rango_t_ha: [number, number] | null;
    puntos_usados: string[];
  };
  correccion: {
    dif_altura_m: number | null;
    aplicada: boolean;
    gradiente: GradienteTermico;
    delta_tmin_c: number;
    delta_tmed_c: number;
  };
  /** Meses del ciclo con la temperatura corregida a la altura de la parcela */
  meses: MesCorregido[];
  /** Factor por helada (1 = sin daño): 1 − sensibilidad de la fase más dañada */
  factor_helada: number;
  marco: MarcoPlantacion | null;
}

const razon = (
  codigo: string,
  severidad: Severidad,
  mensaje_es: string,
  dato_usado: string,
  fuente?: string,
): Razon => ({ codigo, severidad, mensaje_es, dato_usado, ...(fuente ? { fuente } : {}) });

/** Meses del ciclo: de la campaña del balance FAO-56 o del mes típico de siembra */
function mesesDelCiclo(e: EntradaSiembra): { meses: string[]; siembra: string | null; dias: number | null } {
  const p = e.nucleo.sim.puntos[e.punto];
  const camp = p?.escenarios[e.escenario]?.cultivos[e.cultivo]?.[e.campana];
  const feno = e.nucleo.fenologia.cultivos.find((c) => c.id === e.cultivo);
  const dias = feno?.ciclo_dias ?? e.nucleo.catalogo.cultivos[e.cultivo]?.ecocrop.ciclo_max_dias ?? null;
  let siembra = camp?.siembra ?? null;
  if (!siembra && feno && typeof feno.mes_siembra_tipico === 'number') {
    const anio = 2026 + e.campana + ((feno.mes_siembra_tipico as number) < 9 ? 1 : 0);
    siembra = `${anio}-${String(feno.mes_siembra_tipico).padStart(2, '0')}`;
  }
  if (!siembra || dias == null) return { meses: [], siembra, dias };
  const n = Math.max(1, Math.ceil(dias / 30.4));
  const [y, m] = siembra.split('-').map(Number);
  const meses = Array.from({ length: n }, (_, k) => {
    const t = y * 12 + (m - 1) + k;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  });
  return { meses, siembra, dias };
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function evaluarSiembra(e: EntradaSiembra): EvaluacionSiembra {
  const { nucleo, resumen, chunks } = e;
  const razones: Razon[] = [];
  const cat = nucleo.catalogo.cultivos[e.cultivo];
  const eco = cat?.ecocrop;
  const feno = nucleo.fenologia.cultivos.find((c) => c.id === e.cultivo);
  const sc = e.siembra.cultivos[e.cultivo];
  const nombre = cat?.nombre ?? e.cultivo;

  // 1. Uso de suelo, áreas protegidas y casas (Fase 1)
  if (!resumen.puede_sembrar)
    razones.push(
      razon(
        'USO_SUELO',
        'bloqueo',
        resumen.pct.bloqueado > 50
          ? `El ${resumen.pct.bloqueado} % de la parcela está bloqueado (ciudad, casas, agua, nieve o área protegida).`
          : 'La parcela no tiene datos suficientes para sembrar.',
        `bloqueado ${resumen.pct.bloqueado} %, con datos ${resumen.pct_cubierto} %`,
        'ESA WorldCover 2021, WDPA, OpenStreetMap',
      ),
    );

  // 2. Altitud
  const elev = resumen.elevacion_media_m;
  const utiles = chunks.chunks.filter((c) => c.dentro && usable(c));
  const elevs = utiles.map((c) => c.elevacion_m).filter((x): x is number => x != null);
  const eMin = elevs.length ? Math.min(...elevs) : null;
  const eMax = elevs.length ? Math.max(...elevs) : null;
  const datoAlt =
    elev == null ? 'sin dato' : `${Math.round(elev)} m (${Math.round(eMin!)}-${Math.round(eMax!)} m)`;
  if (elev == null) {
    if (resumen.puede_sembrar)
      razones.push(razon('ALTITUD_SIN_DATO', 'advertencia', 'No hay altura de la parcela.', 'sin dato'));
  } else if (!sc?.altitud_cultivo && !sc?.altitud_variedad) {
    razones.push(
      razon(
        'ALTITUD_SIN_RANGO',
        'info',
        `No hay un rango de altitud con fuente para ${nombre}: no se evalúa.`,
        datoAlt,
      ),
    );
  } else {
    const [cMin, cMax] = sc.altitud_cultivo ?? [null, null];
    if ((cMin != null && elev < cMin) || (cMax != null && elev > cMax)) {
      razones.push(
        razon(
          'ALTITUD_FUERA_CULTIVO',
          'bloqueo',
          `A ${Math.round(elev)} m ${nombre} está fuera de su rango de cultivo (${cMin ?? '—'}-${cMax ?? '—'} m).`,
          datoAlt,
          sc.fuente_altitud_cultivo ?? undefined,
        ),
      );
    } else if (sc.altitud_variedad && (elev < sc.altitud_variedad[0] || elev > sc.altitud_variedad[1])) {
      razones.push(
        razon(
          'ALTITUD_FUERA_VARIEDAD',
          'advertencia',
          `A ${Math.round(elev)} m está fuera del rango de la variedad de referencia ${sc.variedad} (${sc.altitud_variedad[0]}-${sc.altitud_variedad[1]} m): busca una variedad adaptada a esa altura.`,
          datoAlt,
          sc.fuente_altitud_variedad ?? undefined,
        ),
      );
    } else {
      razones.push(
        razon(
          'ALTITUD_OK',
          'info',
          `Altura dentro del rango${sc.altitud_variedad ? ` de ${sc.variedad} (${sc.altitud_variedad[0]}-${sc.altitud_variedad[1]} m)` : ` del cultivo`}.`,
          datoAlt,
          (sc.fuente_altitud_variedad ?? sc.fuente_altitud_cultivo) || undefined,
        ),
      );
    }
  }

  // 3. Pendiente (área útil ponderada por la fracción dentro del polígono)
  const areaUtil = utiles.reduce((a, c) => a + c.fraccion, 0);
  const conPend = utiles.filter((c) => c.pendiente_grados != null);
  if (areaUtil > 0 && conPend.length) {
    const pct = (umbral: number) =>
      r1(
        (conPend.filter((c) => c.pendiente_grados! > umbral).reduce((a, c) => a + c.fraccion, 0) / areaUtil) *
          100,
      );
    const p30 = pct(PENDIENTE_BLOQUEO_GRADOS);
    const p15 = pct(PENDIENTE_ADVERTENCIA_GRADOS);
    const dato = `media ${resumen.pendiente_media_grados?.toFixed(1) ?? '—'}°, > ${PENDIENTE_ADVERTENCIA_GRADOS}°: ${p15} %, > ${PENDIENTE_BLOQUEO_GRADOS}°: ${p30} %`;
    if (p30 > PCT_AREA_PENDIENTE_BLOQUEO)
      razones.push(
        razon(
          'PENDIENTE_BLOQUEO',
          'bloqueo',
          `El ${p30} % del área útil tiene más de ${PENDIENTE_BLOQUEO_GRADOS}° de pendiente: no se recomienda cultivar (erosión).`,
          dato,
          'SRTM 90 m',
        ),
      );
    else if (p30 > 0 || p15 > 0)
      razones.push(
        razon(
          'PENDIENTE_ADVERTENCIA',
          'advertencia',
          `El ${p15} % del área útil supera ${PENDIENTE_ADVERTENCIA_GRADOS}°${p30 > 0 ? ` (y ${p30} % supera ${PENDIENTE_BLOQUEO_GRADOS}°)` : ''}: siembra en contorno o terrazas.`,
          dato,
          'SRTM 90 m',
        ),
      );
  }

  // 4. Corrección por altura de la temperatura del punto
  const gradiente = gradienteTermico(nucleo, e.escenario);
  const elevPunto = nucleo.puntos.find((p) => p.id === e.punto)?.elevacion_m ?? null;
  const dif = elev != null && elevPunto != null ? elev - elevPunto : null;
  const aplicada = dif != null && Math.abs(dif) > UMBRAL_CORRECCION_ALTURA_M;
  const dTmin = aplicada ? r2((gradiente.tmin_c_km * dif!) / 1000) : 0;
  const dTmed = aplicada ? r2((gradiente.tmed_c_km * dif!) / 1000) : 0;
  if (aplicada)
    razones.push(
      razon(
        'CORRECCION_ALTURA',
        'info',
        `La parcela está ${Math.abs(Math.round(dif!))} m ${dif! > 0 ? 'más arriba' : 'más abajo'} que el punto con datos: su temperatura se corrige ${dTmed > 0 ? '+' : ''}${dTmed} °C (media) y ${dTmin > 0 ? '+' : ''}${dTmin} °C (mínima).`,
        `gradiente ${gradiente.tmed_c_km} °C/km (r = ${gradiente.r_tmed}) y ${gradiente.tmin_c_km} °C/km para la mínima, de los ${gradiente.n_puntos} puntos de Junín`,
        'ERA5-Land + PISCO en los 10 puntos (escenario elegido)',
      ),
    );

  // 5. Helada y temperatura en los meses del ciclo
  const ciclo = mesesDelCiclo(e);
  const mesesEsc = nucleo.sim.puntos[e.punto]?.escenarios[e.escenario]?.meses ?? [];
  const letal = (feno?.helada_letal_c as number | undefined) ?? eco?.t_helada_letal_c ?? null;
  const meses: MesCorregido[] = [];
  for (const [k, mes] of ciclo.meses.entries()) {
    const m = mesesEsc.find((x) => x.mes === mes);
    if (!m) continue;
    const dia = k * 30.4;
    const fase = feno?.fases.find((f) => dia >= f.dia_ini && dia <= f.dia_fin) ?? null;
    meses.push({
      mes,
      tmin_punto: m.tmin_c,
      tmin_parcela: r2(m.tmin_c + dTmin),
      tmed_parcela: r2(m.tmed_c + dTmed),
      fase: fase?.fase ?? null,
      sens_helada: fase?.sens_helada ?? null,
    });
  }
  let factor_helada = 1;
  if (letal != null && meses.length) {
    const letales = meses.filter((m) => m.tmin_parcela < letal);
    const riesgo = meses.filter((m) => m.tmin_parcela >= letal && m.tmin_parcela < letal + MARGEN_HELADA_C);
    const dato = meses.map((m) => `${nombreMes(m.mes)} ${m.tmin_parcela} °C`).join(', ');
    if (letales.length) {
      const peor = Math.max(...letales.map((m) => m.sens_helada ?? 1));
      factor_helada = r2(1 - peor);
      razones.push(
        razon(
          factor_helada <= 0 ? 'HELADA_LETAL' : 'HELADA',
          factor_helada <= 0.5 ? 'bloqueo' : 'advertencia',
          `En ${letales.map((m) => nombreMes(m.mes)).join(', ')} la mínima media de la parcela queda bajo la helada letal de ${nombre} (${letal} °C)${factor_helada <= 0.5 ? `: la helada dañaría ${Math.round((1 - factor_helada) * 100)} % del cultivo en su fase más sensible. No es apta en esta campaña.` : `: el rendimiento baja × ${factor_helada}.`}`,
          `Tmín corregida: ${dato}`,
          'Helada letal: fenologia_cultivos.json (FAO EcoCrop); daño = sensibilidad de la fase (SENAMHI)',
        ),
      );
    } else if (riesgo.length) {
      razones.push(
        razon(
          'HELADA_RIESGO',
          'advertencia',
          `Riesgo de heladas nocturnas en ${riesgo.map((m) => nombreMes(m.mes)).join(', ')}: la mínima media está a menos de ${MARGEN_HELADA_C} °C de la helada letal (${letal} °C).`,
          `Tmín corregida: ${dato}`,
          'La Tmín mensual es un promedio: no ve cada noche (fenologia_cultivos.json)',
        ),
      );
    }
    const tmin = eco?.t_min_c;
    if (tmin != null) {
      const frios = meses.filter((m) => m.tmed_parcela < tmin);
      if (frios.length > meses.length / 2)
        razones.push(
          razon(
            'TEMPERATURA_BAJA',
            'advertencia',
            `En ${frios.length} de ${meses.length} meses del ciclo la temperatura media (${Math.min(...frios.map((m) => m.tmed_parcela))}-${Math.max(...frios.map((m) => m.tmed_parcela))} °C) está bajo el mínimo de ${nombre} (${tmin} °C): crecerá lento.`,
            `Tmed corregida por altura`,
            'FAO EcoCrop',
          ),
        );
    }
  } else if (!ciclo.meses.length) {
    razones.push(
      razon(
        'CICLO_SIN_DATO',
        'info',
        `No hay calendario de siembra para ${nombre}: no se evalúa la helada.`,
        '—',
      ),
    );
  }

  // 6. pH
  const ph = resumen.ph_medio;
  if (ph != null && eco?.ph_min != null && eco.ph_max != null) {
    if (ph < eco.ph_min || ph > eco.ph_max)
      razones.push(
        razon(
          'PH_FUERA',
          'bloqueo',
          `pH ${ph.toFixed(1)}: fuera del rango que tolera ${nombre} (${eco.ph_min}-${eco.ph_max}).`,
          `pH medio ${ph.toFixed(1)}`,
          'SoilGrids 250 m; rango FAO EcoCrop',
        ),
      );
    else if (eco.ph_opt_min != null && eco.ph_opt_max != null && (ph < eco.ph_opt_min || ph > eco.ph_opt_max))
      razones.push(
        razon(
          'PH_NO_OPTIMO',
          'advertencia',
          `pH ${ph.toFixed(1)}: fuera del óptimo (${eco.ph_opt_min}-${eco.ph_opt_max}); ${ph < eco.ph_opt_min ? 'encalar' : 'acidificar'} ayuda.`,
          `pH medio ${ph.toFixed(1)}`,
          'SoilGrids 250 m; rango FAO EcoCrop',
        ),
      );
  }

  // 7. Textura
  const pref = typeof feno?.textura_preferida === 'string' ? (feno.textura_preferida as string) : null;
  const tex = resumen.textura_dominante;
  if (pref && tex) {
    const clase = texturaDe(tex);
    if (/ligera|media|pesada/.test(pref) && !pref.includes(clase))
      razones.push(
        razon(
          'TEXTURA',
          'advertencia',
          `Suelo ${tex.toLowerCase()} (${clase}); ${nombre} prefiere textura ${pref}.`,
          `textura dominante ${tex}`,
          'SoilGrids; fenologia_cultivos.json',
        ),
      );
  }

  // 8. Ventana de siembra y déficit severo
  const camp = nucleo.sim.puntos[e.punto]?.escenarios[e.escenario]?.cultivos[e.cultivo]?.[e.campana];
  if (ciclo.siembra)
    razones.push(
      razon(
        'VENTANA_SIEMBRA',
        'info',
        `Siembra en ${nombreMes(ciclo.siembra)}; ciclo de ${ciclo.dias} días (${ciclo.meses.length} meses).`,
        camp ? 'mes de siembra del balance FAO-56' : 'mes típico de siembra (fenología)',
        'fenologia_cultivos.json (INIA, SENAMHI)',
      ),
    );
  if (camp) {
    const severos = Object.entries(camp.mensual).filter(([, m]) => m.ks < KS_DEFICIT_SEVERO);
    if (severos.length)
      razones.push(
        razon(
          'DEFICIT_SEVERO',
          'advertencia',
          `Déficit de agua severo en ${severos.map(([m]) => nombreMes(m)).join(', ')} (Ks < ${KS_DEFICIT_SEVERO}): planifica riego.`,
          severos.map(([m, x]) => `${nombreMes(m)} Ks ${x.ks.toFixed(2)}`).join(', '),
          'Balance hídrico FAO-56 con lluvia PISCO',
        ),
      );
  }

  // 9. Cultivo de la provincia y área útil
  const prov = nucleo.sim.puntos[e.punto]?.provincia;
  const enProv = nucleo.catalogo.provincias[prov ?? '']?.cultivos.find((c) => c.id === e.cultivo);
  if (!enProv || enProv.porcentaje < 1)
    razones.push(
      razon(
        'FUERA_DE_PROVINCIA',
        'advertencia',
        `${nombre} casi no se siembra en ${nucleo.catalogo.provincias[prov ?? '']?.nombre ?? 'la provincia'}: el rendimiento se escala con la aptitud EcoCrop.`,
        enProv ? `${enProv.porcentaje} % del área cosechada` : 'no figura en la DRA 2022',
        'DRA Junín 2022',
      ),
    );
  if (resumen.area_total_ha > 0)
    razones.push(
      razon(
        'AREA_UTIL',
        'info',
        `Área útil para sembrar: ${resumen.area_efectiva_ha.toFixed(3)} de ${resumen.area_total_ha.toFixed(3)} ha (${Math.round((resumen.area_efectiva_ha / resumen.area_total_ha) * 100)} %).`,
        `${resumen.n_con_dato + resumen.n_interpolado} chunks útiles`,
      ),
    );

  // 10. Confianza por distancia: rango con los puntos vecinos
  const d = e.distancia_km;
  const nivel: NivelConfianza =
    d <= DISTANCIA_CONFIANZA_KM.alta ? 'alta' : d <= DISTANCIA_CONFIANZA_KM.media ? 'media' : 'baja';
  const p0 = nucleo.sim.puntos[e.punto];
  const vecinos = p0
    ? Object.entries(nucleo.sim.puntos)
        .map(([id, p]) => ({ id, d: distKm(p0.lat, p0.lon, p.lat, p.lon) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, VECINOS[nivel])
        .map((x) => x.id)
    : [];
  const rends = vecinos
    .map((id) => rendimiento(id, e.escenario, e.cultivo, e.anterior, nucleo, e.campana)?.rend_t_ha)
    .filter((x): x is number => x != null);
  const rango: [number, number] | null = rends.length ? [Math.min(...rends), Math.max(...rends)] : null;
  if (nivel !== 'alta')
    razones.push(
      razon(
        'CONFIANZA',
        nivel === 'baja' ? 'advertencia' : 'info',
        `El punto con datos está a ${d.toFixed(1)} km: confianza ${nivel}. El rendimiento puede ir de ${rango?.[0] ?? '—'} a ${rango?.[1] ?? '—'} t/ha según el clima de ${vecinos.join(', ')}.`,
        `distancia ${d.toFixed(1)} km (alta ≤ ${DISTANCIA_CONFIANZA_KM.alta}, media ≤ ${DISTANCIA_CONFIANZA_KM.media})`,
      ),
    );

  const estado: EstadoSiembra = razones.some((r) => r.severidad === 'bloqueo')
    ? 'no_apta'
    : razones.some((r) => r.severidad === 'advertencia')
      ? 'con_advertencias'
      : 'apta';
  const orden: Record<Severidad, number> = { bloqueo: 0, advertencia: 1, info: 2 };
  razones.sort((a, b) => orden[a.severidad] - orden[b.severidad]);

  return {
    estado,
    razones,
    confianza: { nivel, distancia_km: r1(d), rango_t_ha: rango, puntos_usados: vecinos },
    correccion: {
      dif_altura_m: dif == null ? null : Math.round(dif),
      aplicada,
      gradiente,
      delta_tmin_c: dTmin,
      delta_tmed_c: dTmed,
    },
    meses,
    factor_helada,
    marco: marcoDe(sc),
  };
}
