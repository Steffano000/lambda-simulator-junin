/**
 * State → Visual de la celda (design.md §4): transformación declarativa y única
 * estado_celda → visual_celda. Funciones puras, sin Three.js ni React, reutilizables por
 * la grilla, los surcos, los cultivos y las marcas (y testeables en node).
 */
import { container } from '@/app/container';
import type { TileNode } from '@/domain/grid';
import { estadoHidrico, tieneSurcos, type EstadoHidrico } from '@/domain/hydrology';
import type { Overlay } from '@/store/useSimStore';
import { chiColor, humidityColor, phColor, soilColor } from '@/theme/ramps';
import { hidratacion, surface } from '@/theme/tokens';

/** Alturas visibles del bloque de terreno, en metros (el cubo mide 1 m). */
export const ALTURA_BLOQUE = {
  /** Terreno sin trabajar: bloque completo. */
  baldio: 1,
  /** Con surcos: el bloque trabajado baja un poco y se lee el trabajo del suelo. */
  trabajado: 0.94,
  /** El canal se hunde para que se vea el recorrido del agua. */
  canal: 0.8,
} as const;

/** Alto de los lomos (montículos) del arado sobre la cara superior del bloque. */
export const ALTURA_LOMO = 0.09;

/** Estado hídrico de la celda (null para canales o suelos sin datos). */
export function estadoHidricoCelda(tile: TileNode): EstadoHidrico | null {
  if (tile.canal) return null;
  const props = container.hidraulica(tile.suelo.clase);
  return props ? estadoHidrico(tile.humedad, tile.aguaSuperficie, props.saturacionPct) : null;
}

export function tileColor(tile: TileNode, overlay: Overlay): string {
  if (tile.bloqueado) return tile.bloqueado.color;
  if (tile.canal) return surface.agua;
  switch (overlay) {
    case 'humedad':
      return humidityColor(tile.humedad);
    case 'hidratacion': {
      const estado = estadoHidricoCelda(tile);
      return estado ? hidratacion[estado] : surface.vacio;
    }
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
  if (tile.canal) return ALTURA_BLOQUE.canal;
  return tile.estado === 'baldio' ? ALTURA_BLOQUE.baldio : ALTURA_BLOQUE.trabajado;
}

/** Alto de los lomos si la celda tiene surcos activos. */
export const lomoHeight = (tile: TileNode): number => (tieneSurcos(tile) ? ALTURA_LOMO : 0);
