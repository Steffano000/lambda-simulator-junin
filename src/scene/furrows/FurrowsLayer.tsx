/**
 * Surcos del arado: lomos (montículos de tierra) en la dirección del arado y el agua libre
 * que guardan (lluvia o riego por inundación), más los charcos del terreno sin arar.
 * Los lomos toman el color de la capa activa, como el bloque; el agua usa el material `agua`.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { TileNode } from '@/domain/grid';
import { tieneSurcos } from '@/domain/hydrology';
import type { Overlay } from '@/store/useSimStore';
import { InstanceField, getMaterial } from '@/scene/render';
import { ALTURA_LOMO, tileCenter, tileColor, tileTopY, type GridOffset } from '@/scene/tiles';
import { LOMOS, MEDIDAS, SURCOS, alturaAgua, desplazamiento } from './furrowVisual';

/** Lomo: prisma de perfil trapezoidal (base ancha, cima estrecha), largo 1 en X, alto 1. */
const LOMO = (() => {
  const perfil = new THREE.Shape();
  perfil.moveTo(-0.5, 0);
  perfil.lineTo(0.5, 0);
  perfil.lineTo(0.18, 1);
  perfil.lineTo(-0.18, 1);
  perfil.closePath();
  // El perfil está en el plano XY; se extruye en Z y se gira para que el largo quede en X
  return new THREE.ExtrudeGeometry(perfil, { depth: 1, bevelEnabled: false })
    .translate(0, 0, -0.5)
    .rotateY(Math.PI / 2);
})();

/** Lámina de agua: caja con pivote en la base. */
const LAMINA = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

const GIRO_Z = new THREE.Matrix4().makeRotationY(Math.PI / 2);
const tmp = new THREE.Matrix4();
const escala = new THREE.Matrix4();

interface Franja {
  tile: TileNode;
  offset: number;
}

export interface FurrowsLayerProps {
  tiles: readonly TileNode[];
  offset: GridOffset;
  overlay: Overlay;
}

export function FurrowsLayer({ tiles, offset, overlay }: FurrowsLayerProps) {
  const surcadas = useMemo(() => tiles.filter(tieneSurcos), [tiles]);
  const lomos = useMemo<Franja[]>(
    () => surcadas.flatMap((tile) => LOMOS.map((o) => ({ tile, offset: o }))),
    [surcadas],
  );
  const agua = useMemo<Franja[]>(
    () =>
      tiles
        .filter((t) => !t.canal && alturaAgua(t) > 0)
        .flatMap((tile) =>
          tieneSurcos(tile) ? SURCOS.map((o) => ({ tile, offset: o })) : [{ tile, offset: 0 }],
        ),
    [tiles],
  );

  return (
    <>
      <InstanceField
        geometry={LOMO}
        material={getMaterial('terreno')}
        items={lomos}
        capacity={tiles.length * LOMOS.length}
        deps={[overlay]}
        place={(batch, { tile, offset: o }, i) => {
          const { x, z } = tileCenter(tile, offset);
          const { dx, dz } = desplazamiento(tile, o);
          escala.makeScale(MEDIDAS.largo, ALTURA_LOMO, MEDIDAS.anchoLomo);
          tmp.identity();
          if (tile.surcos === 'z') tmp.multiply(GIRO_Z);
          tmp.multiply(escala).setPosition(x + dx, tileTopY(tile), z + dz);
          batch.placeMatrix(i, tmp);
        }}
        paint={({ tile }) => tileColor(tile, overlay)}
      />
      <InstanceField
        geometry={LAMINA}
        material={getMaterial('agua')}
        items={agua}
        capacity={tiles.length * SURCOS.length}
        place={(batch, { tile, offset: o }, i) => {
          const { x, z } = tileCenter(tile, offset);
          const h = alturaAgua(tile);
          if (!tieneSurcos(tile)) {
            batch.place(i, x, tileTopY(tile), z, MEDIDAS.charco, h, MEDIDAS.charco);
            return;
          }
          const { dx, dz } = desplazamiento(tile, o);
          const [sx, sz] =
            tile.surcos === 'z' ? [MEDIDAS.anchoSurco, MEDIDAS.largo] : [MEDIDAS.largo, MEDIDAS.anchoSurco];
          batch.place(i, x + dx, tileTopY(tile), z + dz, sx, h, sz);
        }}
      />
    </>
  );
}
