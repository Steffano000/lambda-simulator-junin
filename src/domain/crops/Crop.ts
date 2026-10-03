/**
 * Paso 04 · Entidad de cultivo: envuelve un registro de data/cultivos.json con su
 * comportamiento (etapas, Kc, compatibilidad de textura, requisitos y zonificación).
 */
import type { ClimaMes, Cultivo } from '@/data/types';
import type { TileNode } from '../grid';
import type { Textura } from '../terrain/TerrainProfile';
import { RequirementFactory, umbralHumedad, type Requirement } from './requirements';

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

export interface Faltante {
  requisito: Requirement;
  motivo: string;
}

export class Crop {
  readonly requisitos: readonly Requirement[];

  constructor(readonly datos: Readonly<Cultivo>) {
    this.requisitos = RequirementFactory.forCrop(datos);
  }

  get nombre(): string {
    return this.datos.nombre;
  }

  get cicloDias(): number {
    return this.datos.ciclo_dias;
  }

  get umbralHumedad(): number {
    return umbralHumedad(this.datos);
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

  /** Curva Kc diaria piecewise lineal FAO-56 (docs/04 · 1a). */
  kc(dias: number): number {
    const d = this.datos;
    const finDesarrollo = d.dias_inicial + d.dias_desarrollo;
    if (dias < d.dias_inicial) return d.kc_inicial;
    if (dias < finDesarrollo) {
      return d.kc_inicial + ((dias - d.dias_inicial) / d.dias_desarrollo) * (d.kc_medio - d.kc_inicial);
    }
    if (dias < this.inicioFinal) return d.kc_medio;
    const t = Math.min(1, (dias - this.inicioFinal) / d.dias_final);
    return d.kc_medio + t * (d.kc_final - d.kc_medio);
  }

  estaMaduro(dias: number): boolean {
    return dias >= this.inicioFinal;
  }

  /** Rendimiento de referencia en kg por celda de 1 m² (t/ha × 0.1). */
  get rendimientoRefKgM2(): number {
    return this.datos.rendimiento_junin_2025 * 0.1;
  }

  /**
   * Rendimiento de referencia (kg/m²) en una celda concreta: en una parcela real de Junín es el
   * del motor de Junín para esa celda (mismo número que el panel del mapa); si no, Junín 2025.
   */
  rendimientoRefKgM2En(tile: Pick<TileNode, 'rendJuninTHa'>): number {
    const tHa = tile.rendJuninTHa?.[this.nombre];
    return tHa != null ? tHa * 0.1 : this.rendimientoRefKgM2;
  }

  /** De dónde sale la referencia de esa celda */
  fuenteRendimiento(tile: Pick<TileNode, 'rendJuninTHa'>): string {
    return tile.rendJuninTHa?.[this.nombre] != null ? 'motor de Junín (parcela real)' : 'Junín 2025';
  }

  /** `textura_preferida`: "sin dato" o vacía = acepta cualquier textura. */
  texturaCompatible(textura: Textura): boolean {
    const pref = this.datos.textura_preferida.toLowerCase();
    if (!/ligera|media|pesada/.test(pref)) return true;
    return pref.includes(textura);
  }

  /** Requisitos de la celda que no se cumplen (vacío = lista para sembrar). */
  faltantes(tile: TileNode): Faltante[] {
    const out: Faltante[] = [];
    for (const requisito of this.requisitos) {
      const motivo = requisito.check(tile);
      if (motivo) out.push({ requisito, motivo });
    }
    return out;
  }

  /** Motivos que impiden sembrar solo por calendario (sin mirar la celda). */
  motivosCalendario(mes: number): string[] {
    return mes === this.datos.mes_siembra
      ? []
      : [`${this.nombre} se siembra en ${MESES[this.datos.mes_siembra - 1]}, no en ${MESES[mes - 1]}.`];
  }

  /** Motivos del clima del mes, válidos para cualquier celda. Sin dato → la regla no aplica. */
  motivosClima(clima: ClimaMes): string[] {
    const d = this.datos;
    const motivos: string[] = [];
    if (d.t_base !== null && clima.tmed < d.t_base) {
      motivos.push(`Temperatura media ${clima.tmed} °C bajo la base de ${this.nombre} (${d.t_base} °C).`);
    }
    if (d.helada_letal !== null && clima.tmin <= d.helada_letal) {
      motivos.push(`Riesgo de helada: tmin ${clima.tmin} °C ≤ ${d.helada_letal} °C.`);
    }
    return motivos;
  }

  /** Zonificación completa (EP-03.2): calendario + clima + requisitos de la celda. */
  motivosBloqueo({ tile, mes, clima }: ContextoSiembra): string[] {
    return [
      ...this.motivosCalendario(mes),
      ...this.motivosClima(clima),
      ...this.faltantes(tile).map((f) => f.motivo),
    ];
  }
}
