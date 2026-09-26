/**
 * State → Visual de los surcos y del agua libre: dónde van los lomos, en qué dirección y
 * hasta dónde llega el agua. Funciones puras (testeables en node).
 *
 * Una celda arada tiene 3 lomos paralelos (en −1/3, 0, +1/3 del ancho) y 2 surcos
 * interiores (en ±1/6) donde se acumula el agua de lluvia o de la inundación.
 */
import type { TileNode } from '@/domain/grid';
import { ALMACEN_SUPERFICIE, tieneSurcos } from '@/domain/hydrology';
import { ALTURA_LOMO } from '@/scene/tiles';

/** Posición transversal de los lomos y de los surcos (fracción del lado de la celda). */
export const LOMOS = [-1 / 3, 0, 1 / 3] as const;
export const SURCOS = [-1 / 6, 1 / 6] as const;

export const MEDIDAS = {
  /** Largo del lomo y de la lámina de agua (deja el hueco entre celdas) */
  largo: 0.96,
  /** Ancho del lomo en la base */
  anchoLomo: 0.24,
  /** Ancho de la lámina de agua dentro del surco */
  anchoSurco: 0.12,
  /** Charco sobre terreno sin surcos */
  charco: 0.88,
  alturaCharcoMax: 0.035,
} as const;

/** Agua libre mínima (mm) para dibujarla. */
export const AGUA_VISIBLE_MM = 0.5;

/** 0–1: nivel del agua en los surcos respecto a su capacidad. */
export const nivelSurco = (t: TileNode): number => Math.min(1, t.aguaSuperficie / ALMACEN_SUPERFICIE.surcos);

/** Altura (m) de la lámina de agua sobre la cara superior del bloque. */
export function alturaAgua(t: TileNode): number {
  if (t.aguaSuperficie < AGUA_VISIBLE_MM) return 0;
  if (tieneSurcos(t)) return Math.max(0.006, nivelSurco(t) * ALTURA_LOMO);
  return Math.min(MEDIDAS.alturaCharcoMax, 0.006 + (t.aguaSuperficie / ALMACEN_SUPERFICIE.plano) * 0.02);
}

/** Desplazamiento (dx, dz) de una franja transversal según la orientación de los surcos. */
export function desplazamiento(t: TileNode, offset: number): { dx: number; dz: number } {
  return t.surcos === 'z' ? { dx: offset, dz: 0 } : { dx: 0, dz: offset };
}
