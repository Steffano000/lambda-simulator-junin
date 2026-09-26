/**
 * Generador meteorológico diario (validación de lluvia). A partir del clima mensual del
 * escenario decide, de forma determinista por semilla y día, si llueve y cuánto.
 *
 * Método (tipo WGEN/Richardson, simplificado):
 *  - Probabilidad de día lluvioso p = lluvia / (lluvia + K): meses húmedos → más días de lluvia.
 *  - Cantidad del día lluvioso ~ exponencial con media = lluvia_mes / (p · días del mes):
 *    así el promedio de muchos años reproduce la lluvia mensual del escenario.
 *  - Intensidad por cantidad → duración = cantidad / intensidad horaria.
 *  - Humedad relativa: estimada (el escenario no la trae): alta en días de lluvia.
 */
import type { ClimaMes } from '@/data/types';
import { createRng } from '../shared/random';
import type { ClimateScenario } from './ClimateScenario';
import { DIAS_POR_MES, EnvironmentModel } from './EnvironmentModel';

export type EstadoCielo = 'despejado' | 'nublado' | 'lluvia';
export type Intensidad = 'debil' | 'moderada' | 'fuerte' | 'muy-fuerte';

export const ETIQUETA_INTENSIDAD: Record<Intensidad, string> = {
  debil: 'Débil',
  moderada: 'Moderada',
  fuerte: 'Fuerte',
  'muy-fuerte': 'Muy fuerte',
};

/** Parámetros del generador (ajustables). */
export const PARAM_METEO = {
  /** K de p = lluvia / (lluvia + K), en mm/mes */
  kProbabilidad: 60,
  pMin: 0.03,
  pMax: 0.8,
  /** Tope de un evento, en múltiplos de la media (evita valores absurdos) */
  topeEvento: 6,
  /** HR desde la que se forman nubes */
  hrNubes: 65,
} as const;

/** Límite superior (mm) y tasa horaria (mm/h) de cada intensidad. */
const INTENSIDADES: { id: Intensidad; hasta: number; mmH: number }[] = [
  { id: 'debil', hasta: 5, mmH: 1.5 },
  { id: 'moderada', hasta: 20, mmH: 4 },
  { id: 'fuerte', hasta: 40, mmH: 10 },
  { id: 'muy-fuerte', hasta: Infinity, mmH: 20 },
];

export interface EventoLluvia {
  mm: number;
  intensidad: Intensidad;
  intensidadMmH: number;
  duracionH: number;
  /** Con tmin ≤ 0 °C la precipitación puede caer como granizo */
  tipo: 'lluvia' | 'granizo';
}

export interface Validacion {
  etiqueta: string;
  ok: boolean;
  detalle: string;
}

export interface ClimaDelDia {
  dia: number;
  mes: number;
  tmed: number;
  tmin: number;
  /** mm/día */
  et0: number;
  /** Humedad relativa estimada (%) */
  hr: number;
  probabilidad: number;
  cielo: EstadoCielo;
  nubes: boolean;
  lluvia: EventoLluvia | null;
  validaciones: Validacion[];
}

/** Semilla combinada estable para (semilla del terreno, día). */
const semillaDia = (seed: number, dia: number) =>
  (Math.imul(seed ^ 0x9e3779b9, 31) + Math.imul(dia + 1, 0x85ebca6b)) >>> 0;

export const probabilidadLluvia = (clima: ClimaMes): number =>
  Math.min(
    PARAM_METEO.pMax,
    Math.max(PARAM_METEO.pMin, clima.lluvia / (clima.lluvia + PARAM_METEO.kProbabilidad)),
  );

export class WeatherGenerator {
  static generar(escenario: ClimateScenario, mesInicio: number, dia: number, seed: number): ClimaDelDia {
    const mes = EnvironmentModel.mesActual(mesInicio, dia);
    const clima = escenario.mes(mes);
    const diario = EnvironmentModel.diario(clima);
    const rng = createRng(semillaDia(seed, dia));
    const [sorteo, uCantidad, uHr] = [rng(), rng(), rng()];

    const p = probabilidadLluvia(clima);
    const llueve = clima.lluvia > 0 && sorteo < p;
    const hr = Math.round(llueve ? 78 + 18 * uHr : Math.min(85, 35 + 45 * p + 12 * uHr));

    let lluvia: EventoLluvia | null = null;
    if (llueve) {
      const mediaEvento = clima.lluvia / (p * DIAS_POR_MES);
      const mm = Math.min(
        -mediaEvento * Math.log(1 - uCantidad * 0.999),
        mediaEvento * PARAM_METEO.topeEvento,
      );
      const nivel = INTENSIDADES.find((i) => mm <= i.hasta)!;
      lluvia = {
        mm: +mm.toFixed(1),
        intensidad: nivel.id,
        intensidadMmH: nivel.mmH,
        duracionH: +Math.min(24, Math.max(0.5, mm / nivel.mmH)).toFixed(1),
        tipo: clima.tmin <= 0 ? 'granizo' : 'lluvia',
      };
    }

    const nubes = llueve || hr >= PARAM_METEO.hrNubes;
    return {
      dia,
      mes,
      tmed: clima.tmed,
      tmin: clima.tmin,
      et0: diario.et0,
      hr,
      probabilidad: p,
      cielo: llueve ? 'lluvia' : nubes ? 'nublado' : 'despejado',
      nubes,
      lluvia,
      validaciones: [
        {
          etiqueta: 'Probabilidad del mes',
          ok: p >= 0.2,
          detalle: `${Math.round(p * 100)} % de días con lluvia (${clima.lluvia} mm/mes).`,
        },
        {
          etiqueta: 'Sorteo del día',
          ok: llueve,
          detalle: llueve ? 'Condiciones favorables: se forma lluvia.' : 'Sin precipitación hoy.',
        },
        {
          etiqueta: 'Humedad ambiental',
          ok: hr >= PARAM_METEO.hrNubes,
          detalle: `HR ${hr} % (estimada)${nubes ? ': hay nubosidad.' : ': cielo despejado.'}`,
        },
        {
          etiqueta: 'Temperatura',
          ok: clima.tmin > 0,
          detalle:
            clima.tmin > 0
              ? `tmin ${clima.tmin} °C: precipitación líquida.`
              : `tmin ${clima.tmin} °C: posible granizo o helada.`,
        },
      ],
    };
  }
}
