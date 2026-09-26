/**
 * State → Visual (design.md §4): transformación declarativa y única estado_celda → visual_celda.
 */
import type { TileNode } from '@/domain/grid';
import type { Overlay } from '@/store/useSimStore';
import { chiColor, humidityColor, phColor, soilColor } from '@/theme/ramps';
import { surface } from '@/theme/tokens';

export function tileColor(tile: TileNode, overlay: Overlay): string {
  if (tile.canal) return surface.agua;
  switch (overlay) {
    case 'humedad':
      return humidityColor(tile.humedad);
    case 'ph':
      return phColor(tile.suelo.ph);
    case 'salud':
      // Sin cultivo: gris neutro para que solo resalten las plantaciones
      return tile.vegetacionId ? chiColor(tile.salud) : surface.vacio;
    case 'suelo':
    default:
      return soilColor(tile.suelo.clase);
  }
}

/** Altura visible del bloque: el suelo trabajado baja un poco (surcos) y el canal se hunde. */
export function tileHeight(tile: TileNode): number {
  if (tile.canal) return 0.8;
  return tile.estado === 'baldio' ? 1 : 0.94;
}
