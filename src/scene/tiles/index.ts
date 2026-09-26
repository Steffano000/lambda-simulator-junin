/**
 * Contrato visual de la celda: color y altura del bloque, lomos del arado y su colocación
 * en el mundo. Es la pieza que comparten la grilla, los surcos, los cultivos y las marcas.
 */
export {
  ALTURA_BLOQUE,
  ALTURA_LOMO,
  estadoHidricoCelda,
  lomoHeight,
  tileColor,
  tileHeight,
} from './tileVisual';
export { gridOffset, tileBaseY, tileCenter, tileSurfaceY, tileTopY, type GridOffset } from './placement';
