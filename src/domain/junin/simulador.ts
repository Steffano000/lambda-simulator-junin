/**
 * Motor de la versión mejorada (Junín). TypeScript puro: recibe los JSON ya cargados.
 * Port de INTEGRACION_SISTEMAS/frontend/simulador.js, con el motor que corresponde a cada cultivo:
 *
 * - Balance hídrico FAO-56 (papa, maíz amiláceo, quinua, haba, avena forrajera):
 *     rend = referencia DRA × (factor de agua del escenario ÷ factor de agua del clima normal)
 *            × rotación  (× aptitud si está fuera de su provincia)
 *   Es una ANOMALÍA, igual que AquaCrop: el DRA 2022 ya es lo que se cosechó con la lluvia real,
 *   así que multiplicarlo por el factor de agua absoluto descontaba la sequía «normal» dos veces.
 *   Un año normal da el rendimiento DRA; uno más seco, menos.
 * - AquaCrop (papa, quinua, cebada): anomalía del escenario sobre el rendimiento DRA.
 *     Para papa y quinua es un dato de apoyo; para cebada es el motor principal.
 * - Resto de cultivos: rendimiento DRA de la provincia, sin balance (× aptitud EcoCrop solo si
 *   el cultivo no se siembra en la provincia: el DRA de la provincia ya refleja su clima).
 */
import type {
  AquaCropResumen,
  Campana,
  CatalogoCultivos,
  ClaseHidrica,
  EscenarioId,
  Fenologia,
  NucleoJunin,
  SimuladorEscenarios,
} from '@/data/junin/types';

export const ESCENARIOS: readonly EscenarioId[] = ['normal', 'actual', 'neutro', 'nino', 'nina'];

export type Motor = 'balance_fao56' | 'aquacrop' | 'dra_aptitud';

export const MOTOR_ETIQUETA: Record<Motor, string> = {
  balance_fao56: 'Balance hídrico FAO-56',
  aquacrop: 'AquaCrop (anomalía sobre DRA)',
  dra_aptitud: 'Rendimiento DRA × aptitud EcoCrop (sin balance)',
};

/** Etiquetas obligatorias de la interfaz (ARQUITECTURA_HIBRIDA.md) */
export const ETIQUETA_SIMULACION = 'Simulación validada en Junín (lluvia corregida con PISCO/SENAMHI)';
export const ETIQUETA_MAPA_NASA = 'Imagen NASA (contexto, sin corrección local)';

/** 1. El punto con datos más cercano (distancia en el plano, suficiente dentro de Junín) */
export function puntoMasCercano(lat: number, lon: number, sim: SimuladorEscenarios): string {
  let mejor = '';
  let dmin = Infinity;
  const coslat = Math.cos((lat * Math.PI) / 180);
  for (const [id, p] of Object.entries(sim.puntos)) {
    const d = (p.lat - lat) ** 2 + ((p.lon - lon) * coslat) ** 2;
    if (d < dmin) {
      dmin = d;
      mejor = id;
    }
  }
  return mejor;
}

export interface OpcionCultivo {
  id: string;
  nombre: string;
  /** % del área cosechada de la provincia (DRA 2022) */
  porcentaje: number;
  /** true si se siembra en la provincia (≥ 1 % del área) */
  de_la_provincia: boolean;
  motor: Motor;
}

/** 2. Menú de cultivos: los de la provincia (≥ 1 %) primero; el resto se permite con aptitud */
export function menuCultivos(punto: string, nucleo: NucleoJunin, incluirOtros = false): OpcionCultivo[] {
  const { sim, catalogo, aquacrop } = nucleo;
  const prov = sim.puntos[punto]?.provincia;
  if (!prov) return [];
  const propios = (catalogo.provincias[prov]?.cultivos ?? []).filter((c) => c.porcentaje >= 1);
  const ids = new Set(propios.map((c) => c.id));
  const lista: OpcionCultivo[] = propios
    .filter((c) => catalogo.cultivos[c.id])
    .map((c) => ({
      id: c.id,
      nombre: catalogo.cultivos[c.id].nombre,
      porcentaje: c.porcentaje,
      de_la_provincia: true,
      motor: motorDe(punto, c.id, sim, aquacrop),
    }));
  if (incluirOtros) {
    for (const [id, c] of Object.entries(catalogo.cultivos)) {
      if (!ids.has(id))
        lista.push({
          id,
          nombre: c.nombre,
          porcentaje: 0,
          de_la_provincia: false,
          motor: motorDe(punto, id, sim, aquacrop),
        });
    }
  }
  return lista;
}

export function motorDe(
  punto: string,
  cultivo: string,
  sim: SimuladorEscenarios,
  aquacrop?: AquaCropResumen,
): Motor {
  if (sim.puntos[punto]?.escenarios.normal.cultivos[cultivo]) return 'balance_fao56';
  if (aquacrop?.puntos[punto]?.cultivos[cultivo]) return 'aquacrop';
  return 'dra_aptitud';
}

export interface MesClima {
  mes: string;
  lluvia: number;
  et0: number;
  tmin: number;
  tmax: number;
  balance: number;
  indice: number;
  clase: ClaseHidrica;
  /** semáforo P/ET0: verde ≥ 1, ámbar 0.5–1, rojo < 0.5 */
  semaforo: 'verde' | 'ambar' | 'rojo';
}

/** 3. Clima de 24 meses de un escenario con el semáforo P/ET0 */
export function climaEscenario(punto: string, escenario: EscenarioId, sim: SimuladorEscenarios): MesClima[] {
  return sim.puntos[punto].escenarios[escenario].meses.map((m) => ({
    mes: m.mes,
    lluvia: m.lluvia_mm,
    et0: m.et0_mm,
    tmin: m.tmin_c,
    tmax: m.tmax_c,
    balance: m.balance_mm,
    indice: m.indice_p_et0,
    clase: m.clase,
    semaforo: m.indice_p_et0 >= 1 ? 'verde' : m.indice_p_et0 >= 0.5 ? 'ambar' : 'rojo',
  }));
}

/** 4. Efecto de la rotación (tabla del equipo); 1 si no hay regla */
export function efectoRotacion(
  anterior: string | null | undefined,
  siguiente: string,
  feno: Fenologia,
): number {
  if (!anterior) return 1;
  const e = feno.rotacion.efectos.find((x) => x.anterior === anterior && x.siguiente === siguiente);
  return e ? e.efecto_rendimiento : 1;
}

/** Aptitud EcoCrop (0-1) de un cultivo en un punto; null si no se calculó */
export function aptitudDe(punto: string, cultivo: string, nucleo: NucleoJunin): number | null {
  return nucleo.aptitud.find((a) => a.punto === punto && a.cultivo === cultivo)?.aptitud ?? null;
}

/** Rendimiento DRA 2022 (t/ha) de la provincia; si no se siembra ahí, el de todo Junín */
export function rendimientoDra(
  provincia: string,
  cultivo: string,
  catalogo: CatalogoCultivos,
): number | null {
  const c = catalogo.cultivos[cultivo];
  if (!c) return null;
  const kg = c.provincias[provincia]?.rend_kg_ha ?? c.junin_2022?.rend_kg_ha;
  return kg ? kg / 1000 : null;
}

export interface ResultadoRendimiento {
  punto: string;
  provincia: string;
  escenario: EscenarioId;
  cultivo: string;
  anterior: string | null;
  campana: number;
  motor: Motor;
  motor_etiqueta: string;
  siembra: string | null;
  rend_t_ha: number;
  componentes: {
    rend_ref_t_ha: number;
    factor_agua: number | null;
    /** Factor de agua del mismo cultivo y campaña con el clima normal 1991-2020 */
    factor_agua_normal: number | null;
    /** factor_agua ÷ factor_agua_normal (1 = año normal) */
    anomalia_balance: number | null;
    efecto_rotacion: number;
    aptitud: number | null;
    anomalia_aquacrop: number | null;
  };
  /** Rendimiento AquaCrop del mismo escenario (apoyo para papa y quinua) */
  referencia_aquacrop_t_ha: number | null;
  alerta_helada: boolean;
  alerta_deficit: boolean;
  fuera_de_provincia: boolean;
  etiqueta: string;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** 5. Rendimiento de una campaña (0 = 2026-27, 1 = 2027-28) */
export function rendimiento(
  punto: string,
  escenario: EscenarioId,
  cultivo: string,
  anterior: string | null,
  nucleo: NucleoJunin,
  campana = 0,
): ResultadoRendimiento | null {
  const { sim, catalogo, fenologia, aquacrop } = nucleo;
  const p = sim.puntos[punto];
  if (!p) return null;
  const prov = p.provincia;
  const propios = new Set(
    (catalogo.provincias[prov]?.cultivos ?? []).filter((c) => c.porcentaje >= 1).map((c) => c.id),
  );
  const fuera = !propios.has(cultivo);
  const aptitud = aptitudDe(punto, cultivo, nucleo);
  const factorFuera = fuera ? (aptitud ?? 1) : 1;
  const rot = efectoRotacion(anterior, cultivo, fenologia);
  const aq = aquacrop.puntos[punto]?.cultivos[cultivo]?.escenarios[escenario]?.[campana] ?? null;
  const motor = motorDe(punto, cultivo, sim, aquacrop);
  const base = {
    punto,
    provincia: prov,
    escenario,
    cultivo,
    anterior,
    campana,
    motor,
    motor_etiqueta: MOTOR_ETIQUETA[motor],
    fuera_de_provincia: fuera,
    etiqueta: ETIQUETA_SIMULACION,
    referencia_aquacrop_t_ha: aq?.rend_esperado_t_ha ?? null,
  };

  if (motor === 'balance_fao56') {
    const camp: Campana | undefined = p.escenarios[escenario].cultivos[cultivo]?.[campana];
    if (!camp) return null;
    const normal = p.escenarios.normal?.cultivos[cultivo]?.[campana]?.factor_agua ?? null;
    const anomalia = normal ? r2(camp.factor_agua / normal) : 1;
    return {
      ...base,
      siembra: camp.siembra,
      rend_t_ha: r2(camp.rend_ref_t_ha * anomalia * rot * factorFuera),
      componentes: {
        rend_ref_t_ha: camp.rend_ref_t_ha,
        factor_agua: camp.factor_agua,
        factor_agua_normal: normal,
        anomalia_balance: anomalia,
        efecto_rotacion: rot,
        aptitud: fuera ? aptitud : null,
        anomalia_aquacrop: aq?.anomalia ?? null,
      },
      alerta_helada: camp.meses_riesgo_helada > 0,
      alerta_deficit: anomalia < 0.9,
    };
  }

  if (motor === 'aquacrop' && aq) {
    const ref = aquacrop.puntos[punto].cultivos[cultivo].rend_dra_2022_t_ha;
    return {
      ...base,
      siembra: null,
      rend_t_ha: r2(ref * aq.anomalia * rot * factorFuera),
      componentes: {
        rend_ref_t_ha: ref,
        factor_agua: null,
        factor_agua_normal: null,
        anomalia_balance: null,
        efecto_rotacion: rot,
        aptitud: fuera ? aptitud : null,
        anomalia_aquacrop: aq.anomalia,
      },
      alerta_helada: false,
      alerta_deficit: aq.anomalia < 0.9,
    };
  }

  const ref = rendimientoDra(prov, cultivo, catalogo);
  if (ref == null) return null;
  // La aptitud EcoCrop solo escala a los cultivos que NO se siembran en la provincia
  return {
    ...base,
    motor: 'dra_aptitud',
    motor_etiqueta: MOTOR_ETIQUETA.dra_aptitud,
    siembra: null,
    rend_t_ha: r2(ref * factorFuera * rot),
    componentes: {
      rend_ref_t_ha: r2(ref),
      factor_agua: null,
      factor_agua_normal: null,
      anomalia_balance: null,
      efecto_rotacion: rot,
      aptitud: fuera ? aptitud : null,
      anomalia_aquacrop: null,
    },
    alerta_helada: false,
    alerta_deficit: false,
  };
}
