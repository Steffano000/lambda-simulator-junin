/**
 * Marcas sobre la cara superior: celdas seleccionadas (blanco) y celdas que no cumplen
 * los requisitos del cultivo (rojo). Placas finas instanciadas, sin raycast: el puntero
 * lo lleva la grilla.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { TileNode } from '@/domain/grid';
import { InstanceField, getMaterial } from '@/scene/render';
import { tileCenter, tileSurfaceY, type GridOffset } from '@/scene/tiles';
import { ELEVACION_MARCA, ESCALA_MARCA, MARCO, MATERIAL_POR_MARCA, type TipoMarca } from './markerVisual';

/** Anillo cuadrado horizontal, una sola geometría para los dos tipos de marca. */
const MARCA = new THREE.RingGeometry(MARCO.interior, MARCO.exterior, MARCO.lados, 1, Math.PI / 4).rotateX(
  -Math.PI / 2,
);

export interface SelectionLayerProps {
  tiles: readonly TileNode[];
  offset: GridOffset;
  ids: ReadonlySet<string>;
  tipo: TipoMarca;
}

export function SelectionLayer({ tiles, offset, ids, tipo }: SelectionLayerProps) {
  const marcadas = useMemo(() => tiles.filter((t) => ids.has(t.id)), [tiles, ids]);
  const escala = ESCALA_MARCA[tipo] * Math.SQRT2;

  return (
    <InstanceField
      geometry={MARCA}
      material={getMaterial(MATERIAL_POR_MARCA[tipo])}
      items={marcadas}
      // Capacidad = celdas de la grilla: marcar o desmarcar no remonta la malla.
      capacity={tiles.length}
      deps={[escala]}
      place={(batch, tile, i) => {
        const { x, z } = tileCenter(tile, offset);
        batch.placeScaled(i, x, tileSurfaceY(tile) + ELEVACION_MARCA, z, escala);
      }}
    />
  );
}
