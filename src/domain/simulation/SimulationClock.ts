/**
 * Reloj de simulación. Cada día:
 *   1. Clima del día (WeatherGenerator): ¿llueve? cantidad, intensidad, duración.
 *   2. Lluvia → mismo balance que el riego: absorción, surcos/charcos, escorrentía.
 *   3. Balance diario: infiltración de superficie, evaporación, ETa = Ks·Kc·ET0, drenaje.
 *   4. Estado hídrico → estrés (déficit, exceso, encharcamiento) → salud y crecimiento.
 * Clase pura: recibe todo por inyección y no guarda estado.
 */
import { EnvironmentModel, WeatherGenerator, type ClimateScenario, type Intensidad } from '../climate';
import { RECUPERACION_DESCANSO, type CropFactory } from '../crops';
import type { TileNode } from '../grid';
import {
  ESTADOS_HIDRICOS,
  WaterBalance,
  estadoHidrico,
  ks,
  sueloDeCelda,
  type EstadoHidrico,
  type PropiedadesHidricas,
} from '../hydrology';
import { HealthModel, type StressId } from '../stress';

/** Ritmo de desarrollo del cultivo según el agua (1 = normal). Provisional. */
export const CRECIMIENTO = {
  encharcado: 0.5,
  exceso: 0.8,
  /** Con déficit el ritmo es Ks, con este mínimo */
  deficitMin: 0.3,
} as const;

export interface AvanceInput {
  tiles: readonly TileNode[];
  dias: number;
  diaInicial: number;
  mesInicio: number;
  escenario: ClimateScenario;
  /** Semilla del terreno: hace reproducible el clima diario */
  seed: number;
  hidraulica: (clase: string) => PropiedadesHidricas | undefined;
}

export interface EventoRegistrado {
  dia: number;
  mm: number;
  intensidad: Intensidad;
  duracionH: number;
}

export interface ResumenAvance {
  desde: number;
  hasta: number;
  lluviaMm: number;
  eventos: EventoRegistrado[];
  et0Mm: number;
  /** Promedios por celda de suelo (mm) */
  infiltradoMm: number;
  escorrentiaMm: number;
  evaporadoMm: number;
  transpiradoMm: number;
  drenadoMm: number;
  humedadAntes: number;
  humedadDespues: number;
  saludAntes: number | null;
  saludDespues: number | null;
  nuevasMaduras: number;
  nuevasMuertas: number;
  /** Días-celda afectados por cada estrés */
  estres: Partial<Record<StressId, number>>;
  /** Celdas por estado hídrico al terminar */
  estados: Record<EstadoHidrico, number>;
}

const promedio = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export class SimulationClock {
  constructor(
    private readonly crops: CropFactory,
    private readonly health = new HealthModel(),
  ) {}

  /** Barbecho: mientras dura, el suelo recupera N y materia orgánica; al terminar se libera. */
  static descansar(t: TileNode, dia: number): void {
    if (t.descansoHasta === null) return;
    if (dia >= t.descansoHasta) {
      t.descansoHasta = null;
      return;
    }
    t.suelo = {
      ...t.suelo,
      n: +(t.suelo.n + RECUPERACION_DESCANSO.nPorDia).toFixed(1),
      materiaOrganica: +(t.suelo.materiaOrganica + RECUPERACION_DESCANSO.moPorDia).toFixed(2),
    };
  }

  static mesActual(mesInicio: number, dia: number): number {
    return EnvironmentModel.mesActual(mesInicio, dia);
  }

  advance(input: AvanceInput): { tiles: TileNode[]; resumen: ResumenAvance } {
    const { dias, diaInicial, mesInicio, escenario, seed, hidraulica } = input;
    const tiles = input.tiles.map((t) => ({ ...t }));
    const suelo = tiles.filter((t) => !t.canal);
    const cultivadas = () => tiles.filter((t) => t.vegetacionId && t.salud > 0);
    const n = Math.max(suelo.length, 1);

    const r: ResumenAvance = {
      desde: diaInicial,
      hasta: diaInicial + dias,
      lluviaMm: 0,
      eventos: [],
      et0Mm: 0,
      infiltradoMm: 0,
      escorrentiaMm: 0,
      evaporadoMm: 0,
      transpiradoMm: 0,
      drenadoMm: 0,
      humedadAntes: promedio(suelo.map((t) => t.humedad)) ?? 0,
      humedadDespues: 0,
      saludAntes: promedio(cultivadas().map((t) => t.salud)),
      saludDespues: null,
      nuevasMaduras: 0,
      nuevasMuertas: 0,
      estres: {},
      estados: Object.fromEntries(ESTADOS_HIDRICOS.map((e) => [e, 0])) as Record<EstadoHidrico, number>,
    };

    for (let d = diaInicial; d < diaInicial + dias; d++) {
      const clima = WeatherGenerator.generar(escenario, mesInicio, d, seed);
      r.et0Mm += clima.et0;
      if (clima.lluvia) {
        r.lluviaMm += clima.lluvia.mm;
        r.eventos.push({ dia: d, ...clima.lluvia });
      }

      for (const t of suelo) {
        SimulationClock.descansar(t, d);
        const props = hidraulica(t.suelo.clase);
        if (!props) continue;
        const crop = t.salud > 0 ? this.crops.find(t.vegetacionId) : undefined;
        const s = sueloDeCelda(t, props, crop?.datos.raiz_m);
        let agua = { humedad: t.humedad, aguaSuperficie: t.aguaSuperficie };

        // Lluvia: misma entrada que el riego
        if (clima.lluvia) {
          const e = WaterBalance.aplicar(agua, clima.lluvia.mm, clima.lluvia.duracionH, s);
          agua = e.estado;
          r.infiltradoMm += e.infiltrado / n;
          r.escorrentiaMm += e.escorrentia / n;
        }

        const paso = WaterBalance.dia(
          agua,
          clima.et0,
          s,
          crop ? { kc: crop.kc(t.diasCultivo), umbral: crop.umbralHumedad } : undefined,
        );
        r.infiltradoMm += paso.infiltrado / n;
        r.evaporadoMm += paso.evaporado / n;
        r.transpiradoMm += paso.transpirado / n;
        r.drenadoMm += paso.drenado / n;
        t.humedad = paso.estado.humedad;
        t.aguaSuperficie = paso.estado.aguaSuperficie;

        const estado = estadoHidrico(t.humedad, t.aguaSuperficie, props.saturacionPct);
        const encharcado = estado === 'encharcado';

        if (crop) this.vivir(t, crop, clima, estado, r);
        t.diasEncharcado = encharcado ? t.diasEncharcado + 1 : 0;
      }
    }

    for (const t of suelo) {
      t.humedad = +t.humedad.toFixed(1);
      t.aguaSuperficie = +t.aguaSuperficie.toFixed(1);
      const props = hidraulica(t.suelo.clase);
      if (props) r.estados[estadoHidrico(t.humedad, t.aguaSuperficie, props.saturacionPct)]++;
    }
    r.humedadDespues = promedio(suelo.map((t) => t.humedad)) ?? 0;
    r.saludDespues = promedio(cultivadas().map((t) => t.salud));
    return { tiles, resumen: r };
  }

  /** Un día del cultivo: estrés por agua y temperatura → salud; ritmo de desarrollo. */
  private vivir(
    t: TileNode,
    crop: NonNullable<ReturnType<CropFactory['find']>>,
    clima: { tmed: number; tmin: number },
    estado: EstadoHidrico,
    r: ResumenAvance,
  ): void {
    const encharcado = estado === 'encharcado';
    const { salud, efectos } = this.health.step(
      t.salud,
      {
        tmed: clima.tmed,
        tmin: clima.tmin,
        humedad: t.humedad,
        umbralHumedad: crop.umbralHumedad,
        encharcado,
        diasEncharcado: t.diasEncharcado,
      },
      crop.datos,
    );
    for (const e of efectos) r.estres[e.id] = (r.estres[e.id] ?? 0) + 1;
    if (salud <= 0) r.nuevasMuertas++;
    t.salud = salud;

    const ritmo = encharcado
      ? CRECIMIENTO.encharcado
      : estado === 'saturado'
        ? CRECIMIENTO.exceso
        : Math.max(CRECIMIENTO.deficitMin, ks(t.humedad, crop.umbralHumedad));
    t.diasCultivo += ritmo;
    if (t.estado === 'sembrado' && crop.estaMaduro(t.diasCultivo)) {
      t.estado = 'maduro';
      r.nuevasMaduras++;
    }
  }
}
