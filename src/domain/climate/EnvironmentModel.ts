/**
 * Contexto ambiental: convierte el clima mensual del escenario en valores diarios y
 * describe los modificadores del mes (seco, lluvioso, frío nocturno…).
 *
 * Supuesto MVP: lluvia y ET0 se reparten uniformemente en los días del mes.
 */
import type { ClimaMes } from '@/data/types';
import type { ClimateScenario } from './ClimateScenario';

export const DIAS_POR_MES = 365 / 12;

export interface ClimaDia {
  mes: number;
  tmed: number;
  tmin: number;
  /** mm/día */
  et0: number;
  /** mm/día */
  lluvia: number;
}

export type TipoModificador = 'favorable' | 'riesgo' | 'neutral';

export interface Modificador {
  tipo: TipoModificador;
  titulo: string;
  detalle: string;
}

/** Umbral de "frío nocturno" (°C) para advertir riesgo de heladas en cultivos sensibles. */
export const FRIO_NOCTURNO_C = 4;

export class EnvironmentModel {
  static mesActual(mesInicio: number, dia: number): number {
    return ((mesInicio - 1 + Math.floor(dia / DIAS_POR_MES)) % 12) + 1;
  }

  static diario(clima: ClimaMes): ClimaDia {
    return {
      mes: clima.mes,
      tmed: clima.tmed,
      tmin: clima.tmin,
      et0: clima.et0 / DIAS_POR_MES,
      lluvia: clima.lluvia / DIAS_POR_MES,
    };
  }

  static modificadores(escenario: ClimateScenario, mes: number): Modificador[] {
    const c = escenario.mes(mes);
    const balance = c.lluvia - c.et0;
    const lluviaMedia = escenario.lluviaAnual / 12;
    const mods: Modificador[] = [];

    if (balance < 0) {
      mods.push({
        tipo: 'riesgo',
        titulo: 'Déficit hídrico del mes',
        detalle: `La lluvia (${c.lluvia} mm) no cubre la ET0 (${c.et0} mm): faltan ${Math.abs(balance).toFixed(0)} mm. Los suelos se secan sin riego.`,
      });
    } else {
      mods.push({
        tipo: 'favorable',
        titulo: 'Excedente de lluvia',
        detalle: `La lluvia supera la ET0 en ${balance.toFixed(0)} mm: la humedad del suelo se recupera.`,
      });
    }

    if (c.lluvia > lluviaMedia * 1.4 && balance > 0) {
      mods.push({
        tipo: 'riesgo',
        titulo: 'Mes muy lluvioso',
        detalle: 'Excedente de agua: riesgo de anegamiento en suelos pesados; considere drenar.',
      });
    } else if (c.lluvia < lluviaMedia * 0.4) {
      mods.push({
        tipo: 'riesgo',
        titulo: 'Mes seco',
        detalle: 'Lluvia muy por debajo del promedio del escenario.',
      });
    }

    if (c.tmin <= FRIO_NOCTURNO_C) {
      mods.push({
        tipo: 'riesgo',
        titulo: 'Noches frías',
        detalle: `tmin ${c.tmin} °C: las heladas puntuales son probables en cultivos sensibles.`,
      });
    }

    return mods;
  }
}
