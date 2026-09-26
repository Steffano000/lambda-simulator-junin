/**
 * Paso 01/04 · Cultivos sobre la grilla: una sola malla instanciada (primitiva low-poly),
 * color = etapa fenológica y altura creciente con la etapa. Sustituible por los .glb
 * del assetRegistry cuando existan.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { container } from '@/app/container';
import type { EtapaVisual } from '@/domain/crops';
import type { TileNode } from '@/domain/grid';
import { stageColor } from '@/theme/ramps';
import { surface } from '@/theme/tokens';
import { getMaterial } from './factories/materialFactory';
import { tileHeight } from './tileVisual';

const cone = new THREE.ConeGeometry(0.28, 1, 6).translate(0, 0.5, 0);
const dummy = new THREE.Object3D();
const color = new THREE.Color();

const ALTURA: Record<EtapaVisual, number> = {
  siembra: 0.12,
  germinacion: 0.25,
  desarrollo: 0.45,
  media: 0.7,
  final: 0.8,
  cosecha: 0.8,
};

interface Props {
  tiles: TileNode[];
  offset: { x: number; z: number };
}

export function PlantsLayer({ tiles, offset }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const plantadas = useMemo(() => tiles.filter((t) => t.vegetacionId !== null), [tiles]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    plantadas.forEach((tile, i) => {
      const crop = container.crops.find(tile.vegetacionId);
      const etapa = crop ? crop.etapaEn(tile.diasCultivo) : 'siembra';
      const muerta = tile.salud <= 0;
      const h = muerta ? 0.15 : ALTURA[etapa];
      dummy.position.set(
        tile.coords.x - offset.x,
        tile.elevacion + tileHeight(tile),
        tile.coords.z - offset.z,
      );
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(muerta ? surface.roca : stageColor(etapa)));
    });
    mesh.count = plantadas.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plantadas, offset]);

  // Capacidad = total de celdas; `count` limita lo dibujado. Sin raycast: el clic va al bloque.
  return (
    <instancedMesh
      key={tiles.length}
      ref={ref}
      args={[cone, getMaterial('planta'), Math.max(tiles.length, 1)]}
      raycast={() => null}
    />
  );
}
