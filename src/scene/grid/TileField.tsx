/**
 * Modelo 3D del bloque de terreno: una malla instanciada, un cubo por celda.
 * Color = overlay activo (src/scene/tiles/tileVisual) y altura = relieve + estado del
 * suelo. Es la única capa con puntero: el clic y el arrastre salen de aquí.
 */
import * as THREE from 'three';
import type { TileNode } from '@/domain/grid';
import type { Overlay } from '@/store/useSimStore';
import { BLOQUE_GAP, InstanceField, TILE_SIZE, getMaterial } from '@/scene/render';
import { tileCenter, tileColor, tileHeight, type GridOffset } from '@/scene/tiles';
import type { TilePicking } from './useTilePicking';

/** Cubo de 1 m³ con el pivote en el centro: la altura se escala desde la base. */
const BLOQUE = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);

export interface TileFieldProps extends TilePicking {
  tiles: readonly TileNode[];
  offset: GridOffset;
  overlay: Overlay;
}

export function TileField({ tiles, offset, overlay, ...pointer }: TileFieldProps) {
  return (
    <InstanceField
      geometry={BLOQUE}
      material={getMaterial('terreno')}
      items={tiles}
      interactive
      deps={[overlay]}
      place={(batch, tile, i) => {
        const { x, z } = tileCenter(tile, offset);
        const h = tileHeight(tile);
        // El bloque se apoya en su relieve: el centro queda a media altura.
        batch.place(i, x, tile.elevacion + h / 2, z, BLOQUE_GAP, h);
      }}
      paint={(tile) => tileColor(tile, overlay)}
      {...pointer}
    />
  );
}
