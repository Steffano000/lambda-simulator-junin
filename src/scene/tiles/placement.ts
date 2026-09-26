/**
 * Colocación de la celda en el mundo: la grilla se centra en el origen y cada celda se
 * apoya sobre su elevación (relieve del terreno, paso 07).
 *
 * Ejes (design.md §1): X = columnas, Z = filas, Y = altitud.
 */
import type { GridConfig, TileNode } from '@/domain/grid';
import { lomoHeight, tileHeight } from './tileVisual';

/** Desplazamiento que lleva el centro de la grilla al origen. */
export interface GridOffset {
  x: number;
  z: number;
}

export const gridOffset = (config: GridConfig): GridOffset => ({
  x: (config.cols - 1) / 2,
  z: (config.rows - 1) / 2,
});

/** Centro de la celda en el plano, ya compensado el desplazamiento de la grilla. */
export function tileCenter(tile: TileNode, offset: GridOffset): { x: number; z: number } {
  return { x: tile.coords.x - offset.x, z: tile.coords.z - offset.z };
}

/** Y de la base del bloque: el relieve manda (0 = planicie). */
export const tileBaseY = (tile: TileNode): number => tile.elevacion;

/** Y de la cara superior del bloque: fondo de los surcos. */
export const tileTopY = (tile: TileNode): number => tile.elevacion + tileHeight(tile);

/**
 * Y de la superficie visible: cima de los lomos si hay surcos (ahí se apoyan el cultivo
 * y las marcas), o la cara superior si no.
 */
export const tileSurfaceY = (tile: TileNode): number => tileTopY(tile) + lomoHeight(tile);
