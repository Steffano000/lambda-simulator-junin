/**
 * Paso 04 · Entidad de cultivo: envuelve un registro de data/cultivos.json con su
 * comportamiento (etapa por días, madurez, zonificación de siembra EP-03.2).
 */
import type { ClimaMes, Cultivo } from '@/data/types';
import type { TileNode } from '../grid';

/** Etapas visibles (design.md §3): coinciden con las claves `etapa` de la paleta. */
export type EtapaVisual = 'siembra' | 'germinacion' | 'desarrollo' | 'media' | 'final' | 'cosecha';

export const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

export interface ContextoSiembra {
  tile: TileNode;
  /** Mes calendario actual (1–12) */
  mes: number;
  /** Clima del mes actual en el escenario activo */
  clima: ClimaMes;
}

export class Crop {
  constructor(readonly datos: Readonly<Cultivo>) {}

  get nombre(): string {
    return this.datos.nombre;
  }

  get cicloDias(): number {
    return this.datos.ciclo_dias;
  }

  /** Día en que empieza la etapa Final (a partir de ahí se puede cosechar). */
  get inicioFinal(): number {
    const d = this.datos;
    return d.dias_inicial + d.dias_desarrollo + d.dias_media;
  }

  /** Etapa del día acumulando días contra dias_inicial/desarrollo/media/final (docs/04 · 1b). */
  etapaEn(dias: number): EtapaVisual {
    const d = this.datos;
    if (dias <= 0) return 'siembra';
    if (dias < d.dias_inicial) return 'germinacion';
    if (dias < d.dias_inicial + d.dias_desarrollo) return 'desarrollo';
    if (dias < this.inicioFinal) return 'media';
    if (dias < d.ciclo_dias) return 'final';
    return 'cosecha';
  }

  estaMaduro(dias: number): boolean {
    return dias >= this.inicioFinal;
  }

  /** Rendimiento de referencia en kg por celda de 1 m² (t/ha × 0.1). */
  get rendimientoRefKgM2(): number {
    return this.datos.rendimiento_junin_2025 * 0.1;
  }

  /** Motivos que impiden sembrar solo por calendario (sin mirar la celda). */
  motivosCalendario(mes: number): string[] {
    return mes === this.datos.mes_siembra
      ? []
      : [`${this.nombre} se siembra en ${MESES[this.datos.mes_siembra - 1]}, no en ${MESES[mes - 1]}.`];
  }

  /**
   * Zonificación (EP-03.2): lista vacía = se puede sembrar.
   * - Mes de siembra = `mes_siembra`.
   * - pH de la celda dentro de [ph_opt_min, ph_opt_max].
   * - Clima del mes: tmed ≥ t_base (hay crecimiento) y tmin > helada_letal (sin helada letal).
   */
  motivosBloqueo({ tile, mes, clima }: ContextoSiembra): string[] {
    return [...this.motivosCalendario(mes), ...this.motivosClima(clima), ...this.motivosSuelo(tile)];
  }

  /** Motivos del clima del mes, válidos para cualquier celda. */
  motivosClima(clima: ClimaMes): string[] {
    const d = this.datos;
    const motivos: string[] = [];
    if (clima.tmed < d.t_base) {
      motivos.push(`Temperatura media ${clima.tmed} °C bajo la base de ${this.nombre} (${d.t_base} °C).`);
    }
    if (clima.tmin <= d.helada_letal) {
      motivos.push(`Riesgo de helada: tmin ${clima.tmin} °C ≤ ${d.helada_letal} °C.`);
    }
    return motivos;
  }

  motivosSuelo(tile: TileNode): string[] {
    const d = this.datos;
    const ph = tile.suelo.ph;
    return ph < d.ph_opt_min || ph > d.ph_opt_max
      ? [`pH ${ph.toFixed(1)} fuera del óptimo de ${this.nombre} (${d.ph_opt_min}–${d.ph_opt_max}).`]
      : [];
  }
}
