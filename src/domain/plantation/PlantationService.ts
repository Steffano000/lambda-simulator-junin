/**
 * Plantaciones: un grupo de celdas sembradas con el mismo cultivo en el mismo día.
 * Resume su estado, registra su evolución y explica qué condiciones la afectan.
 */
import type { ClimaDia } from '../climate';
import type { Crop, EtapaVisual } from '../crops';
import type { TileNode } from '../grid';
import { chiEstado, type ChiEstado, type HealthModel, type StressEffect } from '../stress';
import type { Textura } from '../terrain';

export interface PuntoHistorial {
  dia: number;
  salud: number;
  humedad: number;
  vivas: number;
}

export interface Plantacion {
  id: string;
  cultivo: string;
  diaSiembra: number;
  tileIds: string[];
  historial: PuntoHistorial[];
  cosechadoKg: number;
}

export interface ResumenPlantacion {
  /** Celdas que aún tienen el cultivo */
  activas: number;
  vivas: number;
  muertas: number;
  maduras: number;
  saludMedia: number;
  humedadMedia: number;
  estado: ChiEstado;
  etapa: EtapaVisual;
  dias: number;
}

export interface Condicion {
  tipo: 'favorable' | 'riesgo' | 'neutral';
  texto: string;
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export class PlantationService {
  private contador = 0;

  constructor(private readonly health: HealthModel) {}

  crear(cultivo: string, tileIds: string[], dia: number, tiles: ReadonlyMap<string, TileNode>): Plantacion {
    const p: Plantacion = {
      id: `P${++this.contador}`,
      cultivo,
      diaSiembra: dia,
      tileIds,
      historial: [],
      cosechadoKg: 0,
    };
    return this.registrar(p, tiles, dia);
  }

  /** Celdas de la plantación que todavía tienen su cultivo. */
  activas(p: Plantacion, tiles: ReadonlyMap<string, TileNode>): TileNode[] {
    return p.tileIds.map((id) => tiles.get(id)).filter((t): t is TileNode => t?.vegetacionId === p.cultivo);
  }

  resumir(
    p: Plantacion,
    tiles: ReadonlyMap<string, TileNode>,
    crop: Crop,
    diaActual: number,
  ): ResumenPlantacion {
    const activas = this.activas(p, tiles);
    const vivas = activas.filter((t) => t.salud > 0);
    const dias = diaActual - p.diaSiembra;
    const saludMedia = media(vivas.map((t) => t.salud));
    return {
      activas: activas.length,
      vivas: vivas.length,
      muertas: activas.length - vivas.length,
      maduras: vivas.filter((t) => t.estado === 'maduro').length,
      saludMedia,
      humedadMedia: media(activas.map((t) => t.humedad)),
      estado: vivas.length ? chiEstado(saludMedia) : 'muerto',
      etapa: crop.etapaEn(dias),
      dias,
    };
  }

  /** Agrega un punto de evolución (tras sembrar o avanzar el tiempo). */
  registrar(p: Plantacion, tiles: ReadonlyMap<string, TileNode>, dia: number): Plantacion {
    const activas = this.activas(p, tiles);
    if (activas.length === 0) return p;
    const vivas = activas.filter((t) => t.salud > 0);
    const punto: PuntoHistorial = {
      dia,
      salud: Math.round(media(vivas.map((t) => t.salud))),
      humedad: Math.round(media(activas.map((t) => t.humedad))),
      vivas: vivas.length,
    };
    const historial =
      p.historial.at(-1)?.dia === dia ? [...p.historial.slice(0, -1), punto] : [...p.historial, punto];
    return { ...p, historial };
  }

  /** Condiciones actuales (positivas y negativas) según el clima del día y el estado medio. */
  condiciones(
    p: Plantacion,
    tiles: ReadonlyMap<string, TileNode>,
    crop: Crop,
    clima: ClimaDia,
    textura: Textura,
  ): Condicion[] {
    const activas = this.activas(p, tiles).filter((t) => t.salud > 0);
    if (activas.length === 0) return [];
    const humedad = media(activas.map((t) => t.humedad));
    const efectos: StressEffect[] = this.health.efectos(
      { tmed: clima.tmed, tmin: clima.tmin, humedad, umbralHumedad: crop.umbralHumedad, textura },
      crop.datos,
    );
    const out: Condicion[] = efectos.map((e) => ({ tipo: 'riesgo', texto: e.descripcion }));

    const diasMedios = Math.round(media(activas.map((t) => t.diasCultivo)));
    const etc = crop.kc(diasMedios) * clima.et0;
    const balance = clima.lluvia - etc;
    out.push({
      tipo: balance >= 0 ? 'favorable' : 'riesgo',
      texto: `Consumo ETc ${etc.toFixed(1)} mm/día (Kc ${crop.kc(diasMedios).toFixed(2)}) vs lluvia ${clima.lluvia.toFixed(1)} mm/día.`,
    });

    if (clima.tmed < crop.datos.t_opt_min) {
      out.push({
        tipo: 'neutral',
        texto: `Temperatura ${clima.tmed} °C bajo el óptimo (${crop.datos.t_opt_min}–${crop.datos.t_opt_max} °C), típico de la sierra.`,
      });
    }
    if (efectos.length === 0)
      out.push({ tipo: 'favorable', texto: 'Sin estrés: la salud se recupera cada día.' });
    return out;
  }
}
