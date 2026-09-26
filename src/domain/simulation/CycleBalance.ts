/**
 * Paso 05 · Comparativa cultivo × escenario: ETc, lluvia y balance hídrico acumulados
 * durante el ciclo completo, sembrando en `mes_siembra` (docs/04 · funcionalidades 3–4).
 * Día a día: ETc = Kc(día) × ET0(mes)/días; balance = lluvia − ETc.
 */
import { EnvironmentModel, type ClimateScenario } from '../climate';
import type { Crop } from '../crops';

export interface BalanceCiclo {
  escenario: string;
  cultivo: string;
  etc: number;
  lluvia: number;
  balance: number;
  /** Días con tmin ≤ helada letal del cultivo (0 si no hay dato) */
  diasHelada: number;
}

export class CycleBalance {
  static calcular(crop: Crop, escenario: ClimateScenario): BalanceCiclo {
    let etc = 0;
    let lluvia = 0;
    let diasHelada = 0;
    const helada = crop.datos.helada_letal;

    for (let dia = 0; dia < crop.cicloDias; dia++) {
      const mes = EnvironmentModel.mesActual(crop.datos.mes_siembra, dia);
      const clima = EnvironmentModel.diario(escenario.mes(mes));
      etc += crop.kc(dia) * clima.et0;
      lluvia += clima.lluvia;
      if (helada !== null && clima.tmin <= helada) diasHelada++;
    }

    return {
      escenario: escenario.nombre,
      cultivo: crop.nombre,
      etc,
      lluvia,
      balance: lluvia - etc,
      diasHelada,
    };
  }
}
