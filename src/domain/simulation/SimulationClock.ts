/**
 * Reloj de simulación: avanza día a día el balance hídrico de cada celda, la salud (CHI)
 * y la etapa de los cultivos. Clase pura: recibe todo por inyección y no guarda estado.
 *
 * Balance diario: Δmm = lluvia − ETc, con ETc = Kc(día) × ET0 (suelo desnudo: Kc fijo).
 * Δ% humedad = Δmm / (agua útil × profundidad de raíz) × 100.
 */
import type { Terreno } from '@/data/types';
import { EnvironmentModel, type ClimateScenario } from '../climate';
import type { CropFactory } from '../crops';
import type { TileNode } from '../grid';
import { HealthModel, type StressId } from '../stress';
import type { Textura } from '../terrain';

/** Coeficiente de evaporación del suelo sin cultivo (provisional, FAO-56 Ke típico bajo). */
export const KC_SUELO_DESNUDO = 0.3;
/** Profundidad de la capa que se seca sin cultivo (m). */
export const PROFUNDIDAD_SUELO_M = 0.3;

export interface AvanceInput {
  tiles: readonly TileNode[];
  dias: number;
  diaInicial: number;
  mesInicio: number;
  escenario: ClimateScenario;
  textura: Textura;
  soilOf: (clase: string) => Terreno | undefined;
}

export interface ResumenAvance {
  desde: number;
  hasta: number;
  lluviaMm: number;
  et0Mm: number;
  humedadAntes: number;
  humedadDespues: number;
  saludAntes: number | null;
  saludDespues: number | null;
  nuevasMaduras: number;
  nuevasMuertas: number;
  /** Días-celda afectados por cada estrés */
  estres: Partial<Record<StressId, number>>;
}

const promedio = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export class SimulationClock {
  constructor(
    private readonly crops: CropFactory,
    private readonly health = new HealthModel(),
  ) {}

  static mesActual(mesInicio: number, dia: number): number {
    return EnvironmentModel.mesActual(mesInicio, dia);
  }

  advance(input: AvanceInput): { tiles: TileNode[]; resumen: ResumenAvance } {
    const { dias, diaInicial, mesInicio, escenario, textura, soilOf } = input;
    const tiles = input.tiles.map((t) => ({ ...t }));
    const cultivadas = () => tiles.filter((t) => t.vegetacionId && t.salud > 0);
    const suelo = tiles.filter((t) => !t.canal);

    const resumen: ResumenAvance = {
      desde: diaInicial,
      hasta: diaInicial + dias,
      lluviaMm: 0,
      et0Mm: 0,
      humedadAntes: promedio(suelo.map((t) => t.humedad)) ?? 0,
      humedadDespues: 0,
      saludAntes: promedio(cultivadas().map((t) => t.salud)),
      saludDespues: null,
      nuevasMaduras: 0,
      nuevasMuertas: 0,
      estres: {},
    };

    for (let d = 0; d < dias; d++) {
      const mes = EnvironmentModel.mesActual(mesInicio, diaInicial + d);
      const clima = EnvironmentModel.diario(escenario.mes(mes));
      resumen.lluviaMm += clima.lluvia;
      resumen.et0Mm += clima.et0;

      for (const t of tiles) {
        if (t.canal) continue;
        const crop = t.salud > 0 ? this.crops.find(t.vegetacionId) : undefined;

        // Balance hídrico
        const terreno = soilOf(t.suelo.clase);
        if (terreno) {
          const kc = crop ? crop.kc(t.diasCultivo) : KC_SUELO_DESNUDO;
          const profundidad = crop ? crop.datos.raiz_m : PROFUNDIDAD_SUELO_M;
          const deltaMm = clima.lluvia - kc * clima.et0;
          const deltaPct = (deltaMm / (terreno.agua_util_mm_m * profundidad)) * 100;
          t.humedad = Math.min(100, Math.max(0, t.humedad + deltaPct));
        }

        // Salud y crecimiento
        if (!crop) continue;
        const { salud, efectos } = this.health.step(
          t.salud,
          {
            tmed: clima.tmed,
            tmin: clima.tmin,
            humedad: t.humedad,
            umbralHumedad: crop.umbralHumedad,
            textura,
          },
          crop.datos,
        );
        for (const e of efectos) resumen.estres[e.id] = (resumen.estres[e.id] ?? 0) + 1;
        if (salud <= 0) resumen.nuevasMuertas++;
        t.salud = salud;
        t.diasCultivo += 1;
        if (t.estado === 'sembrado' && crop.estaMaduro(t.diasCultivo)) {
          t.estado = 'maduro';
          resumen.nuevasMaduras++;
        }
      }
    }

    for (const t of tiles) t.humedad = Math.round(t.humedad);
    resumen.humedadDespues = promedio(suelo.map((t) => t.humedad)) ?? 0;
    resumen.saludDespues = promedio(cultivadas().map((t) => t.salud));
    return { tiles, resumen };
  }
}
