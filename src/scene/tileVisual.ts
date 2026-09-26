/**
 * State → Visual (design.md §4): transformación declarativa y única estado_celda → color.
 */
import type { TileNode } from '@/domain/grid';
import type { Overlay } from '@/store/useSimStore';
import { humidityColor, phColor, soilColor } from '@/theme/ramps';

export function tileColor(tile: TileNode, overlay: Overlay): string {
  switch (overlay) {
    case 'humedad':
      return humidityColor(tile.humedad);
    case 'ph':
      return phColor(tile.suelo.ph);
    case 'suelo':
    default:
      return soilColor(tile.suelo.clase);
  }
}
